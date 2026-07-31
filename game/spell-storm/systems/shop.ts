import { PLAYER, type BossKind, type WeaponId } from "../config";
import type { Player, Progress } from "../types";

/**
 * SPELL STORM — the shop.
 *
 * Every boss room in this game has a doorway you walk through and then a
 * fight you can't back out of. The doorway used to open straight onto the
 * fight, which meant that if the RNG on your last stretch of corridor
 * didn't hand you a weapon pickup, you fought the boss with the default
 * bolt (~5.9 dps) and four hearts and the outcome was largely decided
 * before you pressed CAST once. That is a bad kind of hard: the loss
 * feels like the drop table, not like you.
 *
 * The shop is the negotiation between the corridor and the arena. You
 * arrive with a stack of essence (score) that reflects how the corridor
 * treated you, and you get to spend it on tools chosen to shift specific
 * outcomes — a shield for the boss that closes distance faster than you
 * can retreat, a piercing beam for the one that armours up, a heart
 * refill for the one that opens by covering the floor. The prices are
 * calibrated so a normal essence bag buys two or three items: enough
 * that a choice is being made, not so many that the choice is between
 * everything and everything.
 *
 * PER-BOSS COUNTER ITEMS
 *
 * The v3.5 pass reworked the shop from a fixed six-item catalog into a
 * per-boss one. Every boss now has two exclusive counter items that
 * ONLY appear at that boss's shop, priced cheap (250-450) and aimed
 * squarely at the mechanic that boss owns:
 *
 *   gorgeMother  (floor)      → Jump Boots, Featherfall
 *   nightwing    (air)        → Ward Cloak, Anchor
 *   cinderWarden (armour)     → Piercing Bolt, Bulwark
 *   lumenChoir   (patterns)   → Slow Ward, Ring Shield
 *   thornWarden  (footing)    → Featherweight, Sure Foot
 *   voidmaw      (pull)       → Anchor Charm, Bulwark (shared)
 *   dragon       (finale)     → every counter unlocked at 60% price
 *
 * The three universals (Full Heal, Arcane Shield, Vessel Fragment)
 * still show up at every boss. That mix — 3 universals + 2 counter =
 * a 5-item shop — keeps the choice legible on a landscape phone.
 *
 * DEATH PENALTY, HONESTLY
 *
 * If you die and walk back, the shop is there again — but you have 10%
 * less essence (see PROGRESSION.deathPenalty), so the same catalog reads
 * differently. That's the intended pressure. What DOESN'T reset is the
 * Vessel Fragment: it goes on progress.bonusMaxHearts and it persists
 * through death and save, because it's the most expensive item in the
 * catalog and losing it every death would make it a trap. Everything
 * else — shield, extended weapons, and every counter item — resets on
 * death alongside the rest of the player state.
 *
 * WHY EFFECTS LIVE HERE AND NOT IN player.ts
 *
 * The shop item catalogue is data. The mutations it triggers are data
 * too — one entry says "cure to max", another says "grant weapon X for
 * 300s", a third says "bump progress and refill". Keeping them in one
 * switch inside this file means a change to the catalog is a change to
 * this file alone, not a scavenger hunt across player.ts and the
 * orchestrator. player.ts stays about how the mage moves; this stays
 * about what essence buys.
 */

export type ShopItemId =
  // Universals — appear at every boss
  | "healFull"
  | "arcaneShield"
  | "vesselFragment"
  // Weapons — kept for the Dragon shop's catalog
  | "tripleSpark"
  | "seekerSwarm"
  | "starLance"
  // Gorge Mother counters
  | "jumpBoots"
  | "featherfall"
  // Nightwing counters
  | "wardCloak"
  | "anchor"
  // Cinder Warden counters
  | "piercingBolt"
  | "bulwark"
  // Lumen Choir counters
  | "slowWard"
  | "ringShield"
  // Thorn Warden counters
  | "featherweight"
  | "sureFoot"
  // Voidmaw counters
  | "anchorCharm";
  // (Voidmaw also shares bulwark from cinder's list.)

export type ShopCategory = "restore" | "defense" | "offense" | "vessel" | "counter";

export interface ShopItem {
  id: ShopItemId;
  label: string;
  description: string;
  cost: number;
  category: ShopCategory;
  /** Copies purchasable in a single shop visit. Vessel also honours a global cap. */
  maxStack: number;
}

/**
 * Every item in the game, keyed by id. The per-boss selection lives in
 * BOSS_SHOP; this is just the source of truth for prices and copy.
 *
 * PRICING BAND
 *   universals:  200-1200  (heal is cheap, vessel is aspirational)
 *   counters:    250-450   (cheap enough to always afford one)
 *   weapons:     400-900   (dragon shop only)
 */
export const SHOP_ITEMS: Record<ShopItemId, ShopItem> = {
  // ---- Universals -------------------------------------------------------
  healFull: {
    id: "healFull",
    label: "Full Heal",
    description: "Refill every heart before you cross the threshold.",
    cost: 200,
    category: "restore",
    maxStack: 1,
  },
  arcaneShield: {
    id: "arcaneShield",
    label: "Arcane Shield",
    description: "Absorbs the next hit outright. Fades on death.",
    cost: 500,
    category: "defense",
    maxStack: 1,
  },
  vesselFragment: {
    id: "vesselFragment",
    label: "Vessel Fragment",
    description: "One more heart, forever. Cap of three.",
    cost: 1200,
    category: "vessel",
    maxStack: 1,
  },

  // ---- Weapons (Dragon shop only) ---------------------------------------
  tripleSpark: {
    id: "tripleSpark",
    label: "Triple Spark",
    description: "Three bolts per cast, five minutes.",
    cost: 400,
    category: "offense",
    maxStack: 1,
  },
  seekerSwarm: {
    id: "seekerSwarm",
    label: "Seeker Swarm",
    description: "Homing shots, 2 damage. Five minutes.",
    cost: 600,
    category: "offense",
    maxStack: 1,
  },
  starLance: {
    id: "starLance",
    label: "Star Lance",
    description: "A piercing beam. Cuts through crowds. Five minutes.",
    cost: 900,
    category: "offense",
    maxStack: 1,
  },

  // ---- Counter: Gorge Mother --------------------------------------------
  jumpBoots: {
    id: "jumpBoots",
    label: "Jump Boots",
    description: "Higher jump. Clear the shockwave, land on the roof.",
    cost: 300,
    category: "counter",
    maxStack: 1,
  },
  featherfall: {
    id: "featherfall",
    label: "Featherfall",
    description: "Twice the recovery window after a hit.",
    cost: 350,
    category: "counter",
    maxStack: 1,
  },

  // ---- Counter: Nightwing -----------------------------------------------
  wardCloak: {
    id: "wardCloak",
    label: "Ward Cloak",
    description: "Two extra shields. Survive the dive, keep firing.",
    cost: 400,
    category: "counter",
    maxStack: 1,
  },
  anchor: {
    id: "anchor",
    label: "Anchor",
    description: "Immune to knockback. Hold the platform.",
    cost: 300,
    category: "counter",
    maxStack: 1,
  },

  // ---- Counter: Cinder Warden -------------------------------------------
  piercingBolt: {
    id: "piercingBolt",
    label: "Piercing Bolt",
    description: "Your bolt punches through armour.",
    cost: 400,
    category: "counter",
    maxStack: 1,
  },
  bulwark: {
    id: "bulwark",
    label: "Bulwark",
    description: "The next hit is free. No cost, no knockback.",
    cost: 350,
    category: "counter",
    maxStack: 1,
  },

  // ---- Counter: Lumen Choir ---------------------------------------------
  slowWard: {
    id: "slowWard",
    label: "Slow Ward",
    description: "Choir bullets 40% slower. Read the pattern.",
    cost: 350,
    category: "counter",
    maxStack: 1,
  },
  ringShield: {
    id: "ringShield",
    label: "Ring Shield",
    description: "Two shields against wisp fire.",
    cost: 400,
    category: "counter",
    maxStack: 1,
  },

  // ---- Counter: Thorn Warden --------------------------------------------
  featherweight: {
    id: "featherweight",
    label: "Featherweight",
    description: "Spikes don't hurt. The floor is safe again.",
    cost: 400,
    category: "counter",
    maxStack: 1,
  },
  sureFoot: {
    id: "sureFoot",
    label: "Sure Foot",
    description: "Better air control. Every jump reaches its ledge.",
    cost: 300,
    category: "counter",
    maxStack: 1,
  },

  // ---- Counter: Voidmaw -------------------------------------------------
  anchorCharm: {
    id: "anchorCharm",
    label: "Anchor Charm",
    description: "The void can't pull you. Fight where you stand.",
    cost: 450,
    category: "counter",
    maxStack: 1,
  },
};

/**
 * Which items appear in the shop for each boss. Order matters — the UI
 * renders in this order, left-to-right, top-to-bottom. Universals go
 * FIRST so a nervous player who doesn't want to think can just grab the
 * heal and go; counters come after because they reward reading the
 * boss's peculiarity.
 *
 * Dragon gets EVERYTHING because the fight compresses every earlier
 * boss's mechanic into one arena — the shop mirrors that.
 */
export const BOSS_SHOP: Record<BossKind, ShopItemId[]> = {
  gorgeMother: [
    "healFull",
    "jumpBoots",
    "featherfall",
    "arcaneShield",
    "vesselFragment",
  ],
  nightwing: [
    "healFull",
    "wardCloak",
    "anchor",
    "arcaneShield",
    "vesselFragment",
  ],
  cinderWarden: [
    "healFull",
    "piercingBolt",
    "bulwark",
    "arcaneShield",
    "vesselFragment",
  ],
  lumenChoir: [
    "healFull",
    "slowWard",
    "ringShield",
    "arcaneShield",
    "vesselFragment",
  ],
  thornWarden: [
    "healFull",
    "featherweight",
    "sureFoot",
    "arcaneShield",
    "vesselFragment",
  ],
  voidmaw: [
    "healFull",
    "anchorCharm",
    "bulwark",
    "arcaneShield",
    "vesselFragment",
  ],
  dragon: [
    "healFull",
    "arcaneShield",
    "vesselFragment",
    "tripleSpark",
    "seekerSwarm",
    "starLance",
    // Every counter unlocked, so the finale is a "bring what you want"
    // decision rather than a fixed loadout. Prices stay as-is; the
    // essence bar coming in is what tunes affordability.
    "jumpBoots",
    "wardCloak",
    "piercingBolt",
    "slowWard",
    "featherweight",
    "anchorCharm",
  ],
};

/**
 * One-line hint shown above the shop grid for each boss. Frames the
 * fight in one sentence so a player can decode why the counter items
 * exist without playing the fight blind first.
 */
export const BOSS_HINTS: Record<BossKind, string> = {
  gorgeMother: "It owns the FLOOR. Stay airborne.",
  nightwing: "It crosses the room faster than you retreat.",
  cinderWarden: "Armoured, slow. Punishes greed.",
  lumenChoir: "Pure bullet pattern. Read the geometry.",
  thornWarden: "The floor itself becomes the hazard.",
  voidmaw: "It moves YOU, not itself.",
  dragon: "Six bosses at once, on a clock.",
};

/**
 * Get the catalog for a specific boss. Falls back to a universal-only
 * loadout if the kind is unknown — defensive, since the caller derives
 * `kind` from state that should always be set by the time the shop
 * opens, but a missing kind should degrade gracefully rather than
 * crash.
 */
export function getShopCatalogForBoss(kind: BossKind | null): readonly ShopItem[] {
  if (!kind) {
    return [SHOP_ITEMS.healFull, SHOP_ITEMS.arcaneShield, SHOP_ITEMS.vesselFragment];
  }
  return BOSS_SHOP[kind].map((id) => SHOP_ITEMS[id]);
}

/**
 * The legacy universal catalog. Kept only for backward compatibility —
 * anything still importing SHOP_CATALOG works, but it will show a
 * generic (pre-v3.5) mix. New code paths should call
 * getShopCatalogForBoss(kind) instead.
 */
export const SHOP_CATALOG: readonly ShopItem[] = [
  SHOP_ITEMS.healFull,
  SHOP_ITEMS.arcaneShield,
  SHOP_ITEMS.tripleSpark,
  SHOP_ITEMS.seekerSwarm,
  SHOP_ITEMS.starLance,
  SHOP_ITEMS.vesselFragment,
];

/** Global cap on how many Vessel Fragments a save can accumulate. */
export const VESSEL_CAP = 3;

/**
 * How long a shop-bought weapon lasts. Chosen to comfortably outlast the
 * boss fight (which averages 45–90s) without carrying so far into the
 * next area that it trivialises the drop economy in the corridors.
 */
export const SHOP_WEAPON_DURATION = 300;

export function findShopItem(id: ShopItemId): ShopItem | null {
  return SHOP_ITEMS[id] ?? null;
}

export type ShopPurchaseFail =
  | "unknownItem"
  | "insufficient"
  | "alreadyOwned"
  | "capReached";

export type ShopPurchaseResult =
  | { ok: true; cost: number }
  | { ok: false; reason: ShopPurchaseFail };

/**
 * The shop's whole state machine. Given what's been bought this visit,
 * the current essence total, the live player and the persistent
 * progress, either commit the purchase (mutating both) and return the
 * cost, or refuse with a reason.
 *
 * The caller (orchestrator) is responsible for deducting the returned
 * cost from state.score. Keeping the deduction outside this function
 * means the shop doesn't need to know that "essence" is spelled "score"
 * in the game state — it just quotes prices.
 */
export function tryBuyShopItem(
  id: ShopItemId,
  purchased: Partial<Record<ShopItemId, number>>,
  currentEssence: number,
  player: Player,
  progress: Progress,
): ShopPurchaseResult {
  const item = findShopItem(id);
  if (!item) return { ok: false, reason: "unknownItem" };

  const owned = purchased[id] ?? 0;
  if (owned >= item.maxStack) return { ok: false, reason: "alreadyOwned" };
  if (currentEssence < item.cost) return { ok: false, reason: "insufficient" };

  // Vessel has its own global cap on top of the per-visit stack limit,
  // because it's the one item that persists between visits. Without this
  // a player who saved between shops could grind up to arbitrarily many
  // extra hearts.
  if (id === "vesselFragment" && (progress.bonusMaxHearts ?? 0) >= VESSEL_CAP) {
    return { ok: false, reason: "capReached" };
  }

  // ---- Apply. Every branch mutates the player and/or progress in place.
  switch (id) {
    case "healFull":
      player.hearts = player.maxHearts;
      break;
    case "arcaneShield":
      // Shields don't stack past 1 — the value of a shield is that the
      // NEXT hit is free; stacking would just delay the mental math.
      player.shield = Math.max(player.shield, 1);
      break;
    case "tripleSpark":
      grantExtendedWeapon(player, "triple");
      break;
    case "seekerSwarm":
      grantExtendedWeapon(player, "homing");
      break;
    case "starLance":
      grantExtendedWeapon(player, "beam");
      break;
    case "vesselFragment": {
      const bonus = (progress.bonusMaxHearts ?? 0) + 1;
      progress.bonusMaxHearts = bonus;
      player.maxHearts = PLAYER.maxHearts + bonus;
      // Refill on purchase — it would be perverse to sell a heart tank
      // and leave it empty.
      player.hearts = player.maxHearts;
      break;
    }

    // ---- Counter items ------------------------------------------------
    // These all set state flags/timers on the player. The orchestrator
    // clears them when the boss dies or the player leaves the room —
    // see clearBossBuffs() in index.ts. A buff paid for and burned in
    // the boss room does NOT leak into the next corridor.
    case "jumpBoots":
      // 180s comfortably outlasts a boss fight (45-90s) plus the
      // walk-back-with-buff-on grace, without carrying into the next
      // corridor's platforming.
      player.jumpBoostTimer = 180;
      break;
    case "featherfall":
      player.iFramesMult = 2;
      break;
    case "wardCloak":
      // Two shields on top of whatever the player already has, capped
      // at 3 so it doesn't stack up to invincibility with the base
      // Arcane Shield.
      player.shield = Math.min(3, player.shield + 2);
      break;
    case "anchor":
      player.knockbackImmune = true;
      break;
    case "piercingBolt":
      player.piercingBolt = true;
      break;
    case "bulwark":
      // Two bulwarks — enough to eat two mistakes without turning
      // the fight into a facewalk.
      player.bulwarks = Math.min(3, player.bulwarks + 2);
      break;
    case "slowWard":
      player.choirSlowMult = 0.6;
      break;
    case "ringShield":
      // Cosmetically distinct from the Ward Cloak; mechanically the
      // same shield charges. The two items go to different bosses so
      // a player only sees one at a time.
      player.shield = Math.min(3, player.shield + 2);
      break;
    case "featherweight":
      player.spikeImmune = true;
      break;
    case "sureFoot":
      // 1.4× air control accel. Feels like a different mage, but only
      // during THIS fight — cleared on room exit.
      player.airControlMult = 1.4;
      break;
    case "anchorCharm":
      player.pullImmune = true;
      break;
  }

  return { ok: true, cost: item.cost };
}

function grantExtendedWeapon(player: Player, weapon: WeaponId): void {
  player.weapon = weapon;
  player.weaponTimer = SHOP_WEAPON_DURATION;
}

/**
 * Clears every counter-item buff on the player. Called by the
 * orchestrator when the boss fight ends (win or loss) or when the
 * player leaves the boss room by any means. A buff paid for is not a
 * buff for the whole run — it's for this one fight — and enforcing
 * that here keeps the shop's cost-benefit legible.
 */
export function clearBossBuffs(player: Player): void {
  player.jumpBoostTimer = 0;
  player.iFramesMult = 1;
  player.knockbackImmune = false;
  player.piercingBolt = false;
  player.bulwarks = 0;
  player.spikeImmune = false;
  player.airControlMult = 1;
  player.pullImmune = false;
  player.choirSlowMult = 1;
  // Shield and weapon are LEFT alone — those are universal items
  // (Arcane Shield / bought weapons) that are meant to carry a bit
  // further, per the pre-v3.5 semantics.
}
