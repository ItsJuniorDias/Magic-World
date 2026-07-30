import * as THREE from "three";
import {
  ARENA,
  BAT,
  DRAGON,
  ENEMIES,
  ENEMY_POOL_SIZE,
  GOLEM,
  SLIME,
  WISP,
  type EnemyKind,
} from "../config";
import { createCreature, type Creature } from "../art/bestiary";
import type { Fx } from "../art/fx";
import { PALETTE } from "../art/palette";
import type { PaperKit } from "../art/paper";
import type { Enemy, Player, PoseLike } from "../types";
import { clampToArena, resolveGround } from "./physics";
import type { ProjectileSystem } from "./projectiles";

/**
 * Enemy pool and behaviour.
 *
 * Visuals are pooled *per kind*: building a dragon costs a dozen extrusions,
 * so we build one of each kind up front and reuse it. A slot's `visual` field
 * points at the creature instance currently representing it.
 *
 * The AI is deliberately simple. Every enemy in a run-and-gun exists to
 * create a specific spatial problem for the player, not to be clever:
 *
 *   slime — occupies ground, forces jumping
 *   bat   — occupies air, forces looking up
 *   wisp  — attacks at range, forces closing distance or dodging
 *   golem — soaks damage and denies an area, forces repositioning
 *   dragon— all four at once, on a timer
 *
 * Enemies that outsmart the player are not fun. Enemies that arrive in
 * combinations the player has to solve are.
 */

export interface EnemySystem {
  root: THREE.Group;
  list: Enemy[];
  spawn(kind: EnemyKind, x: number, y: number): Enemy | null;
  update(dt: number, player: Player, projectiles: ProjectileSystem, fx: Fx, elapsed: number): void;
  /** Applies damage; returns true when the enemy died from it. */
  damage(index: number, amount: number, fromX: number, fx: Fx): boolean;
  countActive(): number;
  boss(): Enemy | null;
  reset(): void;
  /** Called after simulation to sync meshes. */
  render(elapsed: number): void;
}

interface VisualPool {
  kind: EnemyKind;
  creature: Creature;
  inUse: boolean;
}

export function createEnemies(kit: PaperKit): EnemySystem {
  const root = new THREE.Group();
  root.name = "enemies";

  const list: Enemy[] = [];
  for (let i = 0; i < ENEMY_POOL_SIZE; i++) {
    list.push({
      active: false,
      kind: "slime",
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      hp: 1,
      maxHp: 1,
      facing: 1,
      onGround: false,
      timer: 0,
      timer2: 0,
      state: 0,
      flash: 0,
      phase: 0,
      visual: -1,
    });
  }

  // Visual pool. Counts are sized to how many of each kind can plausibly be
  // on screen at once, which is much lower than the total enemy pool.
  const visuals: VisualPool[] = [];
  const counts: Record<EnemyKind, number> = {
    slime: 12,
    bat: 10,
    golem: 5,
    wisp: 6,
    dragon: 1,
  };
  for (const kind of Object.keys(counts) as EnemyKind[]) {
    for (let i = 0; i < counts[kind]; i++) {
      const creature = createCreature(kit, kind);
      creature.root.visible = false;
      root.add(creature.root);
      visuals.push({ kind, creature, inUse: false });
    }
  }

  function acquireVisual(kind: EnemyKind): number {
    for (let i = 0; i < visuals.length; i++) {
      if (visuals[i].kind === kind && !visuals[i].inUse) {
        visuals[i].inUse = true;
        visuals[i].creature.reset();
        visuals[i].creature.root.visible = true;
        return i;
      }
    }
    return -1;
  }

  function releaseVisual(index: number): void {
    if (index < 0 || index >= visuals.length) return;
    visuals[index].inUse = false;
    visuals[index].creature.root.visible = false;
  }

  function despawn(e: Enemy): void {
    e.active = false;
    releaseVisual(e.visual);
    e.visual = -1;
  }

  return {
    root,
    list,

    spawn(kind, x, y) {
      const spec = ENEMIES[kind];
      const visual = acquireVisual(kind);
      if (visual < 0) return null; // no free mesh; skip rather than pop in

      for (const e of list) {
        if (e.active) continue;
        e.active = true;
        e.kind = kind;
        e.x = x;
        e.y = y;
        e.vx = 0;
        e.vy = 0;
        e.hp = spec.hp;
        e.maxHp = spec.hp;
        e.facing = x > 0 ? -1 : 1;
        e.onGround = false;
        e.timer = Math.random() * 0.6;
        e.timer2 = 0;
        e.state = 0;
        e.flash = 0;
        e.phase = Math.random() * Math.PI * 2;
        e.visual = visual;
        return e;
      }

      releaseVisual(visual);
      return null;
    },

    update(dt, player, projectiles, fx, elapsed) {
      for (const e of list) {
        if (!e.active) continue;

        const spec = ENEMIES[e.kind];
        const previousY = e.y;
        if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 6);

        const toPlayerX = player.x - e.x;
        const distX = Math.abs(toPlayerX);
        const dirX: 1 | -1 = toPlayerX >= 0 ? 1 : -1;

        switch (e.kind) {
          // ---------------------------------------------------------------
          case "slime": {
            e.timer -= dt;
            if (e.onGround) {
              // Friction while grounded, so a slime lands and settles.
              e.vx *= Math.max(0, 1 - 7 * dt);
              if (e.timer <= 0) {
                e.timer = SLIME.hopInterval * (0.8 + Math.random() * 0.5);
                e.vy = SLIME.hopVelocity;
                e.vx = dirX * SLIME.hopForward;
                e.facing = dirX;
                e.onGround = false;
              }
            }
            e.vy -= 42 * dt;
            break;
          }

          // ---------------------------------------------------------------
          case "bat": {
            // Flies a sine path toward the player's head height. The wave is
            // what makes it hard to lead — a bat on a straight line is a
            // free kill.
            const targetY = player.y + 1.4 + Math.sin(elapsed * BAT.waveFrequency + e.phase) * BAT.waveAmplitude;
            const dy = targetY - e.y;
            e.vx = dirX * spec.speed;
            e.vy = Math.max(-spec.speed, Math.min(spec.speed, dy * 3.4));
            e.facing = dirX;
            // Close in fast once it commits.
            if (distX < BAT.diveRange) e.vx *= 1.35;
            break;
          }

          // ---------------------------------------------------------------
          case "golem": {
            // 0 = approach, 1 = windup, 2 = recover
            if (e.state === 0) {
              e.vx = dirX * spec.speed;
              e.facing = dirX;
              if (distX < GOLEM.slamRange && e.onGround) {
                e.state = 1;
                e.timer = GOLEM.slamWindup;
                e.vx = 0;
              }
            } else if (e.state === 1) {
              e.vx = 0;
              e.timer -= dt;
              if (e.timer <= 0) {
                e.state = 2;
                e.timer = GOLEM.slamRecovery;
                fx.shockwave(e.x, e.y + 0.1, PALETTE.golemCore, GOLEM.slamShockwaveRadius, 0.45);
                fx.spray(e.x, e.y + 0.1, 16, PALETTE.golemFace, 0, 1, 2.4, 9);
                // The slam is a physical hazard, resolved by the caller via
                // the shockwave radius check below.
                e.timer2 = 1;
              }
            } else {
              e.vx = 0;
              e.timer -= dt;
              if (e.timer <= 0) e.state = 0;
            }
            e.vy -= 42 * dt;
            break;
          }

          // ---------------------------------------------------------------
          case "wisp": {
            // Hovers at a preferred distance and fires. Backs off when the
            // player closes, so it can't be trivially melted point-blank.
            const desired = WISP.preferredDistance;
            const error = distX - desired;
            e.vx = Math.max(-spec.speed, Math.min(spec.speed, error * 1.4)) * dirX;
            const targetY = player.y + 2.6 + Math.sin(elapsed * 1.4 + e.phase) * 0.7;
            e.vy = Math.max(-spec.speed, Math.min(spec.speed, (targetY - e.y) * 2.6));
            e.facing = dirX;

            e.timer -= dt;
            // timer2 doubles as the charge indicator for the art layer.
            e.timer2 = Math.max(0, 1 - e.timer / 0.55);
            if (e.timer <= 0) {
              e.timer = WISP.fireInterval * (0.85 + Math.random() * 0.4);
              e.timer2 = 0;
              const aimAngle = Math.atan2(player.y + 0.8 - e.y, player.x - e.x);
              projectiles.spawnRaw(
                e.x,
                e.y,
                Math.cos(aimAngle) * WISP.projectileSpeed,
                Math.sin(aimAngle) * WISP.projectileSpeed,
                1,
                0.26,
                true,
              );
              fx.burst(e.x, e.y, 6, PALETTE.wispFace, 3, 7);
            }
            break;
          }

          // ---------------------------------------------------------------
          case "dragon": {
            const hpFraction = e.hp / e.maxHp;
            const phase = hpFraction > DRAGON.phase2At ? 1 : hpFraction > DRAGON.phase3At ? 2 : 3;
            // Later phases act faster. One number, three difficulty tiers.
            const rate = phase === 1 ? 1 : phase === 2 ? 1.35 : 1.8;

            // Drift toward a hover point that tracks the player loosely.
            const hoverTarget = Math.max(
              -ARENA.halfWidth + 4,
              Math.min(ARENA.halfWidth - 4, player.x + Math.sin(elapsed * 0.6) * 6),
            );
            e.vx = Math.max(-spec.speed, Math.min(spec.speed, (hoverTarget - e.x) * 1.1));
            e.vy = (DRAGON.hoverY + Math.sin(elapsed * 0.9) * 0.9 - e.y) * 1.8;
            e.facing = dirX;

            e.timer -= dt * rate;
            e.timer2 = Math.max(0, 1 - e.timer / 0.9);
            if (e.timer <= 0) {
              e.timer = DRAGON.breathInterval;
              e.timer2 = 0;
              // A fan of fire aimed at the player's current position. The
              // spread means standing still is never the answer.
              const base = Math.atan2(player.y + 0.8 - e.y, player.x - e.x);
              for (let i = 0; i < DRAGON.breathCount; i++) {
                const offset = (i / (DRAGON.breathCount - 1) - 0.5) * DRAGON.breathSpread;
                const angle = base + offset;
                projectiles.spawnRaw(
                  e.x + Math.cos(angle) * 1.6,
                  e.y + Math.sin(angle) * 1.6,
                  Math.cos(angle) * DRAGON.breathSpeed * rate,
                  Math.sin(angle) * DRAGON.breathSpeed * rate,
                  1,
                  0.3,
                  true,
                );
              }
              fx.burst(e.x + dirX * 1.8, e.y, 18, PALETTE.skyEmber, 7, 12);
            }

            // Phase 3 drops eggs that hatch into slimes, so the arena floor
            // stops being a safe place to stand and shoot upward.
            if (phase === 3) {
              e.state -= 1;
              if (e.state <= 0) {
                e.state = Math.round(DRAGON.eggInterval * 60);
                // Signalled to the caller by returning through the fx layer;
                // the wave director owns actual spawning.
                pendingEggs.push({ x: e.x, y: e.y - 1.2 });
              }
            }
            break;
          }
        }

        // ---- Integrate ------------------------------------------------
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.x = clampToArena(e.x, spec.halfW);

        // Only ground-bound kinds collide with the floor.
        if (e.kind === "slime" || e.kind === "golem") {
          const ground = resolveGround(e.x, e.y, e.vy, spec.halfW, previousY);
          if (ground.onGround && ground.surfaceY !== null) {
            if (!e.onGround && e.kind === "slime") {
              fx.spray(e.x, e.y, 5, PALETTE.slimeEdge, 0, 1, 2.2, 3.5);
            }
            e.y = ground.surfaceY;
            e.vy = 0;
            e.onGround = true;
          } else {
            e.onGround = false;
          }
        } else {
          e.y = Math.max(ARENA.floorY + 0.8, Math.min(ARENA.ceilingY, e.y));
        }
      }
    },

    damage(index, amount, fromX, fx) {
      const e = list[index];
      if (!e.active) return false;
      const spec = ENEMIES[e.kind];
      e.hp -= amount;
      e.flash = 1;

      // Knockback, scaled per kind. A golem barely flinches; that resistance
      // is most of what communicates "this one is heavy".
      const away = e.x >= fromX ? 1 : -1;
      e.vx += away * 6.5 * spec.knockbackScale;
      if (spec.knockbackScale > 0.5 && e.kind !== "bat") e.vy += 2.2 * spec.knockbackScale;

      fx.burst(e.x, e.y + spec.halfH * 0.4, 5, PALETTE.arcaneCore, 4.5, 7);

      if (e.hp <= 0) {
        const deathColor =
          e.kind === "slime"
            ? PALETTE.slimeFace
            : e.kind === "bat"
              ? PALETTE.batFace
              : e.kind === "golem"
                ? PALETTE.golemFace
                : e.kind === "wisp"
                  ? PALETTE.wispFace
                  : PALETTE.dragonFace;
        const scale = e.kind === "dragon" ? 3 : 1;
        fx.burst(e.x, e.y + spec.halfH * 0.5, 18 * scale, deathColor, 8 * scale, 11 * scale);
        fx.burst(e.x, e.y + spec.halfH * 0.5, 10 * scale, PALETTE.gold, 5 * scale, 8 * scale);
        fx.shockwave(e.x, e.y + spec.halfH * 0.5, deathColor, 1.6 * scale, 0.32);
        despawn(e);
        return true;
      }
      return false;
    },

    countActive() {
      let n = 0;
      for (const e of list) if (e.active) n += 1;
      return n;
    },

    boss() {
      for (const e of list) if (e.active && e.kind === "dragon") return e;
      return null;
    },

    reset() {
      for (const e of list) if (e.active) despawn(e);
      pendingEggs.length = 0;
    },

    render(elapsed) {
      for (const e of list) {
        if (!e.active || e.visual < 0) continue;
        const slot = visuals[e.visual];
        const creature = slot.creature;
        const spec = ENEMIES[e.kind];

        creature.root.position.set(e.x, e.y, 0);
        creature.puppet.setFacing(e.facing);
        creature.setFlash(e.flash);

        const pose: PoseLike = {
          time: elapsed,
          speed: Math.abs(e.vx),
          speedRatio: Math.min(1, Math.abs(e.vx) / Math.max(0.001, spec.speed)),
          onGround: e.onGround,
          vy: e.vy,
          aimAngle: null,
          recoil: 0,
          phase: e.phase,
        };

        // `extra` carries the per-kind charge/windup value the art layer uses
        // for telegraphing. Golem: windup progress. Wisp/dragon: charge.
        let extra = 0;
        if (e.kind === "golem" && e.state === 1) {
          extra = 1 - e.timer / GOLEM.slamWindup;
        } else if (e.kind === "wisp" || e.kind === "dragon") {
          extra = e.timer2;
        }
        creature.update(pose, extra);
      }
    },
  };
}

/**
 * Eggs the dragon has dropped this frame, drained by the wave director.
 * Module-level because the boss can't spawn enemies itself without a
 * circular dependency between the enemy system and its own pool.
 */
export const pendingEggs: { x: number; y: number }[] = [];
