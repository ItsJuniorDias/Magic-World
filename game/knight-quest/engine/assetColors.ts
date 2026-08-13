import type { AssetKey } from "./assetManifest";

// ---------------------------------------------------------------------------
// Per-asset color palette.
//
// The KayKit + POLYGON models use texture atlases: each mesh has one material
// pointing at a big PNG, and UV coordinates pick a specific pixel for each
// face. That gives the low-poly art its multi-colour look.
//
// In React Native we can't decode those embedded PNGs (three-stdlib's
// texture pipeline uses `new Image()` which doesn't exist in RN), so every
// mesh renders with just its base color factor — which for these packs is
// nearly white. The result is a scene of white silhouettes.
//
// This map fixes that by assigning a hand-picked solid color to each asset
// type. The scene loses the intra-mesh colour variation the atlas gave us
// (walls, roofs, windows are all the same color now), but we get a
// coherent cartoon palette where every object is instantly recognisable.
//
// Any asset without an entry keeps its glTF base color (usually white/gray).
// ---------------------------------------------------------------------------

export const ASSET_COLORS: Partial<Record<AssetKey, number>> = {
  // ---- characters -------------------------------------------------------
  knight: 0x9caac6, // silver-blue armor
  skeleton_minion: 0xdcd4bc, // bone white
  skeleton_rogue: 0xc8bfa5,
  skeleton_mage: 0x7b6ca8, // purple robes
  skeleton_warrior: 0xa89870, // aged bone
  weapon_blade: 0xb0b0b0,
  weapon_axe: 0x9a8a70,
  weapon_staff: 0x6a4a2c,

  // ---- dungeon (KayKit Remastered) --------------------------------------
  wall: 0x6a635a,
  wall_corner: 0x6a635a,
  wall_doorway: 0x6a635a,
  wall_gated: 0x8a7040, // wooden portcullis
  wall_pillar: 0x6a635a,
  column: 0x726a60,
  pillar: 0x726a60,
  floor_large: 0x4a4442,
  floor_small: 0x4a4442,
  floor_broken: 0x3e3836,
  floor_weeds: 0x546038,
  floor_decorated: 0x524a48,
  chest: 0x8b5a2b,
  chest_gold: 0xd4a840,
  key: 0xf0c848,
  coin: 0xf0c848,
  torch_mounted: 0x604836,
  barrel_small: 0x8a6540,
  barrel_large: 0x8a6540,
  box_small: 0xa07850,
  crates_stacked: 0xa07850,
  banner_red: 0xc03830,
  banner_blue: 0x3868c0,
  sword_shield: 0x9a9a9a,
  rubble_half: 0x555045,
  stairs: 0x524a48,
  spikes: 0x8a8080,

  // ---- POLYGON village + overworld --------------------------------------
  poly_house_a: 0xd8b088,
  poly_house_b: 0xd0a880,
  poly_house_c: 0xc89870,
  poly_house_d: 0xd8b088,
  poly_house_e: 0xc89870,
  poly_house_big: 0xb08860,
  poly_hut: 0xa8825a,
  poly_well: 0x8a827a,
  poly_stall_a: 0xc84838,
  poly_stall_b: 0x386ea8,
  poly_stall_cover_a: 0xc03830,
  poly_stall_cover_b: 0x3868c0,
  poly_stall_table: 0x8a6540,
  poly_fence_a: 0x8a6540,
  poly_fence_b: 0x8a6540,
  poly_fence_post: 0x8a6540,
  poly_wall_stone: 0x9a948a,
  poly_roadsign: 0x8a6540,
  poly_campfire: 0xb04a20,
  poly_cart: 0x8a6540,
  poly_washingline: 0xe0d8c8,

  // trees / foliage
  poly_tree_a: 0x2e7038,
  poly_tree_b: 0x2e7038,
  poly_tree_c: 0x2e7038,
  poly_pine_a: 0x1e5a30,
  poly_pine_b: 0x1e5a30,
  poly_tree_birch: 0x60a848,
  poly_tree_dead: 0x6a5030,
  poly_tree_stump: 0x8a6540,
  poly_tree_log: 0x8a6540,
  poly_bush_a: 0x4a9440,
  poly_bush_b: 0x4a9440,
  poly_bush_c: 0x4a9440,
  poly_bush_d: 0x4a9440,
  poly_grass_a: 0x7ac96b,
  poly_grass_b: 0x7ac96b,
  poly_flower_a: 0xe07070,
  poly_flower_b: 0xf0d040,
  poly_reeds: 0x9ac060,
  poly_mushroom: 0xc04040,

  // rocks
  poly_rock_a: 0x8a827a,
  poly_rock_b: 0x8a827a,
  poly_rock_flat: 0x8a827a,
  poly_pebble_a: 0x8a827a,

  // ground tiles
  poly_ground_grass_a: 0x63b258,
  poly_ground_grass_b: 0x5aa550,
  poly_ground_dirt_a: 0xa88058,
  poly_ground_dirt_b: 0x9a7050,
  poly_ground_stone: 0x8a8580,
  poly_road_straight: 0xa08050,
  poly_road_corner: 0xa08050,

  // water
  poly_stream_straight: 0x4a9cd8,
  poly_bridge: 0x8a6540,
  poly_lillypad: 0x3a8848,

  // props
  poly_barrel_a: 0x8a6540,
  poly_crate_a: 0xa07850,
  poly_basket_a: 0xa07850,
  poly_pot: 0x8a5030,
  poly_sack_a: 0xc8b088,
  poly_pumpkin: 0xe08030,
  poly_cheese: 0xf0d040,
  poly_meat: 0xc04040,
  poly_potion_a: 0x5090c0,
  poly_lantern: 0xd4a840,

  // sky
  poly_cloud_a: 0xffffff,
  poly_cloud_b: 0xffffff,
};
