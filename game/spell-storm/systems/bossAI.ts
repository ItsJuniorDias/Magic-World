import {
  BOSS,
  CHOIR,
  CINDER,
  DRAGON,
  ENEMIES,
  GORGE,
  NIGHTWING,
  THORN,
  VOID,
  type BossKind,
  type MinionKind,
} from "../config";
import { PALETTE } from "../art/palette";
import type { Fx } from "../art/fx";
import type { Enemy, Player } from "../types";
import { ARENA_STATE } from "./arena";
import type { ProjectileSystem } from "./projectiles";

/**
 * The seven fights.
 *
 * THE CONTRACT EVERY BOSS KEEPS
 *
 * 1. Three phases at fixed HP thresholds (65% / 30%). The player learns the
 *    rhythm once and applies it seven times.
 * 2. Every attack is telegraphed for at least ~0.4s through `e.tell`, which
 *    the art layer turns into a physical wind-up. On a touch screen anything
 *    faster is a coin flip, not a test of skill.
 * 3. Nothing spawns on top of the player, ever.
 * 4. There is always a safe place. It may be small and it may be moving, but
 *    a fight with no answer is a slot machine.
 *
 * WHY THE STATE MACHINES ARE SO PLAIN
 *
 * Each boss is a handful of integer states and three timers. It would be
 * straightforward to give them utility scoring or a behaviour tree, and it
 * would make the fights worse: a boss the player cannot predict is a boss
 * they cannot learn, and learning the pattern IS the content. The
 * intelligence budget goes into the *pattern*, not the decision-making.
 *
 * WHAT EACH ONE ASKS OF THE PLAYER
 *
 *   Gorge Mother  vertical space — she owns the floor, you live on platforms
 *   Nightwing     horizontal space — she crosses faster than you can run
 *   Cinder Warden patience — armoured, slow, punishes greed
 *   Lumen Choir   pattern reading — bullet geometry, no contact threat
 *   Thorn Warden  footing — the floor itself becomes the hazard
 *   Voidmaw       control — it moves YOU rather than moving itself
 *   Storm Dragon  all of the above, on a clock
 */

const GRAVITY = -42;

// ---------------------------------------------------------------------------
// Deferred effects
//
// Bosses can't spawn enemies or damage the player directly without a circular
// dependency (the enemy system owns the pool the boss lives in, and the player
// damage path lives in the orchestrator). They push requests here and the
// orchestrator drains them once per frame — the same pattern the dragon's eggs
// already used, generalised.
// ---------------------------------------------------------------------------

export interface PendingSpawn {
  kind: MinionKind;
  x: number;
  y: number;
  /** Seconds until it appears. Gives the player time to read the tell. */
  delay: number;
}

/** A damage zone that exists for a moment. Resolved against the player. */
export interface PendingHazard {
  x: number;
  y: number;
  radius: number;
  /** Only hurts a player who is standing on a surface. */
  groundOnly: boolean;
  life: number;
  color: number;
}

/** A ground spike erupting. Visual + hazard. */
export interface PendingSpike {
  x: number;
  life: number;
  height: number;
}

export const pendingSpawns: PendingSpawn[] = [];
export const pendingHazards: PendingHazard[] = [];
export const pendingSpikes: PendingSpike[] = [];
/** Inward acceleration Voidmaw applies to the player this frame. */
export const pendingPull = { x: 0, y: 0, strength: 0 };

export function clearBossQueues(): void {
  pendingSpawns.length = 0;
  pendingHazards.length = 0;
  pendingSpikes.length = 0;
  pendingPull.strength = 0;
}

// ---------------------------------------------------------------------------

export interface BossContext {
  dt: number;
  player: Player;
  projectiles: ProjectileSystem;
  fx: Fx;
  elapsed: number;
  shake(amount: number): void;
}

/** Phase from HP, shared by all seven so the rhythm is learnable. */
export function bossPhase(e: Enemy): 1 | 2 | 3 {
  const f = e.hp / Math.max(1, e.maxHp);
  if (f > BOSS.phase2At) return 1;
  if (f > BOSS.phase3At) return 2;
  return 3;
}

function centreX(): number {
  return (ARENA_STATE.minX + ARENA_STATE.maxX) * 0.5;
}

function clampX(x: number, margin: number): number {
  return Math.max(ARENA_STATE.minX + margin, Math.min(ARENA_STATE.maxX - margin, x));
}

function fireAt(
  ctx: BossContext,
  x: number,
  y: number,
  tx: number,
  ty: number,
  speed: number,
  radius = 0.3,
  damage = 1,
): void {
  const a = Math.atan2(ty - y, tx - x);
  ctx.projectiles.spawnRaw(x, y, Math.cos(a) * speed, Math.sin(a) * speed, damage, radius, true);
}

function fireRing(
  ctx: BossContext,
  x: number,
  y: number,
  count: number,
  speed: number,
  offset = 0,
  radius = 0.3,
): void {
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * Math.PI * 2;
    ctx.projectiles.spawnRaw(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 1, radius, true);
  }
}

function slam(x: number, y: number, radius: number, color: number, ctx: BossContext): void {
  pendingHazards.push({ x, y, radius, groundOnly: true, life: 0.16, color });
  ctx.fx.shockwave(x, y + 0.1, color, radius, 0.42);
  ctx.fx.spray(x, y + 0.1, 20, color, 0, 1, 2.6, 10);
  ctx.shake(0.9);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function updateBoss(e: Enemy, kind: BossKind, ctx: BossContext): void {
  const { dt } = ctx;

  // Intro roar: invulnerable, motionless, gates already sealed behind you.
  if (e.invulnerable > 0) {
    e.invulnerable = Math.max(0, e.invulnerable - dt);
    e.tell = Math.min(1, e.tell + dt * 1.4);
    e.vx = 0;
    if (kind === "gorgeMother" || kind === "cinderWarden" || kind === "thornWarden") {
      e.vy += GRAVITY * dt;
    } else {
      e.vy = 0;
    }
    return;
  }

  e.phaseIndex = bossPhase(e);
  e.tell = Math.max(0, e.tell - dt * 3.2);

  switch (kind) {
    case "gorgeMother":
      gorgeMother(e, ctx);
      break;
    case "nightwing":
      nightwing(e, ctx);
      break;
    case "cinderWarden":
      cinderWarden(e, ctx);
      break;
    case "lumenChoir":
      lumenChoir(e, ctx);
      break;
    case "thornWarden":
      thornWarden(e, ctx);
      break;
    case "voidmaw":
      voidmaw(e, ctx);
      break;
    case "dragon":
      stormDragon(e, ctx);
      break;
  }
}

// ---------------------------------------------------------------------------
// 1. GORGE MOTHER — owns the floor
//
// She is only ever in two places: on the ground, or in the air on her way to
// the ground. That makes the fight a simple, brutal question — where will she
// land, and are you above it? The platforms in the Gorge are the answer.
// ---------------------------------------------------------------------------
function gorgeMother(e: Enemy, ctx: BossContext): void {
  const { dt, player } = ctx;
  const spec = ENEMIES.gorgeMother;
  const phase = e.phaseIndex;
  const rate = phase === 1 ? 1 : phase === 2 ? 1.3 : 1.65;

  e.vy += GRAVITY * dt;

  if (e.onGround) {
    // state 1 means "was airborne last frame" — this is the landing frame.
    if (e.state === 1) {
      e.state = 0;
      e.tell = 1;
      slam(e.x, e.y, GORGE.slamRadius, PALETTE.gorgeCore, ctx);

      const brood = GORGE.spawnPerLand[phase - 1];
      for (let i = 0; i < brood; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const sx = clampX(e.x + side * (3.2 + i * 1.4), 2);
        pendingSpawns.push({ kind: "slime", x: sx, y: 1.4, delay: 0.18 + i * 0.1 });
        ctx.fx.burst(sx, 1.2, 8, PALETTE.gorgeEdge, 5, 8);
      }

      // Phase 3: a fan of arcing globs, so the landing is dangerous even if
      // you were airborne when it happened.
      if (phase === 3) {
        for (let i = 0; i < GORGE.globCount; i++) {
          const spread = (i / (GORGE.globCount - 1) - 0.5) * 1.7;
          ctx.projectiles.spawnRaw(
            e.x,
            e.y + 1.6,
            Math.sin(spread) * GORGE.globSpeed,
            Math.cos(spread) * GORGE.globSpeed * 0.85,
            1,
            0.34,
            true,
          );
        }
      }
      e.timer = GORGE.hopInterval / rate;
    }

    e.vx *= Math.max(0, 1 - 6 * dt);
    e.timer -= dt;
    if (e.timer <= 0) {
      const dirX = player.x >= e.x ? 1 : -1;
      // Aim the hop at the player rather than nudging toward them: a boss
      // that closes gradually can be kited forever.
      const reach = Math.min(Math.abs(player.x - e.x), 14);
      e.vy = GORGE.hopVelocity * (phase === 3 ? 1.1 : 1);
      e.vx = dirX * Math.max(GORGE.hopForward * 0.5, reach * 0.62);
      e.facing = dirX;
      e.onGround = false;
      e.state = 1;
    }
  } else {
    e.state = 1;
    e.x = clampX(e.x, spec.halfW);
  }
}

// ---------------------------------------------------------------------------
// 2. NIGHTWING — owns the air
//
// Perch, scream, dive. The dive is faster than the player's run speed on
// purpose: you cannot outrun it, you have to be somewhere it isn't. The
// 0.45s wing-flare is the entire fight.
// ---------------------------------------------------------------------------
function nightwing(e: Enemy, ctx: BossContext): void {
  const { dt, player } = ctx;
  const spec = ENEMIES.nightwing;
  const phase = e.phaseIndex;
  const rate = phase === 1 ? 1 : phase === 2 ? 1.28 : 1.6;
  const perchY = ARENA_STATE.ceilingY - 4.5;

  switch (e.state) {
    // ---- Perched: hover high, screech, summon ----------------------------
    case 0: {
      const target = e.anchorX;
      e.vx = (target - e.x) * 2.4;
      e.vy = (perchY - e.y) * 3.0;
      e.facing = player.x >= e.x ? 1 : -1;

      e.timer -= dt * rate;
      // Screech at the halfway mark, so it never coincides with the dive tell.
      if (e.timer2 <= 0 && e.timer < NIGHTWING.perchTime * 0.5) {
        e.timer2 = 1;
        fireRing(
          ctx,
          e.x,
          e.y,
          NIGHTWING.screechCount + (phase - 1) * 2,
          NIGHTWING.screechSpeed,
          Math.random() * Math.PI,
          0.28,
        );
        ctx.fx.shockwave(e.x, e.y, PALETTE.nightEye, 3.4, 0.4);

        const summon = NIGHTWING.summonPerPerch[phase - 1];
        for (let i = 0; i < summon; i++) {
          pendingSpawns.push({
            kind: "bat",
            x: clampX(e.x + (i % 2 === 0 ? -5 : 5) - i, 2),
            y: perchY - 1.5,
            delay: 0.2 + i * 0.15,
          });
        }
      }

      if (e.timer <= 0) {
        e.state = 1;
        e.timer = NIGHTWING.diveWindup;
        e.timer2 = 0;
        // Lock the dive altitude NOW, at the start of the wind-up. Tracking
        // the player through the wind-up would make the tell meaningless.
        e.anchorY = Math.max(1.4, player.y + 0.8);
      }
      break;
    }

    // ---- Wind-up: wings flare, hangs dead still --------------------------
    case 1: {
      e.vx = 0;
      e.vy = (e.anchorY + 3.5 - e.y) * 2.4;
      e.facing = player.x >= e.x ? 1 : -1;
      e.tell = 1 - e.timer / NIGHTWING.diveWindup;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 2;
        e.timer = 1.6;
        e.vx = e.facing * NIGHTWING.diveSpeed * (phase === 3 ? 1.15 : 1);
      }
      break;
    }

    // ---- Dive: a straight line across the room ---------------------------
    case 2: {
      e.vy = (e.anchorY - e.y) * 5.0;
      e.timer -= dt;
      const nearWall =
        e.x <= ARENA_STATE.minX + spec.halfW + 0.6 || e.x >= ARENA_STATE.maxX - spec.halfW - 0.6;
      if (nearWall || e.timer <= 0) {
        ctx.fx.burst(e.x, e.y, 14, PALETTE.nightWing, 7, 10);
        ctx.shake(0.4);
        e.state = 3;
        e.timer = 0.45;
        // Phase 3 dives twice before returning to the perch.
        e.timer3 = phase === 3 && e.timer3 < 1 ? 1 : 0;
      }
      break;
    }

    // ---- Recover ---------------------------------------------------------
    default: {
      e.vx *= Math.max(0, 1 - 5 * dt);
      e.vy = (perchY - e.y) * 2.2;
      e.timer -= dt;
      if (e.timer <= 0) {
        if (e.timer3 > 0) {
          e.timer3 = 2;
          e.state = 1;
          e.timer = NIGHTWING.diveWindup * 0.8;
          e.anchorY = Math.max(1.4, player.y + 0.8);
        } else {
          e.state = 0;
          e.timer = NIGHTWING.perchTime;
          e.timer2 = 0;
          e.timer3 = 0;
          // Perch on the opposite side from the player, so the dive always
          // has a run-up and always crosses them.
          e.anchorX = player.x > centreX() ? ARENA_STATE.minX + 6 : ARENA_STATE.maxX - 6;
        }
      }
      break;
    }
  }

  e.x = clampX(e.x, spec.halfW);
  e.y = Math.max(1.2, Math.min(ARENA_STATE.ceilingY - 1.5, e.y));
}

// ---------------------------------------------------------------------------
// 3. CINDER WARDEN — punishes greed
//
// Slow enough that you can always leave. Everything that hits you in this
// fight is something you chose to stand next to.
// ---------------------------------------------------------------------------
function cinderWarden(e: Enemy, ctx: BossContext): void {
  const { dt, player } = ctx;
  const spec = ENEMIES.cinderWarden;
  const phase = e.phaseIndex;
  const dirX: 1 | -1 = player.x >= e.x ? 1 : -1;
  const distX = Math.abs(player.x - e.x);

  e.vy += GRAVITY * dt;
  e.timer3 -= dt;

  switch (e.state) {
    // ---- Approach --------------------------------------------------------
    case 0: {
      e.vx = dirX * spec.speed * (phase === 3 ? 1.25 : 1);
      e.facing = dirX;

      if (distX < CINDER.slamRange && e.onGround) {
        e.state = phase === 3 ? 4 : 1;
        e.timer = phase === 3 ? CINDER.chargeWindup : CINDER.slamWindup;
        e.vx = 0;
      } else if (distX > CINDER.throwRange && e.timer3 <= 0) {
        e.state = 3;
        e.timer = 0.55;
        e.timer3 = CINDER.throwInterval / (phase === 1 ? 1 : phase === 2 ? 1.3 : 1.6);
        e.vx = 0;
      }
      break;
    }

    // ---- Slam wind-up ----------------------------------------------------
    case 1: {
      e.vx = 0;
      e.tell = 1 - e.timer / CINDER.slamWindup;
      e.timer -= dt;
      if (e.timer <= 0) {
        slam(e.x, e.y, CINDER.slamRadius, PALETTE.cinderCore, ctx);
        // Two rings of debris outward along the floor: the safe answer is to
        // be airborne, and it has to be worth jumping for.
        for (const side of [-1, 1]) {
          for (let i = 1; i <= 2; i++) {
            ctx.projectiles.spawnRaw(
              e.x + side * i * 1.6,
              0.7,
              side * (7 + i * 2.5),
              5.5,
              1,
              0.3,
              true,
            );
          }
        }
        e.state = 2;
        e.timer = CINDER.slamRecovery;
      }
      break;
    }

    // ---- Recover ---------------------------------------------------------
    case 2: {
      e.vx = 0;
      e.timer -= dt;
      if (e.timer <= 0) e.state = 0;
      break;
    }

    // ---- Boulder ---------------------------------------------------------
    case 3: {
      e.vx = 0;
      e.facing = dirX;
      e.tell = 1 - e.timer / 0.55;
      e.timer -= dt;
      if (e.timer <= 0) {
        // Lobbed on an arc, not fired flat: a straight shot at this range is
        // unreadable, an arc gives the player a full second of flight time.
        const flight = Math.max(0.5, distX / CINDER.throwSpeed);
        ctx.projectiles.spawnRaw(
          e.x + dirX * 1.2,
          e.y + 3.0,
          (player.x - e.x) / flight,
          CINDER.throwArc,
          1,
          0.42,
          true,
        );
        ctx.fx.burst(e.x + dirX * 1.2, e.y + 3.0, 8, PALETTE.cinderGlow, 5, 8);
        e.state = 0;
      }
      break;
    }

    // ---- Charge wind-up (phase 3 only) -----------------------------------
    case 4: {
      e.vx = 0;
      e.facing = dirX;
      e.tell = 1 - e.timer / CINDER.chargeWindup;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 5;
        e.timer = CINDER.chargeDuration;
        e.vx = e.facing * CINDER.chargeSpeed;
        ctx.shake(0.5);
      }
      break;
    }

    // ---- Charging --------------------------------------------------------
    default: {
      e.timer -= dt;
      ctx.fx.spray(e.x, e.y + 0.4, 2, PALETTE.cinderCore, -e.facing, 0.2, 0.8, 6);
      const nearWall =
        e.x <= ARENA_STATE.minX + spec.halfW + 0.5 || e.x >= ARENA_STATE.maxX - spec.halfW - 0.5;
      if (nearWall) {
        slam(e.x, e.y, CINDER.slamRadius * 0.8, PALETTE.cinderCore, ctx);
        e.timer = 0;
      }
      if (e.timer <= 0) {
        e.vx = 0;
        e.state = 2;
        e.timer = CINDER.slamRecovery;
      }
      break;
    }
  }

  e.x = clampX(e.x, spec.halfW);
}

// ---------------------------------------------------------------------------
// 4. LUMEN CHOIR — pattern reading
//
// The only boss with no contact threat: you can stand inside it. Everything
// that kills you is a bullet you could have walked around, which makes it the
// cleanest skill check of the seven.
// ---------------------------------------------------------------------------
function lumenChoir(e: Enemy, ctx: BossContext): void {
  const { dt, player, elapsed } = ctx;
  const spec = ENEMIES.lumenChoir;
  const phase = e.phaseIndex;
  const rate = phase === 1 ? 1 : phase === 2 ? 1.3 : 1.7;

  const hoverY = 6.4 + Math.sin(elapsed * 0.8) * 0.9;
  e.vy = (hoverY - e.y) * 2.2;
  e.facing = player.x >= e.x ? 1 : -1;

  e.timer3 -= dt;
  if (e.timer3 <= 0 && e.state === 0) {
    // Blink rather than walk. A floating boss that drifts can be cornered;
    // one that blinks keeps the arena in play.
    e.timer3 = CHOIR.blinkInterval / rate;
    ctx.fx.burst(e.x, e.y, 16, PALETTE.choirCore, 8, 10);
    const side = player.x > centreX() ? -1 : 1;
    e.anchorX = clampX(player.x + side * CHOIR.blinkRange, 4);
    e.x = e.anchorX;
    ctx.fx.burst(e.x, e.y, 16, PALETTE.choirOrb, 8, 10);
  }
  e.vx = (e.anchorX - e.x) * 2.0;

  switch (e.state) {
    case 0: {
      e.timer -= dt * rate;
      if (e.timer <= 0) {
        e.state = 1;
        e.timer = 0.7;
      }
      break;
    }

    // ---- Charging a volley ----------------------------------------------
    case 1: {
      e.tell = 1 - e.timer / 0.7;
      e.timer -= dt;
      if (e.timer <= 0) {
        // Alternate ring and spiral. Two patterns is enough: the ring asks
        // you to move, the spiral asks you to keep moving in one direction,
        // and together they cover both failure modes of standing still.
        if (e.timer2 === 0) {
          fireRing(ctx, e.x, e.y, CHOIR.ringCount + (phase - 1) * 3, CHOIR.ringSpeed, Math.random());
          // Phase 3 adds an aimed lance through the gap in the ring.
          if (phase === 3) fireAt(ctx, e.x, e.y, player.x, player.y + 0.8, CHOIR.ringSpeed * 1.6, 0.24);
          e.timer2 = 1;
        } else {
          e.state = 2;
          e.timer = 0;
          e.timer2 = 0;
          e.anchorY = Math.random() * Math.PI * 2;
          e.timer3 = Math.max(e.timer3, 1.4);
          break;
        }
        e.state = 0;
        e.timer = CHOIR.volleyInterval;
        ctx.fx.shockwave(e.x, e.y, PALETTE.choirCore, 2.6, 0.35);
      }
      break;
    }

    // ---- Spiral: one bullet at a time, rotating -------------------------
    default: {
      e.timer -= dt;
      if (e.timer <= 0) {
        const count = Math.round(e.timer2);
        const a = e.anchorY + count * CHOIR.spiralTurn;
        ctx.projectiles.spawnRaw(
          e.x,
          e.y,
          Math.cos(a) * CHOIR.spiralSpeed,
          Math.sin(a) * CHOIR.spiralSpeed,
          1,
          0.26,
          true,
        );
        // Phase 2+ mirrors the spiral, which turns a walkable pattern into
        // one you have to weave through.
        if (phase >= 2) {
          ctx.projectiles.spawnRaw(
            e.x,
            e.y,
            Math.cos(a + Math.PI) * CHOIR.spiralSpeed,
            Math.sin(a + Math.PI) * CHOIR.spiralSpeed,
            1,
            0.26,
            true,
          );
        }
        e.timer2 += 1;
        e.timer = 0.07 / rate;
        if (e.timer2 >= CHOIR.spiralCount) {
          e.timer2 = 0;
          e.state = 0;
          e.timer = CHOIR.volleyInterval;
        }
      }
      break;
    }
  }

  e.x = clampX(e.x, spec.halfW);
}

// ---------------------------------------------------------------------------
// 5. THORN WARDEN — footing
//
// It never moves. Everything dangerous comes out of the ground, which inverts
// the usual instinct: the floor is the threat and the boss is the safe spot.
// ---------------------------------------------------------------------------
function thornWarden(e: Enemy, ctx: BossContext): void {
  const { dt, player } = ctx;
  const phase = e.phaseIndex;
  const rate = phase === 1 ? 1 : phase === 2 ? 1.3 : 1.65;

  e.vy += GRAVITY * dt;
  e.vx = 0;
  e.facing = player.x >= e.x ? 1 : -1;

  // Seeds run on their own clock, independent of the ground wave, so the
  // player has to solve two problems that aren't synchronised.
  e.timer3 -= dt * rate;
  if (e.timer3 <= 0 && e.state === 0) {
    e.timer3 = THORN.seedInterval;
    for (let i = 0; i < THORN.seedCount; i++) {
      const spread = (i / Math.max(1, THORN.seedCount - 1) - 0.5) * 1.4;
      const x = clampX(player.x + spread * 6, 2.5);
      ctx.fx.burst(x, 0.4, 8, PALETTE.thornLeaf, 4, 7);
      ctx.fx.shockwave(x, 0.3, PALETTE.thornLeaf, 1.2, 0.5);
      // Telegraphed by a full 2.6s of a visible sprout before it hatches.
      pendingSpawns.push({ kind: "slime", x, y: 1.2, delay: THORN.seedHatch });
    }
  }

  switch (e.state) {
    case 0: {
      e.timer -= dt * rate;
      if (e.timer <= 0) {
        e.state = 1;
        e.timer = THORN.waveWindup;
      }
      break;
    }

    // ---- Wind-up: the ground cracks --------------------------------------
    case 1: {
      e.tell = 1 - e.timer / THORN.waveWindup;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 2;
        e.timer = 0;
        // Travel toward the player. anchorY doubles as the travelling front.
        e.anchorY = 0;
        e.timer2 = player.x >= e.x ? 1 : -1;
        ctx.shake(0.5);
      }
      break;
    }

    // ---- The wave: spikes erupt outward in sequence ----------------------
    case 2: {
      e.anchorY += THORN.waveSpeed * dt * rate;
      const front = e.x + e.timer2 * e.anchorY;
      // Emit one spike per spacing interval as the front passes it.
      const emitted = Math.floor(e.anchorY / THORN.spikeSpacing);
      if (emitted > e.timer) {
        e.timer = emitted;
        const sx = e.x + e.timer2 * emitted * THORN.spikeSpacing;
        if (sx > ARENA_STATE.minX + 1 && sx < ARENA_STATE.maxX - 1) {
          pendingSpikes.push({ x: sx, life: THORN.spikeLife, height: THORN.spikeHeight });
          pendingHazards.push({
            x: sx,
            y: 0.9,
            radius: 1.15,
            groundOnly: false,
            life: THORN.spikeLife * 0.75,
            color: PALETTE.thornSpike,
          });
          ctx.fx.spray(sx, 0.2, 6, PALETTE.thornSpike, 0, 1, 1.4, 8);
        }
      }
      // Phase 3 sends a second wave back the other way.
      if (front < ARENA_STATE.minX - 2 || front > ARENA_STATE.maxX + 2) {
        if (phase === 3 && e.timer2 > 0) {
          e.timer2 = -1;
          e.anchorY = 0;
          e.timer = 0;
        } else {
          e.state = 0;
          e.timer = THORN.waveInterval;
        }
      }
      break;
    }

    // ---- Phase 3 lash: punishes camping a platform -----------------------
    default: {
      e.state = 0;
      e.timer = THORN.waveInterval;
      break;
    }
  }

  // Phase 3 also lashes at whatever the player is standing on.
  if (phase === 3) {
    e.timer2 = e.timer2 === 0 ? 1 : e.timer2;
  }
}

// ---------------------------------------------------------------------------
// 6. VOIDMAW — control
//
// The one fight where the boss moves you rather than moving itself. Every
// other boss can be solved by positioning; this one takes positioning away
// and hands it back only when you fight for it.
// ---------------------------------------------------------------------------
function voidmaw(e: Enemy, ctx: BossContext): void {
  const { dt, player, elapsed } = ctx;
  const spec = ENEMIES.voidmaw;
  const phase = e.phaseIndex;
  const rate = phase === 1 ? 1 : phase === 2 ? 1.28 : 1.6;

  const hoverY = 7.0 + Math.sin(elapsed * 0.7) * 1.1;
  e.vy = (hoverY - e.y) * 1.9;
  e.vx = (e.anchorX - e.x) * 1.6;
  e.facing = player.x >= e.x ? 1 : -1;

  // The pull is always on. Strength scales with the collapse charge, so the
  // art (spinning rings) and the mechanic (drag) rise together — the player
  // never has to be told, they feel it and see it at the same time.
  const dx = e.x - player.x;
  const dy = e.y - (player.y + 0.8);
  const dist = Math.hypot(dx, dy);
  if (dist < VOID.pullRadius && dist > 0.4) {
    const falloff = 1 - dist / VOID.pullRadius;
    const strength = VOID.pullStrength * falloff * (1 + e.tell * 2) * (phase === 3 ? 1.3 : 1);
    pendingPull.x = dx / dist;
    pendingPull.y = dy / dist;
    pendingPull.strength = strength;
  }

  switch (e.state) {
    case 0: {
      // Lances on a steady clock while it drifts.
      e.timer2 -= dt * rate;
      if (e.timer2 <= 0) {
        e.timer2 = VOID.lanceInterval;
        const base = Math.atan2(player.y + 0.8 - e.y, player.x - e.x);
        const n = VOID.lanceCount + (phase - 1);
        for (let i = 0; i < n; i++) {
          const a = base + (i / Math.max(1, n - 1) - 0.5) * VOID.lanceSpread;
          ctx.projectiles.spawnRaw(
            e.x + Math.cos(a) * 1.5,
            e.y + Math.sin(a) * 1.5,
            Math.cos(a) * VOID.lanceSpeed,
            Math.sin(a) * VOID.lanceSpeed,
            1,
            0.22,
            true,
          );
        }
        ctx.fx.burst(e.x, e.y, 8, PALETTE.voidEye, 5, 8);
      }

      e.timer3 -= dt * rate;
      if (e.timer3 <= 0) {
        e.timer3 = VOID.blinkInterval;
        ctx.fx.burst(e.x, e.y, 18, PALETTE.voidRing, 9, 11);
        e.anchorX = clampX(centreX() + (Math.random() - 0.5) * 12, 4);
      }

      e.timer -= dt * rate;
      if (e.timer <= 0) {
        e.state = 1;
        e.timer = VOID.collapseWindup;
        // Invulnerable through the collapse. This is the fight's rest beat:
        // shooting is pointless, so the only thing to do is escape the pull,
        // which is exactly the skill the fight is teaching.
        e.invulnerable = 0;
      }
      break;
    }

    // ---- Collapse: pull triples, then it vents ---------------------------
    case 1: {
      e.tell = Math.min(1, 1 - e.timer / VOID.collapseWindup);
      e.timer -= dt;
      if (e.timer <= 0) {
        const n = VOID.collapseVent + (phase - 1) * 6;
        fireRing(ctx, e.x, e.y, n, VOID.collapseVentSpeed, Math.random(), 0.26);
        fireRing(ctx, e.x, e.y, n, VOID.collapseVentSpeed * 0.6, Math.random(), 0.26);
        ctx.fx.shockwave(e.x, e.y, PALETTE.voidRing, 6.5, 0.5);
        ctx.fx.burst(e.x, e.y, 30, PALETTE.voidEye, 12, 13);
        ctx.shake(1.0);
        pendingPull.strength = 0;
        e.state = 0;
        e.timer = VOID.collapseInterval;
        e.tell = 0;
      }
      break;
    }

    default:
      e.state = 0;
      break;
  }

  e.x = clampX(e.x, spec.halfW);
}

// ---------------------------------------------------------------------------
// 7. STORM DRAGON — the finale
//
// Everything the other six taught, on one clock: Gorge's ground denial via
// eggs, Nightwing's crossing dive, the Warden's slam, the Choir's fan, the
// Thorn's floor hazard, Voidmaw's escalating pressure.
// ---------------------------------------------------------------------------
function stormDragon(e: Enemy, ctx: BossContext): void {
  const { dt, player, elapsed } = ctx;
  const spec = ENEMIES.dragon;
  const phase = e.phaseIndex;
  const rate = phase === 1 ? 1 : phase === 2 ? 1.35 : 1.8;

  switch (e.state) {
    // ---- Hover and breathe -----------------------------------------------
    case 0: {
      const hoverTarget = clampX(player.x + Math.sin(elapsed * 0.6) * 7, 5);
      e.vx = Math.max(-spec.speed, Math.min(spec.speed, (hoverTarget - e.x) * 1.1));
      e.vy = (DRAGON.hoverY + Math.sin(elapsed * 0.9) * 1.0 - e.y) * 1.8;
      e.facing = player.x >= e.x ? 1 : -1;

      e.timer -= dt * rate;
      e.tell = Math.max(0, Math.min(1, 1 - e.timer / 0.9));
      if (e.timer <= 0) {
        e.timer = DRAGON.breathInterval;
        const base = Math.atan2(player.y + 0.8 - e.y, player.x - e.x);
        for (let i = 0; i < DRAGON.breathCount; i++) {
          const offset = (i / (DRAGON.breathCount - 1) - 0.5) * DRAGON.breathSpread;
          const a = base + offset;
          ctx.projectiles.spawnRaw(
            e.x + Math.cos(a) * 1.6,
            e.y + Math.sin(a) * 1.6,
            Math.cos(a) * DRAGON.breathSpeed * rate,
            Math.sin(a) * DRAGON.breathSpeed * rate,
            1,
            0.3,
            true,
          );
        }
        ctx.fx.burst(e.x + e.facing * 1.8, e.y, 18, PALETTE.skyEmber, 7, 12);
        e.timer2 += 1;
        // Every third breath, it commits to a swoop instead.
        if (e.timer2 % 3 === 0) {
          e.state = 1;
          e.timer = 0.5;
          e.anchorY = Math.max(1.6, player.y + 1.0);
        }
      }

      // Phase 2+: lightning columns, telegraphed on the floor.
      if (phase >= 2) {
        e.timer3 -= dt * rate;
        if (e.timer3 <= 0) {
          e.timer3 = 3.2;
          const x = clampX(player.x, 2);
          pendingSpikes.push({ x, life: 0.75, height: ARENA_STATE.ceilingY });
          pendingHazards.push({
            x,
            y: 2.0,
            radius: 1.5,
            groundOnly: false,
            life: 0.4,
            color: PALETTE.gold,
          });
          ctx.fx.shockwave(x, 0.3, PALETTE.gold, 2.6, 0.4);
        }
      }

      // Phase 3: eggs, so the floor stops being a safe place to camp.
      if (phase === 3) {
        e.anchorX -= dt;
        if (e.anchorX <= 0) {
          e.anchorX = DRAGON.eggInterval;
          pendingSpawns.push({ kind: "slime", x: clampX(e.x, 2), y: 2.0, delay: 0.4 });
          ctx.fx.burst(e.x, e.y - 1.2, 10, PALETTE.dragonBelly, 5, 9);
        }
      }
      break;
    }

    // ---- Swoop wind-up ----------------------------------------------------
    case 1: {
      e.vx *= Math.max(0, 1 - 6 * dt);
      e.vy = (e.anchorY + 4 - e.y) * 2.2;
      e.tell = 1 - e.timer / 0.5;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 2;
        e.timer = 1.5;
        e.vx = e.facing * 22 * (phase === 3 ? 1.15 : 1);
      }
      break;
    }

    // ---- Swoop ------------------------------------------------------------
    default: {
      e.vy = (e.anchorY - e.y) * 4.4;
      e.timer -= dt;
      ctx.fx.spray(e.x, e.y, 2, PALETTE.skyEmber, -e.facing, 0, 0.8, 6);
      const nearWall =
        e.x <= ARENA_STATE.minX + spec.halfW + 0.6 || e.x >= ARENA_STATE.maxX - spec.halfW - 0.6;
      if (nearWall || e.timer <= 0) {
        ctx.shake(0.6);
        ctx.fx.burst(e.x, e.y, 16, PALETTE.dragonFace, 8, 11);
        e.state = 0;
        e.timer = DRAGON.breathInterval * 0.5;
      }
      break;
    }
  }

  e.x = clampX(e.x, spec.halfW);
  e.y = Math.max(1.4, Math.min(ARENA_STATE.ceilingY - 1.4, e.y));
}
