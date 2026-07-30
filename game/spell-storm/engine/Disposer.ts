import * as THREE from "three";
import type { Disposable } from "../types";

/**
 * Tracks every GPU-backed object the game creates and frees it in one call.
 *
 * Why this exists: three.js does not garbage-collect GPU memory. A geometry
 * or texture that goes out of scope in JS still occupies VRAM until you call
 * .dispose() on it. In a React Native app the user navigates in and out of
 * the game screen repeatedly, so a leak here is not theoretical — it
 * compounds every visit until the OS kills the app.
 *
 * The rule for this codebase: if you `new` a geometry, material, texture or
 * render target, it goes through `track()`. No exceptions.
 */
export class Disposer {
  private resources: Disposable[] = [];
  private disposed = false;

  track<T extends Disposable>(resource: T): T {
    if (this.disposed) {
      // Creating resources after teardown means something outlived the
      // screen — usually a stray timer. Free it immediately and warn.
      console.warn("[spell-storm] resource created after dispose; freeing now");
      resource.dispose();
      return resource;
    }
    this.resources.push(resource);
    return resource;
  }

  /**
   * Walks an Object3D tree and tracks everything hanging off it. Use for
   * loaded GLTF scenes where you didn't construct the resources yourself.
   */
  trackTree(root: THREE.Object3D): THREE.Object3D {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) this.track(mesh.geometry);
      const mat = (mesh as THREE.Mesh).material;
      if (!mat) return;
      const materials = Array.isArray(mat) ? mat : [mat];
      for (const m of materials) {
        this.track(m);
        this.trackMaterialTextures(m);
      }
    });
    return root;
  }

  /** Textures referenced by a material need disposing separately. */
  trackMaterialTextures(material: THREE.Material): void {
    const slots = [
      "map",
      "alphaMap",
      "aoMap",
      "bumpMap",
      "displacementMap",
      "emissiveMap",
      "envMap",
      "lightMap",
      "metalnessMap",
      "normalMap",
      "roughnessMap",
      "specularMap",
    ] as const;
    const anyMat = material as unknown as Record<string, unknown>;
    for (const slot of slots) {
      const tex = anyMat[slot];
      if (tex && tex instanceof THREE.Texture) this.track(tex);
    }
  }

  /**
   * Detaches an object from its parent and frees everything under it.
   * Use for one-off removals during play; the bulk teardown is disposeAll.
   */
  static destroy(obj: THREE.Object3D): void {
    obj.removeFromParent();
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (!mat) return;
      (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
    });
  }

  get size(): number {
    return this.resources.length;
  }

  disposeAll(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const resource of this.resources) {
      try {
        resource.dispose();
      } catch (err) {
        console.warn("[spell-storm] dispose failed", err);
      }
    }
    this.resources.length = 0;
  }
}
