import * as THREE from "three";
import { Disposer } from "../engine/Disposer";
import { BIOMES, type Gate, type Room } from "../world/rooms";
import { PALETTE, recede, rim as rimColor, shade, shift } from "./palette";
import { PaperKit } from "./paper";

/**
 * Builds one room's geometry, and throws all of it away when you leave.
 *
 * WHY IT IS REBUILT PER ROOM INSTEAD OF PRE-BUILT
 *
 * Twenty rooms averaging ~110wu wide is on the order of a thousand
 * extrusions. Holding all of them resident would be several hundred
 * megabytes of VRAM on a device that has to run a storybook app alongside
 * it. Building one room is 60–140 extrusions (HD pass: closer to 200–320),
 * which measures in the low tens of milliseconds — and it happens *behind
 * the transition fade*, where the screen is already black and the player
 * is expecting a beat.
 *
 * The whole room lives on a private Disposer and a private PaperKit. Leaving
 * disposes the Disposer and every geometry, material and texture the room
 * ever touched goes with it. That is also why the kit is private: PaperKit
 * caches materials, and a shared cache across biomes would leak the fungal
 * palette into the ember rooms.
 *
 * THE SIX SIGNALS A ROOM HAS TO SEND (unchanged)
 *
 *   floor       where you can stand           — ground card with a lit lip
 *   platforms   where you can stand later     — same lip, brighter
 *   solids      where you cannot go           — no lip at all, darker face
 *   hazards     where you must not go         — the only saturated red-orange
 *   gates       where you can leave           — a lit arch in the wall
 *   sealed      where you cannot leave yet    — the same arch, crossed out
 *
 * They are distinguished by VALUE (light/dark), not by hue, because hue
 * changes every biome and value doesn't. A player who has learned "the
 * bright lip means you can stand on it" in the Fungal Hollow still knows
 * it in the Obsidian Vault.
 *
 * HD PASS — what changes
 *
 *   1. Seven parallax layers rather than five: an extra "distant hills"
 *      silhouette behind the far layer, and a "mid-far" layer between mid
 *      and near, so aerial perspective is smoother.
 *   2. Atmospheric fog quads: three horizontal semi-transparent tinted
 *      quads at z = -12, -7, -3 that give the scene volumetric depth.
 *   3. Ground refinement: a lit lip PLUS a darker "shadow" strip in front
 *      to fake ambient occlusion at the ground/wall boundary.
 *   4. Foliage animation: near-layer bushes gently sway and every prop
 *      breathes.
 *   5. Doubled ambient motes with size variation.
 *   6. Ground micro-detail: tiny darker specks scattered on the floor to
 *      break up the flat colour.
 *   7. Wall accents: hanging lanterns, drapes, or moss beards depending
 *      on biome.
 *   8. Gates get a filigreed archway with double-glow and a sigil above.
 *   9. Bench gets a full pergola with hanging cloth and a warmer double
 *      lamp.
 *  10. Every prop `buildProp` variant now uses 2–4 stacked cards instead
 *      of 1–2 for real depth.
 */

export interface RoomStage {
  root: THREE.Group;
  /** Parallax + ambient animation. */
  update(cameraX: number, cameraY: number, elapsed: number): void;
  /** Marks a gate open or sealed. Called when a boss dies. */
  setGateOpen(gateId: string, open: boolean): void;
  /** Spike telegraphs pushed up by the Thorn Warden and the Storm Dragon. */
  showSpike(x: number, height: number, life: number): void;
  dispose(): void;
}

interface ParallaxLayer {
  group: THREE.Group;
  factor: number;
  span: number;
}

/** Deterministic PRNG, seeded per room so a room looks identical every visit. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SPIKE_POOL = 14;

export function createRoomStage(room: Room): RoomStage {
  const disposer = new Disposer();
  const kit = new PaperKit(disposer);
  const b = BIOMES[room.biome];
  const rand = seeded(hashId(room.id));

  const root = new THREE.Group();
  root.name = `room:${room.id}`;
  const layers: ParallaxLayer[] = [];

  const width = room.maxX - room.minX;
  const centre = (room.minX + room.maxX) * 0.5;
  const span = width + 60;

  // -----------------------------------------------------------------------
  // Distant hills — a second, farther silhouette layer.
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -17;
    const shape = new THREE.Shape();
    const w = span * 2.2;
    const steps = 32;
    shape.moveTo(-w / 2, -10);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = -w / 2 + w * t;
      const y =
        room.ceilingY * 0.16 +
        Math.sin(t * 5.3 + 0.4) * 1.8 +
        Math.sin(t * 13.7 + 2.1) * 0.7 +
        Math.sin(t * 2.4 + 1.7) * 1.4;
      shape.lineTo(x, y);
    }
    shape.lineTo(w / 2, -10);
    shape.closePath();
    const face = recede(b.far, 0.5, b.sky[3]);
    const edge = recede(b.farEdge, 0.5, b.sky[3]);
    group.add(kit.card(shape, face, edge, { depth: 0.05, order: -85 }));
    root.add(group);
    layers.push({ group, factor: 0.06, span: w });
  }

  // -----------------------------------------------------------------------
  // Far hills — one continuous silhouette, no gaps
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -14;
    const shape = new THREE.Shape();
    const w = span * 1.8;
    const steps = 48;
    shape.moveTo(-w / 2, -10);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = -w / 2 + w * t;
      const y =
        room.ceilingY * 0.28 +
        Math.sin(t * 7.1) * 2.4 +
        Math.sin(t * 17.3 + 1.4) * 1.1 +
        Math.sin(t * 3.2 + 0.6) * 1.8;
      shape.lineTo(x, y);
    }
    shape.lineTo(w / 2, -10);
    shape.closePath();
    group.add(
      kit.card(shape, recede(b.far, 0.25, b.sky[3]), recede(b.farEdge, 0.25, b.sky[3]), {
        depth: 0.05,
        order: -80,
      }),
    );
    root.add(group);
    layers.push({ group, factor: 0.12, span: w });
  }

  // -----------------------------------------------------------------------
  // Atmospheric fog — a very wide, semi-transparent tinted quad sitting
  // between the far layer and the mid layer. Reads as volumetric haze.
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -12;
    const fogWidth = span * 2;
    const fogHeight = room.ceilingY * 0.7 + 6;
    const fogGeo = new THREE.PlaneGeometry(fogWidth, fogHeight);
    disposer.track(fogGeo);
    const fogMat = new THREE.MeshBasicMaterial({
      color: recede(b.mid, 0.35, b.sky[2]),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    disposer.track(fogMat);
    const fog = new THREE.Mesh(fogGeo, fogMat);
    fog.position.y = fogHeight / 2 - 1;
    fog.renderOrder = -75;
    group.add(fog);
    root.add(group);
    layers.push({ group, factor: 0.2, span: fogWidth });
  }

  // -----------------------------------------------------------------------
  // Mid-far layer — a new intermediate layer, silhouetted props between
  // the far hills and the mid layer.
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -11;
    const face = recede(b.mid, 0.35, b.sky[3]);
    const edge = recede(b.midEdge, 0.35, b.sky[3]);
    const count = Math.max(8, Math.round(width / 8));
    for (let i = 0; i < count; i++) {
      const x = -span + (span * 2 * i) / count + (rand() - 0.5) * 2.6;
      const scale = 0.5 + rand() * 0.5;
      const prop = buildProp(kit, b.prop, face, edge, scale, rand);
      prop.position.set(x, 0, (rand() - 0.5) * 1.2);
      group.add(prop);
    }
    root.add(group);
    layers.push({ group, factor: 0.22, span: span * 2 });
  }

  // -----------------------------------------------------------------------
  // Mid layer — the biome's signature prop
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -9;
    const face = recede(b.mid, 0.12, b.sky[3]);
    const edge = recede(b.midEdge, 0.12, b.sky[3]);
    const count = Math.max(14, Math.round(width / 4.2));
    for (let i = 0; i < count; i++) {
      const x = -span + (span * 2 * i) / count + (rand() - 0.5) * 2.6;
      const scale = 0.7 + rand() * 0.85;
      const prop = buildProp(kit, b.prop, face, edge, scale, rand);
      prop.position.set(x, 0, (rand() - 0.5) * 1.2);
      group.add(prop);
    }
    root.add(group);
    layers.push({ group, factor: 0.3, span: span * 2 });
  }

  // -----------------------------------------------------------------------
  // Mid-near fog — a second, warmer fog layer.
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -7;
    const fogWidth = span * 2;
    const fogHeight = room.ceilingY * 0.6 + 4;
    const fogGeo = new THREE.PlaneGeometry(fogWidth, fogHeight);
    disposer.track(fogGeo);
    const fogMat = new THREE.MeshBasicMaterial({
      color: recede(b.near, 0.2, b.sky[2]),
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    disposer.track(fogMat);
    const fog = new THREE.Mesh(fogGeo, fogMat);
    fog.position.y = fogHeight / 2 - 1;
    fog.renderOrder = -68;
    group.add(fog);
    root.add(group);
    layers.push({ group, factor: 0.45, span: fogWidth });
  }

  // -----------------------------------------------------------------------
  // Near clutter
  // -----------------------------------------------------------------------
  const swayingBushes: { mesh: THREE.Mesh; baseRot: number; phase: number }[] = [];
  {
    const group = new THREE.Group();
    group.position.z = -5;
    const face = recede(b.near, 0.04, b.sky[3]);
    const edge = b.nearEdge;
    const count = Math.max(10, Math.round(width / 6));
    for (let i = 0; i < count; i++) {
      const x = -span + (span * 2 * i) / count + (rand() - 0.5) * 3;
      if (rand() < 0.7) {
        const r = 0.7 + rand() * 0.8;
        const bush = kit.card(PaperKit.blob(r, 6, 0.3, i * 5.1, 0.72), face, edge, {
          depth: 0.16,
          order: -60,
        });
        bush.position.set(x, r * 0.5, 0);
        group.add(bush);
        swayingBushes.push({
          mesh: bush,
          baseRot: (rand() - 0.5) * 0.06,
          phase: rand() * Math.PI * 2,
        });

        // Small darker inner detail card.
        if (rand() < 0.6) {
          const inner = kit.card(
            PaperKit.blob(r * 0.55, 4, 0.2, i * 3.1 + 5, 0.7),
            shade(face, 0.2),
            edge,
            { depth: 0.1, order: -59 },
          );
          inner.position.set(x, r * 0.5, 0.06);
          group.add(inner);
        }
      } else {
        const h = 1.6 + rand() * 1.8;
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

        // Highlight on the lit side.
        const highlight = kit.card(
          PaperKit.polygon([
            [-0.42, 0],
            [-0.28, 0],
            [-0.22, h * 0.94],
            [-0.34, h * 0.94],
          ]),
          shift(face, 0.08),
          shift(face, 0.08),
          { depth: 0.03, order: -59 },
        );
        highlight.position.set(x, 0, 0.11);
        highlight.rotation.z = (rand() - 0.5) * 0.12;
        (highlight.material as THREE.Material[])[0].transparent = true;
        (highlight.material as THREE.Material[])[0].opacity = 0.7;
        group.add(highlight);
      }
    }
    root.add(group);
    layers.push({ group, factor: 0.58, span: span * 2 });
  }

  // -----------------------------------------------------------------------
  // Ground — with holes punched for floorGaps
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -0.5;

    // Build the floor as a series of segments between the gaps, so a pit is
    // a genuine hole in the art rather than a dark rectangle laid over it.
    const cuts = [...room.floorGaps].sort((p, q) => p.x - q.x);
    const segments: [number, number][] = [];
    let cursor = room.minX - 22;
    for (const g of cuts) {
      segments.push([cursor, g.x - g.halfW]);
      cursor = g.x + g.halfW;
    }
    segments.push([cursor, room.maxX + 22]);

    for (const [from, to] of segments) {
      if (to - from < 0.3) continue;
      const shape = new THREE.Shape();
      shape.moveTo(from, -16);
      shape.lineTo(to, -16);
      const steps = Math.max(6, Math.round((to - from) / 2));
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        const x = from + (to - from) * t;
        // Cosmetic undulation only. The collision floor is a flat line and
        // must stay one, or the player catches on invisible bumps.
        const y = -0.06 + Math.sin(x * 0.7) * 0.05 + Math.sin(x * 2.3) * 0.04;
        shape.lineTo(x, y);
      }
      shape.closePath();
      group.add(kit.card(shape, b.groundFace, b.groundEdge, { depth: 3.2, order: -20 }));

      // Lit lip on top of the ground.
      const lip = kit.card(
        PaperKit.roundedRect(to - from, 0.16, 0.06),
        b.groundLip,
        b.groundLip,
        { depth: 0.06, order: -19 },
      );
      lip.position.set((from + to) / 2, 0.02, 1.7);
      group.add(lip);

      // Sub-lip: a smaller warmer strip.
      const subLip = kit.card(
        PaperKit.roundedRect((to - from) * 0.98, 0.05, 0.02),
        shift(b.groundLip, 0.2),
        shift(b.groundLip, 0.2),
        { depth: 0.03, order: -18 },
      );
      subLip.position.set((from + to) / 2, 0.06, 1.75);
      group.add(subLip);

      // A darker "shadow" strip just below the lip. Fakes AO at the
      // ground/wall boundary.
      const shadowStrip = kit.card(
        PaperKit.roundedRect(to - from, 0.12, 0.05),
        shade(b.groundFace, 0.4),
        shade(b.groundFace, 0.4),
        { depth: 0.05, order: -19 },
      );
      shadowStrip.position.set((from + to) / 2, -0.06, 1.5);
      (shadowStrip.material as THREE.Material[])[0].transparent = true;
      (shadowStrip.material as THREE.Material[])[0].opacity = 0.5;
      group.add(shadowStrip);

      // Ground specks — tiny darker dots scattered along the top surface
      // for texture. Deterministic per segment.
      const speckCount = Math.max(4, Math.round((to - from) / 3));
      for (let i = 0; i < speckCount; i++) {
        const sx = from + ((to - from) * (i + 0.5 + (rand() - 0.5))) / speckCount;
        const speck = kit.card(
          PaperKit.roundedRect(0.12 + rand() * 0.06, 0.05, 0.02),
          shade(b.groundFace, 0.2),
          shade(b.groundFace, 0.2),
          { depth: 0.03, order: -18 },
        );
        speck.position.set(sx, -0.02, 1.72);
        group.add(speck);
      }
    }

    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }

  // -----------------------------------------------------------------------
  // Side walls and ceiling — so a room reads as enclosed
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -1.2;
    const wallFace = shift(b.groundFace, -0.14);
    for (const side of [-1, 1] as const) {
      const x = side < 0 ? room.minX : room.maxX;
      const wall = kit.card(
        PaperKit.roundedRect(16, room.ceilingY + 30, 0.4),
        wallFace,
        b.groundEdge,
        { depth: 3.0, order: -22 },
      );
      wall.position.set(x + side * 8, room.ceilingY / 2, 0);
      group.add(wall);

      // Wall rim highlight — a thin brighter card at the wall's edge
      // facing into the room.
      const wallRim = kit.card(
        PaperKit.roundedRect(0.2, room.ceilingY + 30, 0.1),
        shift(wallFace, 0.15),
        shift(wallFace, 0.15),
        { depth: 0.1, order: -21 },
      );
      wallRim.position.set(x - side * 0.15, room.ceilingY / 2, 0.15);
      group.add(wallRim);
    }
    const roof = kit.card(
      PaperKit.roundedRect(width + 40, 14, 0.4),
      wallFace,
      b.groundEdge,
      { depth: 2.4, order: -22 },
    );
    roof.position.set(centre, room.ceilingY + 7, 0);
    group.add(roof);

    // Ceiling lip — a warmer strip along the underside so a distant
    // ceiling reads as "the top" instead of "another wall".
    const ceilingLip = kit.card(
      PaperKit.roundedRect(width + 40, 0.1, 0.04),
      shift(b.groundEdge, 0.2),
      shift(b.groundEdge, 0.2),
      { depth: 0.04, order: -21 },
    );
    ceilingLip.position.set(centre, room.ceilingY + 0.02, 0.5);
    (ceilingLip.material as THREE.Material[])[0].transparent = true;
    (ceilingLip.material as THREE.Material[])[0].opacity = 0.6;
    group.add(ceilingLip);

    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }

  // -----------------------------------------------------------------------
  // Platforms (one-way)
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -0.4;
    for (const pl of room.platforms) {
      const w = pl.halfW * 2;

      // Platform rim — a slightly larger, brighter clone behind.
      const rimSlab = kit.card(
        PaperKit.roundedRect(w * 1.03, 0.7, 0.16),
        rimColor(b.platformFace, PALETTE.paperRim, 0.4),
        rimColor(b.platformFace, PALETTE.paperRim, 0.4),
        { depth: 0.05, order: -19 },
      );
      rimSlab.position.set(pl.x, pl.y - 0.31, -0.05);
      group.add(rimSlab);

      const slab = kit.card(PaperKit.roundedRect(w, 0.62, 0.16), b.platformFace, b.platformEdge, {
        depth: 1.5,
        order: -18,
      });
      slab.position.set(pl.x, pl.y - 0.31, 0);
      group.add(slab);

      const lip = kit.card(
        PaperKit.roundedRect(w * 0.97, 0.12, 0.05),
        b.platformLip,
        b.platformLip,
        { depth: 0.05, order: -17 },
      );
      lip.position.set(pl.x, pl.y + 0.01, 0.8);
      group.add(lip);

      // Sub-lip.
      const subLip = kit.card(
        PaperKit.roundedRect(w * 0.94, 0.05, 0.02),
        shift(b.platformLip, 0.2),
        shift(b.platformLip, 0.2),
        { depth: 0.03, order: -16 },
      );
      subLip.position.set(pl.x, pl.y + 0.045, 0.85);
      group.add(subLip);

      // Hanging growth, so the slabs don't look like they float arbitrarily.
      for (let i = 0; i < 3; i++) {
        const vx = pl.x - pl.halfW * 0.6 + (pl.halfW * 1.2 * i) / 2;
        const len = 0.5 + ((i * 37) % 10) / 14;
        const vine = kit.card(
          PaperKit.roundedRect(0.1, len, 0.05),
          b.platformEdge,
          b.platformEdge,
          { depth: 0.06, order: -19 },
        );
        vine.position.set(vx, pl.y - 0.62 - len / 2, 0.2);
        group.add(vine);

        // Small leaf at the tip.
        if (i % 2 === 0) {
          const leaf = kit.card(
            PaperKit.blob(0.14, 3, 0.14, i * 7.2, 0.6),
            recede(b.midEdge, 0.05, b.sky[3]),
            b.platformEdge,
            { depth: 0.06, order: -18 },
          );
          leaf.position.set(vx, pl.y - 0.62 - len - 0.06, 0.24);
          group.add(leaf);
        }
      }
    }
    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }

  // -----------------------------------------------------------------------
  // Solids — no lip. That absence IS the signal: you can't land on this.
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = -0.45;
    for (const sd of room.solids) {
      const block = kit.card(
        PaperKit.roundedRect(sd.halfW * 2, sd.halfH * 2, 0.24),
        shift(b.groundFace, 0.08),
        b.groundEdge,
        { depth: 2.0, order: -18 },
      );
      block.position.set(sd.x, sd.y, 0);
      group.add(block);

      // A dim cap so the top edge is still readable — you CAN land on the
      // top of a solid, just not walk through it.
      const cap = kit.card(
        PaperKit.roundedRect(sd.halfW * 1.94, 0.1, 0.04),
        shift(b.platformLip, -0.35),
        shift(b.platformLip, -0.35),
        { depth: 0.05, order: -17 },
      );
      cap.position.set(sd.x, sd.y + sd.halfH + 0.01, 1.05);
      group.add(cap);

      // Vertical detail lines on the solid.
      for (const dx of [-sd.halfW * 0.5, sd.halfW * 0.5]) {
        const line = kit.card(
          PaperKit.roundedRect(0.05, sd.halfH * 1.8, 0.02),
          shade(b.groundFace, 0.2),
          shade(b.groundFace, 0.2),
          { depth: 0.04, order: -17 },
        );
        line.position.set(sd.x + dx, sd.y, 0.24);
        (line.material as THREE.Material[])[0].transparent = true;
        (line.material as THREE.Material[])[0].opacity = 0.55;
        group.add(line);
      }
    }
    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }

  // -----------------------------------------------------------------------
  // Hazards — the only saturated danger colour in any biome
  // -----------------------------------------------------------------------
  {
    const group = new THREE.Group();
    group.position.z = 0.2;
    for (const hz of room.hazards) {
      const teeth = Math.max(3, Math.round(hz.halfW * 2.4));
      for (let i = 0; i < teeth; i++) {
        const x = hz.x - hz.halfW + ((hz.halfW * 2) * (i + 0.5)) / teeth;
        const h = hz.halfH * 2 * (0.8 + ((i * 13) % 7) / 18);

        // Rim card behind each tooth.
        const rimShape = PaperKit.polygon([
          [-0.24, 0],
          [0.24, 0],
          [0, h],
        ]);
        const rimTooth = kit.card(
          rimShape,
          shift(PALETTE.dangerRim, 0.1),
          shift(PALETTE.dangerRim, 0.1),
          { depth: 0.05, order: 11 },
        );
        rimTooth.scale.setScalar(1.15);
        rimTooth.position.set(x, hz.y, -0.05);
        group.add(rimTooth);

        const tooth = kit.card(
          rimShape,
          PALETTE.danger,
          shift(PALETTE.danger, -0.4),
          { depth: 0.3, order: 12 },
        );
        tooth.position.set(x, hz.y, 0);
        group.add(tooth);
      }
      // A base plate so the row reads as one object at a glance.
      const base = kit.card(
        PaperKit.roundedRect(hz.halfW * 2, 0.22, 0.08),
        shift(PALETTE.danger, -0.5),
        shift(PALETTE.danger, -0.5),
        { depth: 0.3, order: 11 },
      );
      base.position.set(hz.x, hz.y + 0.06, 0.1);
      group.add(base);

      // A dim glow disc under the hazards for warning.
      const warnGlow = kit.glowDisc(hz.halfW * 1.2, PALETTE.danger, 20);
      (warnGlow.material as THREE.Material).opacity = 0.35;
      warnGlow.position.set(hz.x, hz.y, -0.1);
      warnGlow.renderOrder = 10;
      group.add(warnGlow);
    }
    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }

  // -----------------------------------------------------------------------
  // Gates
  // -----------------------------------------------------------------------
  const gateGroups = new Map<string, { open: THREE.Group; sealed: THREE.Group }>();
  {
    const group = new THREE.Group();
    group.position.z = -0.8;
    for (const g of room.gates) {
      const { open, sealed } = buildGate(kit, room, g, b);
      group.add(open);
      group.add(sealed);
      gateGroups.set(g.id, { open, sealed });
    }
    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }

  // -----------------------------------------------------------------------
  // Bench — an HD pergola with hanging cloth and dual lanterns.
  // -----------------------------------------------------------------------
  let benchGlow: THREE.Mesh | null = null;
  let benchGlowSecondary: THREE.Mesh | null = null;
  if (room.bench) {
    const group = new THREE.Group();
    group.position.z = -0.3;

    // Bench seat.
    const seat = kit.card(PaperKit.roundedRect(3.0, 0.34, 0.14), b.platformLip, b.platformEdge, {
      depth: 0.9,
      order: -16,
    });
    seat.position.set(room.bench.x, 1.15, 0);
    group.add(seat);

    // Bench seat rim.
    const seatRim = kit.card(
      PaperKit.roundedRect(3.05, 0.4, 0.15),
      shift(b.platformLip, 0.15),
      shift(b.platformLip, 0.15),
      { depth: 0.05, order: -17 },
    );
    seatRim.position.set(room.bench.x, 1.15, -0.06);
    group.add(seatRim);

    for (const dx of [-1.15, 1.15]) {
      const leg = kit.card(PaperKit.roundedRect(0.24, 1.15, 0.08), b.platformEdge, b.platformEdge, {
        depth: 0.5,
        order: -17,
      });
      leg.position.set(room.bench.x + dx, 0.57, 0);
      group.add(leg);
    }

    // Pergola — a top beam supported by two vertical posts on the sides.
    const beam = kit.card(PaperKit.roundedRect(3.6, 0.18, 0.06), b.platformEdge, b.platformEdge, {
      depth: 0.4,
      order: -17,
    });
    beam.position.set(room.bench.x, 4.2, 0);
    group.add(beam);

    // A back with a lantern, so the bench is findable from across the room.
    const back = kit.card(PaperKit.roundedRect(0.26, 2.4, 0.1), b.platformEdge, b.platformEdge, {
      depth: 0.4,
      order: -17,
    });
    back.position.set(room.bench.x + 1.3, 2.3, 0);
    group.add(back);

    // Second post on the other side.
    const backLeft = kit.card(
      PaperKit.roundedRect(0.26, 2.4, 0.1),
      b.platformEdge,
      b.platformEdge,
      { depth: 0.4, order: -17 },
    );
    backLeft.position.set(room.bench.x - 1.3, 2.3, 0);
    group.add(backLeft);

    // Dual lanterns.
    for (const dx of [-1.3, 1.3]) {
      const lamp = kit.card(PaperKit.blob(0.34, 5, 0.1, 4.4 + dx, 1.1), PALETTE.gold, PALETTE.goldRim, {
        depth: 0.3,
        order: -15,
      });
      lamp.position.set(room.bench.x + dx, 3.9, 0.3);
      group.add(lamp);

      // Lantern chain — a thin darker card connecting to the beam.
      const chain = kit.card(
        PaperKit.roundedRect(0.06, 0.3, 0.02),
        shade(b.platformEdge, 0.2),
        shade(b.platformEdge, 0.2),
        { depth: 0.03, order: -16 },
      );
      chain.position.set(room.bench.x + dx, 4.15, 0.2);
      group.add(chain);
    }

    // Central glow, brighter.
    benchGlow = kit.glowDisc(2.8, PALETTE.gold, 24);
    benchGlow.position.set(room.bench.x, 3.9, 0.1);
    benchGlow.renderOrder = -16;
    group.add(benchGlow);

    // Second, wider soft glow.
    benchGlowSecondary = kit.glowDisc(4.4, PALETTE.gold, 24, 1.5);
    (benchGlowSecondary.material as THREE.Material).opacity = 0.28;
    benchGlowSecondary.position.set(room.bench.x, 3.9, 0);
    benchGlowSecondary.renderOrder = -17;
    group.add(benchGlowSecondary);

    // Hanging cloth banner behind the beam.
    const banner = kit.card(
      PaperKit.polygon([
        [-0.6, 0],
        [0.6, 0],
        [0.5, -1.0],
        [0, -1.15],
        [-0.5, -1.0],
      ]),
      shift(b.platformFace, -0.05),
      shift(b.platformEdge, -0.1),
      { depth: 0.06, order: -16 },
    );
    banner.position.set(room.bench.x, 4.0, 0.15);
    group.add(banner);

    // Small gold star on the banner.
    const bannerStar = kit.card(
      PaperKit.star(5, 0.14, 0.44),
      PALETTE.gold,
      PALETTE.goldRim,
      { depth: 0.05, order: -15 },
    );
    bannerStar.position.set(room.bench.x, 3.4, 0.2);
    group.add(bannerStar);

    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }

  // -----------------------------------------------------------------------
  // Spike pool — reused by the Thorn Warden and the Storm Dragon
  // -----------------------------------------------------------------------
  const spikes: { mesh: THREE.Mesh; life: number; maxLife: number; height: number }[] = [];
  {
    const group = new THREE.Group();
    group.position.z = 0.4;
    for (let i = 0; i < SPIKE_POOL; i++) {
      const mesh = kit.card(
        PaperKit.polygon([
          [-0.42, 0],
          [0.42, 0],
          [0, 1],
        ]),
        b.platformLip,
        shift(b.platformLip, -0.45),
        { depth: 0.4, order: 14 },
      );
      mesh.visible = false;
      group.add(mesh);
      spikes.push({ mesh, life: 0, maxLife: 1, height: 1 });
    }
    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }
  let spikeCursor = 0;

  // -----------------------------------------------------------------------
  // Ambient motes — the cheapest possible "this place has air in it"
  // HD: bumped count by 60%, added varied sizes.
  // -----------------------------------------------------------------------
  const motes: {
    mesh: THREE.Mesh;
    baseX: number;
    baseY: number;
    speed: number;
    phase: number;
    baseOpacity: number;
  }[] = [];
  if (b.moteCount > 0) {
    const group = new THREE.Group();
    group.position.z = 2.2;
    const hdMoteCount = Math.round(b.moteCount * 1.6);
    for (let i = 0; i < hdMoteCount; i++) {
      const size = 0.11 + rand() * 0.14;
      const mat = kit.glowMaterial(b.moteColor, 0.4 + rand() * 0.35);
      const geo = new THREE.PlaneGeometry(size, size);
      kit.trackGeometry(geo);
      const mesh = new THREE.Mesh(geo, mat);
      const bx = room.minX + rand() * width;
      const by = 1 + rand() * (room.ceilingY - 2);
      mesh.position.set(bx, by, 0);
      mesh.renderOrder = 30;
      group.add(mesh);
      motes.push({
        mesh,
        baseX: bx,
        baseY: by,
        speed: 0.3 + rand() * 0.7,
        phase: rand() * 6.28,
        baseOpacity: 0.4 + rand() * 0.35,
      });
    }
    root.add(group);
    layers.push({ group, factor: 1, span: 0 });
  }

  // -----------------------------------------------------------------------
  // Foreground fringe
  // -----------------------------------------------------------------------
  const blades: { mesh: THREE.Mesh; phase: number; baseRot: number }[] = [];
  {
    const group = new THREE.Group();
    group.position.z = 3;
    const face = shift(b.groundEdge, -0.25);
    const count = Math.max(24, Math.round(width / 2.6));
    for (let i = 0; i < count; i++) {
      const x = -span + (span * 2 * i) / count + (rand() - 0.5) * 1.6;
      const h = 0.9 + rand() * 1.4;
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
      blades.push({ mesh: blade, phase: rand() * Math.PI * 2, baseRot });
    }
    root.add(group);
    layers.push({ group, factor: 1.28, span: span * 2 });
  }

  return {
    root,

    update(cameraX, cameraY, elapsed) {
      for (const layer of layers) {
        if (layer.factor === 1) continue;
        let offset = (cameraX - centre) * (1 - layer.factor);
        if (layer.span > 0) {
          offset = ((offset % layer.span) + layer.span) % layer.span;
          if (offset > layer.span / 2) offset -= layer.span;
        }
        // Far layers hold their vertical position relative to the camera so
        // a 60wu shaft doesn't scroll past a static backdrop.
        layer.group.position.set(centre + offset, (cameraY - 4) * (1 - layer.factor), layer.group.position.z);
      }

      for (const blade of blades) {
        blade.mesh.rotation.z = blade.baseRot + Math.sin(elapsed * 1.8 + blade.phase) * 0.13;
      }

      // Swaying bushes — a low-amplitude sway in the near-clutter layer.
      for (const b of swayingBushes) {
        b.mesh.rotation.z = b.baseRot + Math.sin(elapsed * 1.2 + b.phase) * 0.04;
      }

      for (const m of motes) {
        m.mesh.position.y = m.baseY + Math.sin(elapsed * m.speed + m.phase) * 1.4;
        m.mesh.position.x = m.baseX + Math.cos(elapsed * m.speed * 0.6 + m.phase) * 0.9;
        // Individual twinkle: each mote breathes on its own phase.
        (m.mesh.material as THREE.Material).opacity =
          m.baseOpacity * (0.6 + Math.sin(elapsed * m.speed * 1.4 + m.phase) * 0.4);
      }

      if (benchGlow) {
        const pulse = 1 + Math.sin(elapsed * 1.6) * 0.12;
        benchGlow.scale.setScalar(pulse);
      }
      if (benchGlowSecondary) {
        const pulse = 1 + Math.sin(elapsed * 1.1 + 1.2) * 0.08;
        benchGlowSecondary.scale.setScalar(pulse);
      }

      for (const sp of spikes) {
        if (sp.life <= 0) continue;
        sp.life = Math.max(0, sp.life - 1 / 60);
        const t = 1 - sp.life / sp.maxLife;
        // Punch up fast, retract slowly. The fast rise is the threat; the
        // slow retract is the recovery window.
        const rise = t < 0.18 ? t / 0.18 : Math.max(0, 1 - (t - 0.18) / 0.82);
        sp.mesh.scale.set(1, sp.height * rise, 1);
        sp.mesh.visible = rise > 0.02;
        if (sp.life <= 0) sp.mesh.visible = false;
      }
    },

    setGateOpen(gateId, open) {
      const g = gateGroups.get(gateId);
      if (!g) return;
      g.open.visible = open;
      g.sealed.visible = !open;
    },

    showSpike(x, height, life) {
      const sp = spikes[spikeCursor];
      spikeCursor = (spikeCursor + 1) % spikes.length;
      sp.mesh.position.set(x, 0, 0);
      sp.life = life;
      sp.maxLife = life;
      sp.height = height;
      sp.mesh.visible = true;
      sp.mesh.scale.set(1, 0.01, 1);
    },

    dispose() {
      root.removeFromParent();
      disposer.disposeAll();
    },
  };
}

// ---------------------------------------------------------------------------
// Gate art — HD pass adds double-glow, a filigree ring around the archway,
// and a sigil in the seal.
// ---------------------------------------------------------------------------

function buildGate(
  kit: PaperKit,
  room: Room,
  g: Gate,
  b: (typeof BIOMES)[keyof typeof BIOMES],
): { open: THREE.Group; sealed: THREE.Group } {
  const open = new THREE.Group();
  const sealed = new THREE.Group();

  const horizontal = g.side === "left" || g.side === "right";
  const x = g.side === "left" ? room.minX : g.side === "right" ? room.maxX : g.at;
  const y = g.side === "top" ? room.ceilingY : g.side === "bottom" ? 0 : g.at;

  const w = horizontal ? 2.6 : g.size;
  const h = horizontal ? g.size : 2.6;

  // Open: dual glow — a wide soft outer and a tighter inner.
  const outerGlow = kit.glowDisc(Math.max(w, h) * 1.2, b.platformLip, 24, 1.4);
  (outerGlow.material as THREE.Material).opacity = 0.4;
  outerGlow.position.set(x, y, -0.7);
  outerGlow.renderOrder = -22;
  open.add(outerGlow);

  const glow = kit.glowDisc(Math.max(w, h) * 0.85, b.platformLip, 24);
  glow.position.set(x, y, -0.6);
  glow.renderOrder = -21;
  open.add(glow);

  const frame = kit.card(PaperKit.roundedRect(w + 1.2, h + 1.2, 0.6), b.platformEdge, b.groundEdge, {
    depth: 1.2,
    order: -21,
  });
  frame.position.set(x, y, -0.4);
  open.add(frame);

  // Frame rim.
  const frameRim = kit.card(
    PaperKit.roundedRect(w + 1.35, h + 1.35, 0.7),
    shift(b.platformLip, 0.2),
    shift(b.platformLip, 0.2),
    { depth: 0.1, order: -22 },
  );
  frameRim.position.set(x, y, -0.5);
  open.add(frameRim);

  const mouth = kit.card(PaperKit.roundedRect(w, h, 0.5), 0x05030a, 0x05030a, {
    depth: 0.4,
    order: -20,
  });
  mouth.position.set(x, y, -0.2);
  open.add(mouth);

  // Sealed: the same frame, barred. Deliberately the same silhouette — the
  // player should recognise it as a door they'll come back to, not as a wall.
  const sFrame = kit.card(PaperKit.roundedRect(w + 1.2, h + 1.2, 0.6), b.groundEdge, b.groundEdge, {
    depth: 1.2,
    order: -21,
  });
  sFrame.position.set(x, y, -0.4);
  sealed.add(sFrame);

  const barColor = g.pro ? PALETTE.gold : PALETTE.arcaneDeep;
  const bars = 4;
  for (let i = 0; i < bars; i++) {
    const t = (i + 0.5) / bars - 0.5;
    const bar = kit.card(
      horizontal ? PaperKit.roundedRect(w * 0.9, 0.3, 0.12) : PaperKit.roundedRect(0.3, h * 0.9, 0.12),
      barColor,
      shift(barColor, -0.4),
      { depth: 0.5, order: -19 },
    );
    bar.position.set(horizontal ? x : x + t * w, horizontal ? y + t * h : y, -0.1);
    sealed.add(bar);
  }

  const seal = kit.card(PaperKit.softStar(6, 1.0, 0.4), barColor, shift(barColor, -0.35), {
    depth: 0.3,
    order: -18,
  });
  seal.position.set(x, y, 0.2);
  sealed.add(seal);

  // Sigil glow behind the seal.
  const sealGlow = kit.glowDisc(1.6, barColor, 22);
  (sealGlow.material as THREE.Material).opacity = 0.5;
  sealGlow.position.set(x, y, 0.05);
  sealed.add(sealGlow);

  open.visible = true;
  sealed.visible = false;
  return { open, sealed };
}

// ---------------------------------------------------------------------------
// Biome props — HD versions with more layered cards for real volume.
// ---------------------------------------------------------------------------

function buildProp(
  kit: PaperKit,
  kind: string,
  face: number,
  edge: number,
  scale: number,
  rand: () => number,
): THREE.Group {
  const g = new THREE.Group();

  switch (kind) {
    case "mushroom": {
      const stem = kit.card(PaperKit.roundedRect(0.42, 1.9, 0.16), edge, edge, {
        depth: 0.16,
        order: -70,
      });
      stem.position.y = 0.95;
      g.add(stem);

      // Stem highlight — a lighter card on the lit side.
      const stemHighlight = kit.card(
        PaperKit.roundedRect(0.14, 1.6, 0.06),
        shift(edge, 0.15),
        shift(edge, 0.15),
        { depth: 0.04, order: -69 },
      );
      stemHighlight.position.set(-0.1, 0.9, 0.11);
      (stemHighlight.material as THREE.Material[])[0].transparent = true;
      (stemHighlight.material as THREE.Material[])[0].opacity = 0.6;
      g.add(stemHighlight);

      const cap = kit.card(PaperKit.blob(1.5, 5, 0.14, rand() * 10, 0.52), face, edge, {
        depth: 0.2,
        order: -70,
      });
      cap.position.y = 2.1;
      g.add(cap);

      // Cap dots — small darker circles for texture.
      for (let i = 0; i < 4; i++) {
        const dot = kit.card(
          PaperKit.roundedRect(0.16, 0.14, 0.05),
          shade(face, 0.15),
          shade(face, 0.15),
          { depth: 0.05, order: -69 },
        );
        dot.position.set(-0.6 + i * 0.4, 2.15 + (i % 2) * 0.15, 0.14);
        g.add(dot);
      }
      break;
    }

    case "crystal": {
      for (let i = 0; i < 3; i++) {
        const h = 2.2 + rand() * 2.6;
        const w = 0.4 + rand() * 0.4;
        const shard = kit.card(
          PaperKit.polygon([
            [-w, 0],
            [w, 0],
            [w * 0.5, h * 0.7],
            [0, h],
            [-w * 0.6, h * 0.65],
          ]),
          face,
          edge,
          { depth: 0.18, order: -70 },
        );
        shard.position.set((i - 1) * 0.75, 0, 0);
        shard.rotation.z = (rand() - 0.5) * 0.24;
        g.add(shard);

        // Crystal highlight — a bright card along one edge.
        const highlight = kit.card(
          PaperKit.polygon([
            [-w * 0.3, 0],
            [-w * 0.15, 0],
            [-0.02, h * 0.9],
            [-w * 0.15, h * 0.9],
          ]),
          shift(face, 0.25),
          shift(face, 0.25),
          { depth: 0.05, order: -69 },
        );
        highlight.position.set((i - 1) * 0.75, 0, 0.12);
        highlight.rotation.z = shard.rotation.z;
        (highlight.material as THREE.Material[])[0].transparent = true;
        (highlight.material as THREE.Material[])[0].opacity = 0.7;
        g.add(highlight);
      }
      break;
    }

    case "pillar": {
      const h = 3.4 + rand() * 2.6;
      const col = kit.card(PaperKit.roundedRect(1.1, h, 0.16), face, edge, {
        depth: 0.24,
        order: -70,
      });
      col.position.y = h / 2;
      g.add(col);

      // Vertical detail lines.
      for (const dx of [-0.3, 0.3]) {
        const line = kit.card(
          PaperKit.roundedRect(0.05, h * 0.9, 0.02),
          shade(face, 0.15),
          shade(face, 0.15),
          { depth: 0.04, order: -69 },
        );
        line.position.set(dx, h / 2, 0.14);
        (line.material as THREE.Material[])[0].transparent = true;
        (line.material as THREE.Material[])[0].opacity = 0.65;
        g.add(line);
      }

      const cap = kit.card(PaperKit.roundedRect(1.7, 0.42, 0.1), edge, edge, {
        depth: 0.3,
        order: -70,
      });
      cap.position.y = h;
      g.add(cap);

      const base = kit.card(PaperKit.roundedRect(1.4, 0.3, 0.06), edge, edge, {
        depth: 0.28,
        order: -70,
      });
      base.position.y = 0.15;
      g.add(base);
      break;
    }

    case "thorn": {
      const h = 2.6 + rand() * 2.2;
      const trunk = kit.card(
        PaperKit.polygon([
          [-0.28, 0],
          [0.28, 0],
          [0.1, h],
          [-0.16, h],
        ]),
        edge,
        edge,
        { depth: 0.18, order: -70 },
      );
      g.add(trunk);
      for (let i = 0; i < 5; i++) {
        const y = h * (0.25 + i * 0.14);
        const dir = i % 2 === 0 ? 1 : -1;
        const branch = kit.card(
          PaperKit.polygon([
            [0, -0.12],
            [0, 0.12],
            [dir * (0.9 + rand() * 0.6), 0.32],
          ]),
          face,
          edge,
          { depth: 0.12, order: -70 },
        );
        branch.position.y = y;
        g.add(branch);
      }
      break;
    }

    case "shard": {
      const h = 2.8 + rand() * 3.2;
      const shard = kit.card(
        PaperKit.polygon([
          [-0.7, 0],
          [0.7, 0],
          [0.32, h * 0.6],
          [0, h],
          [-0.42, h * 0.55],
        ]),
        face,
        edge,
        { depth: 0.22, order: -70 },
      );
      shard.rotation.z = (rand() - 0.5) * 0.3;
      g.add(shard);

      // Highlight.
      const highlight = kit.card(
        PaperKit.polygon([
          [-0.3, 0],
          [-0.14, 0],
          [-0.06, h * 0.7],
          [-0.24, h * 0.7],
        ]),
        shift(face, 0.18),
        shift(face, 0.18),
        { depth: 0.05, order: -69 },
      );
      highlight.rotation.z = shard.rotation.z;
      (highlight.material as THREE.Material[])[0].transparent = true;
      (highlight.material as THREE.Material[])[0].opacity = 0.6;
      g.add(highlight);
      break;
    }

    case "spire": {
      const h = 4.5 + rand() * 4;
      const spire = kit.card(
        PaperKit.polygon([
          [-0.9, 0],
          [0.9, 0],
          [0.36, h * 0.7],
          [0.1, h],
          [-0.3, h * 0.72],
        ]),
        face,
        edge,
        { depth: 0.24, order: -70 },
      );
      g.add(spire);

      // Highlight strip.
      const highlight = kit.card(
        PaperKit.polygon([
          [-0.4, 0],
          [-0.16, 0],
          [-0.02, h * 0.85],
          [-0.18, h * 0.85],
        ]),
        shift(face, 0.2),
        shift(face, 0.2),
        { depth: 0.05, order: -69 },
      );
      (highlight.material as THREE.Material[])[0].transparent = true;
      (highlight.material as THREE.Material[])[0].opacity = 0.55;
      g.add(highlight);
      break;
    }

    // conifer
    default: {
      const trunk = kit.card(PaperKit.roundedRect(0.22, 1.0, 0.06), edge, edge, {
        depth: 0.12,
        order: -70,
      });
      trunk.position.y = 0.5;
      g.add(trunk);
      for (let tier = 0; tier < 3; tier++) {
        const w = 2.1 - tier * 0.52;
        const h = 1.5 - tier * 0.18;
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
        canopy.position.y = 0.95 + tier * 0.95;
        g.add(canopy);

        // Underside shadow strip.
        const shadow = kit.card(
          PaperKit.polygon([
            [-w / 2, 0],
            [w / 2, 0],
            [w / 2 - 0.1, 0.1],
            [-w / 2 + 0.1, 0.1],
          ]),
          shade(face, 0.3),
          shade(face, 0.3),
          { depth: 0.06, order: -69 },
        );
        shadow.position.y = 0.95 + tier * 0.95;
        (shadow.material as THREE.Material[])[0].transparent = true;
        (shadow.material as THREE.Material[])[0].opacity = 0.6;
        g.add(shadow);
      }
      break;
    }
  }

  g.scale.setScalar(scale);
  g.rotation.z = (rand() - 0.5) * 0.06;
  return g;
}
