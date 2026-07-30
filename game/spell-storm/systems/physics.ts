import type { AABB } from "../types";
import { ARENA_STATE, overFloorGap } from "./arena";

/**
 * All collision in Spell Storm. There is still no physics engine and there
 * still does not need to be one: every body is an axis-aligned box and
 * nothing rotates.
 *
 * Since the world became a room graph there are now three kinds of geometry
 * instead of one:
 *
 *   floor      — a flat line at y=0, with holes punched in it by floorGaps.
 *                A hole is how you reach a bottom gate.
 *   platforms  — ONE-WAY. Jump up through them, land on top. This is a
 *                design choice, not a simplification: two-way platforms in a
 *                game where you dodge projectiles turn every ceiling into a
 *                death trap, and the player can't see the collision box.
 *   solids     — block from every side. Walls, pillars, ledges you can't drop
 *                through. These are what make a room read as architecture
 *                rather than as a floor with furniture on it.
 *
 * Solids are resolved axis-by-axis (X first, then Y) rather than with a swept
 * test. Axis separation is what stops a body catching on the seam between two
 * adjacent blocks — the classic "invisible wall in the middle of a flat
 * floor" bug — because after the X pass the body is already clear
 * horizontally when the Y pass runs.
 */

export function boxesOverlap(a: AABB, b: AABB): boolean {
  return Math.abs(a.x - b.x) < a.halfW + b.halfW && Math.abs(a.y - b.y) < a.halfH + b.halfH;
}

export function circleHitsBox(cx: number, cy: number, radius: number, box: AABB): boolean {
  // Closest point on the box to the circle centre.
  const nearestX = Math.max(box.x - box.halfW, Math.min(cx, box.x + box.halfW));
  const nearestY = Math.max(box.y - box.halfH, Math.min(cy, box.y + box.halfH));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

export interface GroundResult {
  /** Y of the surface the body is standing on, or null if airborne. */
  surfaceY: number | null;
  onGround: boolean;
}

/**
 * Resolves vertical collision against the floor, one-way platforms and the
 * tops of solids.
 *
 * The one-way test is `previousBottom >= surface`: the body must have been
 * above the platform at the start of the step. Testing only the current
 * position would let a fast-falling body tunnel straight through.
 */
export function resolveGround(
  x: number,
  y: number,
  vy: number,
  halfW: number,
  previousY: number,
): GroundResult {
  // Falling or level. Rising bodies pass through one-way surfaces.
  if (vy > 0) return { surfaceY: null, onGround: false };

  let best: number | null = null;

  // Floor — unless there is a hole here.
  if (y <= ARENA_STATE.floorY && !overFloorGap(x)) best = ARENA_STATE.floorY;

  // One-way platforms
  for (const p of ARENA_STATE.platforms) {
    const withinX = Math.abs(x - p.x) < p.halfW + halfW * 0.5;
    if (!withinX) continue;
    // Small tolerance so a body resting exactly on the surface stays put
    // instead of oscillating between grounded and airborne.
    const wasAbove = previousY >= p.y - 0.02;
    const isBelow = y <= p.y;
    if (wasAbove && isBelow) {
      if (best === null || p.y > best) best = p.y;
    }
  }

  // Tops of solids behave like platforms on the way down. The sides and the
  // underside are handled by resolveSolidsX / resolveCeiling.
  for (const s of ARENA_STATE.solids) {
    const top = s.y + s.halfH;
    const withinX = Math.abs(x - s.x) < s.halfW + halfW * 0.5;
    if (!withinX) continue;
    const wasAbove = previousY >= top - 0.02;
    const isBelow = y <= top;
    if (wasAbove && isBelow) {
      if (best === null || top > best) best = top;
    }
  }

  return { surfaceY: best, onGround: best !== null };
}

export interface SolidResult {
  x: number;
  /** True when the body was pushed out sideways — used to kill horizontal speed. */
  blocked: boolean;
}

/**
 * Horizontal separation from solids. Call AFTER integrating x, BEFORE the
 * vertical pass.
 *
 * `y` is the body's FEET. A body is only pushed sideways when its vertical
 * span genuinely overlaps the block — otherwise standing on top of a pillar
 * would register as a side hit and shove you off it.
 */
export function resolveSolidsX(
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  previousX: number,
): SolidResult {
  const centreY = y + halfH;
  let out = x;
  let blocked = false;

  for (const s of ARENA_STATE.solids) {
    const top = s.y + s.halfH;
    const bottom = s.y - s.halfH;
    // Ignore the block entirely if we are resting on its lid. The 0.06 slack
    // matches the tolerance in resolveGround.
    if (y >= top - 0.06) continue;
    if (centreY + halfH <= bottom) continue;
    if (centreY - halfH >= top) continue;

    const dx = out - s.x;
    const overlap = s.halfW + halfW - Math.abs(dx);
    if (overlap <= 0) continue;

    // Push out along the axis we came from, so a body moving right is
    // stopped on the block's left face rather than teleported through it.
    const fromLeft = previousX <= s.x;
    out = fromLeft ? s.x - (s.halfW + halfW) : s.x + (s.halfW + halfW);
    blocked = true;
  }

  return { x: out, blocked };
}

export interface CeilingResult {
  y: number;
  bumped: boolean;
}

/** Stops a rising body under the underside of a solid, and under the room roof. */
export function resolveCeiling(
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  vy: number,
): CeilingResult {
  const roof = ARENA_STATE.ceilingY - halfH * 2;
  if (vy <= 0) {
    return { y: Math.min(y, roof), bumped: false };
  }

  let out = y;
  let bumped = false;
  const headY = y + halfH * 2;

  for (const s of ARENA_STATE.solids) {
    const bottom = s.y - s.halfH;
    const top = s.y + s.halfH;
    if (Math.abs(x - s.x) >= s.halfW + halfW) continue;
    if (headY <= bottom) continue;
    if (out >= top) continue;
    const capped = bottom - halfH * 2;
    if (capped < out) {
      out = capped;
      bumped = true;
    }
  }

  if (out > roof) {
    out = roof;
    bumped = true;
  }

  return { y: out, bumped };
}

/** True when the body is inside a hazard (spikes). */
export function hitsHazard(box: AABB): boolean {
  for (const h of ARENA_STATE.hazards) {
    if (
      Math.abs(box.x - h.x) < box.halfW + h.halfW &&
      Math.abs(box.y - (h.y + h.halfH)) < box.halfH + h.halfH
    ) {
      return true;
    }
  }
  return false;
}

/** Clamps a body inside the active room horizontal bounds. */
export function clampToArena(x: number, halfW: number): number {
  return Math.max(ARENA_STATE.minX + halfW, Math.min(ARENA_STATE.maxX - halfW, x));
}

/** Whether a point has left the room far enough to be despawned. */
export function outOfBounds(x: number, y: number): boolean {
  return (
    x < ARENA_STATE.minX - 8 ||
    x > ARENA_STATE.maxX + 8 ||
    y < ARENA_STATE.floorY - 14 ||
    y > ARENA_STATE.ceilingY + 8
  );
}

/** Frame-rate independent exponential smoothing toward a target. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/** Moves `current` toward `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}
