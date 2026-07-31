import type { BossKind, MinionKind } from "../config";

/**
 * SPELL STORM — the world.
 *
 * The game used to be one 32wu box. Twenty rooms now sit on a graph roughly
 * 2,000wu across, which is the difference between "an arena" and "a place".
 *
 * WHY ROOMS AND NOT ONE CONTINUOUS LEVEL
 *
 * A single strip can't branch, and branching is the whole point — Hollow
 * Knight's map is legible because you make a *choice* at a junction and the
 * choice is spatial. It also can't be streamed: one 2,000wu level means every
 * extrusion in the game resident in VRAM at once. Rooms give us both for
 * free. Each room builds its geometry on entry and disposes it on exit, so
 * the GPU only ever holds the room you're standing in.
 *
 * THE SHAPE OF THE MAP
 *
 *                        [spire_climb]──[nightwing_perch ★2]
 *                              │
 *   [thorn_hollow ★5]      [spire_hall]
 *          │                   │
 *     [thornwood]          (up)│
 *          │                   │
 *     [thorn_gate]─────────────┤
 *          │                   │
 *  [gorge_lair ★1]        [CROSSROADS]───(high ledge, needs 6)───[storm_ascent]──[storm_throne ★7]
 *          │                   │
 *   [fungal_deep]              │(down)
 *          │                   │
 *  [fungal_hollow]────────[cistern_fall]
 *          │                   │
 *          └───(left)          │
 *                        [cistern_choir]──[lumen_sanctum ★4]
 *   [CROSSROADS]───(right)──[emberway]──[ember_forge]──[cinder_hall ★3]
 *                                            │(down)
 *                                       [void_stair]
 *                                            │
 *                                      [void_vault ★6]
 *
 * FREE VS MEMBER
 *
 * Fungal, Spire and Ember are open to everyone: a hub, three branches, three
 * bosses, an ending. Thorn, Cistern, Void and Storm sit behind the
 * membership. The gate is a visible sealed door in the world rather than a
 * modal that ambushes you, which is the difference between a paywall that
 * reads as content and one that reads as an interruption.
 *
 * AUTHORING NOTES
 *
 *   - x is room-local. Rooms don't share a coordinate space; the map overlay
 *     positions them by `map.col/row`, not by world position.
 *   - floorY is always 0. Everything else hangs off that.
 *   - `solids` block from every side (walls, pillars, ledges you can't drop
 *     through). `platforms` are one-way — jump up through, land on top.
 *   - `floorGaps` punch holes in the floor. A bottom gate needs one.
 *   - Gate `at` is the CENTRE of the opening: y for left/right, x for
 *     top/bottom.
 */

// ---------------------------------------------------------------------------
// Biomes
// ---------------------------------------------------------------------------

export type BiomeId =
  | "hollow"
  | "fungal"
  | "thorn"
  | "spire"
  | "ember"
  | "cistern"
  | "void"
  | "storm";

export type PropKind = "conifer" | "mushroom" | "crystal" | "pillar" | "thorn" | "shard" | "spire";

export interface Biome {
  id: BiomeId;
  label: string;
  /** Sky gradient, horizon to zenith. */
  sky: [number, number, number, number, number];
  /** Parallax layers, far to near. */
  far: number;
  farEdge: number;
  mid: number;
  midEdge: number;
  near: number;
  nearEdge: number;
  /** Ground and platforms. */
  groundFace: number;
  groundEdge: number;
  groundLip: number;
  platformFace: number;
  platformEdge: number;
  platformLip: number;
  /** Scenery silhouette used in the mid layer. */
  prop: PropKind;
  /** Drifting motes. Set count to 0 for none. */
  moteColor: number;
  moteCount: number;
  /** Tint for the map overlay node. */
  mapTint: string;
}

export const BIOMES: Record<BiomeId, Biome> = {
  hollow: {
    id: "hollow",
    label: "Hollowroot",
    sky: [0xffb25c, 0xe8593c, 0x8e2d63, 0x3b1b5e, 0x140b2e],
    far: 0x4a2a63,
    farEdge: 0x351d49,
    mid: 0x6b3260,
    midEdge: 0x4c2145,
    near: 0x3f2247,
    nearEdge: 0x2a1631,
    groundFace: 0x2e1a3d,
    groundEdge: 0x1c0f28,
    groundLip: 0xffa04f,
    platformFace: 0x6d4a7a,
    platformEdge: 0x422c4d,
    platformLip: 0xffc94a,
    prop: "conifer",
    moteColor: 0xffc94a,
    moteCount: 18,
    mapTint: "#C9A0FF",
  },
  fungal: {
    id: "fungal",
    label: "Fungal Hollow",
    sky: [0x9fe86b, 0x3f9e6a, 0x1d6b62, 0x123f52, 0x08202e],
    far: 0x1f6a5e,
    farEdge: 0x144a44,
    mid: 0x2b8a63,
    midEdge: 0x1a5b45,
    near: 0x1d4f45,
    nearEdge: 0x102f2b,
    groundFace: 0x18382f,
    groundEdge: 0x0d211c,
    groundLip: 0x8ce87a,
    platformFace: 0x3f7a5c,
    platformEdge: 0x244a38,
    platformLip: 0xb6f57f,
    prop: "mushroom",
    moteColor: 0xb6f57f,
    moteCount: 26,
    mapTint: "#8CE87A",
  },
  thorn: {
    id: "thorn",
    label: "Thornwood",
    sky: [0xffd98a, 0xd9793a, 0x7a3a2e, 0x3d2430, 0x1a1220],
    far: 0x4d3a2c,
    farEdge: 0x33261d,
    mid: 0x6b4a2e,
    midEdge: 0x45301d,
    near: 0x3c2a20,
    nearEdge: 0x241a13,
    groundFace: 0x2a2016,
    groundEdge: 0x18120d,
    groundLip: 0xd9a24f,
    platformFace: 0x66492e,
    platformEdge: 0x3d2c1c,
    platformLip: 0xe8c46b,
    prop: "thorn",
    moteColor: 0xd9a24f,
    moteCount: 20,
    mapTint: "#D9A24F",
  },
  spire: {
    id: "spire",
    label: "Wind Spire",
    sky: [0x7fd8ff, 0x4a7fd6, 0x2b4a9e, 0x1b2a63, 0x0d1230],
    far: 0x2a3f7a,
    farEdge: 0x1c2b57,
    mid: 0x3a5599,
    midEdge: 0x263a6b,
    near: 0x2a3a63,
    nearEdge: 0x18213d,
    groundFace: 0x1e2749,
    groundEdge: 0x111730,
    groundLip: 0x8fd8ff,
    platformFace: 0x4a5f9e,
    platformEdge: 0x2b3a66,
    platformLip: 0xa8e4ff,
    prop: "spire",
    moteColor: 0xa8e4ff,
    moteCount: 30,
    mapTint: "#8FD8FF",
  },
  ember: {
    id: "ember",
    label: "Ember Deep",
    sky: [0xffd06b, 0xff7a3d, 0xc93a2e, 0x6b1f2e, 0x2b0d1c],
    far: 0x6b2a2e,
    farEdge: 0x4a1c20,
    mid: 0x8f3a2b,
    midEdge: 0x612519,
    near: 0x542420,
    nearEdge: 0x331512,
    groundFace: 0x3d1c19,
    groundEdge: 0x230f0e,
    groundLip: 0xff8a3d,
    platformFace: 0x7a3f2e,
    platformEdge: 0x4a251b,
    platformLip: 0xffb25c,
    prop: "pillar",
    moteColor: 0xff8a3d,
    moteCount: 24,
    mapTint: "#FF8A3D",
  },
  cistern: {
    id: "cistern",
    label: "Sunken Cistern",
    sky: [0x8ff0e8, 0x3aa8b8, 0x1f6b8a, 0x143f5e, 0x081f2e],
    far: 0x1f5a7a,
    farEdge: 0x143f57,
    mid: 0x2b7a99,
    midEdge: 0x1a5166,
    near: 0x1d4657,
    nearEdge: 0x102b36,
    groundFace: 0x15303d,
    groundEdge: 0x0b1c24,
    groundLip: 0x6fe9ff,
    platformFace: 0x35697a,
    platformEdge: 0x1e3f4a,
    platformLip: 0x9ff2ff,
    prop: "crystal",
    moteColor: 0x6fe9ff,
    moteCount: 34,
    mapTint: "#6FE9FF",
  },
  void: {
    id: "void",
    label: "Obsidian Vault",
    sky: [0x8a5cd6, 0x4a2b8a, 0x2a1554, 0x160a2e, 0x070315],
    far: 0x2a1a4a,
    farEdge: 0x1b1030,
    mid: 0x3d2666,
    midEdge: 0x261646,
    near: 0x241540,
    nearEdge: 0x150c26,
    groundFace: 0x180d2b,
    groundEdge: 0x0c0617,
    groundLip: 0xa06bff,
    platformFace: 0x40295e,
    platformEdge: 0x261638,
    platformLip: 0xc49aff,
    prop: "shard",
    moteColor: 0xa06bff,
    moteCount: 28,
    mapTint: "#A06BFF",
  },
  storm: {
    id: "storm",
    label: "Storm Throne",
    sky: [0xffe08a, 0xff5c72, 0x8a2b6b, 0x3d1146, 0x14031f],
    far: 0x5c1f5e,
    farEdge: 0x3d1240,
    mid: 0x8a2b6b,
    midEdge: 0x5c1a48,
    near: 0x4a1a44,
    nearEdge: 0x2b0e28,
    groundFace: 0x330f2e,
    groundEdge: 0x1c0619,
    groundLip: 0xffc94a,
    platformFace: 0x6b2a5e,
    platformEdge: 0x40173a,
    platformLip: 0xffd76b,
    prop: "pillar",
    moteColor: 0xffc94a,
    moteCount: 32,
    mapTint: "#FFC94A",
  },
};

// ---------------------------------------------------------------------------
// Room primitives
// ---------------------------------------------------------------------------

/** One-way platform. `x`/`y` is the centre of the top surface. */
export interface Platform {
  x: number;
  y: number;
  halfW: number;
}

/** A solid block. Blocks from every side. */
export interface Solid {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

/** A hole in the floor. Fall through it to reach a bottom gate. */
export interface FloorGap {
  x: number;
  halfW: number;
}

/** Spikes. Contact costs a heart and bounces you back. */
export interface Hazard {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

export type GateSide = "left" | "right" | "top" | "bottom";

export interface Gate {
  id: string;
  side: GateSide;
  /** Centre of the opening: y for left/right, x for top/bottom. */
  at: number;
  /** Height of the opening (left/right) or width (top/bottom). */
  size: number;
  /** Destination room id. */
  to: string;
  /** Gate id in the destination room to arrive at. */
  toGate: string;
  /** Bosses that must be defeated first. */
  requires?: number;
  /** Behind the membership. */
  pro?: boolean;
  /** Label shown on the sealed door. */
  sealLabel?: string;
}

export interface Spawn {
  kind: MinionKind;
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  biome: BiomeId;
  minX: number;
  maxX: number;
  ceilingY: number;
  platforms: Platform[];
  solids: Solid[];
  floorGaps: FloorGap[];
  hazards: Hazard[];
  gates: Gate[];
  spawns: Spawn[];
  /** Present on boss arenas. Gates seal until the boss is dead. */
  boss?: BossKind;
  /** Boss display name, shown on the health bar. */
  bossName?: string;
  /** Boss subtitle — the Hollow Knight second line. */
  bossTitle?: string;
  /** A bench: heals, saves, becomes the respawn point. */
  bench?: { x: number };
  /** Position on the map overlay grid. */
  map: { col: number; row: number };
}

// ---------------------------------------------------------------------------
// Authoring helpers
// ---------------------------------------------------------------------------

const p = (x: number, y: number, halfW: number): Platform => ({ x, y, halfW });
const s = (x: number, y: number, halfW: number, halfH: number): Solid => ({ x, y, halfW, halfH });
const gap = (x: number, halfW: number): FloorGap => ({ x, halfW });
const spike = (x: number, y: number, halfW: number, halfH = 0.45): Hazard => ({ x, y, halfW, halfH });
const at = (kind: MinionKind, x: number, y = 1.2): Spawn => ({ kind, x, y });

/** A run of platforms climbing in one direction. */
function stairs(
  x0: number,
  y0: number,
  count: number,
  dx: number,
  dy: number,
  halfW = 1.9,
): Platform[] {
  const out: Platform[] = [];
  for (let i = 0; i < count; i++) out.push(p(x0 + dx * i, y0 + dy * i, halfW));
  return out;
}

/** Evenly spaced platforms across a span, alternating height. */
function ledges(
  from: number,
  to: number,
  count: number,
  lowY: number,
  highY: number,
  halfW = 2.4,
): Platform[] {
  const out: Platform[] = [];
  const step = (to - from) / Math.max(1, count - 1);
  for (let i = 0; i < count; i++) {
    out.push(p(from + step * i, i % 2 === 0 ? lowY : highY, halfW));
  }
  return out;
}

// ---------------------------------------------------------------------------
// The rooms
// ---------------------------------------------------------------------------

export const ROOMS: Record<string, Room> = {
  // =========================================================================
  // HUB
  // =========================================================================
  crossroads: {
    id: "crossroads",
    name: "Hollowroot Crossroads",
    biome: "hollow",
    minX: -38,
    maxX: 38,
    ceilingY: 22,
    platforms: [
      p(-24, 4.2, 3.4),
      p(-12, 7.6, 3.0),
      p(0, 4.6, 4.2),
      p(12, 7.6, 3.0),
      p(24, 4.2, 3.4),
      // The climb to the sealed Storm Gate, high on the right wall.
      ...stairs(21, 11.0, 4, 3.9, 2.6, 1.7),
    ],
    solids: [
      // Buttresses framing the hub. They make the room read as built.
      s(-31, 3.0, 1.1, 3.0),
      s(31, 3.0, 1.1, 3.0),
    ],
    // The pit sits well clear of the bench at x=0. A hole under the spawn
    // point is a hole the player falls through before they have touched a
    // control, and they arrive somewhere they did not choose to go.
    floorGaps: [gap(15, 3.4)],
    hazards: [],
    gates: [
      { id: "w", side: "left", at: 2.2, size: 5.0, to: "fungal_hollow", toGate: "e" },
      { id: "e", side: "right", at: 2.2, size: 5.0, to: "emberway", toGate: "w" },
      { id: "n", side: "top", at: -12, size: 7.0, to: "spire_hall", toGate: "s" },
      { id: "s", side: "bottom", at: 15, size: 6.8, to: "cistern_fall", toGate: "n" },
      {
        id: "storm",
        side: "right",
        at: 20.4,
        size: 4.6,
        to: "storm_ascent",
        toGate: "w",
        requires: 6,
        sealLabel: "Sealed by six sigils",
      },
    ],
    spawns: [at("slime", -18), at("slime", 18), at("bat", 6, 9)],
    bench: { x: 0 },
    map: { col: 3, row: 2 },
  },

  // =========================================================================
  // FUNGAL BRANCH  →  Gorge Mother
  // =========================================================================
  fungal_hollow: {
    id: "fungal_hollow",
    name: "Fungal Hollow",
    biome: "fungal",
    minX: -52,
    maxX: 52,
    ceilingY: 26,
    platforms: [
      ...ledges(-44, -8, 6, 3.4, 6.8, 2.2),
      p(4, 4.0, 3.6),
      p(16, 7.2, 2.8),
      p(30, 4.4, 3.2),
      p(42, 8.0, 2.6),
      // Column up to the Thorn gate in the ceiling.
      ...stairs(-30, 10.5, 5, 2.6, 2.9, 1.6),
    ],
    solids: [s(-2, 2.2, 1.0, 2.2), s(24, 1.6, 0.9, 1.6)],
    floorGaps: [],
    hazards: [spike(10, 0.3, 1.6), spike(-16, 0.3, 1.4)],
    gates: [
      { id: "e", side: "right", at: 2.2, size: 5.0, to: "crossroads", toGate: "w" },
      { id: "w", side: "left", at: 2.2, size: 5.0, to: "fungal_deep", toGate: "e" },
      {
        id: "n",
        side: "top",
        at: -20,
        size: 6.4,
        to: "thorn_gate",
        toGate: "s",
        pro: true,
        sealLabel: "Thornwood — members",
      },
    ],
    spawns: [
      at("slime", -36),
      at("slime", -24),
      at("bat", -12, 9.5),
      at("slime", 12),
      at("wisp", 26, 7.5),
      at("bat", 38, 10),
    ],
    map: { col: 2, row: 2 },
  },

  fungal_deep: {
    id: "fungal_deep",
    name: "The Spore Wells",
    biome: "fungal",
    minX: -58,
    maxX: 58,
    ceilingY: 24,
    platforms: [
      ...ledges(-50, -20, 5, 4.0, 8.4, 2.0),
      p(-6, 5.4, 3.0),
      p(6, 9.2, 2.6),
      p(20, 5.4, 3.0),
      ...stairs(32, 4.2, 5, 5.2, 2.4, 1.9),
    ],
    solids: [s(-14, 3.0, 1.2, 3.0), s(14, 3.6, 1.2, 3.6), s(46, 2.4, 1.0, 2.4)],
    floorGaps: [],
    hazards: [spike(-30, 0.3, 2.2), spike(0, 0.3, 1.8), spike(28, 0.3, 2.0)],
    gates: [
      { id: "e", side: "right", at: 2.2, size: 5.0, to: "fungal_hollow", toGate: "w" },
      { id: "w", side: "left", at: 2.2, size: 5.6, to: "gorge_lair", toGate: "e" },
    ],
    spawns: [
      at("slime", -44),
      at("wisp", -34, 8),
      at("slime", -20),
      at("bat", -4, 11),
      at("golem", 12),
      at("slime", 26),
      at("bat", 40, 10),
      at("wisp", 50, 9),
    ],
    bench: { x: 52 },
    map: { col: 1, row: 2 },
  },

  gorge_lair: {
    id: "gorge_lair",
    name: "The Gorge",
    biome: "fungal",
    minX: -26,
    maxX: 26,
    ceilingY: 20,
    // Boss arenas get platforms, and that is not decoration: the Gorge
    // Mother owns the entire floor when she lands. Without somewhere to
    // stand the fight is a coin flip rather than a problem.
    platforms: [p(-17, 5.2, 3.0), p(0, 8.6, 3.4), p(17, 5.2, 3.0)],
    solids: [],
    floorGaps: [],
    hazards: [],
    gates: [{ id: "e", side: "right", at: 2.4, size: 5.6, to: "fungal_deep", toGate: "w" }],
    spawns: [],
    boss: "gorgeMother",
    bossName: "Gorge Mother",
    bossTitle: "Root of the Bloom",
    map: { col: 0, row: 2 },
  },

  // =========================================================================
  // THORN BRANCH (members)  →  Thorn Warden
  // =========================================================================
  thorn_gate: {
    id: "thorn_gate",
    name: "Bramble Gate",
    biome: "thorn",
    minX: -44,
    maxX: 44,
    ceilingY: 22,
    platforms: [
      ...ledges(-36, -4, 5, 4.4, 8.0, 2.2),
      p(10, 5.0, 3.2),
      p(24, 8.6, 2.6),
      p(36, 4.6, 2.8),
    ],
    solids: [s(-18, 2.6, 1.1, 2.6), s(18, 3.2, 1.1, 3.2)],
    floorGaps: [gap(-8, 3.0)],
    hazards: [spike(30, 0.3, 2.4)],
    gates: [
      { id: "s", side: "bottom", at: -8, size: 5.8, to: "fungal_hollow", toGate: "n" },
      { id: "w", side: "left", at: 2.2, size: 5.0, to: "thornwood", toGate: "e" },
    ],
    spawns: [at("wisp", -28, 8), at("slime", -14), at("golem", 4), at("bat", 20, 10), at("slime", 34)],
    map: { col: 2, row: 1 },
  },

  thornwood: {
    id: "thornwood",
    name: "The Thornwood",
    biome: "thorn",
    minX: -60,
    maxX: 60,
    ceilingY: 26,
    platforms: [
      ...ledges(-52, -16, 6, 4.6, 9.2, 2.0),
      p(0, 6.0, 3.4),
      p(14, 10.4, 2.4),
      p(28, 6.0, 3.0),
      ...stairs(40, 4.6, 4, 5.0, 2.8, 1.8),
    ],
    solids: [s(-8, 3.4, 1.2, 3.4), s(22, 2.8, 1.1, 2.8), s(52, 3.0, 1.2, 3.0)],
    floorGaps: [],
    hazards: [spike(-34, 0.3, 2.6), spike(-4, 0.3, 2.0), spike(34, 0.3, 2.8)],
    gates: [
      { id: "e", side: "right", at: 2.2, size: 5.0, to: "thorn_gate", toGate: "w" },
      { id: "w", side: "left", at: 2.2, size: 5.6, to: "thorn_hollow", toGate: "e" },
    ],
    spawns: [
      at("golem", -46),
      at("wisp", -36, 9),
      at("bat", -22, 12),
      at("slime", -10),
      at("golem", 8),
      at("wisp", 24, 9),
      at("bat", 44, 11),
    ],
    bench: { x: 56 },
    map: { col: 1, row: 1 },
  },

  thorn_hollow: {
    id: "thorn_hollow",
    name: "Heartwood",
    biome: "thorn",
    minX: -28,
    maxX: 28,
    ceilingY: 20,
    platforms: [p(-19, 5.6, 2.8), p(0, 9.4, 3.0), p(19, 5.6, 2.8)],
    solids: [],
    floorGaps: [],
    hazards: [],
    gates: [{ id: "e", side: "right", at: 2.4, size: 5.6, to: "thornwood", toGate: "w" }],
    spawns: [],
    boss: "thornWarden",
    bossName: "Thorn Warden",
    bossTitle: "Keeper of the Deep Wood",
    map: { col: 0, row: 1 },
  },

  // =========================================================================
  // SPIRE BRANCH  →  Nightwing
  // =========================================================================
  spire_hall: {
    id: "spire_hall",
    name: "Windward Hall",
    biome: "spire",
    minX: -40,
    maxX: 40,
    ceilingY: 30,
    platforms: [
      p(-30, 4.6, 3.0),
      p(-16, 8.4, 2.6),
      p(-2, 12.2, 2.4),
      p(12, 8.4, 2.6),
      p(26, 4.6, 3.0),
      // The shaft up. Alternating sides so the climb is a rhythm.
      ...ledges(-10, 10, 6, 15.6, 19.4, 1.8),
    ],
    solids: [s(-22, 2.4, 1.0, 2.4), s(20, 2.4, 1.0, 2.4)],
    floorGaps: [gap(6, 3.2)],
    hazards: [],
    gates: [
      { id: "s", side: "bottom", at: 6, size: 6.2, to: "crossroads", toGate: "n" },
      { id: "n", side: "top", at: 0, size: 7.0, to: "spire_climb", toGate: "s" },
    ],
    spawns: [at("bat", -24, 11), at("bat", 8, 14), at("wisp", -4, 10), at("slime", 30)],
    map: { col: 3, row: 1 },
  },

  spire_climb: {
    id: "spire_climb",
    name: "The Long Ascent",
    biome: "spire",
    minX: -30,
    maxX: 30,
    ceilingY: 62,
    // A genuinely tall room. The camera has to follow vertically here, which
    // is the reason CAMERA.followY was replaced with a proper deadzone rig.
    platforms: [
      ...ledges(-22, 22, 5, 4.6, 8.2, 2.2),
      ...ledges(-20, 20, 5, 13.0, 16.6, 2.0),
      ...ledges(-20, 20, 5, 21.4, 25.0, 2.0),
      ...ledges(-18, 18, 5, 29.8, 33.4, 1.9),
      ...ledges(-18, 18, 5, 38.2, 41.8, 1.9),
      ...ledges(-14, 14, 4, 46.6, 50.2, 1.8),
      p(0, 55.0, 4.0),
    ],
    solids: [s(-27, 12.0, 1.4, 12.0), s(27, 20.0, 1.4, 12.0)],
    floorGaps: [gap(0, 3.0)],
    hazards: [spike(-8, 0.3, 3.0), spike(10, 0.3, 3.0)],
    gates: [
      { id: "s", side: "bottom", at: 0, size: 6.4, to: "spire_hall", toGate: "n" },
      { id: "e", side: "right", at: 56.0, size: 5.4, to: "nightwing_perch", toGate: "w" },
    ],
    spawns: [
      at("bat", -14, 8),
      at("bat", 12, 18),
      at("wisp", -8, 24),
      at("bat", 6, 32),
      at("wisp", -6, 40),
      at("bat", 10, 48),
      at("bat", -10, 52),
    ],
    bench: { x: -24 },
    map: { col: 4, row: 0 },
  },

  nightwing_perch: {
    id: "nightwing_perch",
    name: "The Roost",
    biome: "spire",
    minX: -30,
    maxX: 30,
    ceilingY: 22,
    platforms: [p(-20, 5.0, 3.0), p(0, 8.0, 2.6), p(20, 5.0, 3.0)],
    solids: [],
    floorGaps: [],
    hazards: [],
    gates: [{ id: "w", side: "left", at: 2.4, size: 5.4, to: "spire_climb", toGate: "e" }],
    spawns: [],
    boss: "nightwing",
    bossName: "Nightwing",
    bossTitle: "Matriarch of the Roost",
    map: { col: 5, row: 0 },
  },

  // =========================================================================
  // EMBER BRANCH  →  Cinder Warden
  // =========================================================================
  emberway: {
    id: "emberway",
    name: "The Emberway",
    biome: "ember",
    minX: -50,
    maxX: 50,
    ceilingY: 24,
    platforms: [
      p(-40, 4.4, 3.0),
      p(-26, 8.0, 2.6),
      p(-12, 4.4, 3.0),
      p(2, 8.6, 2.8),
      p(16, 5.0, 3.0),
      p(30, 9.0, 2.6),
      p(42, 5.2, 3.0),
    ],
    solids: [s(-33, 2.6, 1.1, 2.6), s(9, 3.0, 1.1, 3.0), s(36, 2.4, 1.0, 2.4)],
    floorGaps: [],
    hazards: [spike(-20, 0.3, 2.4), spike(22, 0.3, 2.6)],
    gates: [
      { id: "w", side: "left", at: 2.2, size: 5.0, to: "crossroads", toGate: "e" },
      { id: "e", side: "right", at: 2.2, size: 5.0, to: "ember_forge", toGate: "w" },
    ],
    spawns: [
      at("slime", -44),
      at("bat", -30, 11),
      at("golem", -14),
      at("wisp", 4, 9),
      at("slime", 20),
      at("bat", 34, 12),
    ],
    map: { col: 4, row: 2 },
  },

  ember_forge: {
    id: "ember_forge",
    name: "The Cooling Forge",
    biome: "ember",
    minX: -56,
    maxX: 56,
    ceilingY: 26,
    platforms: [
      ...ledges(-48, -12, 5, 4.6, 9.0, 2.2),
      p(2, 5.6, 3.4),
      p(16, 10.0, 2.6),
      p(30, 5.6, 3.0),
      p(44, 9.6, 2.6),
    ],
    solids: [s(-26, 3.4, 1.3, 3.4), s(10, 2.6, 1.1, 2.6), s(38, 3.0, 1.2, 3.0)],
    floorGaps: [gap(22, 3.2)],
    hazards: [spike(-6, 0.3, 2.6)],
    gates: [
      { id: "w", side: "left", at: 2.2, size: 5.0, to: "emberway", toGate: "e" },
      { id: "e", side: "right", at: 2.2, size: 5.6, to: "cinder_hall", toGate: "w" },
      {
        id: "s",
        side: "bottom",
        at: 22,
        size: 6.0,
        to: "void_stair",
        toGate: "n",
        pro: true,
        sealLabel: "Obsidian Vault — members",
      },
    ],
    spawns: [
      at("golem", -40),
      at("wisp", -30, 9),
      at("slime", -18),
      at("bat", -4, 12),
      at("golem", 14),
      at("wisp", 32, 10),
      at("slime", 46),
    ],
    bench: { x: 50 },
    map: { col: 5, row: 2 },
  },

  cinder_hall: {
    id: "cinder_hall",
    name: "The Cinder Hall",
    biome: "ember",
    minX: -28,
    maxX: 28,
    ceilingY: 20,
    platforms: [p(-18, 5.4, 2.8), p(0, 9.0, 3.2), p(18, 5.4, 2.8)],
    solids: [],
    floorGaps: [],
    hazards: [],
    gates: [{ id: "w", side: "left", at: 2.4, size: 5.6, to: "ember_forge", toGate: "e" }],
    spawns: [],
    boss: "cinderWarden",
    bossName: "Cinder Warden",
    bossTitle: "Last of the Forge",
    map: { col: 6, row: 2 },
  },

  // =========================================================================
  // VOID BRANCH (members)  →  Voidmaw
  // =========================================================================
  void_stair: {
    id: "void_stair",
    name: "Obsidian Stair",
    biome: "void",
    minX: -34,
    maxX: 34,
    ceilingY: 44,
    platforms: [
      ...stairs(-26, 36.0, 6, 5.0, -4.4, 2.0),
      ...stairs(24, 12.0, 5, -5.0, -1.9, 2.0),
      p(0, 4.6, 3.6),
    ],
    solids: [s(-31, 18.0, 1.3, 14.0), s(31, 18.0, 1.3, 14.0)],
    floorGaps: [gap(-14, 3.0)],
    hazards: [spike(12, 0.3, 3.2)],
    gates: [
      { id: "n", side: "top", at: 22, size: 5.8, to: "ember_forge", toGate: "s" },
      { id: "s", side: "bottom", at: -14, size: 5.6, to: "void_vault", toGate: "n" },
    ],
    spawns: [
      at("wisp", -20, 30),
      at("bat", -6, 24),
      at("wisp", 10, 16),
      at("golem", 18),
      at("bat", -12, 8),
    ],
    bench: { x: 26 },
    map: { col: 5, row: 3 },
  },

  void_vault: {
    id: "void_vault",
    name: "The Vault",
    biome: "void",
    minX: -30,
    maxX: 30,
    ceilingY: 24,
    // Voidmaw drags you toward the centre, so the platforms sit wide: the
    // fight is about fighting the pull to reach the edges, and there has to
    // be somewhere worth reaching.
    platforms: [p(-22, 5.6, 3.0), p(-9, 10.0, 2.4), p(9, 10.0, 2.4), p(22, 5.6, 3.0)],
    solids: [],
    floorGaps: [],
    hazards: [],
    gates: [{ id: "n", side: "top", at: 0, size: 6.0, to: "void_stair", toGate: "s" }],
    spawns: [],
    boss: "voidmaw",
    bossName: "Voidmaw",
    bossTitle: "That Which Draws Inward",
    map: { col: 5, row: 4 },
  },

  // =========================================================================
  // CISTERN BRANCH (members)  →  Lumen Choir
  // =========================================================================
  cistern_fall: {
    id: "cistern_fall",
    name: "The Long Fall",
    biome: "cistern",
    minX: -32,
    maxX: 32,
    ceilingY: 46,
    platforms: [
      ...ledges(-24, 24, 5, 38.0, 41.0, 2.0),
      ...ledges(-22, 22, 5, 29.0, 32.0, 2.0),
      ...ledges(-22, 22, 5, 20.0, 23.0, 2.0),
      ...ledges(-20, 20, 5, 11.0, 14.0, 2.0),
      p(-24, 4.6, 3.0),
      p(24, 4.6, 3.0),
    ],
    solids: [s(-29, 20.0, 1.3, 16.0), s(29, 20.0, 1.3, 16.0)],
    floorGaps: [gap(0, 3.4)],
    hazards: [spike(-12, 0.3, 2.6), spike(12, 0.3, 2.6)],
    gates: [
      {
        id: "n",
        side: "top",
        at: 0,
        size: 6.4,
        to: "crossroads",
        toGate: "s",
      },
      { id: "s", side: "bottom", at: 0, size: 6.2, to: "cistern_choir", toGate: "n" },
    ],
    spawns: [
      at("bat", -14, 40),
      at("wisp", 10, 32),
      at("bat", -8, 24),
      at("wisp", 6, 15),
      at("slime", -20),
      at("slime", 18),
    ],
    map: { col: 3, row: 3 },
  },

  cistern_choir: {
    id: "cistern_choir",
    name: "Drowned Cistern",
    biome: "cistern",
    minX: -54,
    maxX: 54,
    ceilingY: 26,
    platforms: [
      ...ledges(-46, -10, 6, 4.8, 9.4, 2.2),
      p(4, 5.8, 3.4),
      p(18, 10.2, 2.6),
      p(32, 5.8, 3.0),
      p(44, 10.0, 2.6),
    ],
    solids: [s(-24, 3.2, 1.2, 3.2), s(12, 2.8, 1.1, 2.8), s(38, 3.4, 1.2, 3.4)],
    floorGaps: [],
    hazards: [spike(-2, 0.3, 2.4), spike(26, 0.3, 2.6)],
    gates: [
      { id: "n", side: "top", at: -30, size: 5.8, to: "cistern_fall", toGate: "s" },
      {
        id: "e",
        side: "right",
        at: 2.2,
        size: 5.6,
        to: "lumen_sanctum",
        toGate: "w",
        pro: true,
        sealLabel: "Lumen Sanctum — members",
      },
    ],
    spawns: [
      at("wisp", -40, 9),
      at("bat", -28, 12),
      at("slime", -14),
      at("golem", 6),
      at("wisp", 22, 10),
      at("bat", 40, 13),
    ],
    bench: { x: 48 },
    map: { col: 3, row: 4 },
  },

  lumen_sanctum: {
    id: "lumen_sanctum",
    name: "Lumen Sanctum",
    biome: "cistern",
    minX: -28,
    maxX: 28,
    ceilingY: 22,
    platforms: [p(-19, 5.2, 2.8), p(0, 8.8, 2.8), p(19, 5.2, 2.8)],
    solids: [],
    floorGaps: [],
    hazards: [],
    gates: [{ id: "w", side: "left", at: 2.4, size: 5.6, to: "cistern_choir", toGate: "e" }],
    spawns: [],
    boss: "lumenChoir",
    bossName: "Lumen Choir",
    bossTitle: "Three Voices, One Light",
    map: { col: 4, row: 4 },
  },

  // =========================================================================
  // STORM — the finale
  // =========================================================================
  storm_ascent: {
    id: "storm_ascent",
    name: "The Sigil Road",
    biome: "storm",
    minX: -40,
    maxX: 40,
    ceilingY: 34,
    platforms: [
      ...stairs(-32, 5.0, 6, 5.4, 2.6, 2.0),
      p(6, 20.6, 3.0),
      ...stairs(16, 16.4, 4, 5.6, -2.6, 2.0),
    ],
    solids: [s(-18, 2.6, 1.1, 2.6), s(20, 2.6, 1.1, 2.6)],
    floorGaps: [],
    hazards: [spike(-6, 0.3, 3.0), spike(30, 0.3, 2.6)],
    gates: [
      { id: "w", side: "left", at: 2.2, size: 5.0, to: "crossroads", toGate: "storm" },
      { id: "e", side: "right", at: 2.2, size: 6.0, to: "storm_throne", toGate: "w" },
    ],
    spawns: [
      at("golem", -26),
      at("wisp", -14, 10),
      at("bat", 0, 16),
      at("golem", 14),
      at("wisp", 28, 11),
    ],
    bench: { x: -36 },
    map: { col: 4, row: 3 },
  },

  storm_throne: {
    id: "storm_throne",
    name: "The Storm Throne",
    biome: "storm",
    minX: -34,
    maxX: 34,
    ceilingY: 26,
    platforms: [p(-24, 5.4, 3.0), p(-10, 9.6, 2.6), p(10, 9.6, 2.6), p(24, 5.4, 3.0)],
    solids: [],
    floorGaps: [],
    hazards: [],
    gates: [{ id: "w", side: "left", at: 2.4, size: 6.0, to: "storm_ascent", toGate: "e" }],
    spawns: [],
    boss: "dragon",
    bossName: "The Storm Dragon",
    bossTitle: "First and Last of the Sky",
    map: { col: 6, row: 3 },
  },
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const START_ROOM = "crossroads";

export const ROOM_IDS = Object.keys(ROOMS);

export function getRoom(id: string): Room {
  const room = ROOMS[id];
  if (!room) throw new Error(`[spell-storm] unknown room: ${id}`);
  return room;
}

export function findGate(room: Room, gateId: string): Gate | null {
  return room.gates.find((g) => g.id === gateId) ?? null;
}

/** Every boss in the world, in intended clear order. */
export const BOSS_ROOMS: { room: string; boss: BossKind; name: string; title: string }[] =
  ROOM_IDS.filter((id) => ROOMS[id].boss).map((id) => ({
    room: id,
    boss: ROOMS[id].boss!,
    name: ROOMS[id].bossName ?? "Unknown",
    title: ROOMS[id].bossTitle ?? "",
  }));

/** Grid extents, for laying out the map overlay. */
export const MAP_EXTENT = ROOM_IDS.reduce(
  (acc, id) => {
    const m = ROOMS[id].map;
    return {
      cols: Math.max(acc.cols, m.col + 1),
      rows: Math.max(acc.rows, m.row + 1),
    };
  },
  { cols: 0, rows: 0 },
);

/**
 * Where the player lands when arriving through `gate`. Deliberately inset
 * from the wall: spawning flush against the opening lets a single frame of
 * overlap bounce you straight back through it.
 */
export function arrivalPoint(room: Room, gate: Gate): { x: number; y: number } {
  const inset = 3.2;
  switch (gate.side) {
    case "left":
      return { x: room.minX + inset, y: Math.max(0, gate.at - 2.0) };
    case "right":
      return { x: room.maxX - inset, y: Math.max(0, gate.at - 2.0) };
    case "top":
      // Was `ceilingY - 3.0`, which spawned the player at y=43 in Long Fall
      // — but the top gate's detector fires from y >= 42.8. Arriving from
      // Crossroads bounced back on the next frame, and every other vertical
      // transition (Spire Hall, Void Stair, Cistern Choir…) had the same
      // bug. 1wu of clearance under the detector, not 0.2, so a landing
      // that overshoots by a fraction of a frame still doesn't retrigger.
      return { x: gate.at, y: room.ceilingY - 4.0 };
    case "bottom": {
      // You reach a bottom gate by falling through a hole, so arriving
      // through one means coming UP through that same hole. Landing on it
      // drops you straight back down — crossroads and spire_hall used to
      // bounce the player between them forever. Step off the hole, toward
      // the middle of the room where there is guaranteed to be floor.
      const centre = (room.minX + room.maxX) * 0.5;
      const dir = gate.at > centre ? -1 : 1;
      const x = gate.at + dir * (gate.size * 0.5 + 2.5);
      return { x: Math.max(room.minX + 2.5, Math.min(room.maxX - 2.5, x)), y: 1.0 };
    }
  }
}
