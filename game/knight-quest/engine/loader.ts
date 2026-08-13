import { Asset } from "expo-asset";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { SkeletonUtils } from "three-stdlib";
import { RENDER } from "../config";
import { ASSET_MODULES, type AssetKey } from "./assetManifest";

// ---------------------------------------------------------------------------
// Asset loader — Expo/RN edition.
//
// The web build loads GLBs by URL from a static server. In Expo we go
// through expo-asset: `Asset.fromModule(require(...))` resolves each file
// to a local URI at runtime (bundled in the app, or downloaded from the
// bundler in dev), then three-stdlib's GLTFLoader consumes it.
//
// The .gltf skeleton weapons need their side-car .bin resolved too. We
// pre-download the sibling files so GLTFLoader's XHR-style relative
// lookups find them on disk.
//
// Scale is identical to the web build: POLYGON assets prefixed `poly_`
// get a baked 0.01x wrap because Synty ships in centimetres.
// ---------------------------------------------------------------------------

export interface LoadedAsset {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

const cache = new Map<AssetKey, LoadedAsset>();

function nativeScale(key: string): number {
  return key.startsWith("poly_") ? 0.01 : 1;
}

function convertMaterials(root: THREE.Object3D): void {
  if (!RENDER.useLambert) return;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const convert = (m: THREE.Material): THREE.Material => {
      const std = m as THREE.MeshStandardMaterial;
      const lam = new THREE.MeshLambertMaterial({
        map: std.map ?? null,
        color: std.color ? std.color.clone() : new THREE.Color(0xffffff),
        transparent: std.transparent,
        opacity: std.opacity,
        side: std.side,
      });
      lam.name = m.name;
      return lam;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(convert)
      : convert(mesh.material);
  });
}

function enableShadows(root: THREE.Object3D, cast: boolean, receive: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    if ((mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) {
      mesh.frustumCulled = false;
    }
  });
}

async function resolveUri(key: AssetKey): Promise<string> {
  const asset = Asset.fromModule(ASSET_MODULES[key]);
  if (!asset.localUri) await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

/**
 * Loads every asset in ASSET_MODULES. Progress is reported per file so the
 * loading screen has something to animate. Weapons (.gltf + .bin + .png)
 * are loaded together as one group so partial states never render.
 */
export async function loadAll(
  onProgress: (done: number, total: number, label: string) => void,
): Promise<void> {
  const loader = new GLTFLoader();

  // Every .glb key is a self-contained load.
  const glbKeys: AssetKey[] = Object.keys(ASSET_MODULES).filter((k) =>
    !k.startsWith("weapon_") && k !== "skeleton_texture" && !k.endsWith("_bin"),
  ) as AssetKey[];

  let done = 0;
  const total = glbKeys.length;

  for (const key of glbKeys) {
    onProgress(done, total, String(key));
    try {
      const uri = await resolveUri(key);
      const gltf = await loader.loadAsync(uri);
      convertMaterials(gltf.scene);
      cache.set(key, { scene: gltf.scene as THREE.Group, animations: gltf.animations });
    } catch (err) {
      console.warn(`[knight-quest] failed to load ${key}`, err);
    }
    done++;
  }

  onProgress(total, total, "done");
}

// ---------------------------- weapons ---------------------------------------
//
// The three skeleton weapons live as .gltf + .bin + .png triples. GLTFLoader
// needs the .bin and texture to be reachable via relative URIs from the .gltf.
// We prefetch all three, then read the .gltf as text, rewrite the URIs to
// absolute file paths, and parse with `loader.parse` so the resolver hits
// the local URIs directly.

const weaponCache = new Map<"blade" | "axe" | "staff", THREE.Group>();

export async function preloadWeapons(): Promise<void> {
  const loader = new GLTFLoader();
  const items: [
    "blade" | "axe" | "staff",
    AssetKey,
    AssetKey,
  ][] = [
    ["blade", "weapon_blade", "weapon_blade_bin"],
    ["axe", "weapon_axe", "weapon_axe_bin"],
    ["staff", "weapon_staff", "weapon_staff_bin"],
  ];
  const texUri = await resolveUri("skeleton_texture");
  for (const [key, gltfKey, binKey] of items) {
    const gltfUri = await resolveUri(gltfKey);
    const binUri = await resolveUri(binKey);
    try {
      const text = await (await fetch(gltfUri)).text();
      const patched = text
        .replace(/"Skeleton_[^"]+\.bin"/g, `"${binUri}"`)
        .replace(/"skeleton_texture\.png"/g, `"${texUri}"`);
      // parse with an empty base path — every URI in the JSON is now absolute
      await new Promise<void>((resolve, reject) => {
        loader.parse(
          patched,
          "",
          (gltf) => {
            convertMaterials(gltf.scene);
            weaponCache.set(key, gltf.scene as THREE.Group);
            resolve();
          },
          (err) => reject(err),
        );
      });
    } catch (err) {
      console.warn(`[knight-quest] failed to preload weapon ${key}`, err);
    }
  }
}

export function getAnimations(key: AssetKey): THREE.AnimationClip[] {
  const a = cache.get(key);
  if (!a) throw new Error(`Asset not loaded: ${key}`);
  return a.animations;
}

export interface SpawnOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  scale?: number;
}

export function spawn(key: AssetKey, opts: SpawnOptions = {}): THREE.Group {
  const a = cache.get(key);
  if (!a) throw new Error(`Asset not loaded: ${key}`);
  const inst = SkeletonUtils.clone(a.scene) as THREE.Group;
  enableShadows(inst, opts.castShadow ?? false, opts.receiveShadow ?? false);
  const s = nativeScale(key) * (opts.scale ?? 1);
  if (s !== 1) {
    const wrapper = new THREE.Group();
    wrapper.add(inst);
    wrapper.scale.setScalar(s);
    return wrapper;
  }
  return inst;
}

export function findNode(root: THREE.Object3D, contains: string): THREE.Object3D | null {
  const needle = contains.toLowerCase();
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && o.name.toLowerCase().includes(needle)) found = o;
  });
  return found;
}

/** Attach a preloaded weapon to a skeleton's right-hand slot. */
export function attachWeapon(
  root: THREE.Object3D,
  weapon: "blade" | "axe" | "staff",
  scale = 1,
): void {
  const cached = weaponCache.get(weapon);
  if (!cached) return;
  const slot = findNode(root, "handslot.r");
  if (!slot) return;
  const w = cached.clone(true);
  w.scale.setScalar(scale);
  slot.add(w);
}
