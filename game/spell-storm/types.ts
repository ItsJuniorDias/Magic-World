import type * as THREE from "three";
import type { BossKind, EnemyKind, PickupKind, WeaponId } from "./config";
import type { ShopItemId } from "./systems/shop";
import type { DialogueLine } from "./systems/dialogue";

/** A 2D vector. The game is 2.5D — Z is fixed per layer, never simulated. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned box used for every collision in the game. */
export interface AABB {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Written by the React layer (touch handlers), read by the simulation.
 * Deliberately a plain mutable object: it is polled once per fixed step,
 * never allocated per frame.
 */
export interface InputState {
  /** Stick vector, each component in [-1, 1]. */
  moveX: number;
  moveY: number;
  /** True while the JUMP button is held. */
  jumpHeld: boolean;
  /** Set true on press, cleared by the simulation once consumed. */
  jumpPressed: boolean;
  /** True while the FIRE button is held — the mage auto-fires. */
  fireHeld: boolean;
  /** Set true on the first frame FIRE goes down. Drives the aim latch. */
  firePressed: boolean;
  /** Set true when a dash is requested. +1 right, -1 left, 0 ignored. */
  dashRequest: 0 | 1 | -1;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  /** Seconds since leaving the ground — drives coyote time. */
  timeOffGround: number;
  /** Seconds since JUMP was pressed — drives the jump buffer. */
  timeSinceJumpPress: number;
  /** True while rising from a jump the player hasn't released yet. */
  jumping: boolean;

  hearts: number;
  /**
   * Live max hearts for this run. Starts at PLAYER.maxHearts and grows by
   * `progress.bonusMaxHearts` whenever a Vessel Fragment is purchased in
   * the shop. Persisting the cap on the Player rather than reading the
   * constant everywhere means resetPlayer() can rebuild it from the
   * saved bonus at respawn without touching config.
   */
  maxHearts: number;
  invulnerable: number;
  /**
   * Charges bought from the Arcane Shield in the shop. Each takes a hit
   * for free — i-frames and knockback still apply so the shield reads
   * as a real save, not a whiff. Zero out at death alongside weapons.
   */
  shield: number;

  /** Normalised aim direction, snapped to 8 ways. */
  aimX: number;
  aimY: number;
  /**
   * The snapshot of the aim direction taken when CAST was first pressed.
   * While CAST is held, `aimX/aimY` are copied from this rather than from
   * the live stick, so movement and aim are decoupled per turn.
   */
  latchedAimX: number;
  latchedAimY: number;
  /** True while the aim is latched — cleared on CAST release. */
  aimLatched: boolean;

  weapon: WeaponId;
  weaponTimer: number;
  fireCooldown: number;

  // ---- Dash ----
  /** > 0 while dashing. During this window the player is invulnerable. */
  dashTimer: number;
  /** Cooldown until the next dash is available. Held between dashes. */
  dashCooldown: number;
  /** +1 or -1 during the dash, so the player can't reverse mid-dash. */
  dashDir: 1 | -1;
  /**
   * The air-dash charge. Starts true, spent on the JUMP-in-air trigger,
   * refreshed on ground contact. Independent of dashCooldown: even with
   * cooldown ready, an airborne player who's already burnt this charge
   * can't dash again until they land.
   */
  airDashAvailable: boolean;
  /** True when this frame's landing should refund a pogo jump. */
  pogoRefund: boolean;

  /** Visual-only squash/stretch, recovered toward 1. */
  squashX: number;
  squashY: number;

  alive: boolean;
}

export interface Enemy {
  active: boolean;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  onGround: boolean;
  /** Generic per-kind timer (hop cadence, fire cadence, swoop cadence). */
  timer: number;
  /** Secondary timer for multi-stage behaviour (golem windup, dragon phase). */
  timer2: number;
  /** Behaviour state machine slot, interpreted per kind. */
  state: number;
  /** Seconds of hit-flash remaining. */
  flash: number;
  /** Phase offset so identical enemies don't animate in lockstep. */
  phase: number;
  /** Index into the visual pool — the mesh group that represents this enemy. */
  visual: number;
  /** Third timer. Bosses run three clocks at once (attack, phase, telegraph). */
  timer3: number;
  /** Boss phase, 1..3. Zero for minions. */
  phaseIndex: number;
  /** Seconds of invulnerability remaining — boss intros and void collapses. */
  invulnerable: number;
  /** Scratch value the art layer reads for telegraph intensity, 0..1. */
  tell: number;
  /** Scratch position, used by bosses that anchor or orbit. */
  anchorX: number;
  anchorY: number;
}

export interface Projectile {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
  piercing: boolean;
  homing: boolean;
  /** True for enemy-fired projectiles — these damage the player instead. */
  hostile: boolean;
  /** Enemies already hit by this piercing shot, so it can't re-hit them. */
  hitMask: number;
}

export interface Pickup {
  active: boolean;
  kind: PickupKind;
  x: number;
  y: number;
  vy: number;
  life: number;
  phase: number;
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export type GamePhase =
  | "loading"
  | "ready"
  | "playing"
  /** Fading between rooms. The simulation is paused. */
  | "transition"
  /**
   * Boss intro cutscene — the boss room's story beat runs before the
   * shop opens. Sim paused, dialogue overlay drives the UX. First
   * visit only; a returning player skips straight to shop.
   */
  | "cutscene"
  /**
   * You've arrived at a boss room you haven't cleared. The shop overlay
   * is up; the boss hasn't spawned yet and the sim is paused. Leaving
   * this phase either kills you (unlikely — nothing can hit you) or
   * commits you to the fight.
   */
  | "shop"
  /** An NPC chat somewhere in the world. Sim paused, dialogue overlay up. */
  | "dialogue"
  /** Boss roar; the player can move but nothing can hurt them. */
  | "bossIntro"
  /** Boss corpse dissolving. Optionally followed by a defeat cutscene. */
  | "bossDefeated"
  | "resting"
  | "dead"
  | "locked"
  | "victory";

/** What the player has done. Persisted between sessions. */
export interface Progress {
  /** Room ids of bosses defeated. */
  bosses: string[];
  /** Rooms the player has entered, for the map overlay. */
  discovered: string[];
  /** Room id of the last bench rested at. */
  bench: string;
  /** x within that room. */
  benchX: number;
  essence: number;
  /**
   * Vessel Fragments bought from the shop. Persists between deaths and
   * across sessions; capped at VESSEL_CAP (3). Each fragment adds one
   * to the player's max hearts.
   */
  bonusMaxHearts?: number;
  /**
   * Boss room ids whose intro cutscene the player has already sat
   * through. On the second entry (after death, or after clearing a
   * different branch first), we skip straight to the shop.
   */
  watchedCutscenes?: string[];
  /**
   * NPC ids the player has spoken to. Purely for save colour — the
   * script picker keys off boss count rather than met history, so
   * meeting the same NPC twice after two boss kills always shows the
   * "mid" variant.
   */
  metNpcs?: string[];
  /**
   * Room ids of benches the player has already rested at. Used as the
   * pool of valid teleport destinations — you can only travel to a
   * bench you've visited before, matching the Elden Ring "grace" model.
   * Empty on a fresh save; the very first rest at the start-room bench
   * seeds it.
   *
   * NB: `bench` (single string) tracks the LAST bench (where death
   * respawns you). `benchesRested` tracks EVERY bench visited (for the
   * travel UI). They're separate because respawn semantics and travel
   * semantics are different concerns and were already growing apart.
   */
  benchesRested?: string[];
}

export interface RoomHudInfo {
  id: string;
  name: string;
  biome: string;
  bench: boolean;
}

export interface GameState {
  phase: GamePhase;
  score: number;
  combo: number;
  comboTimer: number;
  /** Freeze-frame timer — the simulation is paused while this is > 0. */
  hitstop: number;
  elapsed: number;

  // ---- World ----
  roomId: string;
  /** Countdown on the room-name card. */
  roomTitleTimer: number;
  /** Transition progress, 0..1. Drives the fade quad. */
  fade: number;
  fadeDir: 1 | -1 | 0;
  /** Gate we are travelling through, if any. */
  pendingGate: { to: string; toGate: string } | null;
  /**
   * Grace period after entering a room, in seconds, during which gate
   * detection is disabled. Belt to the arrivalPoint braces: if any spawn
   * ever lands inside a gate's detection range again, this stops the
   * player from being bounced straight back out.
   */
  gateGrace: number;

  // ---- Boss ----
  bossActive: boolean;
  bossKind: BossKind | null;
  bossTimer: number;
  /** Set when the player reaches a gate they haven't unlocked. */
  blockedGate: { label: string; pro: boolean } | null;

  // ---- Shop ----
  /**
   * The boss that will be spawned when the shop overlay closes. Set on
   * entry to an uncleared boss room, cleared once the fight starts.
   * A non-null value here is what tells the phase machine to keep the
   * sim paused for the overlay.
   */
  pendingBoss: BossKind | null;
  /**
   * What was bought in the current shop visit, keyed by ShopItemId. Reset
   * every time the shop opens. Used to enforce the per-visit stack limit
   * without the UI having to remember.
   */
  shopPurchased: Partial<Record<ShopItemId, number>>;

  // ---- Dialogue ----
  /**
   * Active dialogue if any — set for both boss cutscenes and NPC chats.
   * Null everywhere else. The React overlay reads this off the HUD
   * (which mirrors it verbatim); the sim just walks the index.
   */
  dialogue: null | {
    kind: "bossIntro" | "bossDefeat" | "npc" | "epilogue";
    scriptId: string;
    lines: readonly DialogueLine[];
    index: number;
    /** For boss cutscenes only. Determines where the phase machine goes next. */
    pendingBoss: BossKind | null;
    /** For NPC chats only. Marks the NPC as met on close. */
    npcId: string | null;
  };
  /**
   * The id of the NPC the player is currently close enough to talk to,
   * or null. The React layer paints a "TAP TO TALK" prompt off this.
   */
  nearbyNpc: string | null;
}

/**
 * Everything the React layer needs to render the HUD. Pushed out of the
 * simulation once per frame via a callback rather than React state per
 * entity — that would re-render 60 times a second and drop frames.
 */
export interface HudSnapshot {
  phase: GamePhase;
  hearts: number;
  maxHearts: number;
  score: number;
  combo: number;
  weapon: WeaponId;
  weaponTimer: number;

  /** Current room, for the title card and the map. */
  roomId: string;
  roomName: string;
  /** Seconds left on the room-name card; 0 hides it. */
  roomTitle: number;
  atBench: boolean;
  /**
   * All bench-rooms the player has already rested at, ordered by first
   * visit. Drives the travel modal — the UI reads this list and looks
   * up display metadata (name, biome) via ROOMS.
   */
  benchesRested: string[];
  /**
   * True when the player is standing at a bench AND has at least one
   * OTHER bench available as a travel destination. The UI uses this
   * as a single condition to show/hide the Travel button, so it can
   * stay a passive prompt when there's nowhere to go yet (e.g. the
   * player's first-ever rest at Crossroads).
   */
  canTravel: boolean;

  /** Boss bar. */
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  bossName: string;
  bossTitle: string;
  bossInvulnerable: boolean;

  /** Progression. */
  bossesDefeated: number;
  totalBosses: number;
  discovered: string[];
  defeatedRooms: string[];

  /** Dash telemetry, drives the cooldown pip near the CAST button. */
  dashActive: boolean;
  dashReady: boolean;
  /**
   * True when a JUMP press in the air will fire an air dash right now.
   * Distinct from `dashReady` (which just tracks the cooldown) because
   * the air-dash mechanic also requires the per-airborne-session charge
   * to be unspent. Lights the pip gold instead of cyan when armed.
   */
  airDashArmed: boolean;
  /** Whether the current shot direction is latched (visible reticle glow). */
  aimLatched: boolean;

  /** Set when the player walks into a sealed door. */
  sealed: { label: string; pro: boolean } | null;

  /**
   * Live shield charges — rendered as a small aegis pip beside the hearts
   * during play so the player knows their next hit is free.
   */
  shield: number;

  /**
   * Shop panel state, pushed to the React layer so it can render the
   * overlay without querying the game handle imperatively. Null when no
   * shop is open.
   */
  shop: {
    bossName: string;
    bossTitle: string;
    essence: number;
    purchased: Partial<Record<ShopItemId, number>>;
    bonusMaxHearts: number;
  } | null;

  /**
   * Active dialogue if any — the React overlay renders this. Includes
   * both the currently visible line AND some metadata so the overlay
   * can style differently for boss cutscenes vs NPC chats (e.g. a boss
   * cutscene shows a "SKIP" button; an NPC chat does not).
   */
  dialogue: {
    kind: "bossIntro" | "bossDefeat" | "npc" | "epilogue";
    line: DialogueLine;
    index: number;
    total: number;
    /** Boss name for cutscenes (used in header framing). Empty for NPCs. */
    bossName: string;
    bossTitle: string;
  } | null;

  /**
   * NPC id the player is close enough to talk to, or null. Drives the
   * "TAP TO TALK" prompt above the mage.
   */
  nearbyNpc: string | null;
  /** Display name of the nearby NPC. Handy for the prompt. */
  nearbyNpcName: string;
}

// ---------------------------------------------------------------------------
// Engine contract
// ---------------------------------------------------------------------------

/** Anything holding GPU memory that must be released on unmount. */
export interface Disposable {
  dispose(): void;
}

export interface GameContext {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  /** Register a resource for automatic disposal when the screen unmounts. */
  track<T extends Disposable>(resource: T): T;
  /** World units visible horizontally, derived from the device aspect. */
  viewWidth: number;
  viewHeight: number;
  /** Drawing-buffer size in pixels. The camera rig needs it to fit the frustum. */
  pixelWidth: number;
  pixelHeight: number;
}

export interface GameHandle {
  /** Advance the simulation and render one frame. */
  frame(dt: number): void;
  /** Called when the GL surface changes size. */
  resize(width: number, height: number): void;
  /** Start or restart a run. */
  start(): void;
  /** Free every GPU resource. Called on unmount. */
  dispose(): void;
  /** Latest HUD values — polled by the React layer on an interval. */
  readonly hud: HudSnapshot;
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

/**
 * Everything the puppet pose solver needs. Lives here rather than in the art
 * layer so the simulation can build one without importing three.js.
 */
export interface PoseLike {
  /** Seconds, monotonically increasing. */
  time: number;
  /** Horizontal speed in world units/sec, always positive. */
  speed: number;
  /** Normalised speed [0..1] against the character's max. */
  speedRatio: number;
  onGround: boolean;
  /** Vertical velocity, for jump/fall pose blending. */
  vy: number;
  /** Aim angle in radians, or null when the character isn't aiming. */
  aimAngle: number | null;
  /** 0..1, decays after a shot. Drives recoil. */
  recoil: number;
  /** Per-entity offset so clones don't animate in lockstep. */
  phase: number;
}
