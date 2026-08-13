import { Asset } from "expo-asset";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { SkeletonUtils } from "three-stdlib";
import { ASSET_MODULES, type AssetKey } from "./assetManifest";
import { ASSET_COLORS } from "./assetColors";

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
  // ---- IMPORTANT: React Native texture pathway ---------------------------
  //
  // three-stdlib's GLTFLoader decodes embedded PNG textures via
  // `new Image()` + Blob URL. React Native has neither, so embedded textures
  // never actually populate — they end up as uninitialised WebGL textures
  // that sample to black. On Lambert/Standard materials that means every
  // textured mesh renders solid black regardless of lighting.
  //
  // The fix: drop the texture map entirely and read the PBR base color
  // factor into a MeshBasicMaterial. Basic doesn't need lights and doesn't
  // sample a texture, so the mesh renders in a stable solid colour derived
  // from the source glTF. The KayKit + POLYGON art was already flat-shaded,
  // so the visual hit is small — we lose the intra-mesh colour variation
  // that lived in the texture atlas, and gain guaranteed visibility.
  //
  // If we ever ship a proper RN texture loader (via expo-asset PNG decode
  // into a THREE.DataTexture), flip this back to MeshLambertMaterial with
  // `map: std.map` and everything works.
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const convert = (m: THREE.Material): THREE.Material => {
      const std = m as THREE.MeshStandardMaterial;
      const color = std.color ? std.color.clone() : new THREE.Color(0xffffff);
      const basic = new THREE.MeshBasicMaterial({
        color,
        transparent: std.transparent,
        opacity: std.opacity,
        side: std.side,
      });
      basic.name = m.name;
      // Free the (broken) source texture so it doesn't sit in GPU memory.
      if (std.map) std.map.dispose();
      return basic;
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

/**
 * Overrides the base color on every material under `root` with the
 * hand-picked colour for this asset key. See assetColors.ts for why —
 * summary: RN can't decode the embedded atlas texture, so we swap in a
 * solid colour per asset type instead.
 */
function applyAssetColor(root: THREE.Object3D, key: AssetKey): void {
  const hex = ASSET_COLORS[key];
  if (hex === undefined) return;
  const target = new THREE.Color(hex);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const basic = m as THREE.MeshBasicMaterial;
      if (basic.color) basic.color.copy(target);
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
 * loading screen has something to animate.
 */
export async function loadAll(
  onProgress: (done: number, total: number, label: string) => void,
): Promise<void> {
  const loader = new GLTFLoader();
  const keys = Object.keys(ASSET_MODULES) as AssetKey[];
  // Weapons are loaded by preloadWeapons() into their own cache; skip them here.
  const glbKeys = keys.filter((k) => !k.startsWith("weapon_"));

  let done = 0;
  const total = glbKeys.length;

  for (const key of glbKeys) {
    onProgress(done, total, String(key));
    try {
      const uri = await resolveUri(key);
      const gltf = await loader.loadAsync(uri);
      convertMaterials(gltf.scene);
      applyAssetColor(gltf.scene, key);
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
// Skeleton weapons ship as three self-contained .glb files with the shared
// skeleton_texture atlas embedded in each. Same loading path as everything
// else; the only difference is they land in weaponCache so attachWeapon()
// can clone them onto a hand bone.

const weaponCache = new Map<"blade" | "axe" | "staff", THREE.Group>();

export async function preloadWeapons(): Promise<void> {
  const loader = new GLTFLoader();
  const items: ["blade" | "axe" | "staff", AssetKey][] = [
    ["blade", "weapon_blade"],
    ["axe", "weapon_axe"],
    ["staff", "weapon_staff"],
  ];
  for (const [key, assetKey] of items) {
    try {
      const uri = await resolveUri(assetKey);
      const gltf = await loader.loadAsync(uri);
      convertMaterials(gltf.scene);
      applyAssetColor(gltf.scene, assetKey);
      weaponCache.set(key, gltf.scene as THREE.Group);
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
