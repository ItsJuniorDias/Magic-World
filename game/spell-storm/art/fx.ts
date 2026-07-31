import * as THREE from "three";
import { RENDER } from "../config";
import type { Disposer } from "../engine/Disposer";
import { PALETTE } from "./palette";
import type { PaperKit } from "./paper";

/**
 * Impact feedback: particles and shockwave rings — HD pass.
 *
 * Both are strictly pooled. Allocating a mesh or a geometry when an enemy
 * dies would mean a GC pause in the middle of the exact moment the player is
 * paying most attention to — the one frame where a stutter is unforgivable.
 * Everything here is created once at load and recycled forever.
 *
 * Particles are a single Points draw call with a custom shader, so 900 of
 * them cost the same as one. PointsMaterial can't vary size per particle,
 * which is why the shader is hand-written rather than using the built-in.
 *
 * WHAT HD ADDS
 *
 *   1. RENDER.particlePoolSize bumped in config (260 → 900). More
 *      particles per burst = a burst that reads.
 *   2. A softer, more forgiving falloff in the shader — particles no
 *      longer cut off at a hard edge.
 *   3. TWO rings per shockwave — a bright thin inner and a dimmer wide
 *      outer, so impacts read at two scales.
 *   4. New `spark()` type: heavier, gravity-affected particles used for
 *      dust kicks and boss slams.
 *   5. New `beamTrail()`: a directional trail with velocity carry-over,
 *      so a projectile's tail actually looks like it's chasing the head.
 */

const PARTICLE_VERT = `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vAlpha = alpha;
    vTint = tint;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size;
  }
`;

// Soft round falloff computed from gl_PointCoord — no texture needed, which
// matters because React Native has no canvas to generate one from. HD pass:
// softer edge for a nicer bloom feel.
const PARTICLE_FRAG = `
  precision mediump float;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float dist = dot(d, d);
    if (dist > 0.25) discard;
    // Smoother than the previous version — two-stage smoothstep for a
    // brighter core and a longer soft falloff.
    float core = 1.0 - smoothstep(0.0, 0.08, dist);
    float halo = 1.0 - smoothstep(0.05, 0.25, dist);
    float falloff = core * 0.7 + halo * 0.6;
    gl_FragColor = vec4(vTint, vAlpha * falloff);
  }
`;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  drag: number;
}

export interface Fx {
  root: THREE.Group;
  update(dt: number): void;
  /** Radial burst — enemy deaths, spell impacts. */
  burst(x: number, y: number, count: number, hex: number, speed: number, size?: number): void;
  /** Directional spray — landing dust, wall scuffs. */
  spray(
    x: number,
    y: number,
    count: number,
    hex: number,
    dirX: number,
    dirY: number,
    spread: number,
    speed: number,
  ): void;
  /** A single trail dot, emitted along a projectile's path. */
  trail(x: number, y: number, hex: number, size: number): void;
  /** A heavier trail dot with velocity carry-over. Used for beam weapons. */
  beamTrail(x: number, y: number, vx: number, vy: number, hex: number, size: number): void;
  /** Heavy, gravity-affected sparks. Used for slams and dust kicks. */
  spark(x: number, y: number, count: number, hex: number, spread?: number): void;
  /** Expanding ring — golem slams, boss landings, pickup collection. */
  shockwave(x: number, y: number, hex: number, maxRadius: number, duration: number): void;
}

export function createFx(kit: PaperKit, disposer: Disposer): Fx {
  const root = new THREE.Group();
  root.name = "fx";

  // ---- Particles --------------------------------------------------------
  const MAX = RENDER.particlePoolSize;
  const pool: Particle[] = [];
  for (let i = 0; i < MAX; i++) {
    pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, gravity: 0, drag: 0 });
  }
  let cursor = 0;

  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX * 3);
  const sizes = new Float32Array(MAX);
  const alphas = new Float32Array(MAX);
  const tints = new Float32Array(MAX * 3);
  // Park unused particles far off-screen rather than branching in the shader.
  for (let i = 0; i < MAX; i++) positions[i * 3 + 1] = -9999;
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
  geo.setAttribute("tint", new THREE.BufferAttribute(tints, 3));
  disposer.track(geo);

  const mat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  disposer.track(mat);

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 30;
  root.add(points);

  const scratchColor = new THREE.Color();

  function spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    hex: number,
    gravity: number,
    drag: number,
  ): void {
    const i = cursor;
    cursor = (cursor + 1) % MAX;
    const p = pool[i];
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.gravity = gravity;
    p.drag = drag;
    scratchColor.setHex(hex);
    tints[i * 3] = scratchColor.r;
    tints[i * 3 + 1] = scratchColor.g;
    tints[i * 3 + 2] = scratchColor.b;
  }

  // ---- Shockwaves -------------------------------------------------------
  // HD pass: each shockwave is TWO rings — a bright thin inner and a dim
  // wider outer. Both are pooled independently.
  interface Ring {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    life: number;
    maxLife: number;
    maxRadius: number;
    active: boolean;
    wide: boolean;
  }
  const RING_COUNT = 12;
  const rings: Ring[] = [];
  {
    // Two ring geometries: a thin inner and a wide outer.
    const innerGeo = new THREE.RingGeometry(0.82, 1.0, 40);
    disposer.track(innerGeo);
    const outerGeo = new THREE.RingGeometry(0.6, 1.0, 40);
    disposer.track(outerGeo);
    for (let i = 0; i < RING_COUNT; i++) {
      const wide = i % 2 === 1;
      const material = kit.glowMaterial(PALETTE.arcane, 0);
      const mesh = new THREE.Mesh(wide ? outerGeo : innerGeo, material);
      mesh.visible = false;
      mesh.renderOrder = 29;
      root.add(mesh);
      rings.push({ mesh, material, life: 0, maxLife: 1, maxRadius: 1, active: false, wide });
    }
  }
  let ringCursor = 0;

  return {
    root,

    update(dt) {
      // Particles
      for (let i = 0; i < MAX; i++) {
        const p = pool[i];
        if (p.life <= 0) {
          alphas[i] = 0;
          positions[i * 3 + 1] = -9999;
          continue;
        }
        p.life -= dt;
        if (p.life <= 0) {
          alphas[i] = 0;
          positions[i * 3 + 1] = -9999;
          continue;
        }
        p.vy += p.gravity * dt;
        const damp = Math.max(0, 1 - p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const t = p.life / p.maxLife;
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = 1.2;
        // Shrink and fade together; fading alone leaves ghostly dots.
        sizes[i] = p.size * (0.35 + t * 0.65);
        alphas[i] = t * t;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
      geo.attributes.alpha.needsUpdate = true;
      geo.attributes.tint.needsUpdate = true;

      // Rings — pair loop for inner/outer.
      for (const ring of rings) {
        if (!ring.active) continue;
        ring.life -= dt;
        if (ring.life <= 0) {
          ring.active = false;
          ring.mesh.visible = false;
          continue;
        }
        const t = 1 - ring.life / ring.maxLife;
        // Ease-out: fast expansion that decelerates reads as an impact.
        const eased = 1 - (1 - t) * (1 - t);
        ring.mesh.scale.setScalar(0.15 + eased * ring.maxRadius * (ring.wide ? 1.3 : 1));
        ring.material.opacity = (1 - t) * (ring.wide ? 0.5 : 0.9);
      }
    },

    burst(x, y, count, hex, speed, size = 12) {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const v = speed * (0.45 + Math.random() * 0.75);
        spawn(
          x,
          y,
          Math.cos(angle) * v,
          Math.sin(angle) * v,
          0.42 + Math.random() * 0.4,
          size * (0.6 + Math.random() * 0.9),
          hex,
          -14,
          2.2,
        );
      }

      // Add a smattering of bigger, slower "flash" particles for punch.
      for (let i = 0; i < Math.max(2, Math.floor(count / 5)); i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = speed * 0.2;
        spawn(
          x,
          y,
          Math.cos(angle) * v,
          Math.sin(angle) * v,
          0.22 + Math.random() * 0.14,
          size * (2.0 + Math.random() * 1.0),
          hex,
          -6,
          5.0,
        );
      }
    },

    spray(x, y, count, hex, dirX, dirY, spread, speed) {
      const base = Math.atan2(dirY, dirX);
      for (let i = 0; i < count; i++) {
        const angle = base + (Math.random() - 0.5) * spread;
        const v = speed * (0.5 + Math.random() * 0.7);
        spawn(
          x,
          y,
          Math.cos(angle) * v,
          Math.sin(angle) * v,
          0.32 + Math.random() * 0.34,
          8 + Math.random() * 6,
          hex,
          -10,
          3.4,
        );
      }
    },

    trail(x, y, hex, size) {
      spawn(x, y, 0, 0, 0.22, size, hex, 0, 0);
    },

    beamTrail(x, y, vx, vy, hex, size) {
      // Backward velocity so the trail lags behind the projectile.
      spawn(x, y, -vx * 0.28, -vy * 0.28, 0.28, size * 1.2, hex, 0, 4.5);
    },

    spark(x, y, count, hex, spread = Math.PI * 0.55) {
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread * 2;
        const v = 8 + Math.random() * 14;
        spawn(
          x,
          y,
          Math.cos(angle) * v,
          Math.abs(Math.sin(angle)) * v,
          0.55 + Math.random() * 0.35,
          6 + Math.random() * 4,
          hex,
          -32,
          1.3,
        );
      }
    },

    shockwave(x, y, hex, maxRadius, duration) {
      // Fire two rings: an inner bright one and a wider dim one.
      // Iterate through the pool grabbing two consecutive slots.
      for (let side = 0; side < 2; side++) {
        // Try to find a slot with matching `wide` polarity; fall back to
        // any inactive slot if the pool is under pressure.
        let found: Ring | null = null;
        for (let n = 0; n < RING_COUNT; n++) {
          const idx = (ringCursor + n) % RING_COUNT;
          const r = rings[idx];
          if (!r.active && r.wide === (side === 1)) {
            found = r;
            ringCursor = (idx + 1) % RING_COUNT;
            break;
          }
        }
        if (!found) {
          const idx = ringCursor;
          ringCursor = (ringCursor + 1) % RING_COUNT;
          found = rings[idx];
        }
        found.active = true;
        found.life = duration * (side === 1 ? 1.1 : 1);
        found.maxLife = duration * (side === 1 ? 1.1 : 1);
        found.maxRadius = maxRadius;
        found.material.color.setHex(hex);
        found.material.opacity = side === 1 ? 0.5 : 0.9;
        found.mesh.position.set(x, y, side === 1 ? 1.0 : 1.1);
        found.mesh.scale.setScalar(0.15);
        found.mesh.visible = true;
      }
    },
  };
}
