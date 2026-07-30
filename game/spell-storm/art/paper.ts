import * as THREE from "three";
import type { Disposer } from "../engine/Disposer";

/**
 * Every visible object in Spell Storm is a card: a 2D silhouette extruded a
 * few millimetres along Z, with one colour on the face and a darker colour on
 * the extruded wall.
 *
 * ExtrudeGeometry conveniently emits two material groups — index 0 for the
 * front and back caps, index 1 for the side walls — so a two-material array
 * gives us the paper edge for free, with no shader and no second draw call.
 *
 * The camera is tilted a few degrees off-axis (see systems/camera.ts) purely
 * so those side walls catch the eye. Straight-on, an extruded card is
 * indistinguishable from a flat quad.
 */

export interface CardOptions {
  depth?: number;
  bevel?: number;
  /** Render order override; higher draws later (on top). */
  order?: number;
}

const DEFAULT_DEPTH = 0.22;

export class PaperKit {
  private materialCache = new Map<string, THREE.MeshBasicMaterial>();

  constructor(private disposer: Disposer) {}

  // -------------------------------------------------------------------
  // Materials
  // -------------------------------------------------------------------

  /**
   * A shared unlit material. Use for scenery — anything that never changes
   * colour at runtime. Sharing keeps the material count (and therefore the
   * shader-program count) low, which matters a lot on mobile GL.
   */
  material(hex: number, opts?: { transparent?: boolean; opacity?: number }): THREE.MeshBasicMaterial {
    const key = `${hex}|${opts?.transparent ? 1 : 0}|${opts?.opacity ?? 1}`;
    let mat = this.materialCache.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: opts?.transparent ?? false,
        opacity: opts?.opacity ?? 1,
        side: THREE.DoubleSide,
      });
      this.materialCache.set(key, mat);
      this.disposer.track(mat);
    }
    return mat;
  }

  /**
   * A private material instance. Use for anything that flashes, fades or
   * tints per-entity — enemies on hit, pickups blinking out. Sharing would
   * make every slime in the arena flash when one of them is shot.
   */
  uniqueMaterial(hex: number, opts?: { transparent?: boolean; opacity?: number }): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      color: hex,
      transparent: opts?.transparent ?? false,
      opacity: opts?.opacity ?? 1,
      side: THREE.DoubleSide,
    });
    this.disposer.track(mat);
    return mat;
  }

  /**
   * Registers a geometry the caller built themselves. Anything that skips
   * `card()` still has to go through here, or it leaks.
   */
  trackGeometry<T extends THREE.BufferGeometry>(geo: T): T {
    return this.disposer.track(geo);
  }

  /** Additive material for magic, glows and sparks. Never occludes. */
  glowMaterial(hex: number, opacity = 1): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposer.track(mat);
    return mat;
  }

  // -------------------------------------------------------------------
  // Shapes
  // -------------------------------------------------------------------

  /** Rounded rectangle centred on the origin. */
  static roundedRect(width: number, height: number, radius: number): THREE.Shape {
    const w = width / 2;
    const h = height / 2;
    const r = Math.min(radius, w, h);
    const s = new THREE.Shape();
    s.moveTo(-w + r, -h);
    s.lineTo(w - r, -h);
    s.quadraticCurveTo(w, -h, w, -h + r);
    s.lineTo(w, h - r);
    s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h);
    s.quadraticCurveTo(-w, h, -w, h - r);
    s.lineTo(-w, -h + r);
    s.quadraticCurveTo(-w, -h, -w + r, -h);
    return s;
  }

  /** Closed polygon from an explicit point list. */
  static polygon(points: [number, number][]): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
    s.closePath();
    return s;
  }

  /**
   * A wobbly closed blob — slimes, clouds, bushes, the ground silhouette.
   * `seed` makes the wobble deterministic so the same call always produces
   * the same shape (important: a bush must not re-roll between sessions).
   */
  static blob(radius: number, lobes: number, wobble: number, seed: number, squashY = 1): THREE.Shape {
    const s = new THREE.Shape();
    const steps = Math.max(18, lobes * 6);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const noise =
        Math.sin(t * lobes + seed) * 0.6 + Math.sin(t * (lobes * 2 + 1) + seed * 1.7) * 0.4;
      const r = radius * (1 + noise * wobble);
      const x = Math.cos(t) * r;
      const y = Math.sin(t) * r * squashY;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }

  /**
   * A star, used for pickups and the combo burst.
   * `inner` is the ratio of the inner radius to the outer.
   */
  static star(points: number, outer: number, inner: number): THREE.Shape {
    const s = new THREE.Shape();
    const total = points * 2;
    for (let i = 0; i < total; i++) {
      const r = i % 2 === 0 ? outer : outer * inner;
      const a = (i / total) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }

  /** A heart, for the life pickup. Built from two arcs and a point. */
  static heart(size: number): THREE.Shape {
    const s = new THREE.Shape();
    const k = size;
    s.moveTo(0, -k);
    s.bezierCurveTo(-k * 1.5, k * 0.25, -k * 0.75, k * 1.2, 0, k * 0.55);
    s.bezierCurveTo(k * 0.75, k * 1.2, k * 1.5, k * 0.25, 0, -k);
    s.closePath();
    return s;
  }

  // -------------------------------------------------------------------
  // Meshes
  // -------------------------------------------------------------------

  /** Extrudes a shape into a two-tone paper card. */
  card(
    shape: THREE.Shape,
    faceHex: number,
    edgeHex: number,
    opts: CardOptions = {},
  ): THREE.Mesh {
    const depth = opts.depth ?? DEFAULT_DEPTH;
    const bevel = opts.bevel ?? 0;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 1,
      curveSegments: 8,
    });
    // Centre the extrusion on Z so cards rotate about their own middle.
    geo.translate(0, 0, -depth / 2);
    this.disposer.track(geo);

    const mesh = new THREE.Mesh(geo, [this.material(faceHex), this.material(edgeHex)]);
    if (opts.order !== undefined) mesh.renderOrder = opts.order;
    return mesh;
  }

  /** Same as `card`, but with private materials so it can flash or fade. */
  tintableCard(
    shape: THREE.Shape,
    faceHex: number,
    edgeHex: number,
    opts: CardOptions = {},
  ): { mesh: THREE.Mesh; face: THREE.MeshBasicMaterial; edge: THREE.MeshBasicMaterial } {
    const depth = opts.depth ?? DEFAULT_DEPTH;
    const bevel = opts.bevel ?? 0;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 1,
      curveSegments: 8,
    });
    geo.translate(0, 0, -depth / 2);
    this.disposer.track(geo);

    const face = this.uniqueMaterial(faceHex);
    const edge = this.uniqueMaterial(edgeHex);
    const mesh = new THREE.Mesh(geo, [face, edge]);
    if (opts.order !== undefined) mesh.renderOrder = opts.order;
    return { mesh, face, edge };
  }

  /** A flat unlit quad. Used for glows, flashes and the sky. */
  quad(width: number, height: number, material: THREE.Material): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(width, height);
    this.disposer.track(geo);
    return new THREE.Mesh(geo, material);
  }

  /**
   * A soft radial gradient disc, built as geometry with vertex colours rather
   * than as a texture. React Native has no canvas, so the alternative is
   * generating a DataTexture pixel by pixel — this is cheaper to create,
   * cheaper to upload, and scales without blurring.
   */
  glowDisc(radius: number, hex: number, segments = 20): THREE.Mesh {
    const geo = new THREE.CircleGeometry(radius, segments);
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color(hex);
    const pos = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getY(i)) / radius;
      const fade = Math.max(0, 1 - d);
      colors[i * 3] = c.r * fade;
      colors[i * 3 + 1] = c.g * fade;
      colors[i * 3 + 2] = c.b * fade;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.disposer.track(geo);

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposer.track(mat);
    return new THREE.Mesh(geo, mat);
  }
}
