import { ARENA, FEEL, PLAYER, WEAPONS, type WeaponId } from "../config";
import { snapAim } from "../engine/input";
import type { InputState, Player } from "../types";
import { approach, clampToArena, damp, resolveGround } from "./physics";

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
    y: ARENA.floorY,
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
    weapon: "bolt",
    weaponTimer: 0,
    fireCooldown: 0,
    squashX: 1,
    squashY: 1,
    alive: true,
  };
}

export function resetPlayer(p: Player): void {
  p.x = 0;
  p.y = ARENA.floorY;
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
  p.weapon = "bolt";
  p.weaponTimer = 0;
  p.fireCooldown = 0;
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

  // ---- Aim -------------------------------------------------------------
  // The stick does double duty: it steers and it aims, exactly like a
  // Metal Slug d-pad. Aim is snapped to 8 directions.
  const aim = snapAim(input.moveX, input.moveY, p.facing);
  p.aimX = aim.x;
  p.aimY = aim.y;

  // ---- Horizontal ------------------------------------------------------
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

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clampToArena(p.x, PLAYER.halfW);

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

  // Ceiling
  if (p.y > ARENA.ceilingY) {
    p.y = ARENA.ceilingY;
    if (p.vy > 0) p.vy = 0;
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
