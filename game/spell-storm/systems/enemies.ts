import * as THREE from "three";
import {
  BAT,
  BOSS,
  ENEMIES,
  ENEMY_POOL_SIZE,
  GOLEM,
  isBossKind,
  SLIME,
  WISP,
  type BossKind,
  type EnemyKind,
  type MinionKind,
} from "../config";
import { createCreature, type Creature } from "../art/bestiary";
import type { Fx } from "../art/fx";
import { PALETTE } from "../art/palette";
import type { PaperKit } from "../art/paper";
import type { Enemy, Player, PoseLike } from "../types";
import { ARENA_STATE } from "./arena";
import { updateBoss, type BossContext } from "./bossAI";
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
  update(
    dt: number,
    player: Player,
    projectiles: ProjectileSystem,
    fx: Fx,
    elapsed: number,
    shake: (amount: number) => void,
  ): void;
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

/** Death burst colour per kind. A lookup beats a five-deep ternary. */
const DEATH_COLOR: Partial<Record<EnemyKind, number>> = {
  slime: PALETTE.slimeFace,
  bat: PALETTE.batFace,
  golem: PALETTE.golemFace,
  wisp: PALETTE.wispFace,
  gorgeMother: PALETTE.gorgeCore,
  nightwing: PALETTE.nightEye,
  cinderWarden: PALETTE.cinderCore,
  lumenChoir: PALETTE.choirCore,
  thornWarden: PALETTE.thornSpike,
  voidmaw: PALETTE.voidEye,
  dragon: PALETTE.dragonFace,
};

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
      timer3: 0,
      phaseIndex: 0,
      invulnerable: 0,
      tell: 0,
      anchorX: 0,
      anchorY: 0,
    });
  }

  // Visual pool. Counts are sized to how many of each kind can plausibly be
  // on screen at once, which is much lower than the total enemy pool.
  const visuals: VisualPool[] = [];
  //
  // Bosses are NOT pre-built. Building all seven up front costs ~90
  // extrusions of geometry that will never be seen in the same room, and the
  // player only ever meets one at a time. They're built lazily on first
  // spawn and kept afterwards, so a retry after dying is instant.
  const counts: Record<MinionKind, number> = {
    slime: 12,
    bat: 10,
    golem: 5,
    wisp: 6,
  };
  for (const kind of Object.keys(counts) as MinionKind[]) {
    for (let i = 0; i < counts[kind]; i++) {
      const creature = createCreature(kit, kind);
      creature.root.visible = false;
      root.add(creature.root);
      visuals.push({ kind, creature, inUse: false });
    }
  }

  /** Lazily builds a boss visual the first time that boss is entered. */
  function ensureBossVisual(kind: BossKind): void {
    if (visuals.some((v) => v.kind === kind)) return;
    const creature = createCreature(kit, kind);
    creature.root.visible = false;
    root.add(creature.root);
    visuals.push({ kind, creature, inUse: false });
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

  /**
   * Shared integration + ground resolution. Bosses and minions differ in how
   * they DECIDE to move; they agree completely on what happens afterwards.
   */
  function integrate(e: Enemy, dt: number, halfW: number, previousY: number, fx: Fx): void {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = clampToArena(e.x, halfW);

    const grounded =
      e.kind === "slime" ||
      e.kind === "golem" ||
      e.kind === "gorgeMother" ||
      e.kind === "cinderWarden" ||
      e.kind === "thornWarden";

    if (grounded) {
      const ground = resolveGround(e.x, e.y, e.vy, halfW, previousY);
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
      // Anything that walks off the bottom of the world in a room with a pit
      // gets put back on the floor rather than falling out of the level.
      if (e.y < ARENA_STATE.floorY - 6) {
        e.y = ARENA_STATE.floorY;
        e.vy = 0;
        e.onGround = true;
      }
    } else {
      e.y = Math.max(ARENA_STATE.floorY + 0.8, Math.min(ARENA_STATE.ceilingY - 0.8, e.y));
    }
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
      if (isBossKind(kind)) ensureBossVisual(kind);
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
        e.timer3 = 0;
        e.tell = 0;
        e.anchorX = x;
        e.anchorY = y;
        if (isBossKind(kind)) {
          e.phaseIndex = 1;
          // The intro roar doubles as a grace period: the arena gates slam
          // shut, the name card animates in, and the player gets a beat to
          // read the silhouette before anything can hit them.
          e.invulnerable = BOSS.introTime;
          e.timer = 1.2;
          e.facing = x > 0 ? -1 : 1;
        } else {
          e.phaseIndex = 0;
          e.invulnerable = 0;
        }
        return e;
      }

      releaseVisual(visual);
      return null;
    },

    update(dt, player, projectiles, fx, elapsed, shake) {
      const bossCtx: BossContext = { dt, player, projectiles, fx, elapsed, shake };

      for (const e of list) {
        if (!e.active) continue;

        const spec = ENEMIES[e.kind];
        const previousY = e.y;
        if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 6);

        // Bosses have their own file. They share the integration and ground
        // resolution below, but nothing else.
        if (isBossKind(e.kind)) {
          updateBoss(e, e.kind, bossCtx);
          integrate(e, dt, spec.halfW, previousY, fx);
          continue;
        }

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

          default:
            break;
        }

        integrate(e, dt, spec.halfW, previousY, fx);
      }
    },

    damage(index, amount, fromX, fx) {
      const e = list[index];
      if (!e.active) return false;
      // Boss intro and Voidmaw's collapse. The hit still registers visually
      // via a dim flash so the player isn't left wondering if their shots
      // are even reaching — they just do nothing.
      if (e.invulnerable > 0) {
        e.flash = Math.max(e.flash, 0.35);
        fx.burst(e.x, e.y + 0.6, 3, PALETTE.paperEdge, 3, 5);
        return false;
      }
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
        const deathColor = DEATH_COLOR[e.kind] ?? PALETTE.arcane;
        const scale = isBossKind(e.kind) ? 3 : 1;
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
      for (const e of list) if (e.active && isBossKind(e.kind)) return e;
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
        if (isBossKind(e.kind)) {
          extra = e.tell;
        } else if (e.kind === "golem" && e.state === 1) {
          extra = 1 - e.timer / GOLEM.slamWindup;
        } else if (e.kind === "wisp") {
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
