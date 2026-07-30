import * as THREE from "three";
import {
  ARENA,
  COMBO,
  ENEMIES,
  FEEL,
  GOLEM,
  PICKUP,
  PLAYER,
  WAVES,
  type PickupKind,
} from "./config";
import { createFx } from "./art/fx";
import { createMage } from "./art/mage";
import { PALETTE } from "./art/palette";
import { PaperKit } from "./art/paper";
import { createSky } from "./art/sky";
import { createStage } from "./art/stage";
import { Disposer } from "./engine/Disposer";
import { createInputState } from "./engine/input";
import { createCameraRig } from "./systems/camera";
import { createEnemies, pendingEggs } from "./systems/enemies";
import { boxesOverlap, circleHitsBox } from "./systems/physics";
import { createPickups } from "./systems/pickups";
import { alreadyHit, createProjectiles, markHit } from "./systems/projectiles";
import {
  createPlayer,
  damagePlayer,
  grantWeapon,
  healPlayer,
  resetPlayer,
  shouldBlink,
  tryFire,
  updatePlayer,
} from "./systems/player";
import { composeWave, isWaveLocked, spawnPointFor } from "./systems/waves";
import type {
  AABB,
  GameContext,
  GameHandle,
  GameState,
  HudSnapshot,
  InputState,
  PoseLike,
} from "./types";

export interface SpellStormOptions {
  /** Whether the player holds an active subscription. Gates wave 11+. */
  isPro: boolean;
  /** Called once when the run ends, for persistence and analytics. */
  onRunEnd?: (result: { score: number; wave: number; victory: boolean }) => void;
  /** Called when a locked wave is reached, so the screen can offer the paywall. */
  onLocked?: (score: number, wave: number) => void;
  /** Fired for one-shot sound effects. Kept out of the engine deliberately. */
  onSound?: (id: SoundId) => void;
}

export type SoundId =
  | "fire"
  | "jump"
  | "land"
  | "hit"
  | "kill"
  | "hurt"
  | "pickup"
  | "waveStart"
  | "bossRoar"
  | "gameover";

export interface SpellStorm extends GameHandle {
  readonly input: InputState;
}

export function createSpellStorm(ctx: GameContext, options: SpellStormOptions): SpellStorm {
  const disposer = new Disposer();
  const kit = new PaperKit(disposer);

  // ---- Scene graph -------------------------------------------------------
  const world = new THREE.Group();
  world.name = "world";
  ctx.scene.add(world);

  const sky = createSky(kit, disposer, ctx.camera, ctx.viewWidth, ctx.viewHeight);
  const stage = createStage(kit, disposer);
  world.add(stage.root);

  const fx = createFx(kit, disposer);
  world.add(fx.root);

  const enemies = createEnemies(kit);
  world.add(enemies.root);

  const projectiles = createProjectiles(kit);
  world.add(projectiles.root);

  const pickups = createPickups(kit);
  world.add(pickups.root);

  const mage = createMage(kit);
  world.add(mage.root);

  const cameraRig = createCameraRig(ctx.camera);

  // ---- State -------------------------------------------------------------
  const input = createInputState();
  const player = createPlayer();
  const state: GameState = {
    phase: "ready",
    wave: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    intermissionTimer: 0,
    hitstop: 0,
    shake: 0,
    elapsed: 0,
    bossActive: false,
  };

  const hud: HudSnapshot = {
    phase: "ready",
    hearts: PLAYER.startHearts,
    score: 0,
    wave: 0,
    combo: 1,
    weapon: "bolt",
    weaponTimer: 0,
    bossHp: 0,
    bossMaxHp: 1,
    bossActive: false,
  };

  let castFlash = 0;
  let recoil = 0;
  let spawnIndex = 0;
  let runEnded = false;

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

  function startWave(wave: number): void {
    state.wave = wave;

    if (isWaveLocked(wave, options.isPro)) {
      state.phase = "locked";
      options.onLocked?.(state.score, wave);
      return;
    }

    const composition = composeWave(wave);
    state.spawnQueue = composition.queue;
    state.spawnTimer = 0.35;
    state.bossActive = composition.isBoss;
    spawnIndex = 0;
    state.phase = "playing";
    sound(composition.isBoss ? "bossRoar" : "waveStart");
  }

  function endRun(victory: boolean): void {
    if (runEnded) return;
    runEnded = true;
    state.phase = victory ? "victory" : "gameover";
    sound("gameover");
    options.onRunEnd?.({ score: state.score, wave: state.wave, victory });
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

  // ---- Frame -------------------------------------------------------------

  function frame(dt: number): void {
    state.elapsed += dt;
    pose.time = state.elapsed;

    // Hitstop freezes the simulation but not the presentation. The camera
    // still shakes and particles still move, so the freeze reads as impact
    // rather than as a dropped frame.
    if (state.hitstop > 0) {
      state.hitstop = Math.max(0, state.hitstop - dt);
      fx.update(dt);
      cameraRig.update(dt, player.x, player.y, player.vx, PLAYER.maxSpeed);
      stage.update(cameraRig.focusX, state.elapsed);
      sky.update(dt, state.elapsed, cameraRig.focusX);
      publishHud();
      return;
    }

    castFlash = Math.max(0, castFlash - dt * 7);
    recoil = Math.max(0, recoil - dt * 6);

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }

    // ---- Phase machine ---------------------------------------------------
    if (state.phase === "intermission") {
      state.intermissionTimer -= dt;
      if (state.intermissionTimer <= 0) startWave(state.wave + 1);
    } else if (state.phase === "playing") {
      // Drip enemies in rather than dumping the wave at once.
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && enemies.countActive() < WAVES.maxConcurrent) {
          const kind = state.spawnQueue.shift()!;
          const point = spawnPointFor(kind, spawnIndex, ARENA.halfWidth);
          spawnIndex += 1;
          const spawned = enemies.spawn(kind, point.x, point.y);
          if (spawned) {
            fx.burst(point.x, point.y, 8, PALETTE.arcaneDeep, 4, 8);
          } else {
            // Visual pool was full; try again shortly instead of losing it.
            state.spawnQueue.unshift(kind);
          }
          state.spawnTimer = WAVES.spawnInterval;
        }
      } else if (enemies.countActive() === 0) {
        // Wave cleared.
        addScore(250 + state.wave * 50);
        state.bossActive = false;
        state.phase = "intermission";
        state.intermissionTimer = WAVES.intermission;
      }
    }

    const simulating = state.phase === "playing" || state.phase === "intermission";

    // ---- Player ----------------------------------------------------------
    if (simulating && player.alive) {
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
        onFire: (x, y, aimX, aimY, weapon) => {
          sound("fire");
          projectiles.spawn(x, y, aimX, aimY, weapon, false);
          castFlash = 1;
          recoil = 1;
          fx.spray(x, y, 4, PALETTE.arcane, aimX, aimY, 0.7, 5);
          cameraRig.addShake(0.05);
        },
        onWeaponExpired: () => {
          fx.burst(player.x, player.y + 1, 8, PALETTE.arcaneDeep, 3.5, 7);
        },
      });
      tryFire(player, input, {
        onJump: () => {},
        onLand: () => {},
        onFire: (x, y, aimX, aimY, weapon) => {
          sound("fire");
          projectiles.spawn(x, y, aimX, aimY, weapon, false);
          castFlash = 1;
          recoil = 1;
          fx.spray(x, y, 4, PALETTE.arcane, aimX, aimY, 0.7, 5);
          cameraRig.addShake(0.05);
        },
        onWeaponExpired: () => {},
      });
    }

    // ---- Enemies ---------------------------------------------------------
    if (simulating) {
      enemies.update(dt, player, projectiles, fx, state.elapsed);

      // Dragon eggs, drained here to avoid a circular dependency.
      while (pendingEggs.length > 0) {
        const egg = pendingEggs.pop()!;
        enemies.spawn("slime", egg.x, egg.y);
        fx.burst(egg.x, egg.y, 8, PALETTE.dragonBelly, 4, 8);
      }
    }

    projectiles.update(dt, enemies.list, fx);

    // ---- Collisions ------------------------------------------------------
    if (simulating) {
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

          const isBoss = e.kind === "dragon";
          const died = enemies.damage(ei, p.damage, p.x, fx);
          sound(died ? "kill" : "hit");
          state.hitstop = Math.max(
            state.hitstop,
            died ? FEEL.hitstopOnKill : isBoss ? FEEL.hitstopOnBossHit : 0,
          );
          cameraRig.addShake(died ? FEEL.shakeOnKill : 0.05);

          if (died) {
            bumpCombo();
            addScore(spec.score);
            pickups.rollDrop(e.x, e.y + 0.5, spec.dropChance);
            if (isBoss) {
              cameraRig.addShake(FEEL.shakeOnBossLand);
              state.hitstop = 0.3;
              state.bossActive = false;
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
      if (player.alive) {
        for (const p of projectiles.list) {
          if (!p.active || !p.hostile) continue;
          if (!circleHitsBox(p.x, p.y, p.radius, playerBox)) continue;
          p.active = false;
          if (damagePlayer(player, p.x)) {
            sound("hurt");
            state.hitstop = FEEL.hitstopOnPlayerHit;
            cameraRig.addShake(FEEL.shakeOnPlayerHit);
            fx.burst(player.x, player.y + PLAYER.halfH, 14, PALETTE.danger, 6, 10);
            state.combo = 1;
            state.comboTimer = 0;
          }
        }
      }

      // Enemy contact and the golem shockwave.
      if (player.alive && player.invulnerable <= 0) {
        for (const e of enemies.list) {
          if (!e.active) continue;
          const spec = ENEMIES[e.kind];

          if (e.kind === "golem" && e.timer2 > 0) {
            // The slam damages by radius on the ground, not by body overlap,
            // so it reaches further than the golem itself — which is the
            // whole point of telegraphing it.
            e.timer2 = 0;
            const dx = Math.abs(player.x - e.x);
            if (dx < GOLEM.slamShockwaveRadius && player.onGround) {
              if (damagePlayer(player, e.x)) {
                sound("hurt");
                state.hitstop = FEEL.hitstopOnPlayerHit;
                cameraRig.addShake(FEEL.shakeOnPlayerHit);
                state.combo = 1;
              }
              break;
            }
          }

          enemyBox.x = e.x;
          enemyBox.y = e.y + spec.halfH * 0.5;
          enemyBox.halfW = spec.halfW;
          enemyBox.halfH = spec.halfH;
          if (!boxesOverlap(playerBox, enemyBox)) continue;

          if (damagePlayer(player, e.x)) {
            sound("hurt");
            state.hitstop = FEEL.hitstopOnPlayerHit;
            cameraRig.addShake(FEEL.shakeOnPlayerHit);
            fx.burst(player.x, player.y + PLAYER.halfH, 14, PALETTE.danger, 6, 10);
            state.combo = 1;
            state.comboTimer = 0;
          }
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

      if (!player.alive) endRun(false);
    }

    // ---- Presentation ----------------------------------------------------
    fx.update(dt);
    enemies.render(state.elapsed);

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
    mage.setVisible(player.alive && !shouldBlink(player));

    cameraRig.update(dt, player.x, player.y, player.vx, PLAYER.maxSpeed);
    stage.update(cameraRig.focusX, state.elapsed);
    sky.update(dt, state.elapsed, cameraRig.focusX);

    publishHud();
  }

  function publishHud(): void {
    const boss = enemies.boss();
    hud.phase = state.phase;
    hud.hearts = player.hearts;
    hud.score = state.score;
    hud.wave = state.wave;
    hud.combo = state.combo;
    hud.weapon = player.weapon;
    hud.weaponTimer = player.weaponTimer;
    hud.bossActive = boss !== null;
    hud.bossHp = boss ? boss.hp : 0;
    hud.bossMaxHp = boss ? boss.maxHp : 1;
  }

  // ---- Public API --------------------------------------------------------

  return {
    input,
    hud,

    frame,

    resize(width: number, height: number) {
      const aspect = width / height;
      const viewHeight = ctx.viewHeight;
      const viewWidth = viewHeight * aspect;
      ctx.camera.left = -viewWidth / 2;
      ctx.camera.right = viewWidth / 2;
      ctx.camera.top = viewHeight / 2;
      ctx.camera.bottom = -viewHeight / 2;
      ctx.camera.updateProjectionMatrix();
    },

    start() {
      resetPlayer(player);
      enemies.reset();
      projectiles.reset();
      pickups.reset();
      state.score = 0;
      state.combo = 1;
      state.comboTimer = 0;
      state.hitstop = 0;
      state.elapsed = 0;
      state.bossActive = false;
      state.spawnQueue = [];
      spawnIndex = 0;
      runEnded = false;
      castFlash = 0;
      recoil = 0;
      cameraRig.reset(0, ARENA.floorY);
      startWave(1);
      publishHud();
    },

    dispose() {
      // Detach the sky from the camera explicitly: it is parented to the
      // camera, not to `world`, so removing the world group would leave it
      // hanging off a camera that outlives this screen.
      sky.root.removeFromParent();
      world.removeFromParent();
      disposer.disposeAll();
    },
  };
}

export { PALETTE } from "./art/palette";
export * from "./config";
export type { HudSnapshot, InputState } from "./types";
