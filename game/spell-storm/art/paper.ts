import * as THREE from "three";
import type { Disposer } from "../engine/Disposer";
import { PALETTE, rim as rimColor, shade as shadeColor } from "./palette";

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
 *
 * v5 HD PASS — new primitives
 *
 *   rimmedCard()   —  card + a slightly brighter, offset "rim" clone behind it
 *                     for fake back-lighting on characters and bosses.
 *   shadowedCard() —  card + a darker, offset shadow clone laid on the ground
 *                     for a cheap contact shadow.
 *   bevelledCard() —  card with a wide bevel, giving the extrusion a rounded
 *                     rather than perpendicular edge — used for hero elements
 *                     like the mage's orb, the sun, the moon.
 *   softStar()     —  star with rounded arms via bezier control points.
 *   filigree()     —  small ornamental filigree curl, for boss crowns and
 *                     stained-glass sky effects.
 *   crescent()     —  moon crescent shape.
 *
 * NONE of these break the paper theatre rule. They still produce two-tone
 * cards; they just stack a few of them to fake the higher-detail passes that
 * a lit engine would do with normals, subsurface and rim shaders.
 */

export interface CardOptions {
  depth?: number;
  bevel?: number;
  /** Render order override; higher draws later (on top). */
  order?: number;
  /** Curve segments for extruded curves. Bump for hero elements. */
  curveSegments?: number;
}

const DEFAULT_DEPTH = 0.22;
const DEFAULT_CURVE_SEGMENTS = 12;

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

  /**
   * A soft dark material for cast shadows on the ground. Multiply-ish look
   * via straight alpha and a dark color; keeps costs down vs a real
   * multiply blend which is unreliable on some mobile GL drivers.
   */
  shadowMaterial(opacity = 0.45): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      color: PALETTE.shadow,
      transparent: true,
      opacity,
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
   *
   * HD pass: bumped the default step count so blob outlines have more curve
   * fidelity. Cheap — this is at build time, not runtime.
   */
  static blob(radius: number, lobes: number, wobble: number, seed: number, squashY = 1): THREE.Shape {
    const s = new THREE.Shape();
    const steps = Math.max(28, lobes * 8);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const noise =
        Math.sin(t * lobes + seed) * 0.6 +
        Math.sin(t * (lobes * 2 + 1) + seed * 1.7) * 0.4 +
        Math.sin(t * (lobes * 3 + 2) + seed * 2.3) * 0.15;
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

  /**
   * A soft-armed star. Each arm is a quadratic curve rather than two straight
   * segments meeting at a point. Reads as a magical burst rather than a flat
   * kids-book star, which suits hero elements and hazard telegraphs.
   */
  static softStar(points: number, outer: number, inner: number): THREE.Shape {
    const s = new THREE.Shape();
    const total = points * 2;
    for (let i = 0; i < total; i++) {
      const r = i % 2 === 0 ? outer : outer * inner;
      const a = (i / total) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else {
        const prevA = ((i - 1) / total) * Math.PI * 2 - Math.PI / 2;
        const midR = (i % 2 === 0 ? inner : 1) * outer * 0.72;
        const midA = (prevA + a) / 2;
        const cx = Math.cos(midA) * midR;
        const cy = Math.sin(midA) * midR;
        s.quadraticCurveTo(cx, cy, x, y);
      }
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

  /** Crescent moon shape (outer disc minus a shifted inner disc). */
  static crescent(radius: number, offset = 0.45): THREE.Shape {
    const outer = new THREE.Shape();
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = Math.cos(t) * radius;
      const y = Math.sin(t) * radius;
      if (i === 0) outer.moveTo(x, y);
      else outer.lineTo(x, y);
    }
    outer.closePath();

    const hole = new THREE.Path();
    const holeR = radius * 0.92;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = Math.cos(t) * holeR + offset * radius;
      const y = Math.sin(t) * holeR;
      if (i === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    hole.closePath();
    outer.holes.push(hole);
    return outer;
  }

  /**
   * An ornamental filigree curl, for boss crowns and stained-glass sky
   * elements. Built from a bezier ribbon.
   */
  static filigree(length: number, thickness = 0.06, curl = 0.8): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(0, -thickness / 2);
    s.bezierCurveTo(length * 0.3, -thickness / 2, length * 0.6, -length * curl * 0.6, length, -length * curl);
    s.lineTo(length + thickness, -length * curl + thickness);
    s.bezierCurveTo(length * 0.7, -length * curl * 0.55 + thickness, length * 0.35, thickness / 2, 0, thickness / 2);
    s.closePath();
    return s;
  }

  /** A teardrop, used for flame licks, orb tails and boss horns. */
  static teardrop(width: number, height: number): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(0, height);
    s.bezierCurveTo(width, height * 0.6, width * 0.7, -height * 0.3, 0, -height * 0.05);
    s.bezierCurveTo(-width * 0.7, -height * 0.3, -width, height * 0.6, 0, height);
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
    const curveSegments = opts.curveSegments ?? DEFAULT_CURVE_SEGMENTS;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: bevel > 0 ? 2 : 1,
      curveSegments,
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
    const curveSegments = opts.curveSegments ?? DEFAULT_CURVE_SEGMENTS;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: bevel > 0 ? 2 : 1,
      curveSegments,
    });
    geo.translate(0, 0, -depth / 2);
    this.disposer.track(geo);

    const face = this.uniqueMaterial(faceHex);
    const edge = this.uniqueMaterial(edgeHex);
    const mesh = new THREE.Mesh(geo, [face, edge]);
    if (opts.order !== undefined) mesh.renderOrder = opts.order;
    return mesh ? { mesh, face, edge } : { mesh, face, edge };
  }

  /**
   * A "rimmed" card: the primary card plus a slightly larger, brighter clone
   * placed a hair behind it. The clone sticks out by a tiny amount around the
   * silhouette and reads as a low sun catching the character from behind. On
   * a phone screen that faked rim is the single biggest source of "these
   * characters feel three-dimensional" without spending a lit shader.
   *
   * Returns the primary mesh; the rim mesh is added as a child so scaling
   * and moving the parent moves both.
   */
  rimmedCard(
    shape: THREE.Shape,
    faceHex: number,
    edgeHex: number,
    opts: CardOptions & { rimHex?: number; rimAmount?: number; rimScale?: number } = {},
  ): THREE.Mesh {
    const primary = this.card(shape, faceHex, edgeHex, opts);
    const rimHex = opts.rimHex ?? rimColor(faceHex, PALETTE.paperRim, opts.rimAmount ?? 0.5);
    const rimScale = opts.rimScale ?? 1.08;
    const rim = this.card(shape, rimHex, rimHex, {
      ...opts,
      depth: (opts.depth ?? DEFAULT_DEPTH) * 0.6,
      order: (opts.order ?? 0) - 1,
    });
    rim.scale.setScalar(rimScale);
    rim.position.z = -0.08;
    primary.add(rim);
    return primary;
  }

  /**
   * A "shadowed" card: the primary card plus a dark, offset clone laid
   * against the ground plane. The offset is what sells it as a cast shadow;
   * a shadow directly under the object reads as a hole in the floor.
   *
   * Returns the primary mesh; the shadow is added as a child positioned
   * downward and slightly to the side.
   */
  shadowedCard(
    shape: THREE.Shape,
    faceHex: number,
    edgeHex: number,
    opts: CardOptions & { shadowOffset?: [number, number]; shadowOpacity?: number } = {},
  ): THREE.Mesh {
    const primary = this.card(shape, faceHex, edgeHex, opts);
    const shadowShape = shape;
    const geo = new THREE.ExtrudeGeometry(shadowShape, {
      depth: 0.02,
      bevelEnabled: false,
      curveSegments: opts.curveSegments ?? DEFAULT_CURVE_SEGMENTS,
    });
    geo.translate(0, 0, -0.01);
    this.disposer.track(geo);
    const shadowMat = this.shadowMaterial(opts.shadowOpacity ?? 0.4);
    const shadow = new THREE.Mesh(geo, shadowMat);
    const [dx, dy] = opts.shadowOffset ?? [0.18, -0.24];
    shadow.position.set(dx, dy, -0.15);
    shadow.scale.set(1.05, 0.4, 1);
    shadow.renderOrder = (opts.order ?? 0) - 2;
    primary.add(shadow);
    return primary;
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
   *
   * HD pass: default segment count bumped from 20 → 32 for smoother glows,
   * with an optional `falloff` exponent (higher = tighter core).
   */
  glowDisc(radius: number, hex: number, segments = 32, falloff = 1): THREE.Mesh {
    const geo = new THREE.CircleGeometry(radius, segments);
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color(hex);
    const pos = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getY(i)) / radius;
      const fade = Math.pow(Math.max(0, 1 - d), falloff);
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

  /**
   * A "godray": a soft angled cone of additive light, used behind the sun
   * and around hero characters mid-cast. Built as a triangle with vertex
   * colours falling off from the base.
   */
  godRay(width: number, length: number, hex: number, opacity = 0.55): THREE.Mesh {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -width / 2, 0, 0,
      width / 2, 0, 0,
      0, length, 0,
    ]);
    const colors = new Float32Array([1, 1, 1, 1, 1, 1, 0, 0, 0]);
    const c = new THREE.Color(hex);
    for (let i = 0; i < 3; i++) {
      colors[i * 3] *= c.r;
      colors[i * 3 + 1] *= c.g;
      colors[i * 3 + 2] *= c.b;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex([0, 1, 2]);
    this.disposer.track(geo);

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposer.track(mat);
    return new THREE.Mesh(geo, mat);
  }

  /**
   * A radial gradient RING, for haloed telegraphs and boss auras. Segment
   * count is higher than the standard shockwave ring so it reads as smooth.
   */
  glowRing(inner: number, outer: number, hex: number, opacity = 0.6, segments = 40): THREE.Mesh {
    const geo = new THREE.RingGeometry(inner, outer, segments);
    this.disposer.track(geo);
    const mat = new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposer.track(mat);
    return new THREE.Mesh(geo, mat);
  }

  // Expose the shade helper on the kit as convenience so callers don't have
  // to import from palette separately for one-off darkenings.
  static shade = shadeColor;
  static rim = rimColor;
}
