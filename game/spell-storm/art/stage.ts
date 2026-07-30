import * as THREE from "three";
import { ARENA, PLATFORMS } from "../config";
import type { Disposer } from "../engine/Disposer";
import { PALETTE, recede } from "./palette";
import { PaperKit } from "./paper";

/**
 * The arena, built as a stack of parallax cards.
 *
 * Depth ordering, back to front:
 *   z = -14  far hills
 *   z = -9   forest
 *   z = -5   bushes and rocks
 *   z = -0.5 ground and platforms  <- gameplay plane is z = 0
 *   z = +3   grass fringe
 *
 * Parallax factors are deliberately non-linear. Real linear parallax
 * (distance-proportional) looks correct and reads as flat, because the far
 * layers barely move at all. Compressing the range keeps every layer visibly
 * alive while still ranking them correctly by depth.
 */

export interface Stage {
  root: THREE.Group;
  update(cameraX: number, elapsed: number): void;
}

interface ParallaxLayer {
  group: THREE.Group;
  factor: number;
  /** Horizontal repeat distance for wrapping. */
  span: number;
}

/** Deterministic PRNG so the arena is identical every session. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function createStage(kit: PaperKit, disposer: Disposer): Stage {
  const root = new THREE.Group();
  root.name = "stage";
  const layers: ParallaxLayer[] = [];
  const rand = seeded(20260730);

  const worldSpan = ARENA.halfWidth * 2 + 30;

  // ---------------------------------------------------------------------
  // Far hills — one continuous silhouette, no gaps
  // ---------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -14;
    const shape = new THREE.Shape();
    const width = worldSpan * 1.8;
    const steps = 48;
    shape.moveTo(-width / 2, -8);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = -width / 2 + width * t;
      const y =
        3.0 +
        Math.sin(t * 7.1) * 1.9 +
        Math.sin(t * 17.3 + 1.4) * 0.9 +
        Math.sin(t * 3.2 + 0.6) * 1.4;
      shape.lineTo(x, y);
    }
    shape.lineTo(width / 2, -8);
    shape.closePath();
    const face = recede(PALETTE.layerFar, 0.25);
    const hills = kit.card(shape, face, recede(PALETTE.layerFarEdge, 0.25), {
      depth: 0.05,
      order: -80,
    });
    group.add(hills);
    root.add(group);
    layers.push({ group, factor: 0.12, span: width });
  }

  // ---------------------------------------------------------------------
  // Forest — stylised conifer cards
  // ---------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -9;
    const face = recede(PALETTE.layerMid, 0.12);
    const edge = recede(PALETTE.layerMidEdge, 0.12);
    const count = 26;
    for (let i = 0; i < count; i++) {
      const x = -worldSpan + (worldSpan * 2 * i) / count + (rand() - 0.5) * 2.4;
      const scale = 0.75 + rand() * 0.75;
      const tree = buildConifer(kit, face, edge, scale, rand());
      tree.position.set(x, 0, (rand() - 0.5) * 1.2);
      group.add(tree);
    }
    root.add(group);
    layers.push({ group, factor: 0.3, span: worldSpan * 2 });
  }

  // ---------------------------------------------------------------------
  // Bushes and standing stones
  // ---------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -5;
    const face = recede(PALETTE.layerNear, 0.04);
    const edge = PALETTE.layerNearEdge;
    for (let i = 0; i < 18; i++) {
      const x = -worldSpan + (worldSpan * 2 * i) / 18 + (rand() - 0.5) * 3;
      if (rand() < 0.72) {
        const r = 0.7 + rand() * 0.7;
        const bush = kit.card(PaperKit.blob(r, 5, 0.3, i * 5.1, 0.72), face, edge, {
          depth: 0.16,
          order: -60,
        });
        bush.position.set(x, r * 0.5, 0);
        group.add(bush);
      } else {
        const h = 1.6 + rand() * 1.5;
        const stone = kit.card(
          PaperKit.polygon([
            [-0.42, 0],
            [0.42, 0],
            [0.3, h],
            [-0.34, h * 0.94],
          ]),
          face,
          edge,
          { depth: 0.2, order: -60 },
        );
        stone.position.set(x, 0, 0);
        stone.rotation.z = (rand() - 0.5) * 0.12;
        group.add(stone);
      }
    }
    root.add(group);
    layers.push({ group, factor: 0.58, span: worldSpan * 2 });
  }

  // ---------------------------------------------------------------------
  // Ground — the gameplay floor
  // ---------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -0.5;

    const width = worldSpan * 2;
    const depthBelow = 14;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -depthBelow);
    shape.lineTo(width / 2, -depthBelow);
    // A gently undulating top edge, so the floor doesn't read as a ruler.
    // The undulation is purely cosmetic and stays under ARENA.floorY — the
    // collision floor is a flat line, and it must be, or the player would
    // catch on invisible bumps.
    const steps = 60;
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const x = -width / 2 + width * t;
      const y = ARENA.floorY - 0.06 + Math.sin(t * 41) * 0.05 + Math.sin(t * 13.7) * 0.04;
      shape.lineTo(x, y);
    }
    shape.closePath();
    const ground = kit.card(shape, PALETTE.groundFace, PALETTE.groundEdge, {
      depth: 3.2,
      order: -20,
    });
    group.add(ground);

    // The lit lip. A thin bright card sitting on the ground's top edge,
    // catching the sun. This one strip does more for the sense of a light
    // source than any actual light would.
    const lip = kit.card(
      PaperKit.roundedRect(width, 0.16, 0.06),
      PALETTE.groundLip,
      PALETTE.groundLip,
      { depth: 0.06, order: -19 },
    );
    lip.position.set(0, ARENA.floorY + 0.02, 1.7);
    group.add(lip);

    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }

  // ---------------------------------------------------------------------
  // Platforms
  // ---------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -0.4;
    for (const p of PLATFORMS) {
      const w = p.halfW * 2;
      const slab = kit.card(PaperKit.roundedRect(w, 0.62, 0.16), PALETTE.platformFace, PALETTE.platformEdge, {
        depth: 1.5,
        order: -18,
      });
      slab.position.set(p.x, p.y - 0.31, 0);
      group.add(slab);

      const lip = kit.card(PaperKit.roundedRect(w * 0.97, 0.12, 0.05), PALETTE.platformLip, PALETTE.platformLip, {
        depth: 0.05,
        order: -17,
      });
      lip.position.set(p.x, p.y + 0.01, 0.8);
      group.add(lip);

      // Hanging vines, so the slabs don't look like they float arbitrarily.
      for (let i = 0; i < 3; i++) {
        const vx = p.x - p.halfW * 0.6 + (p.halfW * 1.2 * i) / 2;
        const len = 0.5 + ((i * 37) % 10) / 14;
        const vine = kit.card(PaperKit.roundedRect(0.1, len, 0.05), PALETTE.platformEdge, PALETTE.platformEdge, {
          depth: 0.06,
          order: -19,
        });
        vine.position.set(vx, p.y - 0.62 - len / 2, 0.2);
        group.add(vine);
      }
    }
    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }

  // ---------------------------------------------------------------------
  // Foreground grass fringe
  // ---------------------------------------------------------------------
  const grassBlades: { mesh: THREE.Mesh; phase: number; baseRot: number }[] = [];
  {
    const group = new THREE.Group();
    group.position.z = 3;
    const face = 0x1a0d24;
    for (let i = 0; i < 40; i++) {
      const x = -worldSpan + (worldSpan * 2 * i) / 40 + (rand() - 0.5) * 1.6;
      const h = 0.9 + rand() * 1.3;
      const blade = kit.card(
        PaperKit.polygon([
          [-0.11, 0],
          [0.11, 0],
          [0.02, h],
        ]),
        face,
        face,
        { depth: 0.05, order: 40 },
      );
      const baseRot = (rand() - 0.5) * 0.3;
      blade.position.set(x, -0.35, 0);
      blade.rotation.z = baseRot;
      group.add(blade);
      grassBlades.push({ mesh: blade, phase: rand() * Math.PI * 2, baseRot });
    }
    root.add(group);
    layers.push({ group, factor: 1.28, span: worldSpan * 2 });
  }

  void disposer;

  return {
    root,
    update(cameraX, elapsed) {
      for (const layer of layers) {
        if (layer.factor === 1) continue;
        // Offset opposite to the camera, scaled by the layer's depth factor.
        let offset = cameraX * (1 - layer.factor);
        if (layer.span > 0) {
          // Wrap so a finite set of props covers infinite panning.
          offset = ((offset % layer.span) + layer.span) % layer.span;
          if (offset > layer.span / 2) offset -= layer.span;
        }
        layer.group.position.x = offset;
      }

      // Wind. One shared sine with a per-blade phase — 40 blades animated
      // for the cost of 40 float ops.
      for (const blade of grassBlades) {
        blade.mesh.rotation.z = blade.baseRot + Math.sin(elapsed * 1.8 + blade.phase) * 0.13;
      }
    },
  };
}

/** A conifer: three stacked triangle cards on a short trunk. */
function buildConifer(
  kit: PaperKit,
  face: number,
  edge: number,
  scale: number,
  jitter: number,
): THREE.Group {
  const tree = new THREE.Group();
  const trunk = kit.card(PaperKit.roundedRect(0.22, 1.0, 0.06), edge, edge, {
    depth: 0.12,
    order: -70,
  });
  trunk.position.y = 0.5;
  tree.add(trunk);

  for (let tier = 0; tier < 3; tier++) {
    const w = 2.1 - tier * 0.52;
    const h = 1.5 - tier * 0.18;
    const y = 0.95 + tier * 0.95;
    const canopy = kit.card(
      PaperKit.polygon([
        [-w / 2, 0],
        [w / 2, 0],
        [0, h],
      ]),
      face,
      edge,
      { depth: 0.14, order: -70 },
    );
    canopy.position.y = y;
    tree.add(canopy);
  }

  tree.scale.setScalar(scale);
  tree.rotation.z = (jitter - 0.5) * 0.06;
  return tree;
}
