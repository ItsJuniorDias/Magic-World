import type * as THREE from "three";
import type { EnemyKind, PickupKind, WeaponId } from "./config";

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
  invulnerable: number;

  /** Normalised aim direction, snapped to 8 ways. */
  aimX: number;
  aimY: number;

  weapon: WeaponId;
  weaponTimer: number;
  fireCooldown: number;

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
  | "intermission"
  | "gameover"
  | "locked"
  | "victory";

export interface GameState {
  phase: GamePhase;
  wave: number;
  score: number;
  combo: number;
  comboTimer: number;
  /** Enemies still to spawn in the current wave. */
  spawnQueue: EnemyKind[];
  spawnTimer: number;
  intermissionTimer: number;
  /** Freeze-frame timer — the simulation is paused while this is > 0. */
  hitstop: number;
  shake: number;
  elapsed: number;
  bossActive: boolean;
}

/**
 * Everything the React layer needs to render the HUD. Pushed out of the
 * simulation once per frame via a callback rather than React state per
 * entity — that would re-render 60 times a second and drop frames.
 */
export interface HudSnapshot {
  phase: GamePhase;
  hearts: number;
  score: number;
  wave: number;
  combo: number;
  weapon: WeaponId;
  weaponTimer: number;
  bossHp: number;
  bossMaxHp: number;
  bossActive: boolean;
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
