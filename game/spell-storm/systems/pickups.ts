import * as THREE from "three";
import { ARENA, PICKUP, type PickupKind } from "../config";
import { PALETTE } from "../art/palette";
import { PaperKit } from "../art/paper";
import type { Pickup, Player } from "../types";
import { resolveGround } from "./physics";

/**
 * Drops. Hearts, weapon scrolls and score stars.
 *
 * Two details that matter more than they look:
 *
 * Blink before expiry. A pickup that vanishes without warning reads as a
 * bug. Three seconds of blinking turns "the game took my heart" into "I was
 * too slow", which is a completely different feeling about the same event.
 *
 * Magnetism. Inside a short radius the pickup accelerates toward the player.
 * Making the player land precisely on a small object mid-firefight is
 * busywork; the pickup meeting them halfway costs nothing and removes a
 * whole class of near-miss frustration.
 */

const KIND_COLORS: Record<PickupKind, { face: number; edge: number; glow: number }> = {
  heart: { face: PALETTE.heart, edge: 0xa8324a, glow: PALETTE.heart },
  triple: { face: PALETTE.arcane, edge: PALETTE.arcaneDeep, glow: PALETTE.arcane },
  beam: { face: 0xc4a2ff, edge: 0x6b4ba8, glow: 0xc4a2ff },
  homing: { face: 0x8affc4, edge: 0x3d8f6b, glow: 0x8affc4 },
  star: { face: PALETTE.gold, edge: 0xc4930f, glow: PALETTE.gold },
};

export interface PickupSystem {
  root: THREE.Group;
  list: Pickup[];
  spawn(kind: PickupKind, x: number, y: number): void;
  /** Rolls the drop table. Returns the kind spawned, or null. */
  rollDrop(x: number, y: number, chance: number): PickupKind | null;
  update(dt: number, player: Player, elapsed: number): void;
  reset(): void;
}

export function createPickups(kit: PaperKit): PickupSystem {
  const root = new THREE.Group();
  root.name = "pickups";

  const list: Pickup[] = [];
  interface Visual {
    group: THREE.Group;
    icon: THREE.Mesh;
    iconFace: THREE.MeshBasicMaterial;
    iconEdge: THREE.MeshBasicMaterial;
    glow: THREE.Mesh;
    scroll: THREE.Mesh;
  }
  const visuals: Visual[] = [];

  for (let i = 0; i < PICKUP.poolSize; i++) {
    list.push({ active: false, kind: "star", x: 0, y: 0, vy: 0, life: 0, phase: 0 });

    const group = new THREE.Group();
    group.visible = false;

    // A scroll backing card, so weapon pickups read as "a spell you pick up"
    // rather than as a floating icon.
    const scroll = kit.card(PaperKit.roundedRect(0.62, 0.78, 0.14), PALETTE.paperFace, PALETTE.paperEdge, {
      depth: 0.16,
      order: 24,
    });
    group.add(scroll);

    const glow = kit.glowDisc(0.85, PALETTE.gold, 14);
    glow.renderOrder = 23;
    group.add(glow);

    const built = kit.tintableCard(PaperKit.star(5, 0.26, 0.45), PALETTE.gold, 0xc4930f, {
      depth: 0.1,
      order: 25,
    });
    built.mesh.position.z = 0.2;
    group.add(built.mesh);

    root.add(group);
    visuals.push({
      group,
      icon: built.mesh,
      iconFace: built.face,
      iconEdge: built.edge,
      glow,
      scroll,
    });
  }

  // Pre-built silhouettes, swapped in when a pickup is armed. Building these
  // once and reassigning geometry avoids an extrusion at drop time.
  const shapes: Record<PickupKind, THREE.BufferGeometry> = {
    heart: extrude(PaperKit.heart(0.26)),
    star: extrude(PaperKit.star(5, 0.26, 0.45)),
    triple: extrude(PaperKit.star(3, 0.28, 0.5)),
    beam: extrude(PaperKit.roundedRect(0.13, 0.6, 0.06)),
    homing: extrude(PaperKit.blob(0.24, 4, 0.22, 3.1)),
  };

  function extrude(shape: THREE.Shape): THREE.BufferGeometry {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: false,
      curveSegments: 8,
    });
    geo.translate(0, 0, -0.05);
    kit.trackGeometry(geo);
    return geo;
  }

  let cursor = 0;

  function arm(kind: PickupKind, x: number, y: number): void {
    let idx = -1;
    for (let i = 0; i < list.length; i++) {
      const probe = (cursor + i) % list.length;
      if (!list[probe].active) {
        idx = probe;
        break;
      }
    }
    // Pool exhausted: overwrite the oldest rather than dropping the reward.
    if (idx < 0) idx = cursor;
    cursor = (idx + 1) % list.length;

    const p = list[idx];
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vy = 4.5;
    p.life = PICKUP.lifetime;
    p.phase = Math.random() * Math.PI * 2;

    const colors = KIND_COLORS[kind];
    const v = visuals[idx];
    v.icon.geometry = shapes[kind];
    v.iconFace.color.setHex(colors.face);
    v.iconEdge.color.setHex(colors.edge);
    (v.glow.material as THREE.MeshBasicMaterial).color.setHex(colors.glow);
    v.scroll.visible = kind !== "heart" && kind !== "star";
    v.group.visible = true;
    v.group.position.set(x, y, 0.4);
  }

  return {
    root,
    list,

    spawn(kind, x, y) {
      arm(kind, x, y);
    },

    rollDrop(x, y, chance) {
      if (Math.random() > chance) return null;
      const total = PICKUP.table.reduce((s, e) => s + e.weight, 0);
      let roll = Math.random() * total;
      for (const entry of PICKUP.table) {
        roll -= entry.weight;
        if (roll <= 0) {
          arm(entry.kind, x, y);
          return entry.kind;
        }
      }
      return null;
    },

    update(dt, player, elapsed) {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const v = visuals[i];
        if (!p.active) continue;

        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          v.group.visible = false;
          continue;
        }

        // Fall and settle.
        const previousY = p.y;
        p.vy -= 34 * dt;
        p.y += p.vy * dt;
        const ground = resolveGround(p.x, p.y, p.vy, PICKUP.radius, previousY);
        if (ground.onGround && ground.surfaceY !== null) {
          p.y = ground.surfaceY + PICKUP.radius;
          p.vy = 0;
        }
        if (p.y < ARENA.floorY + PICKUP.radius) {
          p.y = ARENA.floorY + PICKUP.radius;
          p.vy = 0;
        }

        // Magnetism.
        const dx = player.x - p.x;
        const dy = player.y + 0.7 - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 3.2 && dist > 0.01) {
          const pull = (1 - dist / 3.2) * 26 * dt;
          p.x += (dx / dist) * pull;
          p.y += (dy / dist) * pull;
        }

        const bob = Math.sin(elapsed * PICKUP.bobSpeed + p.phase) * PICKUP.bobAmplitude;
        v.group.position.set(p.x, p.y + bob, 0.4);
        v.icon.rotation.z = Math.sin(elapsed * 1.6 + p.phase) * 0.35;
        v.glow.scale.setScalar(1 + Math.sin(elapsed * 3.2 + p.phase) * 0.15);

        // Blink out.
        if (p.life < PICKUP.blinkAt) {
          const blinkRate = 6 + (PICKUP.blinkAt - p.life) * 4;
          v.group.visible = Math.floor(p.life * blinkRate) % 2 === 0;
        }
      }
    },

    reset() {
      for (let i = 0; i < list.length; i++) {
        list[i].active = false;
        visuals[i].group.visible = false;
      }
      cursor = 0;
    },
  };
}
