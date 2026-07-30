/**
 * Headless verification of the parts of Spell Storm that don't need a GPU.
 *
 * The point isn't coverage — it's that game feel is made of numbers that are
 * easy to get subtly wrong, and "it looked fine when I played it" is not a
 * way to find out that coyote time is off by a frame.
 */
import { BOSS_KINDS, ENEMIES, PLAYER, RENDER, WAVES } from "../game/spell-storm/config";
import { pogoBounce } from "../game/spell-storm/systems/player";
import { createInputState, snapAim, snapAimStrict } from "../game/spell-storm/engine/input";
import { setActiveRoom } from "../game/spell-storm/systems/arena";
import { ROOMS, ROOM_IDS, arrivalPoint, findGate } from "../game/spell-storm/world/rooms";
import { resolveGround, resolveSolidsX } from "../game/spell-storm/systems/physics";
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

// Physics reads the ACTIVE ROOM now, not a config constant. Give the harness
// a room to stand in — the original three-platform arena, rebuilt as a Room,
// plus one solid block so the new separation pass has something to hit.
setActiveRoom({
  id: "test",
  name: "Test Arena",
  biome: "hollow",
  minX: -16,
  maxX: 16,
  ceilingY: 13,
  platforms: [
    { x: -8.5, y: 3.6, halfW: 3.2 },
    { x: 8.5, y: 3.6, halfW: 3.2 },
    { x: 0, y: 7.2, halfW: 4.0 },
  ],
  solids: [{ x: 13, y: 1.5, halfW: 1, halfH: 1.5 }],
  floorGaps: [],
  hazards: [],
  gates: [],
  spawns: [],
  map: { col: 0, row: 0 },
});

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
console.log("\nSolids");
{
  // A body walking right into a block at x=13 (halfW 1) must stop short of
  // it, not tunnel through. This is the collision that makes a room read as
  // architecture rather than as a floor with furniture on it.
  const hit = resolveSolidsX(12.6, 0.0, PLAYER.halfW, PLAYER.halfH, 11.0);
  check("body is stopped by a solid's left face", hit.blocked && hit.x < 12.0, `x=${hit.x.toFixed(2)}`);

  // Standing on the lid must NOT register as a side hit, or the player gets
  // shoved off every pillar they land on.
  const onTop = resolveSolidsX(13.0, 3.0, PLAYER.halfW, PLAYER.halfH, 13.0);
  check("standing on a solid is not a side collision", !onTop.blocked);

  const clear = resolveSolidsX(0, 0, PLAYER.halfW, PLAYER.halfH, 0);
  check("open floor is unaffected", !clear.blocked);
}

// ---------------------------------------------------------------------------
console.log("\nWorld graph");
{
  // A mistyped gate is a soft-lock: the player walks through a door and can
  // never come back. This is the most valuable assertion in the file, because
  // it is exactly the bug you cannot find by playing unless you happen to
  // walk the one wrong way.
  let dangling = 0;
  let asymmetric = 0;
  for (const id of ROOM_IDS) {
    const room = ROOMS[id];
    for (const gate of room.gates) {
      const target = ROOMS[gate.to];
      if (!target) {
        dangling += 1;
        console.log(`        ${id}.${gate.id} -> missing room ${gate.to}`);
        continue;
      }
      const back = findGate(target, gate.toGate);
      if (!back) {
        dangling += 1;
        console.log(`        ${id}.${gate.id} -> missing gate ${gate.to}.${gate.toGate}`);
      } else if (back.to !== id) {
        asymmetric += 1;
        console.log(`        ${id}.${gate.id} <-> ${gate.to}.${gate.toGate} disagree`);
      }
    }
  }
  check("every gate points at a real room and gate", dangling === 0);
  check("every gate has a matching return gate", asymmetric === 0);

  const seen = new Set<string>(["crossroads"]);
  const queue = ["crossroads"];
  while (queue.length) {
    const id = queue.pop()!;
    for (const gate of ROOMS[id].gates) {
      if (ROOMS[gate.to] && !seen.has(gate.to)) {
        seen.add(gate.to);
        queue.push(gate.to);
      }
    }
  }
  check("every room is reachable from the hub", seen.size === ROOM_IDS.length, `${seen.size}/${ROOM_IDS.length}`);

  // Arrival points must land inside the room, or the player spawns in a wall.
  let badSpawn = 0;
  for (const id of ROOM_IDS) {
    const room = ROOMS[id];
    for (const gate of room.gates) {
      const target = ROOMS[gate.to];
      const back = target ? findGate(target, gate.toGate) : null;
      if (!target || !back) continue;
      const at = arrivalPoint(target, back);
      if (at.x <= target.minX + 0.5 || at.x >= target.maxX - 0.5) badSpawn += 1;
      if (at.y < 0 || at.y > target.ceilingY - 1) badSpawn += 1;
    }
  }
  check("no gate spawns the player outside the room", badSpawn === 0);

  const bossRooms = ROOM_IDS.filter((id) => ROOMS[id].boss);
  check("there are seven bosses", bossRooms.length === 7, `${bossRooms.length}`);
  check(
    "every boss room names its boss",
    bossRooms.every((id) => !!ROOMS[id].bossName && !!ROOMS[id].bossTitle),
  );
  check(
    "every boss kind is placed in the world exactly once",
    BOSS_KINDS.every((k) => bossRooms.filter((id) => ROOMS[id].boss === k).length === 1),
  );

  const benches = ROOM_IDS.filter((id) => ROOMS[id].bench).length;
  check("the world has benches to save at", benches >= 5, `${benches} benches`);

  const total = ROOM_IDS.reduce((sum, id) => sum + (ROOMS[id].maxX - ROOMS[id].minX), 0);
  check("the map is actually large", total > 1200, `${Math.round(total)}wu across ${ROOM_IDS.length} rooms`);
}

// ---------------------------------------------------------------------------
console.log("\nBoss arenas");
{
  // A boss wider than a third of its arena has nowhere to be dodged in.
  let cramped = 0;
  for (const id of ROOM_IDS) {
    const room = ROOMS[id];
    if (!room.boss) continue;
    const width = room.maxX - room.minX;
    const spec = ENEMIES[room.boss];
    if (spec.halfW * 2 > width / 3) {
      cramped += 1;
      console.log(`        ${id}: boss ${(spec.halfW * 2).toFixed(1)}wu in ${width.toFixed(0)}wu room`);
    }
  }
  check("every boss fits its arena with room to dodge", cramped === 0);

  // Several bosses own the entire floor, so every arena needs high ground.
  const flat = ROOM_IDS.filter((id) => ROOMS[id].boss && ROOMS[id].platforms.length < 2);
  check("every boss arena has somewhere to stand off the floor", flat.length === 0);

  const order = BOSS_KINDS.map((k) => ENEMIES[k].hp);
  let rising = true;
  for (let i = 1; i < order.length; i++) if (order[i] < order[i - 1]) rising = false;
  check("boss HP rises across the seven", rising, order.join(" < "));
}


// ---------------------------------------------------------------------------
console.log("\nSpawn safety");
{
  // THE BUG THIS EXISTS FOR: the hub's pit, its bench and its default spawn
  // point were all at x=0. Starting the game dropped the player through the
  // floor into a room three branches away before they had touched a control.
  // Nothing in a type system catches "two numbers in different arrays happen
  // to be equal"; this does.
  let spawnOverPit = 0;
  for (const id of ROOM_IDS) {
    const room = ROOMS[id];
    // Only bench rooms are ever entered without a gate — those are the
    // rooms `start()` and `respawn()` drop you into.
    if (!room.bench && id !== "crossroads") continue;
    const x = room.bench ? room.bench.x : (room.minX + room.maxX) / 2;
    for (const gapDef of room.floorGaps) {
      if (Math.abs(x - gapDef.x) < gapDef.halfW + PLAYER.halfW) {
        spawnOverPit += 1;
        console.log(`        ${id}: spawn x=${x} sits over the pit at ${gapDef.x}`);
      }
    }
  }
  check("no room spawns the player over a hole in the floor", spawnOverPit === 0);

  // Same class of problem from the other side: arriving through a side door
  // and landing on a pit.
  let arrivalOverPit = 0;
  for (const id of ROOM_IDS) {
    const room = ROOMS[id];
    for (const gate of room.gates) {
      const target = ROOMS[gate.to];
      const back = target ? findGate(target, gate.toGate) : null;
      if (!target || !back || back.side === "top") continue;
      const at = arrivalPoint(target, back);
      if (at.y > 1.5) continue;
      for (const gapDef of target.floorGaps) {
        if (Math.abs(at.x - gapDef.x) < gapDef.halfW + PLAYER.halfW) {
          arrivalOverPit += 1;
          console.log(`        ${id}.${gate.id} lands on a pit in ${target.id}`);
        }
      }
    }
  }
  check("no door drops the player straight onto a pit", arrivalOverPit === 0);

  // A pit with no gate under it is a trap that costs a heart and teaches
  // nothing. A bottom gate with no pit is a door you can never reach.
  let orphanPit = 0;
  let unreachableDoor = 0;
  for (const id of ROOM_IDS) {
    const room = ROOMS[id];
    const bottoms = room.gates.filter((g) => g.side === "bottom");
    for (const gapDef of room.floorGaps) {
      if (!bottoms.some((g) => Math.abs(g.at - gapDef.x) < gapDef.halfW + 1)) {
        orphanPit += 1;
        console.log(`        ${id}: pit at ${gapDef.x} leads nowhere`);
      }
    }
    for (const g of bottoms) {
      if (!room.floorGaps.some((gp) => Math.abs(g.at - gp.x) < gp.halfW + 1)) {
        unreachableDoor += 1;
        console.log(`        ${id}.${g.id}: bottom gate with no hole above it`);
      }
    }
  }
  check("every pit leads to a door", orphanPit === 0);
  check("every bottom door has a pit to reach it", unreachableDoor === 0);
}

// ---------------------------------------------------------------------------
console.log("\nFree vs member split");
{
  // Walk the graph the way a non-member can, and count the bosses they reach.
  function reachable(isPro: boolean): Set<string> {
    const seen = new Set<string>(["crossroads"]);
    const queue = ["crossroads"];
    while (queue.length) {
      const id = queue.pop()!;
      for (const gate of ROOMS[id].gates) {
        if (gate.pro && !isPro) continue;
        if (gate.requires) continue; // sigil-locked: not a membership question
        if (ROOMS[gate.to] && !seen.has(gate.to)) {
          seen.add(gate.to);
          queue.push(gate.to);
        }
      }
    }
    return seen;
  }

  const free = reachable(false);
  const paid = reachable(true);
  const freeBosses = [...free].filter((id) => ROOMS[id].boss).length;
  const paidBosses = [...paid].filter((id) => ROOMS[id].boss).length;

  check("a free player gets a complete three-boss arc", freeBosses === 3, `${freeBosses} bosses`);
  check("membership opens the rest", paidBosses === 6, `${paidBosses} before the sigil gate`);
  check("a free player has a bench to save at", [...free].some((id) => !!ROOMS[id].bench));

  // Locked doors must be escapable. A locked pit would leave the player
  // falling through a sealed floor with nothing to land on.
  // A locked pit has nothing to bounce off, so the orchestrator lifts the
  // player onto the ledge beside it. Verify that ledge is real floor.
  const stranded: string[] = [];
  for (const id of ROOM_IDS) {
    const room = ROOMS[id];
    for (const g of room.gates) {
      if (!(g.pro || g.requires) || g.side !== "bottom") continue;
      const centre = (room.minX + room.maxX) * 0.5;
      const dir = g.at >= centre ? -1 : 1;
      const ledge = Math.max(room.minX + 2.5, Math.min(room.maxX - 2.5, g.at + dir * (g.size * 0.5 + 3.5)));
      const solid = !room.floorGaps.some((gp) => Math.abs(ledge - gp.x) < gp.halfW + PLAYER.halfW);
      if (!solid) stranded.push(`${id}.${g.id}`);
    }
  }
  check("locked pits have solid ground to recover onto", stranded.length === 0, stranded.join(", ") || "none");
}


// ---------------------------------------------------------------------------
console.log("\nAim latch");
{
  // ------------------------------------------------------------------
  // THE ORIGINAL BUG REPORT: "eu ainda não consigo atirar pra cima"
  //
  // Real-world thumb sequence:
  //   1. Left thumb pushes stick up.
  //   2. Right thumb reaches for CAST — left thumb LIFTS to reposition.
  //   3. CAST fires while stick is idle.
  // The previous build fell back to horizontal facing on stick release,
  // so step 3 fired sideways. This test asserts the fix directly.
  // ------------------------------------------------------------------
  {
    const p = createPlayer();
    const input = createInputState();

    // Step 1: push stick up, no fire yet.
    input.moveX = 0;
    input.moveY = 1;
    updatePlayer(p, input, STEP, noEvents);
    check(
      "aim goes up when the stick is pushed up",
      Math.abs(p.aimX) < 0.1 && p.aimY > 0.9,
      `aim=(${p.aimX.toFixed(2)}, ${p.aimY.toFixed(2)})`,
    );

    // Step 2: release stick BEFORE pressing fire.
    input.moveX = 0;
    input.moveY = 0;
    step(p, input, 3);
    check(
      "aim stays up after the stick is released",
      Math.abs(p.aimX) < 0.1 && p.aimY > 0.9,
      `aim=(${p.aimX.toFixed(2)}, ${p.aimY.toFixed(2)})`,
    );

    // Step 3: NOW press fire. This is the scenario that used to fire sideways.
    input.fireHeld = true;
    input.firePressed = true;
    updatePlayer(p, input, STEP, noEvents);
    check(
      "pressing CAST after releasing the stick fires in the direction we last aimed",
      Math.abs(p.aimX) < 0.1 && p.aimY > 0.9 && p.aimLatched,
      `aim=(${p.aimX.toFixed(2)}, ${p.aimY.toFixed(2)}) latched=${p.aimLatched}`,
    );

    // Step 4: with CAST still held, the player wants to run right. Aim stays up.
    input.moveX = 1;
    input.moveY = 0;
    input.firePressed = false;
    step(p, input, 8);
    check(
      "running right while CAST is held keeps firing up",
      Math.abs(p.aimX) < 0.1 && p.aimY > 0.9,
      `aim=(${p.aimX.toFixed(2)}, ${p.aimY.toFixed(2)})`,
    );
    check("...and the mage actually runs right at speed", p.vx > 6, `vx=${p.vx.toFixed(2)}`);
  }

  // Fresh player, stick idle, tap fire: the latch takes the CURRENT stick
  // direction. If the stick is neutral, it keeps whatever aim we had rather
  // than snapping horizontal — snapping to horizontal here fights players
  // who tap fire on their way into a firing position.
  const p = createPlayer();
  const input = createInputState();
  p.aimX = 0;
  p.aimY = 1; // was already aiming up

  // Push stick up-right, press fire.
  input.moveX = 0.7;
  input.moveY = 0.7;
  input.fireHeld = true;
  input.firePressed = true;
  updatePlayer(p, input, STEP, noEvents);
  check(
    "CAST latches aim to the stick direction at press time",
    Math.abs(p.aimX - 0.707) < 0.1 && Math.abs(p.aimY - 0.707) < 0.1,
    `aim=(${p.aimX.toFixed(2)}, ${p.aimY.toFixed(2)})`,
  );
  check("latch is engaged while fire is held", p.aimLatched);

  // Now keep fire held, push stick down-right. Aim must NOT follow.
  input.moveX = 1;
  input.moveY = -0.2;
  input.firePressed = false;
  step(p, input, 6);
  check(
    "aim stays latched while CAST is held even as the stick moves",
    Math.abs(p.aimX - 0.707) < 0.15 && Math.abs(p.aimY - 0.707) < 0.15,
    `aim=(${p.aimX.toFixed(2)}, ${p.aimY.toFixed(2)})`,
  );
  // Movement continues to follow the stick.
  check("stick keeps controlling movement while aim is latched", p.vx > 5, `vx=${p.vx.toFixed(2)}`);

  // Release fire. Latch clears; aim falls back to stick direction.
  input.fireHeld = false;
  step(p, input, 2);
  check("releasing CAST clears the latch", !p.aimLatched);

  // 8-way snap includes up. Push straight up, no fire: aim is (0, 1).
  const p2 = createPlayer();
  const input2 = createInputState();
  input2.moveX = 0;
  input2.moveY = 1;
  updatePlayer(p2, input2, STEP, noEvents);
  check(
    "pushing the stick straight up aims straight up",
    Math.abs(p2.aimX) < 0.1 && p2.aimY > 0.9,
    `aim=(${p2.aimX.toFixed(2)}, ${p2.aimY.toFixed(2)})`,
  );

  // snapAimStrict returns null when idle — the caller decides what to do.
  const strictIdle = snapAimStrict(0.05, 0.02);
  check("snapAimStrict returns null when the stick is idle", strictIdle === null);
  const strictUp = snapAimStrict(0, 1);
  check(
    "snapAimStrict snaps to up when pushed",
    strictUp !== null && Math.abs(strictUp.x) < 0.1 && strictUp.y > 0.9,
  );
}

// ---------------------------------------------------------------------------
console.log("\nDash");
{
  const p = createPlayer();
  const input = createInputState();
  input.dashRequest = 1;
  updatePlayer(p, input, STEP, noEvents);

  check("dash grants i-frames", p.invulnerable >= PLAYER.dashIFrames * 0.9);
  check("dash sets horizontal velocity to dashSpeed", Math.abs(p.vx - PLAYER.dashSpeed) < 0.1, `vx=${p.vx}`);
  check("dash consumes the request in one frame", (input.dashRequest as number) === 0);
  check("dash puts dash on cooldown", p.dashCooldown > 0);
  check("dash flips facing to the direction of travel", p.facing === 1);

  // A second request during the dash is rejected — no dash chaining.
  input.dashRequest = -1;
  updatePlayer(p, input, STEP, noEvents);
  check("dash cannot be re-triggered while active", Math.abs(p.vx - PLAYER.dashSpeed) < 0.5 && p.facing === 1);

  // Wait out the dash + a bit of cooldown, then try again — should fail.
  input.dashRequest = 0;
  step(p, input, 30); // ~0.5s
  input.dashRequest = -1;
  updatePlayer(p, input, STEP, noEvents);
  check("dash cannot be triggered again during cooldown", p.dashTimer <= 0);

  // Now wait past the full cooldown.
  input.dashRequest = 0;
  step(p, input, 60);
  input.dashRequest = -1;
  updatePlayer(p, input, STEP, noEvents);
  check("dash can be triggered again after cooldown", p.dashTimer > 0);
  check("dash accepts a request in the opposite direction after cooldown", p.dashDir === -1);
}

// ---------------------------------------------------------------------------
console.log("\nPogo");
{
  // Airborne + call pogoBounce = new upward velocity.
  const p = createPlayer();
  p.onGround = false;
  p.vy = -20; // falling fast
  const bounced = pogoBounce(p, noEvents);
  check("pogo returns true when it bounces", bounced);
  check("pogo replaces downward velocity with an upward bounce", p.vy > 0 && Math.abs(p.vy - PLAYER.pogoBounce) < 0.01);
  check("pogo clears the jumping flag so JUMP release can cut the arc", !p.jumping);

  // Grounded = no pogo. Otherwise you'd get infinite bounces off ground
  // targets.
  const p2 = createPlayer();
  p2.onGround = true;
  p2.vy = 0;
  const noGroundPogo = pogoBounce(p2, noEvents);
  check("pogo does nothing when the player is grounded", !noGroundPogo && p2.vy === 0);

  // Config sanity: the bounce is at least as high as jumpVelocity * 0.7,
  // or chaining pogos loses altitude fast and the mechanic dies.
  check(
    "pogo bounce is high enough to sustain a chain",
    PLAYER.pogoBounce >= PLAYER.jumpVelocity * 0.7,
    `pogo=${PLAYER.pogoBounce}  jump=${PLAYER.jumpVelocity}`,
  );
}

// ---------------------------------------------------------------------------
console.log("\nAim snap coverage");
{
  // Every one of the eight compass directions is representable. If any of
  // them snaps to the same direction as another one, we've silently lost a
  // heading.
  const dirs = [
    [1, 0, "E"],
    [1, 1, "NE"],
    [0, 1, "N"],
    [-1, 1, "NW"],
    [-1, 0, "W"],
    [-1, -1, "SW"],
    [0, -1, "S"],
    [1, -1, "SE"],
  ] as const;
  const seen = new Set<string>();
  let all = true;
  for (const [x, y, label] of dirs) {
    const a = snapAim(x, y, 1);
    const key = `${a.x.toFixed(2)},${a.y.toFixed(2)}`;
    if (seen.has(key)) {
      all = false;
      console.log(`        ${label} collides with a previous heading (${key})`);
    }
    seen.add(key);
  }
  check("all 8 headings are distinct", all && seen.size === 8, `${seen.size} unique`);
}
// ---------------------------------------------------------------------------
console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
