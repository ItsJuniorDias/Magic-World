import * as THREE from "three";

/**
 * SPELL STORM — art direction: "paper theatre at dusk" (HD pass)
 *
 * The premise is that the arena is a pop-up spread inside one of Magic
 * World's storybooks. Everything is a flat card cut from coloured paper,
 * stacked in parallax layers, lit by a low sun sitting just under the
 * horizon.
 *
 * v5 HD pass — the palette is expanded but the RULE still holds:
 *
 *   cyan is yours, everything warm can hurt you.
 *
 * What HD adds is not new hues but new *values*: rim-lit outlines, moon-lit
 * pale tints, aurora accents, and warm sub-surface glows. The paper theatre
 * grammar is preserved — every card still has one face colour and one edge
 * colour, still unlit, still readable at phone size.
 */

export const PALETTE = {
  // --- Sky, back to front -------------------------------------------------
  skyZenith: 0x0b0524,
  skyDeep: 0x1a0f3d,
  skyMid: 0x3b1b5e,
  skyRose: 0x8e2d63,
  skyEmber: 0xe8593c,
  skyAmber: 0xffb25c,
  skyHorizon: 0xffd48a,

  // --- Moon and celestial ------------------------------------------------
  moonFace: 0xfff4d4,
  moonEdge: 0xd9c39a,
  moonGlow: 0xffe6b3,
  auroraA: 0x6fe9ff,
  auroraB: 0xa06bff,
  auroraC: 0x7ad14f,
  nebulaCore: 0x8a4fd6,
  nebulaEdge: 0xff5c9e,
  starWarm: 0xfff3d0,
  starCool: 0xd0e8ff,

  // --- Paper stock --------------------------------------------------------
  /** Lit face of a near-field card. */
  paperFace: 0xf7e7c8,
  /** Extruded edge of the same card — the thickness you see at the silhouette. */
  paperEdge: 0xc9a878,
  /** Rim-lit highlight for near-field cards. Warm moonlight. */
  paperRim: 0xffe6b3,

  // --- Parallax layers, far to near (already atmospherically tinted) ------
  layerFarthest: 0x2a1642,
  layerFarthestEdge: 0x1a0d2b,
  layerFar: 0x4a2a63,
  layerFarEdge: 0x351d49,
  layerMidFar: 0x5c2a5e,
  layerMidFarEdge: 0x40203f,
  layerMid: 0x6b3260,
  layerMidEdge: 0x4c2145,
  layerNear: 0x3f2247,
  layerNearEdge: 0x2a1631,

  // --- Ground -------------------------------------------------------------
  groundFace: 0x2e1a3d,
  groundEdge: 0x1c0f28,
  groundLip: 0xffa04f,
  /** A warmer bounce colour on the ground's lit lip. */
  groundGlow: 0xffb46b,

  // --- Platforms ----------------------------------------------------------
  platformFace: 0x6d4a7a,
  platformEdge: 0x422c4d,
  platformLip: 0xffc94a,
  platformGlow: 0xffe07a,

  // --- The mage -----------------------------------------------------------
  robeFace: 0x3d6bd6,
  robeEdge: 0x27458f,
  robeShadow: 0x1a2c66,
  robeTrim: 0x6fe9ff,
  robeRim: 0x9fd4ff,
  skin: 0xffd9b0,
  skinEdge: 0xd9a97f,
  skinRim: 0xffe6c9,
  hairFace: 0xd68a3d,
  hairEdge: 0x8f5620,
  hatFace: 0x2a4bb0,
  hatEdge: 0x1a2f70,
  hatShadow: 0x0d1a52,
  hatRim: 0x8fb4ff,
  staffWood: 0x8a5a3c,
  staffEdge: 0x5c3826,
  staffKnot: 0xd9a24f,
  eyeGlow: 0x6fe9ff,
  eyeDark: 0x1a1030,

  // --- Magic (the only cool family in the game) ---------------------------
  arcane: 0x6fe9ff,
  arcaneCore: 0xffffff,
  arcaneDeep: 0x2b8fd6,
  arcaneOuter: 0xa0f4ff,
  arcanePlasma: 0xd0f9ff,

  // --- Bestiary -----------------------------------------------------------
  slimeFace: 0x6fbf5b,
  slimeEdge: 0x3f8a37,
  slimeShine: 0xc8f0a8,
  slimeRim: 0xb0e090,
  batFace: 0xa46be0,
  batEdge: 0x6b3fa0,
  batWing: 0x422a70,
  batRim: 0xc9a0ff,
  golemFace: 0x8c8499,
  golemEdge: 0x554e63,
  golemCore: 0xffa04f,
  golemRim: 0xb8b0c8,
  wispFace: 0xffd76b,
  wispEdge: 0xd9992f,
  wispRim: 0xfff0a8,
  dragonFace: 0xd94f3d,
  dragonEdge: 0x8c2a22,
  dragonBelly: 0xffc07a,
  dragonWing: 0x7a1f1c,
  dragonRim: 0xffa080,
  dragonScale: 0xb04030,

  // --- The seven ----------------------------------------------------------
  // Each boss owns a hue that appears nowhere else in its biome, so the eye
  // finds it instantly in a crowded room. The rule from the top of this file
  // still holds underneath: cyan is yours, everything warm can hurt you.
  gorgeFace: 0x7ad14f,
  gorgeEdge: 0x2f6b2c,
  gorgeCore: 0xe8ff8a,
  gorgeCrown: 0xffd76b,
  gorgeRim: 0xb0e880,
  gorgeGlisten: 0xf0ffb0,

  nightFace: 0x8a4fd6,
  nightEdge: 0x4a1f8a,
  nightWing: 0x2e0f52,
  nightEye: 0xff5c72,
  nightRim: 0xc9a0ff,
  nightHalo: 0x6b40a0,

  cinderFace: 0x8c7a6b,
  cinderEdge: 0x4a3a30,
  cinderCore: 0xff6b2b,
  cinderGlow: 0xffb25c,
  cinderRim: 0xb09080,
  cinderCrack: 0xff8a3d,

  choirFace: 0xfff0b0,
  choirEdge: 0xd9a92f,
  choirCore: 0x6fe9ff,
  choirOrb: 0xffd76b,
  choirRim: 0xfff8d0,
  choirAura: 0xd9ffea,

  thornFace: 0x6b5230,
  thornEdge: 0x3a2c19,
  thornLeaf: 0x4f8a3a,
  thornSpike: 0xd9a24f,
  thornEye: 0xffe08a,
  thornRim: 0x907040,
  thornMoss: 0x3d6b28,

  voidFace: 0x1a0d2e,
  voidEdge: 0x0a0417,
  voidRing: 0xa06bff,
  voidEye: 0xff4dd6,
  voidTooth: 0xe8d9ff,
  voidRim: 0x5030a0,
  voidAura: 0xc890ff,

  // --- NPCs (paper theatre spirits) ---------------------------------------
  npcRobeA: 0x6b8fd6,
  npcRobeAEdge: 0x3a5aa0,
  npcRobeB: 0xd68f6b,
  npcRobeBEdge: 0xa05a3a,
  npcRobeC: 0xd6bf6b,
  npcRobeCEdge: 0xa08540,
  npcRobeD: 0x8fd68f,
  npcRobeDEdge: 0x5aa05a,
  npcHalo: 0xffe6b3,

  // --- UI and feedback ----------------------------------------------------
  gold: 0xffc94a,
  goldRim: 0xffe07a,
  heart: 0xff5c72,
  heartRim: 0xff90a4,
  danger: 0xff4d3d,
  dangerRim: 0xff8070,
  hitFlash: 0xffffff,
  shadow: 0x0d0618,
  shadowSoft: 0x1a0f28,

  // --- Atmospheric fog tints (per-biome dust and mist) --------------------
  fogWarm: 0xffb25c,
  fogCool: 0x6fe9ff,
  fogMagic: 0xa06bff,
  fogAsh: 0xc9a878,
} as const;

export type PaletteKey = keyof typeof PALETTE;

const scratch = new THREE.Color();

/** Cached Color instances — never allocate a Color inside the game loop. */
const cache = new Map<number, THREE.Color>();

export function color(hex: number): THREE.Color {
  let c = cache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    cache.set(hex, c);
  }
  return c;
}

/**
 * Blends a colour toward the sky, which is how you fake aerial perspective
 * without fog. Distant parallax cards get a high amount so they sit back;
 * near cards get none.
 */
export function recede(hex: number, amount: number, towardHex: number = PALETTE.skyMid): number {
  scratch.setHex(hex).lerp(color(towardHex), amount);
  return scratch.getHex();
}

/** Lighten or darken a colour. Positive brightens, negative darkens. */
export function shift(hex: number, amount: number): number {
  scratch.setHex(hex);
  if (amount >= 0) scratch.lerp(color(0xffffff), amount);
  else scratch.lerp(color(0x000000), -amount);
  return scratch.getHex();
}

/**
 * A rim-light helper: takes a face colour and returns a version brightened
 * and tinted toward warm moonlight. Used for the second "rim" card sitting
 * slightly behind the primary card of important characters (mage, bosses,
 * NPCs) — it fakes a low sun catching the silhouette from behind.
 */
export function rim(hex: number, toward: number = PALETTE.paperRim, amount = 0.55): number {
  scratch.setHex(hex).lerp(color(toward), amount);
  return scratch.getHex();
}

/**
 * A shadow helper: darken a colour toward the deep shadow tone, for cards
 * layered *behind* a lit face to fake a self-shadow.
 */
export function shade(hex: number, amount = 0.45): number {
  scratch.setHex(hex).lerp(color(PALETTE.shadow), amount);
  return scratch.getHex();
}

/**
 * Mix two arbitrary colours by a normalised amount.
 */
export function mix(a: number, b: number, t: number): number {
  scratch.setHex(a).lerp(color(b), t);
  return scratch.getHex();
}
