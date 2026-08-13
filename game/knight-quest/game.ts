import * as THREE from "three";
import { COLORS, PLAYER, RENDER } from "./config";
import { FxSystem, tickFlashes } from "./art/fx";
import { startMusic } from "./engine/audio";
import { createInputState, endFrame } from "./engine/input";
import { loadAll, preloadWeapons } from "./engine/loader";
import { BossSystem } from "./systems/boss";
import { CameraRig } from "./systems/camera";
import { EnemySystem } from "./systems/enemies";
import { PickupSystem } from "./systems/pickups";
import { createPlayer, playerCheer, reviveAtStart, updatePlayer } from "./systems/player";
import { ProjectileSystem } from "./systems/projectiles";
import { PropsSystem } from "./systems/props";
import { RoomManager } from "./systems/rooms";
import type { GameEvents, InputState } from "./types";
import { buildWorld, tileCenter, updateTorches } from "./world/builder";
import { BOSS_ROOM_KEY, START_ROOM_KEY, roomAt } from "./world/dungeon";

// ---------------------------------------------------------------------------
// createKnightQuest — the game as a single opaque handle.
//
// RN-friendly equivalent of the web build's src/main.ts:
//   - receives a scene/renderer already wired by useKnightQuestGame
//   - returns a `KnightQuestGame` handle with frame/resize/restart/dispose
//   - exposes an InputState the touch UI writes into
//   - exposes a HudSnapshot the React layer polls at ~10Hz
// ---------------------------------------------------------------------------

export interface KnightQuestContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  pixelWidth: number;
  pixelHeight: number;
}

/** Snapshot of everything the HUD wants to draw. Polled at ~10Hz by React. */
export interface HudSnapshot {
  halfHearts: number;
  maxHalfHearts: number;
  coins: number;
  hasBossKey: boolean;
  bossHpFrac: number | null;
  roomKey: string;
  roomName: string;
  toast: string | null;
  toastId: number;
  isDead: boolean;
  isVictory: boolean;
  visitedRooms: string[];
}

export interface KnightQuestGame {
  input: InputState;
  hud: HudSnapshot;
  frame(dt: number): void;
  resize(w: number, h: number): void;
  restart(): void;
  dispose(): void;
  requestInteract(): void;
}

export async function createKnightQuest(
  ctx: KnightQuestContext,
  onLoadProgress: (done: number, total: number, label: string) => void,
): Promise<KnightQuestGame> {
  const { scene, camera, renderer, pixelWidth, pixelHeight } = ctx;

  // ---- scene chrome ------------------------------------------------------
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.Fog(COLORS.fog, 32, 90);

  // Ambient — brighter than the web build because we're not casting shadows
  // on RN (see config.ts note). Everything gets a solid base color so the
  // scene reads well even where the directional light doesn't reach.
  const ambient = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambient);

  // Hemisphere fill — a "sky above, ground below" natural fill that costs
  // nothing and gives Lambert materials a subtle color gradient across
  // surfaces. Warm sky, cool ground grounds the outdoor village nicely.
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x3a2a5a, 0.6);
  hemi.position.set(0, 50, 0);
  scene.add(hemi);

  // Directional "sun" for shape and depth. No shadows on RN — the shadow
  // map path swaps FBOs which expo-gl cannot present correctly.
  const sun = new THREE.DirectionalLight(COLORS.sun, 0.75);
  sun.position.set(30, 60, 20);
  if (RENDER.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.001;
  }
  scene.add(sun);

  // ---- load assets (progress-reported) ----------------------------------
  await preloadWeapons();
  await loadAll(onLoadProgress);

  // ---- build world -------------------------------------------------------
  const world = buildWorld(scene);
  const player = createPlayer(scene, world.playerStart);
  const input = createInputState();

  // ---- HUD snapshot (built BEFORE systems so events can close over it) ---
  const hud: HudSnapshot = {
    halfHearts: player.halfHearts,
    maxHalfHearts: PLAYER.maxHalfHearts,
    coins: 0,
    hasBossKey: false,
    bossHpFrac: null,
    roomKey: START_ROOM_KEY,
    roomName: "Willowvale Village",
    toast: null,
    toastId: 0,
    isDead: false,
    isVictory: false,
    visitedRooms: [START_ROOM_KEY],
  };
  let toastCounter = 0;

  // ---- event bus wiring --------------------------------------------------
  // Forward-declare boss reference so onRoomChanged can wake it on entry.
  let bossRef: BossSystem | null = null;

  const events: GameEvents = {
    onHudDirty: () => {
      hud.halfHearts = player.halfHearts;
      hud.coins = player.coins;
      hud.hasBossKey = player.hasBossKey;
    },
    onToast: (t) => {
      hud.toast = t;
      hud.toastId = ++toastCounter;
    },
    onBossBar: (frac) => {
      hud.bossHpFrac = frac;
    },
    onGameOver: () => {
      hud.isDead = true;
    },
    onVictory: () => {
      hud.isVictory = true;
      playerCheer(player);
    },
    onRoomChanged: (key) => {
      hud.roomKey = key;
      const def = roomAt(...(key.split(",").map(Number) as [number, number]));
      if (def) hud.roomName = def.name;
      if (!hud.visitedRooms.includes(key)) hud.visitedRooms = [...hud.visitedRooms, key];
      if (key === BOSS_ROOM_KEY && bossRef?.boss?.state === "waiting") bossRef.wake();
    },
  };

  // ---- systems -----------------------------------------------------------
  const fx = new FxSystem(scene);
  const pickups = new PickupSystem(scene, fx, events);
  const projectiles = new ProjectileSystem(scene, fx, events);
  const props = new PropsSystem(fx, events);
  const enemies = new EnemySystem(scene, fx, events);
  const boss = new BossSystem(scene, fx, events);
  bossRef = boss;

  const roomMgr = new RoomManager(world.rooms, START_ROOM_KEY, events);

  // boss lives dormant in the throne room, waking when player enters
  boss.spawn(world.bossSpawn);

  // pre-spawn enemies (dormant per-room; only active when in that room)
  for (const [, room] of world.rooms) {
    for (const s of room.enemySpawns) {
      enemies.spawnEnemy(s.kind, tileCenter(room.gx, room.gy, s.tx, s.tz), room.key);
    }
  }

  // ---- camera rig --------------------------------------------------------
  //
  // useKnightQuestGame handed us a PerspectiveCamera it built with the
  // right aspect. Our internal CameraRig owns the transform math. Each
  // frame we copy the rig's position/orientation onto the passed camera
  // so `renderer.render(scene, camera)` uses ours.
  const cam = new CameraRig(pixelWidth / pixelHeight);
  cam.snap(player.pos, roomMgr.current);
  copyCamera();
  function copyCamera(): void {
    camera.position.copy(cam.camera.position);
    camera.quaternion.copy(cam.camera.quaternion);
    camera.projectionMatrix.copy(cam.camera.projectionMatrix);
    camera.projectionMatrixInverse.copy(cam.camera.projectionMatrixInverse);
  }

  startMusic();

  let running = true;
  let interactRequested = false;

  function frame(dt: number): void {
    if (interactRequested) {
      input.interactPressed = true;
      interactRequested = false;
    }

    if (running) {
      updatePlayer(player, input, dt, roomMgr, fx, events);
      enemies.update(dt, player, roomMgr, projectiles, pickups);
      boss.update(dt, player, roomMgr, projectiles, props);
      projectiles.update(dt, player, roomMgr);
      pickups.update(dt, player);
      props.update(dt, player, input, roomMgr, pickups);

      if (input.interactPressed) roomMgr.tryUnlockNearbyDoor(player);

      roomMgr.update(dt, player, cam);
      cam.update(dt, player.pos, roomMgr.current);

      const now = performance.now() / 1000;
      updateTorches(roomMgr.current.key, now);
      fx.update(dt);

      const flashRoots: THREE.Object3D[] = [player.root];
      for (const e of enemies.enemies) flashRoots.push(e.root);
      if (boss.boss) flashRoots.push(boss.boss.root);
      tickFlashes(flashRoots, now);

      events.onHudDirty();
      endFrame(input, dt);

      if (hud.isDead || hud.isVictory) running = false;
    } else {
      // Death cheer / victory pose: still animate the player + camera.
      updatePlayer(player, input, dt, roomMgr, fx, events);
      cam.update(dt, player.pos, roomMgr.current);
    }

    copyCamera();
    renderer.render(scene, camera);
  }

  function resize(w: number, h: number): void {
    cam.resize(w / h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function restart(): void {
    enemies.clearAll();
    pickups.clearAll();
    projectiles.clearAll();
    for (const [, r] of world.rooms) {
      r.cleared = r.doors.length === 0 || (r.enemySpawns.length === 0 && !r.hasBoss);
      for (const s of r.enemySpawns) {
        enemies.spawnEnemy(s.kind, tileCenter(r.gx, r.gy, s.tx, s.tz), r.key);
      }
    }
    reviveAtStart(player, world.playerStart);
    roomMgr.current = world.rooms.get(START_ROOM_KEY)!;
    cam.snap(player.pos, roomMgr.current);
    hud.halfHearts = player.halfHearts;
    hud.coins = 0;
    hud.hasBossKey = false;
    hud.bossHpFrac = null;
    hud.isDead = false;
    hud.isVictory = false;
    hud.roomKey = START_ROOM_KEY;
    hud.roomName = "Willowvale Village";
    hud.visitedRooms = [START_ROOM_KEY];
    running = true;
  }

  function dispose(): void {
    running = false;
    enemies.clearAll();
    pickups.clearAll();
    projectiles.clearAll();
    // useKnightQuestGame handles renderer/scene disposal via Disposer.
  }

  return {
    input,
    hud,
    frame,
    resize,
    restart,
    dispose,
    requestInteract: () => { interactRequested = true; },
  };
}
