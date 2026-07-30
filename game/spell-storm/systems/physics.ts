import { ARENA, PLATFORMS } from "../config";
import type { AABB } from "../types";

/**
 * All collision in Spell Storm. There is no physics engine and there does not
 * need to be one: every body is an axis-aligned box, the only static geometry
 * is a flat floor and three horizontal platforms, and nothing rotates.
 *
 * Pulling in a rigid-body library for this would add a WASM blob and a
 * solver, and would make the movement *worse* — a run-and-gun wants
 * hand-authored, slightly unrealistic motion, not accurate simulation.
 */

export function boxesOverlap(a: AABB, b: AABB): boolean {
  return (
    Math.abs(a.x - b.x) < a.halfW + b.halfW && Math.abs(a.y - b.y) < a.halfH + b.halfH
  );
}

export function circleHitsBox(
  cx: number,
  cy: number,
  radius: number,
  box: AABB,
): boolean {
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
 * Resolves vertical collision against the floor and the platforms.
 *
 * Platforms are ONE-WAY: you can jump up through them and land on top, but
 * you cannot be blocked from below. That is a deliberate design choice, not a
 * simplification — two-way platforms in a game where you are dodging
 * projectiles turn every ceiling into a death trap, and the player has no
 * way to see the collision box.
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
  // Falling or level. Rising bodies pass through everything.
  if (vy > 0) return { surfaceY: null, onGround: false };

  let best: number | null = null;

  // Floor
  if (y <= ARENA.floorY) best = ARENA.floorY;

  // Platforms
  for (const p of PLATFORMS) {
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

  return { surfaceY: best, onGround: best !== null };
}

/** Clamps a body inside the arena's horizontal bounds. */
export function clampToArena(x: number, halfW: number): number {
  const limit = ARENA.halfWidth - halfW;
  return Math.max(-limit, Math.min(limit, x));
}

/** Whether a point has left the arena far enough to be despawned. */
export function outOfBounds(x: number, y: number): boolean {
  return (
    x < -ARENA.halfWidth - 8 ||
    x > ARENA.halfWidth + 8 ||
    y < ARENA.floorY - 6 ||
    y > ARENA.ceilingY + 8
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
