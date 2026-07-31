import * as THREE from "three";
import {
  BOSS,
  BOSS_KINDS,
  COMBO,
  ENEMIES,
  FEEL,
  PICKUP,
  PLAYER,
  PROGRESSION,
  type BossKind,
  type PickupKind,
} from "./config";
import { createFx } from "./art/fx";
import { createMage } from "./art/mage";
import { PALETTE } from "./art/palette";
import { PaperKit } from "./art/paper";
import { createSky, type Sky } from "./art/sky";
import { Disposer } from "./engine/Disposer";
import { createInputState } from "./engine/input";
import { ARENA_STATE, overFloorGap, setSealed } from "./systems/arena";
import {
  clearBossQueues,
  pendingHazards,
  pendingPull,
  pendingSpawns,
  pendingSpikes,
} from "./systems/bossAI";
import { createCameraRig } from "./systems/camera";
import { createEnemies } from "./systems/enemies";
import { boxesOverlap, circleHitsBox, hitsHazard } from "./systems/physics";
import { createPickups } from "./systems/pickups";
import { alreadyHit, createProjectiles, markHit } from "./systems/projectiles";
import {
  SHOP_CATALOG,
  tryBuyShopItem,
  type ShopItemId,
  type ShopPurchaseResult,
} from "./systems/shop";
import {
  createPlayer,
  damagePlayer,
  grantWeapon,
  healPlayer,
  pogoBounce,
  resetPlayer,
  shouldBlink,
  tryFire,
  updatePlayer,
} from "./systems/player";
import { createWorld } from "./systems/world";
import { BIOMES, BOSS_ROOMS, getRoom, START_ROOM, type BiomeId } from "./world/rooms";
import type {
  AABB,
  GameContext,
  GameHandle,
  GameState,
  HudSnapshot,
  InputState,
  PoseLike,
  Progress,
} from "./types";

/**
 * SPELL STORM — orchestrator.
 *
 * WHAT CHANGED, AND WHY
 *
 * This used to be a wave director: one arena, a spawn queue, a timer, a boss
 * on wave 10. That shape has a ceiling. Waves are a *score* game — the fun is
 * a number going up — and a score game is over the moment the player stops
 * caring about the number. A map is a *place* game: the fun is that there is
 * somewhere you haven't been, and that lasts as long as the map does.
 *
 * So the loop is now: explore, find a door, find a boss, kill it, the door it
 * was guarding opens. Twenty rooms, seven bosses, benches to save at, and a
 * death that costs you a walk back rather than the whole run.
 *
 * THE FRAME, IN ORDER
 *
 *   1. hitstop        — freeze the sim, keep the presentation running
 *   2. phase machine  — transitions, boss intros, death, resting
 *   3. player         — movement, aim, fire
 *   4. enemies        — minion AI and boss state machines
 *   5. deferred       — spawns, hazards, spikes and pull the bosses queued
 *   6. collisions     — bullets, bodies, hazards, pickups
 *   7. gates          — did the player leave the room
 *   8. presentation   — puppets, camera, parallax, sky, HUD
 *
 * Nothing in steps 3–7 runs during a transition, which is what makes the fade
 * safe: the world is being rebuilt underneath it.
 */

export interface SpellStormOptions {
  /** Whether the player holds an active subscription. Gates four branches. */
  isPro: boolean;
  /** Restored progress. Pass a fresh one for a new save. */
  progress: Progress;
  /** Called whenever progress changes, so the screen can persist it. */
  onProgress?: (progress: Progress) => void;
  /** Called when the player dies, for analytics. */
  onDeath?: (roomId: string, essence: number) => void;
  /** Called when a boss dies. */
  onBossDefeated?: (roomId: string, boss: BossKind, total: number) => void;
  /** Called when the player reaches a members-only door. */
  onLocked?: (roomId: string) => void;
  /** Fired for one-shot sound effects. Kept out of the engine deliberately. */
  onSound?: (id: SoundId) => void;
  /**
   * Called on a successful shop purchase. Handy for haptics / analytics
   * without leaking the shop's internal shape into the React layer's
   * imperative surface.
   */
  onShopBuy?: (id: ShopItemId, cost: number) => void;
}

export type SoundId =
  | "fire"
  | "jump"
  | "land"
  | "hit"
  | "kill"
  | "hurt"
  | "pickup"
  | "gate"
  | "bench"
  | "bossRoar"
  | "bossDown"
  | "sealed"
  | "gameover";

export interface SpellStorm extends GameHandle {
  readonly input: InputState;
  /**
   * Attempts to buy a shop item. Only meaningful while phase === "shop".
   * Returns the same result the shop system produces so the UI can
   * surface exactly why a purchase failed (out of essence, already
   * bought, at the cap). No-op outside the shop phase.
   */
  buyShopItem(id: ShopItemId): ShopPurchaseResult;
  /**
   * Commits the current shop visit and spawns the pending boss. No-op
   * outside the shop phase. The overlay is what invokes this on the
   * "Enter the arena" button.
   */
  closeShop(): void;
}

export function createDefaultProgress(): Progress {
  return {
    bosses: [],
    discovered: [],
    bench: START_ROOM,
    benchX: 0,
    essence: 0,
    bonusMaxHearts: 0,
  };
}

export function createSpellStorm(ctx: GameContext, options: SpellStormOptions): SpellStorm {
  const disposer = new Disposer();
  const kit = new PaperKit(disposer);

  // ---- Scene graph -------------------------------------------------------
  const progress = options.progress ?? createDefaultProgress();

  const world = createWorld(ctx.scene, ctx.camera, ctx.viewWidth, ctx.viewHeight, {
    progress,
    isPro: options.isPro,
    onProgress: options.onProgress,
  });

  // Skies are built lazily, one per biome, and toggled by visibility. Eight
  // of them is about 900 vertices total — far cheaper than rebuilding the
  // gradient, the star field and seven cloud cards on every room change.
  const skies = new Map<BiomeId, Sky>();
  let activeSky: Sky | null = null;

  function useSky(biome: BiomeId): void {
    let sky = skies.get(biome);
    if (!sky) {
      sky = createSky(kit, disposer, ctx.camera, ctx.viewWidth, ctx.viewHeight, BIOMES[biome].sky);
      skies.set(biome, sky);
    }
    if (activeSky && activeSky !== sky) activeSky.root.visible = false;
    sky.root.visible = true;
    activeSky = sky;
  }

  const fx = createFx(kit, disposer);
  world.root.add(fx.root);

  const enemies = createEnemies(kit);
  world.root.add(enemies.root);

  const projectiles = createProjectiles(kit);
  world.root.add(projectiles.root);

  const pickups = createPickups(kit);
  world.root.add(pickups.root);

  const mage = createMage(kit);
  world.root.add(mage.root);

  // -----------------------------------------------------------------------
  // Aim reticle
  //
  // With a single stick doing double duty, the ONE thing that made the aim
  // feel broken to the player was invisible: the mage's arm rotates but you
  // don't see it at phone size. A bright reticle at fixed distance along
  // the aim vector is the fix. It moves as you move the stick, it stays put
  // when the aim latches under CAST, and it disappears when you die.
  //
  // Reticle is a mesh not a UI overlay because it belongs in the world:
  // it must scroll with the camera, get shaken by hitstop, and pop through
  // FX rather than sit on top of them. Two cards — an inner dot and an
  // outer ring — read at 90 pixels of screen. Both additive so the reticle
  // never dims the scene behind it.
  // -----------------------------------------------------------------------
  const reticle = new THREE.Group();
  reticle.name = "reticle";
  world.root.add(reticle);

  const reticleRing = kit.glowDisc(0.34, PALETTE.arcaneCore, 20);
  reticleRing.renderOrder = 30;
  reticle.add(reticleRing);

  const reticleDot = kit.card(PaperKit.star(4, 0.11, 0.42), PALETTE.arcaneCore, PALETTE.arcaneCore, {
    depth: 0.06,
    order: 31,
  });
  reticle.add(reticleDot);

  /** World-space distance from the mage to the reticle. */
  const RETICLE_REACH = 2.4;

  const cameraRig = createCameraRig(ctx.camera);
  cameraRig.fit(ctx.pixelWidth, ctx.pixelHeight);

  // ---- State -------------------------------------------------------------
  const input = createInputState();
  const player = createPlayer();

  const state: GameState = {
    phase: "ready",
    score: 0,
    combo: 1,
    comboTimer: 0,
    hitstop: 0,
    elapsed: 0,
    roomId: START_ROOM,
    roomTitleTimer: 0,
    fade: 0,
    fadeDir: 0,
    pendingGate: null,
    gateGrace: 0,
    bossActive: false,
    bossKind: null,
    bossTimer: 0,
    blockedGate: null,
    pendingBoss: null,
    shopPurchased: {},
  };

  const hud: HudSnapshot = {
    phase: "ready",
    hearts: PLAYER.startHearts,
    maxHearts: PLAYER.maxHearts,
    score: 0,
    combo: 1,
    weapon: "bolt",
    weaponTimer: 0,
    roomId: START_ROOM,
    roomName: getRoom(START_ROOM).name,
    roomTitle: 0,
    atBench: false,
    bossActive: false,
    bossHp: 0,
    bossMaxHp: 1,
    bossName: "",
    bossTitle: "",
    bossInvulnerable: false,
    bossesDefeated: 0,
    totalBosses: BOSS_ROOMS.length,
    discovered: [],
    defeatedRooms: [],
    dashActive: false,
    dashReady: true,
    airDashArmed: false,
    aimLatched: false,
    sealed: null,
    shield: 0,
    shop: null,
  };

  let castFlash = 0;
  let recoil = 0;
  let benchTimer = 0;
  let started = false;

  // Reused collision boxes — allocating these per frame would produce
  // thousands of short-lived objects a second.
  const playerBox: AABB = { x: 0, y: 0, halfW: PLAYER.halfW, halfH: PLAYER.halfH };
  const enemyBox: AABB = { x: 0, y: 0, halfW: 0, halfH: 0 };
  const pose: PoseLike = {
    time: 0,
    speed: 0,
    speedRatio: 0,
    onGround: true,
    vy: 0,
    aimAngle: null,
    recoil: 0,
    phase: 0,
  };

  /** Delayed spawns queued by bosses. Drained with their own timers. */
  const scheduled: { kind: "slime" | "bat" | "golem" | "wisp"; x: number; y: number; t: number }[] = [];
  /** Live damage zones (slams, spikes). */
  const hazards: { x: number; y: number; radius: number; groundOnly: boolean; life: number }[] = [];

  const sound = (id: SoundId) => options.onSound?.(id);

  // ---- Helpers -----------------------------------------------------------

  function syncPlayerBox(): void {
    playerBox.x = player.x;
    playerBox.y = player.y + PLAYER.halfH;
  }

  function addScore(base: number): void {
    state.score += Math.round(base * state.combo);
  }

  function bumpCombo(): void {
    state.combo = Math.min(COMBO.maxMultiplier, state.combo + COMBO.step);
    state.comboTimer = COMBO.window;
  }

  function hurtPlayer(fromX: number, shakeAmount: number = FEEL.shakeOnPlayerHit): void {
    if (!damagePlayer(player, fromX)) return;
    sound("hurt");
    state.hitstop = FEEL.hitstopOnPlayerHit;
    cameraRig.addShake(shakeAmount);
    fx.burst(player.x, player.y + PLAYER.halfH, 14, PALETTE.danger, 6, 10);
    state.combo = 1;
    state.comboTimer = 0;
  }

  function applyPickup(kind: PickupKind, x: number, y: number): void {
    sound("pickup");
    fx.burst(x, y, 12, PALETTE.gold, 5, 9);
    fx.shockwave(x, y, PALETTE.gold, 1.4, 0.3);
    switch (kind) {
      case "heart":
        if (!healPlayer(player)) addScore(PICKUP.starScore);
        break;
      case "star":
        addScore(PICKUP.starScore);
        break;
      default:
        grantWeapon(player, kind);
        break;
    }
  }

  /** Wipes everything that belonged to the room we are leaving. */
  function clearRoomEntities(): void {
    enemies.reset();
    projectiles.reset();
    pickups.reset();
    clearBossQueues();
    scheduled.length = 0;
    hazards.length = 0;
  }

  function enterRoom(roomId: string, fromGate: string | null): void {
    clearRoomEntities();

    const spawnAt = world.enter(roomId, fromGate);
    const room = world.room;

    state.roomId = roomId;
    state.roomTitleTimer = PROGRESSION.roomTitleTime;
    state.blockedGate = null;
    // Silence gate detection just long enough that the player can move a
    // little before the check starts firing. 0.4s is more than enough to
    // walk off the arrival tile, and short enough that intentionally
    // reversing course through the same door still feels responsive.
    state.gateGrace = 0.4;
    useSky(room.biome);

    // Belt and braces: if an arrival point ever ends up over a hole, slide it
    // sideways until it isn't. A player who falls out of a room the instant
    // they enter it has no way to tell a level-design mistake from a crash.
    let sx = spawnAt.x;
    if (overFloorGap(sx) && spawnAt.y < 1.5) {
      for (let step = 1; step <= 20 && overFloorGap(sx); step++) {
        const probe = spawnAt.x + step * 1.5 * (spawnAt.x > (room.minX + room.maxX) * 0.5 ? -1 : 1);
        if (probe > room.minX + 2 && probe < room.maxX - 2) sx = probe;
        else break;
      }
    }

    player.x = sx;
    player.y = spawnAt.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    // Entering from a right-hand door means walking left, and vice versa.
    player.facing = spawnAt.x > (room.minX + room.maxX) * 0.5 ? -1 : 1;

    // Ambient population. Enemies respawn on every visit, Hollow-Knight
    // style: the corridor is a fresh problem each time you cross it, and
    // that is what stops backtracking feeling like empty walking.
    for (const s of room.spawns) enemies.spawn(s.kind, s.x, s.y);

    // Boss.
    //
    // Two paths. If this room has a boss and it's still standing, we
    // open the shop before starting the fight — the arena stays sealed
    // and the boss doesn't spawn until the player commits via
    // closeShop(). If the boss is already down, we just resume play as
    // normal; the room is a peaceful walk-through at that point.
    const bossCleared = progress.bosses.includes(roomId);
    if (room.boss && !bossCleared) {
      openShop(room.boss);
    } else {
      state.bossActive = false;
      state.bossKind = null;
      state.pendingBoss = null;
      setSealed(false);
      cameraRig.setBossFraming(false);
      state.phase = "playing";
    }

    cameraRig.reset(player.x, player.y);
  }

  /**
   * Opens the pre-boss shop. The room is sealed so the player can't
   * wander back out mid-decision, but nothing hostile spawns yet — the
   * arena is genuinely paused. The React layer reads state.phase and
   * hud.shop to draw the overlay; there is no imperative call from here
   * back into React.
   */
  function openShop(kind: BossKind): void {
    state.phase = "shop";
    state.pendingBoss = kind;
    state.shopPurchased = {};
    state.bossActive = false;
    state.bossKind = null;
    // Camera frames the empty arena the same way it will frame the
    // fight, so the transition into bossIntro is a rhythm change, not a
    // camera move. Sealing the room is what tells the player "this is
    // where you're going to fight" and it does that job during the shop
    // too — the doorway they came through is now closed behind them.
    setSealed(true);
    cameraRig.setBossFraming(true);
  }

  function startBossFight(kind: BossKind): void {
    const room = world.room;
    const spawnX = (room.minX + room.maxX) * 0.5 + (player.x > 0 ? -6 : 6);
    const airborne = kind === "nightwing" || kind === "lumenChoir" || kind === "voidmaw" || kind === "dragon";
    enemies.spawn(kind, spawnX, airborne ? room.ceilingY - 6 : 3.0);

    state.bossActive = true;
    state.bossKind = kind;
    state.bossTimer = BOSS.introTime;
    state.phase = "bossIntro";
    // The doors shut. This is the only place in the game that takes an exit
    // away from the player, and it is why boss rooms are authored with a
    // single entrance — you always know exactly which door reopens.
    setSealed(true);
    cameraRig.setBossFraming(true);
    cameraRig.addShake(0.7);
    sound("bossRoar");
  }

  function onBossKilled(x: number, y: number): void {
    const roomId = state.roomId;
    const kind = state.bossKind;

    state.bossActive = false;
    state.phase = "bossDefeated";
    state.bossTimer = BOSS.deathTime;
    state.hitstop = 0.32;

    cameraRig.addShake(FEEL.shakeOnBossLand);
    cameraRig.setBossFraming(false);
    setSealed(false);

    fx.burst(x, y, 46, PALETTE.gold, 13, 15);
    fx.shockwave(x, y, PALETTE.arcaneCore, 9, 0.7);

    world.markBossDefeated(roomId);
    // Reward: a heart and a scattering of pickups. Healing on a boss kill
    // means the walk back to the bench is a victory lap rather than a
    // second, worse fight.
    for (let i = 0; i < BOSS.heartsOnKill; i++) pickups.spawn("heart", x + i * 1.4, y);
    pickups.spawn("star", x - 2.2, y + 0.6);
    pickups.spawn("star", x + 2.2, y + 0.6);

    sound("bossDown");
    if (kind) options.onBossDefeated?.(roomId, kind, progress.bosses.length);
  }

  function restAtBench(): void {
    const room = world.room;
    if (!room.bench) return;
    player.hearts = PLAYER.maxHearts;
    progress.bench = room.id;
    progress.benchX = room.bench.x;
    progress.essence = state.score;
    options.onProgress?.(progress);
    fx.burst(room.bench.x + 1.3, 3.6, 20, PALETTE.gold, 6, 10);
    fx.shockwave(room.bench.x + 1.3, 3.0, PALETTE.gold, 3.4, 0.55);
    sound("bench");
  }

  function die(): void {
    if (state.phase === "dead") return;
    state.phase = "dead";
    state.bossTimer = 1.7;
    state.bossActive = false;
    cameraRig.setBossFraming(false);
    cameraRig.addShake(1.0);
    fx.burst(player.x, player.y + 0.8, 30, PALETTE.arcane, 10, 12);
    sound("gameover");
    const lost = Math.round(state.score * PROGRESSION.deathPenalty);
    state.score = Math.max(0, state.score - lost);
    options.onDeath?.(state.roomId, state.score);
  }

  function respawn(): void {
    // Death resets everything transient — weapon, shield, current
    // hearts — but keeps the Vessel Fragment bonus on max hearts,
    // because that's the one shop item the player is meant to keep
    // between deaths (it's the priciest, and losing it every death
    // would turn it into a trap purchase).
    const maxHearts = PLAYER.maxHearts + (progress.bonusMaxHearts ?? 0);
    player.maxHearts = maxHearts;
    player.hearts = maxHearts;
    player.alive = true;
    player.weapon = "bolt";
    player.weaponTimer = 0;
    player.shield = 0;
    player.invulnerable = PLAYER.iFrames;
    state.combo = 1;
    state.comboTimer = 0;
    enterRoom(progress.bench, null);
  }

  /** Begins a fade-out toward another room. */
  function beginTransition(to: string, toGate: string): void {
    state.phase = "transition";
    state.pendingGate = { to, toGate };
    state.fadeDir = 1;
    sound("gate");
  }

  // ---- Deferred effects the bosses queued ---------------------------------

  function drainBossQueues(dt: number): void {
    while (pendingSpawns.length > 0) {
      const s = pendingSpawns.pop()!;
      scheduled.push({ kind: s.kind, x: s.x, y: s.y, t: s.delay });
    }
    while (pendingHazards.length > 0) {
      const h = pendingHazards.pop()!;
      hazards.push({ x: h.x, y: h.y, radius: h.radius, groundOnly: h.groundOnly, life: h.life });
    }
    while (pendingSpikes.length > 0) {
      const sp = pendingSpikes.pop()!;
      world.stage.showSpike(sp.x, sp.height, sp.life);
    }

    // Voidmaw's drag. Applied as acceleration on the player's velocity rather
    // than as a position offset, so the player can still fight it with the
    // stick — a positional pull would feel like input lag.
    if (pendingPull.strength > 0 && player.alive) {
      player.vx += pendingPull.x * pendingPull.strength * dt;
      player.vy += pendingPull.y * pendingPull.strength * dt * 0.55;
      pendingPull.strength = 0;
    }

    for (let i = scheduled.length - 1; i >= 0; i--) {
      scheduled[i].t -= dt;
      if (scheduled[i].t <= 0) {
        const s = scheduled[i];
        if (enemies.countActive() < 22) enemies.spawn(s.kind, s.x, s.y);
        fx.burst(s.x, s.y, 8, PALETTE.arcaneDeep, 4, 8);
        scheduled.splice(i, 1);
      }
    }

    for (let i = hazards.length - 1; i >= 0; i--) {
      hazards[i].life -= dt;
      if (hazards[i].life <= 0) hazards.splice(i, 1);
    }
  }

  // ---- Frame -------------------------------------------------------------

  function presentation(dt: number): void {
    fx.update(dt);
    enemies.render(state.elapsed);

    pose.time = state.elapsed;
    pose.speed = Math.abs(player.vx);
    pose.speedRatio = Math.min(1, Math.abs(player.vx) / PLAYER.maxSpeed);
    pose.onGround = player.onGround;
    pose.vy = player.vy;
    pose.recoil = recoil;
    // Aim only drives the arm while the player is actually firing or has
    // just fired; otherwise the arm returns to the run cycle and the mage
    // stops looking like a mannequin pointing at nothing.
    pose.aimAngle = input.fireHeld || recoil > 0.05 ? Math.atan2(player.aimY, player.aimX) : null;

    mage.root.position.set(player.x, player.y, 0);
    mage.puppet.setFacing(player.facing);
    mage.puppet.setSquash(player.squashX, player.squashY);
    mage.update(pose, castFlash);
    mage.setVisible(player.alive && !shouldBlink(player) && state.phase !== "dead");

    // Reticle: sits along the aim vector from the mage's chest. Grows and
    // brightens when the aim is latched under CAST so the player can tell
    // at a glance whether the aim is locked or free.
    const reticleVisible =
      player.alive && state.phase === "playing" && !ARENA_STATE.sealed
        ? true
        : player.alive &&
          (state.phase === "playing" || state.phase === "bossIntro" || state.phase === "bossDefeated");
    reticle.visible = reticleVisible;
    if (reticleVisible) {
      reticle.position.set(
        player.x + player.aimX * RETICLE_REACH,
        player.y + PLAYER.halfH + player.aimY * RETICLE_REACH,
        0.4,
      );
      const latch = player.aimLatched ? 1 : 0;
      const pulse = 1 + Math.sin(state.elapsed * 6) * 0.08 + latch * 0.35;
      reticleRing.scale.setScalar(pulse);
      (reticleRing.material as THREE.Material).opacity = 0.35 + latch * 0.4;
      reticleDot.scale.setScalar(0.8 + latch * 0.35);
      reticleDot.rotation.z += dt * (latch ? 6 : 2);
    }

    cameraRig.update(dt, player.x, player.y, player.vx, PLAYER.maxSpeed);
    world.update(cameraRig.focusX, cameraRig.focusY, state.elapsed);
    activeSky?.update(dt, state.elapsed, cameraRig.focusX);
    world.setFade(state.fade);

    publishHud();
  }

  function frame(dt: number): void {
    state.elapsed += dt;

    // ---- Hitstop ---------------------------------------------------------
    // Freezes the simulation but not the presentation. The camera still
    // shakes and particles still move, so the freeze reads as impact rather
    // than as a dropped frame.
    if (state.hitstop > 0) {
      state.hitstop = Math.max(0, state.hitstop - dt);
      presentation(dt);
      return;
    }

    castFlash = Math.max(0, castFlash - dt * 7);
    recoil = Math.max(0, recoil - dt * 6);
    if (state.roomTitleTimer > 0) state.roomTitleTimer = Math.max(0, state.roomTitleTimer - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
    if (state.blockedGate && !world.gateAt(player.x, player.y)) state.blockedGate = null;
    if (state.gateGrace > 0) state.gateGrace = Math.max(0, state.gateGrace - dt);

    // ---- Transition ------------------------------------------------------
    if (state.phase === "transition") {
      const speed = 1 / Math.max(0.05, PROGRESSION.transitionFade);
      state.fade += state.fadeDir * speed * dt;

      if (state.fadeDir === 1 && state.fade >= 1) {
        state.fade = 1;
        const gate = state.pendingGate;
        state.pendingGate = null;
        if (gate) enterRoom(gate.to, gate.toGate);
        // enterRoom sets phase; force it back to transition for the fade-in.
        state.phase = "transition";
        state.fadeDir = -1;
      } else if (state.fadeDir === -1 && state.fade <= 0) {
        state.fade = 0;
        state.fadeDir = 0;
        const room = world.room;
        const cleared = progress.bosses.includes(room.id);
        // If we've just arrived at an uncleared boss room, enterRoom
        // already flipped the phase to "shop" via openShop. Keep it
        // there rather than clobbering it with "bossIntro" — the boss
        // hasn't spawned yet and the overlay needs the sim paused.
        if (room.boss && !cleared) {
          state.phase = "shop";
        } else {
          state.phase = "playing";
        }
      }

      presentation(dt);
      return;
    }

    // ---- Death -----------------------------------------------------------
    if (state.phase === "dead") {
      state.bossTimer -= dt;
      if (state.bossTimer <= 0) {
        state.fade = 0;
        respawn();
        state.phase = "transition";
        state.fadeDir = -1;
        state.fade = 1;
      }
      presentation(dt);
      return;
    }

    // ---- Boss intro / defeat beats --------------------------------------
    if (state.phase === "bossIntro") {
      state.bossTimer -= dt;
      if (state.bossTimer <= 0) state.phase = "playing";
    } else if (state.phase === "bossDefeated") {
      state.bossTimer -= dt;
      if (state.bossTimer <= 0) state.phase = "playing";
    }

    const simulating =
      state.phase === "playing" || state.phase === "bossIntro" || state.phase === "bossDefeated";

    if (!simulating) {
      presentation(dt);
      return;
    }

    // ---- Player ----------------------------------------------------------
    if (player.alive) {
      const fireEvents = {
        onJump: () => {},
        onLand: () => {},
        onFire: (x: number, y: number, aimX: number, aimY: number, weapon: never) => {
          sound("fire");
          projectiles.spawn(x, y, aimX, aimY, weapon, false);
          castFlash = 1;
          recoil = 1;
          fx.spray(x, y, 4, PALETTE.arcane, aimX, aimY, 0.7, 5);
          cameraRig.addShake(0.05);
        },
        onWeaponExpired: () => {},
      };

      updatePlayer(player, input, dt, {
        onJump: (x, y) => {
          sound("jump");
          fx.spray(x, y, 6, PALETTE.arcaneDeep, 0, -1, 1.4, 3);
        },
        onLand: (x, y, impact) => {
          sound("land");
          fx.spray(x, y, Math.min(12, 4 + impact * 0.4), PALETTE.paperEdge, 0, 1, 2.6, 3.2);
          cameraRig.addShake(Math.min(0.25, impact * 0.012));
        },
        onFire: fireEvents.onFire,
        onWeaponExpired: () => {
          fx.burst(player.x, player.y + 1, 8, PALETTE.arcaneDeep, 3.5, 7);
        },
        onDash: (x, y, dir) => {
          // A dash is felt at the wrist, not seen. A whoosh + a plume of
          // motes trailing behind the direction of travel, plus a mild
          // shake, is all it needs to read as "you moved fast, on purpose".
          sound("jump");
          fx.spray(x, y + 0.4, 14, PALETTE.arcane, -dir, 0, 2.2, 8);
          fx.spray(x, y + 0.6, 8, PALETTE.arcaneCore, -dir, 0.3, 1.6, 6);
          cameraRig.addShake(0.14);
        },
      });
      tryFire(player, input, fireEvents);
    }

    // ---- Enemies ---------------------------------------------------------
    enemies.update(dt, player, projectiles, fx, state.elapsed, (amount) => cameraRig.addShake(amount));
    drainBossQueues(dt);
    projectiles.update(dt, enemies.list, fx);

    // ---- Collisions ------------------------------------------------------
    syncPlayerBox();

    // Friendly projectiles vs enemies.
    for (const p of projectiles.list) {
      if (!p.active || p.hostile) continue;
      for (let ei = 0; ei < enemies.list.length; ei++) {
        const e = enemies.list[ei];
        if (!e.active) continue;
        if (p.piercing && alreadyHit(p, ei)) continue;

        const spec = ENEMIES[e.kind];
        enemyBox.x = e.x;
        enemyBox.y = e.y + spec.halfH * 0.5;
        enemyBox.halfW = spec.halfW;
        enemyBox.halfH = spec.halfH;

        if (!circleHitsBox(p.x, p.y, p.radius, enemyBox)) continue;

        const isBoss = (BOSS_KINDS as string[]).includes(e.kind);
        const wasAlive = e.active;
        const died = enemies.damage(ei, p.damage, p.x, fx);
        sound(died ? "kill" : "hit");
        state.hitstop = Math.max(
          state.hitstop,
          died ? FEEL.hitstopOnKill : isBoss ? FEEL.hitstopOnBossHit : 0,
        );
        cameraRig.addShake(died ? FEEL.shakeOnKill : 0.05);

        // Pogo. A downward shot that hits ANYTHING while the player is
        // airborne bounces the player back up. That single mechanic reshapes
        // the whole game: you can chain-bounce across a pit of spikes, stay
        // above the Gorge Mother's landing shockwave by pogoing her, and
        // reach ledges you can't get to with a normal jump.
        //
        // The check is on the projectile's velocity, not the player's aim
        // at the moment of impact — a projectile in flight belongs to the
        // aim it left the mage with, not to wherever the stick is now.
        if (
          !player.onGround &&
          player.alive &&
          p.vy < 0 &&
          Math.abs(p.vy) > Math.abs(p.vx) * 0.85
        ) {
          const bounced = pogoBounce(player, {
            onJump: () => {},
            onLand: () => {},
            onFire: () => {},
            onWeaponExpired: () => {},
            onPogo: (px, py) => {
              sound("jump");
              fx.spray(px, py - 0.2, 10, PALETTE.arcane, 0, -1, 1.6, 6);
              fx.shockwave(px, py - 0.1, PALETTE.arcaneCore, 1.2, 0.24);
              cameraRig.addShake(0.18);
            },
          });
          if (bounced) state.hitstop = Math.max(state.hitstop, 0.05);
        }

        if (died && wasAlive) {
          bumpCombo();
          addScore(spec.score);
          if (isBoss) {
            onBossKilled(e.x, e.y);
          } else {
            pickups.rollDrop(e.x, e.y + 0.5, spec.dropChance);
          }
        }

        if (p.piercing) {
          markHit(p, ei);
        } else {
          p.active = false;
          break;
        }
      }
    }

    // Hostile projectiles vs player.
    if (player.alive && state.phase === "playing") {
      for (const p of projectiles.list) {
        if (!p.active || !p.hostile) continue;
        if (!circleHitsBox(p.x, p.y, p.radius, playerBox)) continue;
        p.active = false;
        hurtPlayer(p.x);
      }
    }

    // Bodies, boss hazards and the room's own spikes.
    if (player.alive && player.invulnerable <= 0 && state.phase === "playing") {
      for (const h of hazards) {
        if (h.groundOnly && !player.onGround) continue;
        const dx = player.x - h.x;
        const dy = player.y + PLAYER.halfH - h.y;
        if (h.groundOnly ? Math.abs(dx) < h.radius : dx * dx + dy * dy < h.radius * h.radius) {
          hurtPlayer(h.x);
          break;
        }
      }
    }

    if (player.alive && player.invulnerable <= 0 && state.phase === "playing") {
      if (hitsHazard(playerBox)) {
        // Static spikes throw you back the way you came, so a spike bed is a
        // cost rather than a death sentence.
        hurtPlayer(player.x - player.facing * 2, 0.6);
      }
    }

    if (player.alive && player.invulnerable <= 0 && state.phase === "playing") {
      for (const e of enemies.list) {
        if (!e.active) continue;
        const spec = ENEMIES[e.kind];
        enemyBox.x = e.x;
        enemyBox.y = e.y + spec.halfH * 0.5;
        enemyBox.halfW = spec.halfW;
        enemyBox.halfH = spec.halfH;
        if (!boxesOverlap(playerBox, enemyBox)) continue;
        // The Choir has no contact damage — it is a pure bullet fight.
        if (e.kind === "lumenChoir") continue;
        hurtPlayer(e.x);
        break;
      }
    }

    // Pickups.
    pickups.update(dt, player, state.elapsed);
    if (player.alive) {
      for (const p of pickups.list) {
        if (!p.active) continue;
        const dx = p.x - player.x;
        const dy = p.y - (player.y + PLAYER.halfH);
        if (dx * dx + dy * dy > (PICKUP.radius + PLAYER.halfW + 0.3) ** 2) continue;
        p.active = false;
        applyPickup(p.kind, p.x, p.y);
      }
    }

    // ---- Bench -----------------------------------------------------------
    const room = world.room;
    if (room.bench && player.alive && player.onGround) {
      const near = Math.abs(player.x - room.bench.x) < 2.2;
      if (near) {
        benchTimer += dt;
        // Half a second of standing still, so you don't save by walking past.
        if (benchTimer > 0.5 && (player.hearts < PLAYER.maxHearts || progress.bench !== room.id)) {
          restAtBench();
          benchTimer = -3;
        }
      } else {
        benchTimer = 0;
      }
    } else {
      benchTimer = 0;
    }

    // ---- Falling out of the world ---------------------------------------
    if (player.y < -14 && player.alive) {
      const hit = world.gateAt(player.x, player.y);
      if (!hit) {
        // No pit gate here: it was a mistake, not a route. Cost a heart and
        // put them back on the floor rather than killing them outright.
        player.y = 1.0;
        player.vy = 0;
        player.x = Math.max(ARENA_STATE.minX + 3, Math.min(ARENA_STATE.maxX - 3, player.x));
        hurtPlayer(player.x, 0.5);
      }
    }

    // ---- Gates -----------------------------------------------------------
    if (player.alive && state.phase === "playing" && !ARENA_STATE.sealed && state.gateGrace <= 0) {
      const hit = world.gateAt(player.x, player.y);
      if (hit) {
        if (hit.open) {
          beginTransition(hit.gate.to, hit.gate.toGate);
        } else if (!state.blockedGate) {
          state.blockedGate = {
            label: hit.gate.sealLabel ?? "Sealed",
            pro: hit.reason === "pro",
          };
          fx.burst(player.x, player.y + 1, 10, PALETTE.gold, 5, 8);
          cameraRig.addShake(0.2);
          sound("sealed");
          if (hit.reason === "pro") options.onLocked?.(hit.gate.to);
          // Push them back off the door so it doesn't retrigger every frame.
          player.vx = hit.gate.side === "left" ? 7 : hit.gate.side === "right" ? -7 : 0;
          if (hit.gate.side === "top") player.vy = -4;
          if (hit.gate.side === "bottom") {
            // A locked pit has nothing to bounce off. Put them on the ledge
            // beside it rather than leaving them falling through a sealed
            // floor forever.
            player.x = world.ledgeBeside(hit.gate);
            player.y = 1.2;
            player.vx = 0;
            player.vy = 0;
          }
        }
      }
    }

    if (!player.alive) die();

    presentation(dt);
  }

  function publishHud(): void {
    const boss = enemies.boss();
    const room = world.room;

    hud.phase = state.phase;
    hud.hearts = player.hearts;
    // Player.maxHearts is dynamic — it starts at PLAYER.maxHearts and
    // grows by progress.bonusMaxHearts when the shop's Vessel Fragment
    // is bought. Reading it off the player rather than the const is what
    // makes the hearts row render correctly after a purchase.
    hud.maxHearts = player.maxHearts;
    hud.score = state.score;
    hud.combo = state.combo;
    hud.weapon = player.weapon;
    hud.weaponTimer = player.weaponTimer;

    hud.roomId = room.id;
    hud.roomName = room.name;
    hud.roomTitle = state.roomTitleTimer;
    hud.atBench = benchTimer > 0.5;

    hud.bossActive = boss !== null;
    hud.bossHp = boss ? boss.hp : 0;
    hud.bossMaxHp = boss ? boss.maxHp : 1;
    hud.bossName = boss ? room.bossName ?? "" : "";
    hud.bossTitle = boss ? room.bossTitle ?? "" : "";
    hud.bossInvulnerable = boss ? boss.invulnerable > 0 : false;

    hud.bossesDefeated = progress.bosses.length;
    hud.totalBosses = BOSS_ROOMS.length;
    hud.discovered = progress.discovered;
    hud.defeatedRooms = progress.bosses;
    hud.dashActive = player.dashTimer > 0;
    hud.dashReady = player.dashCooldown <= 0 && player.dashTimer <= 0;
    // Air dash is armed when the player is in the air and both gates are
    // clear: the cooldown has recovered AND the per-air-session charge
    // is still on. Lit here means "pressing JUMP now will burst you."
    hud.airDashArmed =
      !player.onGround &&
      player.airDashAvailable &&
      player.dashCooldown <= 0 &&
      player.dashTimer <= 0;
    hud.aimLatched = player.aimLatched;
    hud.sealed = state.blockedGate;
    hud.shield = player.shield;

    // Shop panel state. Only populated while the shop phase is active.
    // Everything the overlay needs to render sits in this object — the
    // React layer never reaches into the game state directly.
    if (state.phase === "shop" && state.pendingBoss) {
      hud.shop = {
        bossName: room.bossName ?? "",
        bossTitle: room.bossTitle ?? "",
        essence: state.score,
        purchased: state.shopPurchased,
        bonusMaxHearts: progress.bonusMaxHearts ?? 0,
      };
    } else {
      hud.shop = null;
    }
  }

  // ---- Public API --------------------------------------------------------

  return {
    input,
    hud,
    frame,

    resize(width: number, height: number) {
      cameraRig.fit(width, height);
    },

    buyShopItem(id) {
      if (state.phase !== "shop" || !state.pendingBoss) {
        return { ok: false, reason: "unknownItem" };
      }
      const result = tryBuyShopItem(
        id,
        state.shopPurchased,
        state.score,
        player,
        progress,
      );
      if (result.ok) {
        state.score = Math.max(0, state.score - result.cost);
        state.shopPurchased[id] = (state.shopPurchased[id] ?? 0) + 1;
        // Persist the buy immediately — bonus hearts and the deducted
        // essence should survive a hard app kill mid-shop.
        progress.essence = state.score;
        options.onProgress?.(progress);
        options.onShopBuy?.(id, result.cost);
      }
      publishHud();
      return result;
    },

    closeShop() {
      if (state.phase !== "shop" || !state.pendingBoss) return;
      const kind = state.pendingBoss;
      state.pendingBoss = null;
      // Kick off the actual fight. startBossFight re-seals the room and
      // spawns the boss with introTime seconds of invulnerability, same
      // as it always has.
      startBossFight(kind);
      publishHud();
    },

    start() {
      resetPlayer(player, {
        maxHearts: PLAYER.maxHearts + (progress.bonusMaxHearts ?? 0),
      });
      state.score = progress.essence;
      state.combo = 1;
      state.comboTimer = 0;
      state.hitstop = 0;
      state.elapsed = 0;
      state.fade = 0;
      state.fadeDir = 0;
      state.pendingGate = null;
      state.blockedGate = null;
      castFlash = 0;
      recoil = 0;
      benchTimer = 0;
      started = true;
      // Resume at the last bench. A brand-new save has bench = crossroads.
      enterRoom(progress.bench || START_ROOM, null);
      publishHud();
    },

    dispose() {
      // Skies are parented to the camera, not to `world`, so removing the
      // world group would leave them hanging off a camera that outlives this
      // screen.
      for (const sky of skies.values()) sky.root.removeFromParent();
      skies.clear();
      world.dispose();
      clearBossQueues();
      disposer.disposeAll();
      void started;
    },
  };
}

export { PALETTE } from "./art/palette";
export * from "./config";
export { BIOMES, BOSS_ROOMS, MAP_EXTENT, ROOMS, ROOM_IDS, getRoom } from "./world/rooms";
export type { GateSide } from "./world/rooms";
export type { HudSnapshot, InputState, Progress } from "./types";
