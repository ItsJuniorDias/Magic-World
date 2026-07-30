import { WAVES, type EnemyKind } from "../config";

/**
 * The wave director: what spawns, when, and how the difficulty curve bends.
 *
 * The curve is authored by hand for the first nine waves rather than
 * generated, because the opening of a game is the part that decides whether
 * anyone plays the rest of it. Waves 1-3 teach one enemy at a time. Wave 4
 * introduces air. Wave 7 introduces the damage sponge. Wave 10 is the
 * dragon, and it is also where the paywall sits — the player gets a complete
 * arc with a real ending for free, and the gate lands on the high of having
 * just beaten a boss rather than in the middle of a grind.
 *
 * Past wave 10 the composition is procedural and scales indefinitely.
 */

export interface WaveComposition {
  queue: EnemyKind[];
  /** Shown on the intermission banner. */
  label: string;
  isBoss: boolean;
}

const HANDMADE: (EnemyKind[] | null)[] = [
  null, // index 0 unused; waves are 1-based
  ["slime", "slime", "slime"],
  ["slime", "slime", "slime", "slime", "slime"],
  ["slime", "slime", "slime", "slime", "slime", "slime", "slime"],
  ["bat", "bat", "slime", "slime", "bat"],
  ["bat", "bat", "bat", "slime", "slime", "slime", "bat"],
  ["wisp", "slime", "slime", "bat", "bat", "wisp"],
  ["golem", "slime", "slime", "bat", "bat"],
  ["golem", "wisp", "wisp", "bat", "bat", "slime", "slime"],
  ["golem", "golem", "wisp", "bat", "bat", "bat", "slime", "slime"],
];

export function composeWave(wave: number): WaveComposition {
  if (wave === WAVES.bossWave) {
    return { queue: ["dragon"], label: "The Dragon", isBoss: true };
  }

  if (wave < HANDMADE.length) {
    const queue = HANDMADE[wave];
    if (queue) return { queue: [...queue], label: `Wave ${wave}`, isBoss: false };
  }

  // Procedural, post-boss. Enemy budget grows roughly linearly; the mix
  // shifts toward the expensive kinds so later waves get harder rather than
  // merely longer.
  const beyond = wave - WAVES.bossWave;
  const budget = 8 + beyond * 2.2;
  const queue: EnemyKind[] = [];
  const costs: { kind: EnemyKind; cost: number; weight: number }[] = [
    { kind: "slime", cost: 1, weight: Math.max(1, 6 - beyond * 0.4) },
    { kind: "bat", cost: 1.4, weight: 4 + beyond * 0.15 },
    { kind: "wisp", cost: 2.2, weight: 2 + beyond * 0.28 },
    { kind: "golem", cost: 3.6, weight: 1.2 + beyond * 0.34 },
  ];

  let remaining = budget;
  let guard = 0;
  while (remaining > 0.9 && guard < 200) {
    guard += 1;
    const affordable = costs.filter((c) => c.cost <= remaining);
    if (affordable.length === 0) break;
    const totalWeight = affordable.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const c of affordable) {
      roll -= c.weight;
      if (roll <= 0) {
        queue.push(c.kind);
        remaining -= c.cost;
        break;
      }
    }
  }

  // Every fifth wave past the boss, the dragon comes back — with the same
  // HP but a faster clock, because the player now has better weapons.
  if (beyond > 0 && beyond % 5 === 0) {
    queue.unshift("dragon");
    return { queue, label: `Wave ${wave} — Dragon`, isBoss: true };
  }

  return { queue, label: `Wave ${wave}`, isBoss: false };
}

/** Spawn position for a queued enemy. Alternates sides, varies height. */
export function spawnPointFor(kind: EnemyKind, index: number, halfWidth: number): { x: number; y: number } {
  const side = index % 2 === 0 ? -1 : 1;
  // Just outside the arena edge, so enemies walk/fly in rather than
  // materialising in front of the player.
  const x = side * (halfWidth - 0.5);

  switch (kind) {
    case "bat":
      return { x, y: 6.5 + Math.random() * 4 };
    case "wisp":
      return { x, y: 5.5 + Math.random() * 3 };
    case "dragon":
      return { x: side * (halfWidth - 4), y: 10 };
    default:
      return { x, y: 1.5 };
  }
}

/** True when this wave is behind the subscription gate. */
export function isWaveLocked(wave: number, isPro: boolean): boolean {
  return !isPro && wave > WAVES.freeWaves;
}
