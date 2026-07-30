/**
 * Headless verification of the parts of Spell Storm that don't need a GPU.
 *
 * The point isn't coverage — it's that game feel is made of numbers that are
 * easy to get subtly wrong, and "it looked fine when I played it" is not a
 * way to find out that coyote time is off by a frame.
 */
import { PLAYER, RENDER, WAVES } from "../game/spell-storm/config";
import { createInputState, snapAim } from "../game/spell-storm/engine/input";
import { resolveGround } from "../game/spell-storm/systems/physics";
import { createPlayer, damagePlayer, updatePlayer } from "../game/spell-storm/systems/player";
import { composeWave, isWaveLocked } from "../game/spell-storm/systems/waves";
import type { PlayerEvents } from "../game/spell-storm/systems/player";

let failures = 0;
function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const noEvents: PlayerEvents = {
  onJump: () => {},
  onLand: () => {},
  onFire: () => {},
  onWeaponExpired: () => {},
};

const STEP = RENDER.fixedStep;

function step(p: ReturnType<typeof createPlayer>, input: ReturnType<typeof createInputState>, n: number, events = noEvents) {
  for (let i = 0; i < n; i++) updatePlayer(p, input, STEP, events);
}

// ---------------------------------------------------------------------------
console.log("\nAim snapping");
{
  const right = snapAim(1, 0, 1);
  check("cardinal east is exact", Math.abs(right.x - 1) < 1e-9 && Math.abs(right.y) < 1e-9);

  const diagonal = snapAim(0.9, 0.75, 1);
  const expected = Math.SQRT1_2;
  check(
    "45 degrees snaps to a unit diagonal",
    Math.abs(diagonal.x - expected) < 1e-6 && Math.abs(diagonal.y - expected) < 1e-6,
  );

  const neutral = snapAim(0, 0, -1);
  check("neutral stick falls back to facing", neutral.x === -1 && neutral.y === 0);

  // Every one of the 8 directions must be unit length, or projectile speed
  // would vary by direction — diagonals would be 41% faster.
  let allUnit = true;
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2;
    const v = snapAim(Math.cos(angle), Math.sin(angle), 1);
    if (Math.abs(Math.hypot(v.x, v.y) - 1) > 1e-6) allUnit = false;
  }
  check("all 8 headings are unit length", allUnit);
}

// ---------------------------------------------------------------------------
console.log("\nGround resolution");
{
  const floor = resolveGround(0, -0.1, -5, 0.42, 0.5);
  check("falling body lands on the floor", floor.onGround && floor.surfaceY === 0);

  const rising = resolveGround(0, -0.1, 5, 0.42, -0.5);
  check("rising body passes through", !rising.onGround);

  // One-way platforms: approaching from below must not collide.
  const fromBelow = resolveGround(-8.5, 3.5, -5, 0.42, 2.0);
  check("platform ignored when approaching from below", fromBelow.surfaceY === 0 || fromBelow.surfaceY === null);

  const fromAbove = resolveGround(-8.5, 3.5, -5, 0.42, 4.2);
  check("platform catches a body falling onto it", fromAbove.onGround && fromAbove.surfaceY === 3.6);
}

// ---------------------------------------------------------------------------
console.log("\nJump: coyote time");
{
  // Walk off the edge of the left platform, then jump after the fall began.
  const p = createPlayer();
  const input = createInputState();
  p.x = -8.5;
  p.y = 3.6;
  p.onGround = true;
  p.timeOffGround = 0;

  // Move right until clear of the platform.
  input.moveX = 1;
  let framesToLeave = 0;
  while (p.onGround && framesToLeave < 200) {
    step(p, input, 1);
    framesToLeave += 1;
  }
  check("player leaves the platform", !p.onGround, `${framesToLeave} frames`);

  const yAtLedge = p.y;
  // Jump 3 frames (~50ms) after leaving — inside the coyote window.
  step(p, input, 2);
  input.jumpPressed = true;
  input.jumpHeld = true;
  step(p, input, 1);
  check("coyote jump fires after leaving ground", p.vy > 0, `vy=${p.vy.toFixed(2)}`);
  check("coyote jump gains height", p.y >= yAtLedge - 0.6);
}

console.log("\nJump: coyote window expires");
{
  const p = createPlayer();
  const input = createInputState();
  p.onGround = false;
  p.timeOffGround = PLAYER.coyoteTime + 0.05;
  p.y = 5;
  input.jumpPressed = true;
  input.jumpHeld = true;
  step(p, input, 1);
  check("jump refused once coyote time lapses", p.vy < 0, `vy=${p.vy.toFixed(2)}`);
}

console.log("\nJump: input buffering");
{
  // Press jump while still airborne and above the floor, then land.
  const p = createPlayer();
  const input = createInputState();
  p.y = 1.2;
  p.vy = -8;
  p.onGround = false;
  p.timeOffGround = 1;

  input.jumpPressed = true;
  input.jumpHeld = true;
  step(p, input, 1);
  const buffered = p.timeSinceJumpPress;
  check("press is recorded while airborne", buffered < PLAYER.jumpBuffer);

  // Fall to the ground within the buffer window.
  let landed = false;
  for (let i = 0; i < 10; i++) {
    step(p, input, 1);
    if (p.vy > 0) {
      landed = true;
      break;
    }
  }
  check("buffered press converts to a jump on landing", landed, `vy=${p.vy.toFixed(2)}`);
}

console.log("\nJump: variable height");
{
  const short = createPlayer();
  const shortInput = createInputState();
  shortInput.jumpPressed = true;
  shortInput.jumpHeld = true;
  step(short, shortInput, 1);
  shortInput.jumpHeld = false; // release immediately
  let shortPeak = short.y;
  for (let i = 0; i < 120; i++) {
    step(short, shortInput, 1);
    shortPeak = Math.max(shortPeak, short.y);
  }

  const tall = createPlayer();
  const tallInput = createInputState();
  tallInput.jumpPressed = true;
  tallInput.jumpHeld = true;
  step(tall, tallInput, 1);
  let tallPeak = tall.y;
  for (let i = 0; i < 120; i++) {
    step(tall, tallInput, 1);
    tallPeak = Math.max(tallPeak, tall.y);
  }

  check(
    "holding jump goes meaningfully higher than tapping",
    tallPeak > shortPeak * 1.4,
    `tap=${shortPeak.toFixed(2)}wu  hold=${tallPeak.toFixed(2)}wu`,
  );
  check("tap jump clears a slime with margin", shortPeak > 1.2, `${shortPeak.toFixed(2)}wu`);
  check("hold jump reaches the low platforms with margin", tallPeak >= 4.2, `${tallPeak.toFixed(2)}wu`);
  check("hold jump cannot skip straight to the high platform", tallPeak < 7.2, `${tallPeak.toFixed(2)}wu`);
}

console.log("\nJump: frame-rate independence");
{
  // The whole reason for the fixed-timestep loop: identical results
  // regardless of how the frames are sliced.
  function peakWithStep(dt: number, steps: number): number {
    const p = createPlayer();
    const input = createInputState();
    input.jumpPressed = true;
    input.jumpHeld = true;
    let peak = p.y;
    for (let i = 0; i < steps; i++) {
      updatePlayer(p, input, dt, noEvents);
      peak = Math.max(peak, p.y);
    }
    return peak;
  }
  const at60 = peakWithStep(1 / 60, 120);
  const at120 = peakWithStep(1 / 120, 240);
  check(
    "jump height matches at 60Hz and 120Hz",
    Math.abs(at60 - at120) < 0.25,
    `60Hz=${at60.toFixed(3)}  120Hz=${at120.toFixed(3)}`,
  );
}

console.log("\nMovement");
{
  const p = createPlayer();
  const input = createInputState();
  input.moveX = 1;
  step(p, input, 60);
  check("reaches top speed within a second", Math.abs(p.vx - PLAYER.maxSpeed) < 0.4, `vx=${p.vx.toFixed(2)}`);
  check("faces the direction of travel", p.facing === 1);

  input.moveX = 0;
  step(p, input, 20);
  check("stops promptly when the stick releases", Math.abs(p.vx) < 0.6, `vx=${p.vx.toFixed(2)}`);

  input.moveX = -1;
  step(p, input, 30);
  check("flips facing on reversal", p.facing === -1);

  const clamped = createPlayer();
  const rightInput = createInputState();
  rightInput.moveX = 1;
  step(clamped, rightInput, 400);
  check("clamped inside the arena", clamped.x <= 16 - PLAYER.halfW + 1e-6, `x=${clamped.x.toFixed(2)}`);
}

console.log("\nDamage and invulnerability");
{
  const p = createPlayer();
  const hit = damagePlayer(p, p.x - 1);
  check("first hit lands", hit && p.hearts === PLAYER.startHearts - 1);
  check("knocked away from the source", p.vx > 0, `vx=${p.vx.toFixed(2)}`);

  const blocked = damagePlayer(p, p.x - 1);
  check("second hit blocked by i-frames", !blocked && p.hearts === PLAYER.startHearts - 1);

  const input = createInputState();
  step(p, input, Math.ceil(PLAYER.iFrames * 60) + 2);
  const afterIFrames = damagePlayer(p, p.x - 1);
  check("vulnerable again once i-frames expire", afterIFrames && p.hearts === PLAYER.startHearts - 2);

  damagePlayer(p, p.x - 1);
  p.invulnerable = 0;
  damagePlayer(p, p.x - 1);
  check("dies at zero hearts", !p.alive && p.hearts === 0);
}

// ---------------------------------------------------------------------------
console.log("\nWave director");
{
  const w1 = composeWave(1);
  check("wave 1 is only slimes", w1.queue.every((k) => k === "slime"), `${w1.queue.length} enemies`);
  check("wave 1 is short enough to teach", w1.queue.length <= 4);

  const w4 = composeWave(4);
  check("air threat arrives at wave 4", w4.queue.includes("bat"));

  const w7 = composeWave(7);
  check("golem arrives at wave 7", w7.queue.includes("golem"));

  const boss = composeWave(WAVES.bossWave);
  check("wave 10 is the dragon", boss.isBoss && boss.queue.includes("dragon"));

  // Procedural waves must keep getting harder without exploding.
  //
  // Raw enemy count is the wrong measure: a wave of four golems is harder
  // than one of eight slimes, and composition is deliberately random, so
  // consecutive counts legitimately jump around. Difficulty is the weighted
  // sum, and the property that matters is the trend across the range, not
  // monotonicity between neighbours.
  const THREAT: Record<string, number> = { slime: 1, bat: 1.4, wisp: 2.2, golem: 3.6, dragon: 20 };
  const threatOf = (w: number) =>
    composeWave(w).queue.reduce((sum, kind) => sum + (THREAT[kind] ?? 1), 0);

  // Average several rolls per wave so the randomness doesn't decide the test.
  const sample = (w: number) => {
    let total = 0;
    for (let i = 0; i < 25; i++) total += threatOf(w);
    return total / 25;
  };

  const early = (sample(11) + sample(12) + sample(13)) / 3;
  const late = (sample(28) + sample(29) + sample(30)) / 3;
  check(
    "difficulty trends upward across procedural waves",
    late > early * 1.5,
    `wave 11-13 ≈ ${early.toFixed(1)} threat, wave 28-30 ≈ ${late.toFixed(1)}`,
  );

  let maxCount = 0;
  for (let w = 11; w <= 40; w++) maxCount = Math.max(maxCount, composeWave(w).queue.length);
  check("wave size stays bounded", maxCount < 60, `largest queue ${maxCount}`);

  let recurringBoss = false;
  for (let w = 11; w <= 30; w++) if (composeWave(w).isBoss) recurringBoss = true;
  check("dragon returns in later waves", recurringBoss);
}

console.log("\nPaywall gate");
{
  check("free player clears wave 10", !isWaveLocked(WAVES.freeWaves, false));
  check("free player is gated at wave 11", isWaveLocked(WAVES.freeWaves + 1, false));
  check("member is never gated", !isWaveLocked(999, true));
}

// ---------------------------------------------------------------------------
console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
