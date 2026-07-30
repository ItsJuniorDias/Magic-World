import type { FloorGap, Hazard, Platform, Room, Solid } from "../world/rooms";

/**
 * The active room's collision geometry.
 *
 * WHY THIS IS MODULE STATE AND NOT A PARAMETER
 *
 * `physics.ts` used to import ARENA and PLATFORMS straight from config, which
 * was fine when there was exactly one arena forever. Now that geometry
 * changes every time the player walks through a door, it has to come from
 * somewhere mutable.
 *
 * The alternative — threading a `room` argument through resolveGround,
 * clampToArena, outOfBounds, updatePlayer, the enemy update loop and every
 * boss behaviour — touches a dozen signatures to express one fact that is
 * genuinely global: there is exactly one room being simulated at a time. The
 * codebase already does this for `pendingEggs`, and the constraint that makes
 * it safe holds here too: single-threaded, one game instance per screen,
 * written once per transition and read-only during a frame.
 */

export interface ActiveArena {
  id: string;
  minX: number;
  maxX: number;
  floorY: number;
  ceilingY: number;
  platforms: Platform[];
  solids: Solid[];
  floorGaps: FloorGap[];
  hazards: Hazard[];
  /** True while a boss fight is running: gates are sealed. */
  sealed: boolean;
}

export const ARENA_STATE: ActiveArena = {
  id: "",
  minX: -16,
  maxX: 16,
  floorY: 0,
  ceilingY: 13,
  platforms: [],
  solids: [],
  floorGaps: [],
  hazards: [],
  sealed: false,
};

export function setActiveRoom(room: Room): void {
  ARENA_STATE.id = room.id;
  ARENA_STATE.minX = room.minX;
  ARENA_STATE.maxX = room.maxX;
  ARENA_STATE.floorY = 0;
  ARENA_STATE.ceilingY = room.ceilingY;
  ARENA_STATE.platforms = room.platforms;
  ARENA_STATE.solids = room.solids;
  ARENA_STATE.floorGaps = room.floorGaps;
  ARENA_STATE.hazards = room.hazards;
  ARENA_STATE.sealed = false;
}

export function setSealed(sealed: boolean): void {
  ARENA_STATE.sealed = sealed;
}

/** Room width in world units. */
export function arenaWidth(): number {
  return ARENA_STATE.maxX - ARENA_STATE.minX;
}

export function arenaCentreX(): number {
  return (ARENA_STATE.minX + ARENA_STATE.maxX) * 0.5;
}

/** True when x sits over a hole in the floor. */
export function overFloorGap(x: number): boolean {
  for (const g of ARENA_STATE.floorGaps) {
    if (Math.abs(x - g.x) < g.halfW) return true;
  }
  return false;
}
