import { FEEL, PLAYER, WEAPONS, type WeaponId } from "../config";
import { snapAimStrict } from "../engine/input";
import type { InputState, Player } from "../types";
import {
  approach,
  clampToArena,
  damp,
  resolveCeiling,
  resolveGround,
  resolveSolidsX,
} from "./physics";

/**
 * The mage's movement, and the majority of the game's feel.
 *
 * Almost everything here exists to hide the fact that the player's input is
 * discrete and their thumb is imprecise. In order of how much each one
 * matters:
 *
 *   Coyote time — you may still jump for ~110ms after walking off a ledge.
 *     Without it, players swear the jump button "didn't register", because
 *     human reaction to a ledge is slower than one frame.
 *
 *   Jump buffering — pressing jump up to ~130ms before landing still jumps
 *     on touchdown. Same problem from the other direction: players press
 *     early, and punishing that feels like the game is fighting them.
 *
 *   Variable height — releasing the button mid-rise cuts upward velocity.
 *     This is what makes a jump feel like a decision rather than a commitment,
 *     and it is the difference between one jump arc and a continuum of them.
 *
 *   Asymmetric gravity — falling is 1.55x heavier than rising. Physically
 *     nonsense; it is what stops a jump feeling like the moon.
 */

export function createPlayer(): Player {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    timeOffGround: 0,
    timeSinceJumpPress: Infinity,
    jumping: false,
    hearts: PLAYER.startHearts,
    invulnerable: 0,
    aimX: 1,
    aimY: 0,
    latchedAimX: 1,
    latchedAimY: 0,
    aimLatched: false,
    weapon: "bolt",
    weaponTimer: 0,
    fireCooldown: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashDir: 1,
    pogoRefund: false,
    squashX: 1,
    squashY: 1,
    alive: true,
  };
}

export function resetPlayer(p: Player): void {
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.facing = 1;
  p.onGround = true;
  p.timeOffGround = 0;
  p.timeSinceJumpPress = Infinity;
  p.jumping = false;
  p.hearts = PLAYER.startHearts;
  p.invulnerable = 0;
  p.aimX = 1;
  p.aimY = 0;
  p.latchedAimX = 1;
  p.latchedAimY = 0;
  p.aimLatched = false;
  p.weapon = "bolt";
  p.weaponTimer = 0;
  p.fireCooldown = 0;
  p.dashTimer = 0;
  p.dashCooldown = 0;
  p.dashDir = 1;
  p.pogoRefund = false;
  p.squashX = 1;
  p.squashY = 1;
  p.alive = true;
}

export interface PlayerEvents {
  onJump(x: number, y: number): void;
  onLand(x: number, y: number, impactSpeed: number): void;
  /** Fired once per shot; `count` projectiles have already been spawned. */
  onFire(x: number, y: number, aimX: number, aimY: number, weapon: WeaponId): void;
  onWeaponExpired(): void;
  /** Fired at the start of a dash. Used for FX and the trail. */
  onDash?(x: number, y: number, dir: 1 | -1): void;
  /** Fired when a downward hit bounces the player. */
  onPogo?(x: number, y: number): void;
}

/**
 * Called by the collision layer when a downward projectile of the player's
 * lands on an enemy while the player is airborne. Refunds vertical velocity
 * and, if the config allows, refunds a jump so a chain of pogos isn't
 * gated by a used-up coyote window.
 */
export function pogoBounce(p: Player, events: PlayerEvents): boolean {
  if (!p.alive || p.onGround) return false;
  p.vy = PLAYER.pogoBounce;
  p.jumping = false;
  if (PLAYER.pogoRefundJump) {
    p.timeSinceJumpPress = Infinity;
  }
  events.onPogo?.(p.x, p.y);
  return true;
}

export function updatePlayer(
  p: Player,
  input: InputState,
  dt: number,
  events: PlayerEvents,
): void {
  if (!p.alive) return;

  const previousY = p.y;
  const wasOnGround = p.onGround;

  // ---- Timers ----------------------------------------------------------
  if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);
  if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - dt);
  p.timeSinceJumpPress += dt;
  if (input.jumpPressed) {
    p.timeSinceJumpPress = 0;
    input.jumpPressed = false; // consumed
  }

  if (p.weapon !== "bolt") {
    p.weaponTimer -= dt;
    if (p.weaponTimer <= 0) {
      p.weapon = "bolt";
      p.weaponTimer = 0;
      events.onWeaponExpired();
    }
  }

  // ---- Dash request ----------------------------------------------------
  // A dash is a horizontal burst with i-frames and a cooldown. It is fired
  // on double-tap of the movement stick — the input layer sets dashRequest
  // to the direction of the second tap. We consume it here so it doesn't
  // stack while the flag stays set.
  if (input.dashRequest !== 0 && p.dashCooldown <= 0 && p.dashTimer <= 0 && p.alive) {
    p.dashTimer = PLAYER.dashDuration;
    p.dashCooldown = PLAYER.dashCooldown;
    p.dashDir = input.dashRequest as 1 | -1;
    p.facing = p.dashDir;
    p.invulnerable = Math.max(p.invulnerable, PLAYER.dashIFrames);
    // Kill vertical speed at the start of a dash. A dash that keeps your
    // falling velocity feels like a slip; a dash that zeros it feels like a
    // deliberate act. That is also what makes the dash a viable dodge for
    // downward projectiles.
    if (p.vy < 0) p.vy = 0;
    events.onDash?.(p.x, p.y, p.dashDir);
  }
  input.dashRequest = 0;

  // ---- Aim -------------------------------------------------------------
  //
  // WHY THIS IS SO CAREFUL
  //
  // The player's complaint was "I can't shoot up." Not because the code
  // couldn't produce an upward aim — it always could — but because of a
  // real-world thumb sequence I hadn't accounted for:
  //
  //   1. Left thumb pushes the stick up.  Aim goes up. Good.
  //   2. Right thumb reaches for CAST.  Left thumb LIFTS to reposition.
  //   3. CAST fires.  Left thumb is already gone.
  //   4. On the previous build, step 2 caused aim to snap back to
  //      horizontal, because "no stick input" fell back to `facing` in
  //      snapAim(). So step 3 fired sideways instead of up. Which is
  //      exactly the bug report.
  //
  // The three-stage order below fixes it. Aim FIRST refreshes from the
  // stick (only when actually deflected — an idle stick preserves the
  // last aim). THEN the latch trigger reads the just-refreshed aim, so a
  // fire press captures wherever the player is currently pointing, not a
  // stale value from the previous frame. FINALLY the latch overrides if
  // it's engaged, so subsequent stick motion moves the mage without
  // moving the shot.
  //
  // Facing is unaffected. It follows moveX with its own threshold below,
  // so a stationary player who last aimed up still faces right if that's
  // where they last moved.

  // (1) Refresh aim from the stick's CURRENT direction. When idle, keep
  // the previous aim — this is what makes "push up, release, then press
  // CAST" fire upward instead of sideways.
  if (!p.aimLatched) {
    const strict = snapAimStrict(input.moveX, input.moveY);
    if (strict) {
      p.aimX = strict.x;
      p.aimY = strict.y;
    }
  }

  // (2) If CAST just went down, snapshot the freshly-updated aim.
  if (input.firePressed) {
    p.latchedAimX = p.aimX;
    p.latchedAimY = p.aimY;
    p.aimLatched = true;
    input.firePressed = false; // consumed
  }
  if (!input.fireHeld) {
    p.aimLatched = false;
  }

  // (3) The latch wins when engaged, so continued stick motion doesn't
  // yank the aim off the direction the player intended.
  if (p.aimLatched && PLAYER.aimLatchOnCast) {
    p.aimX = p.latchedAimX;
    p.aimY = p.latchedAimY;
  }

  // ---- Horizontal ------------------------------------------------------
  if (p.dashTimer > 0) {
    // During a dash horizontal control is disabled. Anything else and the
    // dash reads as a lurch you can cancel out of, which defeats the point.
    p.vx = p.dashDir * PLAYER.dashSpeed;
  } else {
    const targetVx = input.moveX * PLAYER.maxSpeed;
    const accelMult = p.onGround ? 1 : PLAYER.airAccelMult;
    const frictionMult = p.onGround ? 1 : PLAYER.airFrictionMult;

    if (Math.abs(input.moveX) > 0.01) {
      p.vx = approach(p.vx, targetVx, PLAYER.accel * accelMult * dt);
      // Facing only flips on deliberate horizontal input, never on knockback.
      if (input.moveX > 0.2) p.facing = 1;
      else if (input.moveX < -0.2) p.facing = -1;
    } else {
      p.vx = approach(p.vx, 0, PLAYER.friction * frictionMult * dt);
    }
  }

  // ---- Jump ------------------------------------------------------------
  const canCoyote = p.timeOffGround <= PLAYER.coyoteTime;
  const buffered = p.timeSinceJumpPress <= PLAYER.jumpBuffer;

  if (buffered && canCoyote && !p.jumping) {
    p.vy = PLAYER.jumpVelocity;
    p.jumping = true;
    p.onGround = false;
    p.timeOffGround = PLAYER.coyoteTime + 1; // spend the coyote window
    p.timeSinceJumpPress = Infinity; // spend the buffer
    p.squashX = FEEL.jumpStretch.x;
    p.squashY = FEEL.jumpStretch.y;
    events.onJump(p.x, p.y);
  }

  // Cut the rise when the button is released — variable jump height.
  if (p.jumping && !input.jumpHeld && p.vy > 0) {
    p.vy *= PLAYER.jumpCutMult;
    p.jumping = false;
  }
  if (p.vy <= 0) p.jumping = false;

  // ---- Vertical --------------------------------------------------------
  const gravity = p.vy > 0 ? PLAYER.gravity : PLAYER.gravity * PLAYER.fallGravityMult;
  p.vy += gravity * dt;
  if (p.vy < -PLAYER.maxFallSpeed) p.vy = -PLAYER.maxFallSpeed;

  const previousX = p.x;
  p.x += p.vx * dt;

  // ---- Horizontal separation from solids -------------------------------
  // Resolved before the vertical pass so that after this line the body is
  // already clear on X. Doing both axes at once is what produces the classic
  // "catches on the seam between two floor tiles" bug.
  const pushed = resolveSolidsX(p.x, p.y, PLAYER.halfW, PLAYER.halfH, previousX);
  if (pushed.blocked) {
    p.x = pushed.x;
    // Killing horizontal speed on a wall matters for feel: without it the
    // player keeps accelerating into the wall and shoots off the moment they
    // clear it.
    p.vx = 0;
  }
  p.x = clampToArena(p.x, PLAYER.halfW);

  p.y += p.vy * dt;

  // ---- Ground resolution -----------------------------------------------
  const ground = resolveGround(p.x, p.y, p.vy, PLAYER.halfW, previousY);
  if (ground.onGround && ground.surfaceY !== null) {
    const impact = -p.vy;
    p.y = ground.surfaceY;
    p.vy = 0;
    p.onGround = true;
    p.timeOffGround = 0;
    if (!wasOnGround && impact > 4) {
      p.squashX = FEEL.landSquash.x;
      p.squashY = FEEL.landSquash.y;
      events.onLand(p.x, p.y, impact);
    }
  } else {
    p.onGround = false;
    p.timeOffGround += dt;
  }

  // ---- Ceiling ----------------------------------------------------------
  // Undersides of solids AND the room roof. A head bump zeroes upward
  // velocity rather than reflecting it — bouncing off a ceiling reads as a
  // bug even when it is physically defensible.
  const ceiling = resolveCeiling(p.x, p.y, PLAYER.halfW, PLAYER.halfH, p.vy);
  if (ceiling.bumped) {
    p.y = ceiling.y;
    if (p.vy > 0) p.vy = 0;
    p.jumping = false;
  }

  // ---- Squash recovery -------------------------------------------------
  p.squashX = damp(p.squashX, 1, 1 / FEEL.squashRecover, dt);
  p.squashY = damp(p.squashY, 1, 1 / FEEL.squashRecover, dt);
}

/**
 * Fires if the trigger is held and the cooldown has elapsed.
 * Returns true when a shot was actually emitted.
 */
export function tryFire(p: Player, input: InputState, events: PlayerEvents): boolean {
  if (!p.alive || !input.fireHeld || p.fireCooldown > 0) return false;
  const spec = WEAPONS[p.weapon];
  p.fireCooldown = spec.cooldown;
  const muzzleX = p.x + p.aimX * PLAYER.muzzleDistance;
  const muzzleY = p.y + PLAYER.halfH + p.aimY * PLAYER.muzzleDistance;
  events.onFire(muzzleX, muzzleY, p.aimX, p.aimY, p.weapon);
  return true;
}

/**
 * Applies a hit. Returns false when the hit was ignored (i-frames), so the
 * caller knows whether to play feedback.
 */
export function damagePlayer(p: Player, fromX: number): boolean {
  if (!p.alive || p.invulnerable > 0) return false;
  p.hearts -= 1;
  p.invulnerable = PLAYER.iFrames;
  const away = p.x >= fromX ? 1 : -1;
  p.vx = away * PLAYER.knockbackX;
  p.vy = PLAYER.knockbackY;
  p.onGround = false;
  p.jumping = false;
  if (p.hearts <= 0) {
    p.hearts = 0;
    p.alive = false;
  }
  return true;
}

export function grantWeapon(p: Player, weapon: WeaponId): void {
  p.weapon = weapon;
  p.weaponTimer = WEAPONS[weapon].duration;
}

export function healPlayer(p: Player): boolean {
  if (p.hearts >= PLAYER.maxHearts) return false;
  p.hearts += 1;
  return true;
}

/** True on the frames where an invulnerable player should be hidden. */
export function shouldBlink(p: Player): boolean {
  if (p.invulnerable <= 0) return false;
  // 14Hz blink. Fast enough to read as "hurt", slow enough to see.
  return Math.floor(p.invulnerable * 14) % 2 === 0;
}
