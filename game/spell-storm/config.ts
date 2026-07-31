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

  maxHearts: 4,
  startHearts: 4,

  /** Muzzle offset from the body centre, along the aim vector. */
  muzzleDistance: 0.95,

  /**
   * Aim latch.
   *
   * On a phone the movement stick and the aim stick are the same stick.
   * Push up to aim up and moveX drops to zero — you stop moving. Push
   * up-right to aim up-right and you can move AND aim, but only diagonally.
   * There is no combination of that one stick that lets you run right at
   * full speed while firing straight up. Which was the whole complaint.
   *
   * When CAST is pressed, we take a snapshot of the stick direction and
   * treat that as the aim until CAST is released. The stick meanwhile keeps
   * controlling movement freely. So the pattern is:
   *
   *   push stick up  ->  press CAST  ->  aim latches to up
   *                  ->  push stick right (CAST still held)  ->  runs right, fires up
   *                  ->  release CAST  ->  aim unlocks
   *
   * This is how Contra and every twin-stick-lite touch shooter handles it.
   */
  aimLatchOnCast: true,

  // -------------------------------------------------------------------
  // Dash — the extra button we did not add
  //
  // Two big buttons on the right (CAST, JUMP) already crowd the thumb. A
  // third would push one of them off the edge on small phones. Instead the
  // dash triggers on a DOUBLE-TAP anywhere in the movement zone, in the
  // direction of the second tap. That reads as an intentional gesture
  // (a single tap never triggers it) and takes zero pixels of HUD.
  // -------------------------------------------------------------------
  dashSpeed: 24,
  dashDuration: 0.18,
  /** i-frames granted for the dash. Shorter than the dash so it recovers. */
  dashIFrames: 0.24,
  dashCooldown: 0.9,
  /** Second-tap window. Feels sluggish above ~300ms, unreliable below ~180. */
  dashDoubleTapWindow: 0.28,

  // -------------------------------------------------------------------
  // Pogo — Hollow Knight down-strike
  //
  // Aim down while airborne, hit an enemy, bounce. That single mechanic
  // turns every enemy into a stepping stone across a pit and every boss
  // fight into a rhythm game — you can chain-pogo the Gorge Mother to
  // stay above her landing shockwave.
  // -------------------------------------------------------------------
  pogoBounce: 21,
  /** Aim must be at least this far below horizontal to count as "down". */
  pogoDownThreshold: -0.5,
  /** Refunds one jump so a chain of pogos isn't punished by no coyote time. */
  pogoRefundJump: true,
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
/** Rank-and-file enemies. These populate corridors. */
export type MinionKind = "slime" | "bat" | "golem" | "wisp";

/**
 * The seven. Each one owns a room at the end of a branch and each one asks a
 * different question of the player:
 *
 *   gorgeMother  — vertical space. It fills the floor; you live on platforms.
 *   nightwing    — horizontal space. It crosses the room faster than you can.
 *   cinderWarden — patience. Armoured, slow, punishes greed.
 *   lumenChoir   — pattern reading. Bullet geometry, no contact threat.
 *   thornWarden  — footing. The floor itself becomes the hazard.
 *   voidmaw      — control. It moves YOU, not itself.
 *   dragon       — all six at once, on a clock. The finale.
 */
export type BossKind =
  | "gorgeMother"
  | "nightwing"
  | "cinderWarden"
  | "lumenChoir"
  | "thornWarden"
  | "voidmaw"
  | "dragon";

export type EnemyKind = MinionKind | BossKind;

export const BOSS_KINDS: BossKind[] = [
  "gorgeMother",
  "nightwing",
  "cinderWarden",
  "lumenChoir",
  "thornWarden",
  "voidmaw",
  "dragon",
];

export function isBossKind(kind: EnemyKind): kind is BossKind {
  return (BOSS_KINDS as string[]).includes(kind);
}

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
  // --- The seven ----------------------------------------------------------
  // Bosses never take knockback (knockbackScale 0). A boss that flinches
  // reads as a big minion; a boss that absorbs everything reads as a wall
  // you have to solve. The hit flash carries the feedback instead.
  gorgeMother: {
    kind: "gorgeMother",
    hp: 42,
    speed: 4.2,
    halfW: 1.75,
    halfH: 1.4,
    score: 4000,
    knockbackScale: 0,
    dropChance: 1,
    contactDamage: 1,
  },
  nightwing: {
    kind: "nightwing",
    hp: 48,
    speed: 13.5,
    halfW: 1.6,
    halfH: 0.95,
    score: 4600,
    knockbackScale: 0,
    dropChance: 1,
    contactDamage: 1,
  },
  cinderWarden: {
    kind: "cinderWarden",
    hp: 64,
    speed: 3.4,
    halfW: 1.45,
    halfH: 2.0,
    score: 5200,
    knockbackScale: 0,
    dropChance: 1,
    contactDamage: 1,
  },
  lumenChoir: {
    kind: "lumenChoir",
    // Deliberately higher than the Cinder Warden despite arriving later on a
    // softer branch: the Choir has NO contact damage, so the player can stand
    // inside it and unload. At 52 it melted before its second pattern.
    hp: 68,
    speed: 6.0,
    halfW: 1.1,
    halfH: 1.1,
    score: 5600,
    knockbackScale: 0,
    dropChance: 1,
    contactDamage: 1,
  },
  thornWarden: {
    kind: "thornWarden",
    hp: 70,
    speed: 2.4,
    halfW: 1.5,
    halfH: 2.2,
    score: 6200,
    knockbackScale: 0,
    dropChance: 1,
    contactDamage: 1,
  },
  voidmaw: {
    kind: "voidmaw",
    hp: 76,
    speed: 5.2,
    halfW: 1.35,
    halfH: 1.35,
    score: 7000,
    knockbackScale: 0,
    dropChance: 1,
    contactDamage: 1,
  },
  dragon: {
    kind: "dragon",
    hp: 96,
    speed: 5.4,
    halfW: 2.1,
    halfH: 1.3,
    score: 9000,
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

// ---------------------------------------------------------------------------
// The seven — per-boss tuning
//
// Every boss follows the same three-phase contract: it opens on a readable
// loop, tightens at 65% HP, and goes desperate at 30%. Phase thresholds are
// shared (BOSS.phase2At / phase3At) so the player learns one rhythm and can
// apply it to all seven. What changes per boss is WHAT the loop is made of.
//
// The telegraph windows are the numbers that matter most. Anything under
// ~0.35s reads as unfair on a touch screen, where the player's thumb is
// already committed by the time they see the tell.
// ---------------------------------------------------------------------------

export const BOSS = {
  phase2At: 0.65,
  phase3At: 0.3,
  /** Seconds of invulnerable roar on spawn. Lets the arena gate slam shut. */
  introTime: 1.6,
  /** Seconds of slow-motion death throes before the room clears. */
  deathTime: 2.2,
  /** Reward for a kill, on top of the spec score. */
  heartsOnKill: 1,
  /** Minions a boss may keep alive at once. Protects the frame budget and
   *  keeps boss fights readable — 6 minions plus a boss was fireworks. */
  maxMinions: 4,
} as const;

/** Gorge Mother — the giant slime. Owns the floor. */
export const GORGE = {
  hopInterval: 1.5,
  hopVelocity: 21,
  hopForward: 7.5,
  /** Radius of the landing shockwave. Wide enough that you must be airborne. */
  slamRadius: 5.4,
  /** Slimelings spat out on each landing, per phase. */
  spawnPerLand: [1, 2, 3],
  /** Phase 3 only: a rain of arcing globs on landing. */
  globCount: 5,
  globSpeed: 13,
} as const;

/** Nightwing — the bat matriarch. Owns the air. */
export const NIGHTWING = {
  /** Time hanging from the ceiling before committing to a dive. */
  perchTime: 1.5,
  /** The tell: it flares its wings for this long before crossing. */
  diveWindup: 0.45,
  diveSpeed: 26,
  /** Radial screech, fired from the perch. */
  screechCount: 10,
  screechSpeed: 9.5,
  /** Bats summoned per perch cycle, per phase. */
  summonPerPerch: [0, 2, 3],
} as const;

/** Cinder Warden — the golem lord. Punishes greed. */
export const CINDER = {
  slamRange: 5.2,
  slamWindup: 0.7,
  slamRecovery: 0.9,
  slamRadius: 6.2,
  /** Boulders lobbed when the player keeps their distance. */
  throwRange: 9,
  throwInterval: 3.1,
  throwSpeed: 15,
  throwArc: 9.5,
  /** Phase 3: it stops slamming and simply charges. */
  chargeSpeed: 15,
  chargeWindup: 0.55,
  chargeDuration: 1.25,
} as const;

/** Lumen Choir — three wisps around a core. Pure bullet pattern. */
export const CHOIR = {
  orbitRadius: 2.15,
  orbitSpeed: 1.5,
  /** Time between pattern volleys. */
  volleyInterval: 2.5,
  /** Even ring — punishes standing still. */
  ringCount: 12,
  ringSpeed: 8,
  /** Spiral — punishes standing still in a different way. */
  spiralCount: 18,
  spiralSpeed: 8.5,
  spiralTurn: 0.34,
  /** It blinks rather than walks. */
  blinkInterval: 4.4,
  blinkRange: 7.5,
} as const;

/** Thorn Warden — rooted. Turns the floor against you. */
export const THORN = {
  /** Spikes erupt along the ground in a travelling wave. */
  waveInterval: 3.4,
  waveSpeed: 13,
  /** The tell: the ground cracks this long before anything comes up. */
  waveWindup: 0.5,
  spikeSpacing: 2.3,
  spikeLife: 0.9,
  spikeHeight: 2.4,
  /** Seeds that hatch into slimes if you ignore them. */
  seedInterval: 5.2,
  seedCount: 3,
  seedSpeed: 12,
  seedHatch: 2.6,
  /** Phase 3: vines lash the platforms so camping stops working. */
  lashInterval: 2.2,
  lashRange: 6.5,
} as const;

/** Voidmaw — it moves you instead of moving itself. */
export const VOID = {
  /** Constant inward acceleration applied to the player, wu/s^2. */
  pullStrength: 15,
  pullRadius: 15,
  /** Collapse: invulnerable, pull triples, then it vents. */
  collapseInterval: 8.5,
  collapseWindup: 1.5,
  collapseVent: 22,
  collapseVentSpeed: 11,
  /** Lances are aimed, fast and thin. Dodge by moving, not by blocking. */
  lanceInterval: 2.1,
  lanceSpeed: 19,
  lanceCount: 3,
  lanceSpread: 0.3,
  blinkInterval: 5.5,
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
  /**
   * Vertical world units visible. Width derives from the device aspect —
   * but see `maxViewWidth`: on a landscape phone (aspect ~2.2) a 15.5wu
   * height means 34wu of width, which used to be WIDER THAN THE ENTIRE
   * ARENA. The whole level fitted on one screen and the camera never moved.
   */
  viewHeight: 13.4,
  /**
   * Hard cap on horizontal world units. When the device is wide enough that
   * `viewHeight * aspect` exceeds this, we shrink viewHeight instead of
   * revealing more world. Without it the game is zoomed out to nothing in
   * landscape and every room reads as tiny.
   */
  maxViewWidth: 25.5,
  /** Never zoom in past this, or portrait tablets get claustrophobic. */
  minViewHeight: 10.5,

  /** Higher = tighter follow. This is a per-second lerp rate. */
  followLerp: 6.2,
  /** Vertical follow is slower than horizontal — jitter reads worse on Y. */
  followLerpY: 4.4,
  /** Camera leads the player in the direction they're moving. */
  lookAheadX: 2.4,
  lookAheadLerp: 2.4,
  /** Camera rests this far above the player's feet. */
  baseY: 3.1,
  /**
   * Deadzone in world units: the player can move this far vertically before
   * the camera follows at all. Stops the view pumping on every small hop.
   */
  deadzoneY: 1.6,
  /** Extra pull-back while a boss is alive, so the arena reads whole. */
  bossZoomOut: 1.22,
  bossZoomLerp: 1.8,
  /** Snap instead of lerping when the camera is further than this. */
  teleportDistance: 26,
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
   * We render into an offscreen target at a fraction of that and blit it
   * back up to full size — the paper art style has no fine detail to lose,
   * and it buys ~40% GPU headroom.
   *
   * IMPORTANT: this must NOT be applied with `renderer.setSize(smaller)`.
   * In a browser that shrinks the backing store and CSS scales it back up.
   * expo-gl has no CSS: the surface stays full size, `gl.viewport` shrinks,
   * and everything outside the viewport stays at the clear colour. That is
   * exactly the black band down the right side of the screen — the scene
   * was being drawn into the bottom-left 75% x 75% of the display.
   * See engine/useGLGame.ts for the render-target blit that fixes it.
   */
  resolutionScale: 0.8,
  /**
   * OFF BY DEFAULT, AND THAT IS DELIBERATE.
   *
   * When true, the scene renders into an offscreen target at
   * `resolutionScale` and is blitted up to full size. That saves real
   * fragment work — but it depends on `renderer.setRenderTarget(null)`
   * returning to the surface expo-gl actually presents, and expo-gl does not
   * guarantee that its presentable framebuffer is FBO 0. When it isn't, the
   * blit lands in a framebuffer nobody ever shows and you get a completely
   * black GL view with a perfectly working HUD on top of it.
   *
   * The direct path has no such dependency and is what the original build
   * used, minus the viewport bug. It costs ~35% more fragments on a 3x
   * display, which the flat art can afford.
   *
   * If you want the saving back, turn this on and verify on a real device
   * before shipping. `resolutionScale` is ignored while it is false.
   */
  offscreenUpscale: false,
  particlePoolSize: 260,
  /** Skip the frame entirely if dt is this large (app was backgrounded). */
  maxDeltaTime: 0.1,
  /** Physics runs at a fixed step; render interpolates. */
  fixedStep: 1 / 60,
  maxStepsPerFrame: 4,
} as const;

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------
export const PROGRESSION = {
  /**
   * Bosses a non-member may defeat. The three free branches (Fungal, Spire,
   * Ember) form a complete arc: a hub, three paths, three kills, an ending.
   * The gate then lands on the high of a win rather than mid-grind.
   */
  freeBosses: 3,
  /** Bosses required before the Storm Gate opens. */
  stormGateRequires: 6,
  /** Hearts restored when resting at a bench. */
  benchHeal: true,
  /** Seconds the room-name card stays on screen. */
  roomTitleTime: 2.6,
  /** Fade in/out on a room transition. Keep it short — this is a corridor. */
  transitionFade: 0.26,
  /** Essence lost on death, as a fraction. Soft, not Souls-hard. */
  deathPenalty: 0.25,
} as const;

export const STORAGE_KEYS = {
  highScore: "@spell_storm_high_score",
  bestWave: "@spell_storm_best_wave",
  muted: "@spell_storm_muted",
  /** JSON blob: defeated bosses, discovered rooms, last bench. */
  progress: "@spell_storm_progress_v1",
} as const;
