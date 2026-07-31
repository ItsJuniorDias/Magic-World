import * as THREE from "three";
import { PROJECTILE, WEAPONS, type WeaponId } from "../config";
import { PALETTE } from "../art/palette";
import { PaperKit } from "../art/paper";
import type { Fx } from "../art/fx";
import type { Enemy, Projectile } from "../types";
import { outOfBounds } from "./physics";

/**
 * Every bolt in the game, friendly and hostile, lives in one fixed pool.
 *
 * The visuals are a matching pool of meshes — a bright core card plus an
 * additive glow disc — that get shown, moved and hidden. Nothing is created
 * or destroyed while the game is running.
 *
 * Piercing shots use a bitmask of enemy indices they've already hit. A Set
 * would be clearer but allocates on every shot; with a pool capped at 32
 * enemies a single 32-bit int does the same job for free.
 */

export interface ProjectileSystem {
  root: THREE.Group;
  list: Projectile[];
  spawn(
    x: number,
    y: number,
    aimX: number,
    aimY: number,
    weapon: WeaponId,
    hostile: boolean,
    /**
     * When set, forces the piercing flag on this volley regardless of
     * the weapon spec. Used by the Piercing Bolt counter item (bought
     * for the Cinder Warden fight) which upgrades the default bolt for
     * one boss without changing the weapon slot.
     */
    piercingOverride?: boolean,
  ): void;
  spawnRaw(
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    radius: number,
    hostile: boolean,
  ): void;
  update(dt: number, enemies: Enemy[], fx: Fx): void;
  reset(): void;
}

export function createProjectiles(kit: PaperKit): ProjectileSystem {
  const root = new THREE.Group();
  root.name = "projectiles";

  const list: Projectile[] = [];
  const cores: THREE.Mesh[] = [];
  const glows: THREE.Mesh[] = [];
  const coreMats: THREE.MeshBasicMaterial[] = [];

  for (let i = 0; i < PROJECTILE.poolSize; i++) {
    list.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      damage: 1,
      radius: 0.2,
      piercing: false,
      homing: false,
      hostile: false,
      hitMask: 0,
    });

    // A four-point star reads as a spark at any size and stays legible when
    // it's only a few pixels across, which a circle does not.
    const coreMat = kit.uniqueMaterial(PALETTE.arcaneCore);
    const coreGeo = new THREE.ExtrudeGeometry(PaperKit.star(4, 0.2, 0.34), {
      depth: 0.1,
      bevelEnabled: false,
      curveSegments: 4,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.renderOrder = 27;
    core.visible = false;
    root.add(core);
    cores.push(core);
    coreMats.push(coreMat);

    const glow = kit.glowDisc(0.46, PALETTE.arcane, 12);
    glow.renderOrder = 26;
    glow.visible = false;
    root.add(glow);
    glows.push(glow);
  }

  let cursor = 0;

  function acquire(): number {
    // Linear probe from the cursor. With a pool of 96 and a lifetime of
    // 2.2s this effectively never fails, but if it does we overwrite the
    // oldest slot rather than dropping the shot — a shot that silently
    // doesn't appear is far worse than one that cuts another short.
    for (let i = 0; i < PROJECTILE.poolSize; i++) {
      const idx = (cursor + i) % PROJECTILE.poolSize;
      if (!list[idx].active) {
        cursor = (idx + 1) % PROJECTILE.poolSize;
        return idx;
      }
    }
    const idx = cursor;
    cursor = (cursor + 1) % PROJECTILE.poolSize;
    return idx;
  }

  function arm(
    idx: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    radius: number,
    piercing: boolean,
    homing: boolean,
    hostile: boolean,
  ): void {
    const p = list[idx];
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = PROJECTILE.lifetime;
    p.damage = damage;
    p.radius = radius;
    p.piercing = piercing;
    p.homing = homing;
    p.hostile = hostile;
    p.hitMask = 0;

    const tint = hostile ? PALETTE.danger : PALETTE.arcaneCore;
    const glowTint = hostile ? PALETTE.skyEmber : PALETTE.arcane;
    coreMats[idx].color.setHex(tint);
    (glows[idx].material as THREE.MeshBasicMaterial).color.setHex(glowTint);

    const scale = radius / 0.2;
    cores[idx].scale.setScalar(scale);
    glows[idx].scale.setScalar(scale);
    cores[idx].visible = true;
    glows[idx].visible = true;
  }

  function release(idx: number): void {
    list[idx].active = false;
    cores[idx].visible = false;
    glows[idx].visible = false;
  }

  return {
    root,
    list,

    spawn(x, y, aimX, aimY, weapon, hostile, piercingOverride) {
      const spec = WEAPONS[weapon];
      const piercing = piercingOverride ?? spec.piercing;
      const base = Math.atan2(aimY, aimX);
      for (let i = 0; i < spec.count; i++) {
        // Distribute evenly across the spread, centred on the aim.
        const offset =
          spec.count === 1 ? 0 : (i / (spec.count - 1) - 0.5) * spec.spread;
        const angle = base + offset;
        const idx = acquire();
        arm(
          idx,
          x,
          y,
          Math.cos(angle) * spec.speed,
          Math.sin(angle) * spec.speed,
          spec.damage,
          spec.radius,
          piercing,
          spec.homing,
          hostile,
        );
      }
    },

    spawnRaw(x, y, vx, vy, damage, radius, hostile) {
      arm(acquire(), x, y, vx, vy, damage, radius, false, false, hostile);
    },

    update(dt, enemies, fx) {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!p.active) continue;

        p.life -= dt;
        if (p.life <= 0) {
          release(i);
          continue;
        }

        // Homing: steer the velocity vector toward the nearest live enemy,
        // capped by a turn rate so it can still be dodged.
        if (p.homing) {
          let bestDist = Infinity;
          let target: Enemy | null = null;
          for (const e of enemies) {
            if (!e.active) continue;
            const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
            if (d < bestDist) {
              bestDist = d;
              target = e;
            }
          }
          if (target) {
            const desired = Math.atan2(target.y - p.y, target.x - p.x);
            const current = Math.atan2(p.vy, p.vx);
            let delta = desired - current;
            // Wrap into [-PI, PI] so it turns the short way round.
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            const maxTurn = PROJECTILE.homingTurnRate * dt;
            const turn = Math.max(-maxTurn, Math.min(maxTurn, delta));
            const speed = Math.hypot(p.vx, p.vy);
            const next = current + turn;
            p.vx = Math.cos(next) * speed;
            p.vy = Math.sin(next) * speed;
          }
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (outOfBounds(p.x, p.y)) {
          release(i);
          continue;
        }

        cores[i].position.set(p.x, p.y, 0.9);
        glows[i].position.set(p.x, p.y, 0.85);
        // Spin the core and point the glow along travel — a static sprite
        // reads as a floating dot, a spinning one reads as energy.
        cores[i].rotation.z += dt * 14;

        // One trail dot every frame, at a fraction of the projectile size.
        if (Math.random() < 0.65) {
          fx.trail(p.x, p.y, p.hostile ? PALETTE.skyEmber : PALETTE.arcane, p.radius * 26);
        }
      }
    },

    reset() {
      for (let i = 0; i < list.length; i++) release(i);
      cursor = 0;
    },
  };
}

/** Marks an enemy index as already hit by a piercing shot. */
export function markHit(p: Projectile, enemyIndex: number): void {
  p.hitMask |= 1 << (enemyIndex & 31);
}

export function alreadyHit(p: Projectile, enemyIndex: number): boolean {
  return (p.hitMask & (1 << (enemyIndex & 31))) !== 0;
}
