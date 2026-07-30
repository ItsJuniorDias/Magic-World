import * as THREE from "three";

/**
 * SPELL STORM — art direction: "paper theatre at dusk"
 *
 * The premise is that the arena is a pop-up spread inside one of Magic
 * World's storybooks. Everything is a flat card cut from coloured paper,
 * stacked in parallax layers, lit by a low sun sitting just under the
 * horizon. Nothing in the scene is textured and nothing is lit by a real
 * light — every surface colour is authored here by hand.
 *
 * Two reasons that is the right call rather than a compromise:
 *
 *   1. Cost. The whole game ships at 0 MB of art assets. For reference the
 *      previous game in this app carries 97 MB of GLB, of which 8 textures
 *      are 4096x4096, for two objects that occupy a few hundred pixels.
 *   2. Legibility. A run-and-gun lives or dies on the player being able to
 *      tell instantly what is floor, what is enemy, and what will hurt them.
 *      Flat cards with hard colour separation read perfectly at phone size,
 *      where a lit, textured, normal-mapped scene turns to mud.
 *
 * The palette is warm everywhere EXCEPT the player's magic, which is the one
 * cool colour in the game. That single decision does most of the readability
 * work: anything cyan belongs to you, anything warm can hurt you.
 */

export const PALETTE = {
  // --- Sky, back to front -------------------------------------------------
  skyZenith: 0x140b2e,
  skyMid: 0x3b1b5e,
  skyRose: 0x8e2d63,
  skyEmber: 0xe8593c,
  skyAmber: 0xffb25c,

  // --- Paper stock --------------------------------------------------------
  /** Lit face of a near-field card. */
  paperFace: 0xf7e7c8,
  /** Extruded edge of the same card — the thickness you see at the silhouette. */
  paperEdge: 0xc9a878,

  // --- Parallax layers, far to near (already atmospherically tinted) ------
  layerFar: 0x4a2a63,
  layerFarEdge: 0x351d49,
  layerMid: 0x6b3260,
  layerMidEdge: 0x4c2145,
  layerNear: 0x3f2247,
  layerNearEdge: 0x2a1631,

  // --- Ground -------------------------------------------------------------
  groundFace: 0x2e1a3d,
  groundEdge: 0x1c0f28,
  groundLip: 0xffa04f,

  // --- Platforms ----------------------------------------------------------
  platformFace: 0x6d4a7a,
  platformEdge: 0x422c4d,
  platformLip: 0xffc94a,

  // --- The mage -----------------------------------------------------------
  robeFace: 0x3d6bd6,
  robeEdge: 0x27458f,
  robeTrim: 0x6fe9ff,
  skin: 0xffd9b0,
  skinEdge: 0xd9a97f,
  hatFace: 0x2a4bb0,
  hatEdge: 0x1a2f70,
  staffWood: 0x8a5a3c,
  staffEdge: 0x5c3826,

  // --- Magic (the only cool family in the game) ---------------------------
  arcane: 0x6fe9ff,
  arcaneCore: 0xffffff,
  arcaneDeep: 0x2b8fd6,

  // --- Bestiary -----------------------------------------------------------
  slimeFace: 0x6fbf5b,
  slimeEdge: 0x3f8a37,
  slimeShine: 0xc8f0a8,
  batFace: 0xa46be0,
  batEdge: 0x6b3fa0,
  golemFace: 0x8c8499,
  golemEdge: 0x554e63,
  golemCore: 0xffa04f,
  wispFace: 0xffd76b,
  wispEdge: 0xd9992f,
  dragonFace: 0xd94f3d,
  dragonEdge: 0x8c2a22,
  dragonBelly: 0xffc07a,
  dragonWing: 0x7a1f1c,

  // --- The seven ----------------------------------------------------------
  // Each boss owns a hue that appears nowhere else in its biome, so the eye
  // finds it instantly in a crowded room. The rule from the top of this file
  // still holds underneath: cyan is yours, everything warm can hurt you.
  gorgeFace: 0x7ad14f,
  gorgeEdge: 0x2f6b2c,
  gorgeCore: 0xe8ff8a,
  gorgeCrown: 0xffd76b,

  nightFace: 0x8a4fd6,
  nightEdge: 0x4a1f8a,
  nightWing: 0x2e0f52,
  nightEye: 0xff5c72,

  cinderFace: 0x8c7a6b,
  cinderEdge: 0x4a3a30,
  cinderCore: 0xff6b2b,
  cinderGlow: 0xffb25c,

  choirFace: 0xfff0b0,
  choirEdge: 0xd9a92f,
  choirCore: 0x6fe9ff,
  choirOrb: 0xffd76b,

  thornFace: 0x6b5230,
  thornEdge: 0x3a2c19,
  thornLeaf: 0x4f8a3a,
  thornSpike: 0xd9a24f,
  thornEye: 0xffe08a,

  voidFace: 0x1a0d2e,
  voidEdge: 0x0a0417,
  voidRing: 0xa06bff,
  voidEye: 0xff4dd6,
  voidTooth: 0xe8d9ff,

  // --- UI and feedback ----------------------------------------------------
  gold: 0xffc94a,
  heart: 0xff5c72,
  danger: 0xff4d3d,
  hitFlash: 0xffffff,
  shadow: 0x0d0618,
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
