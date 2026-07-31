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
    maxHearts: PLAYER.maxHearts,
    invulnerable: 0,
    shield: 0,
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
    airDashAvailable: true,
    pogoRefund: false,
    squashX: 1,
    squashY: 1,
    // Counter items are all off/neutral until the shop grants one.
    // Cleared on death via resetPlayer; also cleared on room exit by
    // the orchestrator so a buff bought at Gorge doesn't leak into
    // the next branch's corridor.
    jumpBoostTimer: 0,
    iFramesMult: 1,
    knockbackImmune: false,
    piercingBolt: false,
    bulwarks: 0,
    spikeImmune: false,
    airControlMult: 1,
    pullImmune: false,
    choirSlowMult: 1,
    alive: true,
  };
}

/**
 * Rewinds the player entity for a new run or a respawn. Accepts an
 * override for max hearts so the orchestrator can plumb through any
 * Vessel Fragments the player has bought from the shop — those live on
 * Progress and survive death, but every other bit of state doesn't.
 */
export function resetPlayer(p: Player, opts?: { maxHearts?: number }): void {
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.facing = 1;
  p.onGround = true;
  p.timeOffGround = 0;
  p.timeSinceJumpPress = Infinity;
  p.jumping = false;
  const maxHearts = opts?.maxHearts ?? PLAYER.maxHearts;
  p.maxHearts = maxHearts;
  p.hearts = maxHearts;
  p.invulnerable = 0;
  p.shield = 0;
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
  p.airDashAvailable = true;
  p.pogoRefund = false;
  p.squashX = 1;
  p.squashY = 1;
  // Counter items always clear on respawn — you can't sneak a buff
  // through a death because that would break the "buy at the door"
  // fantasy of the shop.
  p.jumpBoostTimer = 0;
  p.iFramesMult = 1;
  p.knockbackImmune = false;
  p.piercingBolt = false;
  p.bulwarks = 0;
  p.spikeImmune = false;
  p.airControlMult = 1;
  p.pullImmune = false;
  p.choirSlowMult = 1;
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
    // Air control multiplier applies the Sure Foot buff — a card bought
    // for the Thorn Warden fight where the ground is the hazard and
    // the platforms above it are the only safe footing. Higher air
    // accel = you actually get to the platform you aimed for.
    const accelMult = p.onGround ? 1 : PLAYER.airAccelMult * p.airControlMult;
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

  // Timers on counter-item buffs. Only jumpBoostTimer counts down
  // here — the rest are booleans/mults cleared per-fight by the
  // orchestrator when the boss dies or the player leaves the room.
  if (p.jumpBoostTimer > 0) {
    p.jumpBoostTimer = Math.max(0, p.jumpBoostTimer - dt);
  }

  // ---- Jump / Air dash -------------------------------------------------
  //
  // The JUMP button has two lives. First press from the ground fires a
  // jump. Second press once the player is genuinely airborne (past coyote
  // time) fires an AIR DASH — a horizontal burst identical to the ground
  // dash physics, aimed by the stick with a fallback to `facing`. One
  // charge per airborne session; touching ground refills it.
  //
  // Ordering matters. We check the ground jump first, and only fall
  // through to the air dash if the ground jump condition failed. That
  // way the coyote-jump grace window still wins over the air dash for
  // the player who steps off a ledge and taps JUMP a hair late — they
  // get the jump they meant to get, not a horizontal boost.
  const canCoyote = p.timeOffGround <= PLAYER.coyoteTime;
  const buffered = p.timeSinceJumpPress <= PLAYER.jumpBuffer;

  if (buffered && canCoyote && !p.jumping) {
    // Jump Boots (bought for the Gorge Mother fight where the ground
    // is unsafe on every landing): a 30% velocity bump reads as ~60%
    // more airtime because peak-height scales with v². That's exactly
    // one more platform of clearance.
    const jumpMult = p.jumpBoostTimer > 0 ? 1.3 : 1;
    p.vy = PLAYER.jumpVelocity * jumpMult;
    p.jumping = true;
    p.onGround = false;
    p.timeOffGround = PLAYER.coyoteTime + 1; // spend the coyote window
    p.timeSinceJumpPress = Infinity; // spend the buffer
    p.squashX = FEEL.jumpStretch.x;
    p.squashY = FEEL.jumpStretch.y;
    events.onJump(p.x, p.y);
  } else if (
    buffered &&
    !canCoyote &&
    p.airDashAvailable &&
    p.dashTimer <= 0 &&
    p.dashCooldown <= 0
  ) {
    // Direction: stick if the player is holding one, else face-forward.
    // 0.3 is above the input deadzone (0.18) but low enough that any
    // deliberate tilt counts — you shouldn't have to shove the stick.
    const stickDir = input.moveX > 0.3 ? 1 : input.moveX < -0.3 ? -1 : 0;
    const dir = stickDir !== 0 ? (stickDir as 1 | -1) : p.facing;

    p.dashTimer = PLAYER.dashDuration;
    p.dashCooldown = PLAYER.dashCooldown;
    p.dashDir = dir;
    p.facing = dir;
    p.invulnerable = Math.max(p.invulnerable, PLAYER.dashIFrames);
    // Zero vertical so the burst is a clean horizontal streak, not a
    // parabola. This is what makes the air dash usable as a gap-crossing
    // tool: you know where you'll land.
    p.vy = 0;
    p.airDashAvailable = false;
    p.timeSinceJumpPress = Infinity;
    // Same event as the ground dash — one FX path, one sound, one HUD
    // reaction. From the outside, both dashes are the same move.
    events.onDash?.(p.x, p.y, p.dashDir);
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
    // Landing refills the air-dash charge. Whether or not the player used
    // it during the air session, touching down is when the mechanic
    // resets — same rule as Hollow Knight's shade cloak, and the same
    // rule that makes pogo → dash → pogo → dash a viable chain against
    // a boss (each pogo bounce is airborne without a fresh charge, but
    // the landing between attempts resets you).
    p.airDashAvailable = true;
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
 *
 * Damage resolution order (with counter items):
 *   1. i-frames  → skip
 *   2. bulwarks  → absorb, no heart cost, no knockback bypass
 *   3. shield    → absorb, i-frames + knockback still applied
 *   4. hearts    → lose one
 *
 * Bulwarks come BEFORE shields because a bulwark is the "next hit is
 * free" counter item you buy for a specific boss. It should burn on
 * the very next hit, before your general-purpose shield burns.
 * Knockback and i-frames are still applied on a bulwark absorb so the
 * player still gets pushed clear of the source and can't be re-hit
 * on the following frame.
 */
export function damagePlayer(p: Player, fromX: number): boolean {
  if (!p.alive || p.invulnerable > 0) return false;

  const away = p.x >= fromX ? 1 : -1;
  // iFramesMult expands the recovery window — Featherfall doubles it.
  // Knockback goes to zero entirely if the player has Anchor, which is
  // the whole point of that item (Nightwing dives push you off the
  // platform you were just standing on).
  const iFrames = PLAYER.iFrames * p.iFramesMult;
  const knock = () => {
    if (p.knockbackImmune) {
      p.vx = 0;
      p.vy = 0;
    } else {
      p.vx = away * PLAYER.knockbackX;
      p.vy = PLAYER.knockbackY;
      p.onGround = false;
      p.jumping = false;
    }
    p.invulnerable = iFrames;
  };

  // Bulwark first — it's the boss-specific "next hit ignored" item.
  if (p.bulwarks > 0) {
    p.bulwarks -= 1;
    knock();
    return true;
  }

  // Shield absorbs the hit before it touches hearts. The player still
  // gets the i-frames and the knockback so the save reads as a real hit
  // that landed on the shield — a silent absorb would look like the game
  // ate the input.
  if (p.shield > 0) {
    p.shield -= 1;
    knock();
    return true;
  }

  p.hearts -= 1;
  knock();
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
  if (p.hearts >= p.maxHearts) return false;
  p.hearts += 1;
  return true;
}

/** True on the frames where an invulnerable player should be hidden. */
export function shouldBlink(p: Player): boolean {
  if (p.invulnerable <= 0) return false;
  // 14Hz blink. Fast enough to read as "hurt", slow enough to see.
  return Math.floor(p.invulnerable * 14) % 2 === 0;
}
