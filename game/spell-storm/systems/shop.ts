import { PLAYER, type WeaponId } from "../config";
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
 * DEATH PENALTY, HONESTLY
 *
 * If you die and walk back, the shop is there again — but you have 25%
 * less essence (see PROGRESSION.deathPenalty), so the same catalog reads
 * differently. That's the intended pressure. What DOESN'T reset is the
 * Vessel Fragment: it goes on progress.bonusMaxHearts and it persists
 * through death and save, because it's the most expensive item in the
 * catalog and losing it every death would make it a trap. Everything
 * else — shield, extended weapons — resets on death alongside the rest
 * of the player state.
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
  | "healFull"
  | "arcaneShield"
  | "tripleSpark"
  | "seekerSwarm"
  | "starLance"
  | "vesselFragment";

export type ShopCategory = "restore" | "defense" | "offense" | "vessel";

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
 * The catalog. Order matters — the UI renders left-to-right, top-to-bottom
 * in this order, and the intent is: cheap-and-obvious first (heal), then
 * defense, then the three attack scrolls in ascending price, then the
 * expensive permanent-upgrade at the end.
 */
export const SHOP_CATALOG: readonly ShopItem[] = [
  {
    id: "healFull",
    label: "Full Heal",
    description: "Refill every heart before you cross the threshold.",
    cost: 200,
    category: "restore",
    maxStack: 1,
  },
  {
    id: "arcaneShield",
    label: "Arcane Shield",
    description: "Absorbs the next hit outright. Fades on death.",
    cost: 500,
    category: "defense",
    maxStack: 1,
  },
  {
    id: "tripleSpark",
    label: "Triple Spark",
    description: "Three bolts per cast, five minutes.",
    cost: 400,
    category: "offense",
    maxStack: 1,
  },
  {
    id: "seekerSwarm",
    label: "Seeker Swarm",
    description: "Homing shots, 2 damage. Five minutes.",
    cost: 600,
    category: "offense",
    maxStack: 1,
  },
  {
    id: "starLance",
    label: "Star Lance",
    description: "A piercing beam. Cuts through crowds. Five minutes.",
    cost: 900,
    category: "offense",
    maxStack: 1,
  },
  {
    id: "vesselFragment",
    label: "Vessel Fragment",
    description: "One more heart, forever. Cap of three.",
    cost: 1200,
    category: "vessel",
    maxStack: 1,
  },
] as const;

/** Global cap on how many Vessel Fragments a save can accumulate. */
export const VESSEL_CAP = 3;

/**
 * How long a shop-bought weapon lasts. Chosen to comfortably outlast the
 * boss fight (which averages 45–90s) without carrying so far into the
 * next area that it trivialises the drop economy in the corridors.
 */
export const SHOP_WEAPON_DURATION = 300;

export function findShopItem(id: ShopItemId): ShopItem | null {
  return SHOP_CATALOG.find((i) => i.id === id) ?? null;
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
  }

  return { ok: true, cost: item.cost };
}

function grantExtendedWeapon(player: Player, weapon: WeaponId): void {
  player.weapon = weapon;
  player.weaponTimer = SHOP_WEAPON_DURATION;
}
