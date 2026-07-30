/**
 * SPELL STORM — tuning
 *
 * Every number that affects how the game *feels* lives here. Nothing else
 * in the codebase should contain a magic number you'd want to tweak while
 * playtesting. When the game feels floaty, sluggish or unfair, you open
 * this file and nothing else.
 *
 * Units: world units (wu). The arena is 32wu wide, the mage is ~1.6wu tall.
 * Time is in SECONDS everywhere — never frames. See engine/useGLGame.ts.
 */

// ---------------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------------
export const ARENA = {
  /** Playable half-width. Player is clamped to [-halfWidth, +halfWidth]. */
  halfWidth: 16,
  /** Y of the ground surface. Everything stands on this. */
  floorY: 0,
  /** Ceiling — bats and the dragon are clamped below this. */
  ceilingY: 13,
  /** Camera never reveals past this; keeps parallax edges off-screen. */
  cameraMargin: 2.5,
} as const;

/** Static platforms. x/y is the CENTRE of the top surface. */
export const PLATFORMS: { x: number; y: number; halfW: number }[] = [
  { x: -8.5, y: 3.6, halfW: 3.2 },
  { x: 8.5, y: 3.6, halfW: 3.2 },
  { x: 0, y: 7.2, halfW: 4.0 },
];

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
export const PLAYER = {
  halfW: 0.42,
  halfH: 0.8,

  /** Top speed on the ground (wu/s). */
  maxSpeed: 9.5,
  /** How hard we accelerate toward the stick target. Higher = snappier. */
  accel: 78,
  /** Ground friction when the stick is neutral. Higher = stops on a dime. */
  friction: 62,
  /** Air control is deliberately weaker than ground control. */
  airAccelMult: 0.62,
  airFrictionMult: 0.22,

  gravity: -58,
  /** Falling faster than rising makes jumps feel weighty, not floaty. */
  fallGravityMult: 1.55,
  maxFallSpeed: 34,

  jumpVelocity: 23.6,
  /**
   * Variable jump height: when the player releases JUMP while still rising,
   * we cut the upward velocity to this fraction. This is the single biggest
   * contributor to a jump feeling "controlled" rather than "committed".
   */
  jumpCutMult: 0.48,
  /** Grace period after walking off a ledge where JUMP still works. */
  coyoteTime: 0.11,
  /** Pressing JUMP this long before landing still triggers a jump. */
  jumpBuffer: 0.13,

  /** Invulnerability after taking a hit. Blinks during this window. */
  iFrames: 1.25,
  /** Knockback applied on hit, away from the damage source. */
  knockbackX: 11,
  knockbackY: 9,

  maxHearts: 3,
  startHearts: 3,

  /** Muzzle offset from the body centre, along the aim vector. */
  muzzleDistance: 0.95,
} as const;

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------
export type WeaponId = "bolt" | "triple" | "beam" | "homing";

export interface WeaponSpec {
  id: WeaponId;
  label: string;
  /** Seconds between shots. */
  cooldown: number;
  damage: number;
  speed: number;
  /** Projectiles emitted per shot. */
  count: number;
  /** Total spread across all projectiles, radians. */
  spread: number;
  /** Passes through enemies instead of dying on first contact. */
  piercing: boolean;
  /** Steers toward the nearest enemy. */
  homing: boolean;
  radius: number;
  /** Seconds the pickup lasts. Infinity for the default weapon. */
  duration: number;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  bolt: {
    id: "bolt",
    label: "Spark",
    cooldown: 0.17,
    damage: 1,
    speed: 27,
    count: 1,
    spread: 0,
    piercing: false,
    homing: false,
    radius: 0.22,
    duration: Infinity,
  },
  triple: {
    id: "triple",
    label: "Triple Spark",
    cooldown: 0.21,
    damage: 1,
    speed: 26,
    count: 3,
    spread: 0.42,
    piercing: false,
    homing: false,
    radius: 0.2,
    duration: 14,
  },
  beam: {
    id: "beam",
    label: "Star Lance",
    cooldown: 0.075,
    damage: 1,
    speed: 44,
    count: 1,
    spread: 0.03,
    piercing: true,
    homing: false,
    radius: 0.17,
    duration: 9,
  },
  homing: {
    id: "homing",
    label: "Seeker",
    cooldown: 0.24,
    damage: 2,
    speed: 19,
    count: 2,
    spread: 0.9,
    piercing: false,
    homing: true,
    radius: 0.24,
    duration: 14,
  },
};

export const PROJECTILE = {
  poolSize: 96,
  lifetime: 2.2,
  /** Radians/sec the homing weapon can turn. Low enough to be dodgeable. */
  homingTurnRate: 5.2,
} as const;

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
export type EnemyKind = "slime" | "bat" | "golem" | "wisp" | "dragon";

export interface EnemySpec {
  kind: EnemyKind;
  hp: number;
  speed: number;
  halfW: number;
  halfH: number;
  /** Score before the combo multiplier. */
  score: number;
  /** Resists knockback; 0 = immovable, 1 = full knockback. */
  knockbackScale: number;
  /** Chance [0..1] of dropping a pickup on death. */
  dropChance: number;
  contactDamage: number;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  slime: {
    kind: "slime",
    hp: 1,
    speed: 3.4,
    halfW: 0.5,
    halfH: 0.42,
    score: 100,
    knockbackScale: 1,
    dropChance: 0.06,
    contactDamage: 1,
  },
  bat: {
    kind: "bat",
    hp: 1,
    speed: 6.2,
    halfW: 0.44,
    halfH: 0.34,
    score: 150,
    knockbackScale: 1,
    dropChance: 0.08,
    contactDamage: 1,
  },
  golem: {
    kind: "golem",
    hp: 5,
    speed: 2.1,
    halfW: 0.78,
    halfH: 1.05,
    score: 400,
    knockbackScale: 0.18,
    dropChance: 0.3,
    contactDamage: 1,
  },
  wisp: {
    kind: "wisp",
    hp: 2,
    speed: 2.6,
    halfW: 0.42,
    halfH: 0.42,
    score: 250,
    knockbackScale: 0.7,
    dropChance: 0.18,
    contactDamage: 1,
  },
  dragon: {
    kind: "dragon",
    hp: 46,
    speed: 4.6,
    halfW: 2.1,
    halfH: 1.3,
    score: 5000,
    knockbackScale: 0,
    dropChance: 1,
    contactDamage: 1,
  },
};

export const ENEMY_POOL_SIZE = 40;

/** Slime hop cadence. */
export const SLIME = { hopInterval: 0.85, hopVelocity: 11.5, hopForward: 4.2 } as const;

/** Bat sine-wave flight. */
export const BAT = { waveAmplitude: 1.9, waveFrequency: 2.4, diveRange: 4.5 } as const;

/** Golem telegraphed slam. */
export const GOLEM = {
  slamRange: 3.2,
  slamWindup: 0.65,
  slamRecovery: 0.85,
  slamShockwaveRadius: 3.6,
} as const;

/** Wisp ranged attack. */
export const WISP = {
  fireInterval: 2.3,
  projectileSpeed: 8.5,
  preferredDistance: 6.5,
} as const;

/** Dragon boss. */
export const DRAGON = {
  /** HP fraction thresholds at which the boss changes phase. */
  phase2At: 0.66,
  phase3At: 0.33,
  swoopInterval: 3.4,
  breathInterval: 4.2,
  breathCount: 7,
  breathSpread: 0.85,
  breathSpeed: 10,
  eggInterval: 5.5,
  hoverY: 8.4,
} as const;

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------
export const WAVES = {
  /** Waves 1..freeWaves are playable without a subscription. */
  freeWaves: 10,
  /** The dragon shows up on this wave. */
  bossWave: 10,
  /** Pause between waves, for the banner to read. */
  intermission: 2.4,
  /** Max enemies alive at once — protects the draw-call budget. */
  maxConcurrent: 14,
  /** Delay between individual spawns inside a wave. */
  spawnInterval: 0.55,
} as const;

/** Combo: kills within this window chain and raise the multiplier. */
export const COMBO = {
  window: 2.6,
  maxMultiplier: 8,
  /** Multiplier gained per chained kill. */
  step: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------
export type PickupKind = "heart" | "triple" | "beam" | "homing" | "star";

export const PICKUP = {
  poolSize: 12,
  radius: 0.55,
  lifetime: 11,
  /** Starts blinking with this many seconds left. */
  blinkAt: 3,
  bobAmplitude: 0.22,
  bobSpeed: 2.6,
  /** Weighted table for random drops. */
  table: [
    { kind: "star" as PickupKind, weight: 34 },
    { kind: "heart" as PickupKind, weight: 14 },
    { kind: "triple" as PickupKind, weight: 20 },
    { kind: "homing" as PickupKind, weight: 18 },
    { kind: "beam" as PickupKind, weight: 14 },
  ],
  starScore: 500,
} as const;

// ---------------------------------------------------------------------------
// Game feel
// ---------------------------------------------------------------------------
export const FEEL = {
  /** Freeze-frames. The single cheapest way to make hits feel like they land. */
  hitstopOnKill: 0.06,
  hitstopOnBossHit: 0.03,
  hitstopOnPlayerHit: 0.11,

  shakeOnKill: 0.16,
  shakeOnPlayerHit: 0.85,
  shakeOnBossLand: 1.1,
  /** Shake magnitude decays by this factor per second. */
  shakeDecay: 5.5,
  shakeMaxOffset: 0.55,

  /** Landing squash: (scaleX, scaleY) recovered over squashRecover seconds. */
  landSquash: { x: 1.3, y: 0.72 },
  jumpStretch: { x: 0.82, y: 1.24 },
  squashRecover: 0.19,
} as const;

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
export const CAMERA = {
  /** Vertical world units visible. Width derives from the device aspect. */
  viewHeight: 15.5,
  /** Higher = tighter follow. This is a per-second lerp rate. */
  followLerp: 5.5,
  /** Camera leads the player in the direction they're moving. */
  lookAheadX: 2.1,
  lookAheadLerp: 2.4,
  /** Camera rests this far above the floor. */
  baseY: 5.0,
  /** How much of the player's height the camera tracks (0 = ignore Y). */
  followY: 0.42,
} as const;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
export const INPUT = {
  /** Stick travel in points before it reads as full deflection. */
  stickRadius: 58,
  /** Below this the stick reads as neutral. Prevents drift. */
  deadzone: 0.18,
  /** Aim snaps to the nearest of 8 directions, like a d-pad. */
  aimDirections: 8,
} as const;

// ---------------------------------------------------------------------------
// Rendering budget
// ---------------------------------------------------------------------------
export const RENDER = {
  /**
   * expo-gl hands us a drawing buffer already scaled by the device pixel
   * ratio. On a 3x phone that's a lot of fragments for a fullscreen game.
   * We render at a fraction of it and let the GL view upscale — the paper
   * art style has no fine detail to lose, and it buys ~40% GPU headroom.
   */
  resolutionScale: 0.75,
  particlePoolSize: 260,
  /** Skip the frame entirely if dt is this large (app was backgrounded). */
  maxDeltaTime: 0.1,
  /** Physics runs at a fixed step; render interpolates. */
  fixedStep: 1 / 60,
  maxStepsPerFrame: 4,
} as const;

export const STORAGE_KEYS = {
  highScore: "@spell_storm_high_score",
  bestWave: "@spell_storm_best_wave",
  muted: "@spell_storm_muted",
} as const;
