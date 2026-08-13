import type * as THREE from "three";

// ---------------------------------------------------------------------------
// Disposer — Spell Storm's resource tracker, kept identical here so anyone
// jumping between the two games doesn't have to relearn the API.
//
// Anything that owns GPU memory (Renderer, BufferGeometry, Material,
// Texture, RenderTarget) registers itself via `.track()`. On unmount we
// call `.disposeAll()` and everything gets released in reverse order.
// ---------------------------------------------------------------------------

interface Disposable {
  dispose(): void;
}

export class Disposer {
  private tracked: Disposable[] = [];

  track<T extends Disposable>(resource: T): T {
    this.tracked.push(resource);
    return resource;
  }

  disposeAll(): void {
    for (let i = this.tracked.length - 1; i >= 0; i--) {
      try {
        this.tracked[i].dispose();
      } catch (err) {
        console.warn("[knight-quest] disposer error", err);
      }
    }
    this.tracked = [];
  }
}

/**
 * Walk a scene and dispose every geometry/material/texture underneath it.
 * Useful before removing a whole subtree.
 */
export function disposeSubtree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      const std = m as THREE.MeshStandardMaterial;
      std.map?.dispose();
      std.normalMap?.dispose();
      std.roughnessMap?.dispose();
      std.metalnessMap?.dispose();
      std.emissiveMap?.dispose();
      m.dispose();
    }
  });
}
