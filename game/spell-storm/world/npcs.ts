/**
 * SPELL STORM — NPC placement.
 *
 * Four NPCs, each in a specific non-boss room. The choice of room per
 * NPC is deliberate:
 *
 *   wren    — Crossroads.       The hub. Everyone sees him first, and he
 *                                books the emotional stakes of the run.
 *   miel    — The Spore Wells.  Deepest fungal room, off the main path.
 *                                Reward for exploring; comments on Gorge.
 *   talon   — Windward Hall.    On the way to Nightwing. Sees you climb
 *                                to your third fight, mentions Selûne.
 *   cael    — The Long Fall.    Behind the members' gate. The twist NPC.
 *                                Placing him past the paywall makes the
 *                                twist a member reward.
 *
 * We only spawn ONE NPC per room, so the tuple below can be indexed by
 * room id directly rather than a filter over a list.
 */

export interface NpcPlacement {
  /** Stable id used for save data ("met" tracking) and script lookup. */
  id: string;
  /** Room id where this NPC lives. */
  roomId: string;
  /** World x. floorY is 0, so y is derived at spawn — NPCs stand on the floor. */
  x: number;
  /**
   * Colour hue in [0, 1). Just a look — the paper card that renders the
   * NPC uses this to tint its cloak so the four don't read as clones.
   */
  hue: number;
}

export const NPCS: readonly NpcPlacement[] = [
  { id: "wren", roomId: "crossroads", x: 8, hue: 0.62 },
  { id: "miel", roomId: "fungal_deep", x: -38, hue: 0.34 },
  { id: "talon", roomId: "spire_hall", x: 22, hue: 0.08 },
  { id: "cael", roomId: "cistern_fall", x: -18, hue: 0.78 },
];

export function npcsInRoom(roomId: string): NpcPlacement[] {
  return NPCS.filter((n) => n.roomId === roomId);
}

export function findNpc(id: string): NpcPlacement | null {
  return NPCS.find((n) => n.id === id) ?? null;
}
