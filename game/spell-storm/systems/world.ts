import * as THREE from "three";
import { createRoomStage, type RoomStage } from "../art/roomStage";
import { BIOMES, arrivalPoint, findGate, getRoom, ROOMS, type Gate, type Room } from "../world/rooms";
import type { Progress } from "../types";
import { setActiveRoom, setSealed } from "./arena";

/**
 * Owns which room the player is in and everything that follows from that.
 *
 * A ROOM TRANSITION IS THREE THINGS AT ONCE
 *
 *   1. A frame budget spike. Building a room is 60–140 extrusions, which is
 *      several frames of work. It has to happen while the screen is black.
 *   2. A teleport. The player's position changes by tens of world units, so
 *      the camera has to snap rather than lerp (see CAMERA.teleportDistance).
 *   3. A state reset. Enemies, projectiles and pickups from the old room are
 *      not carried across — a bat that follows you through a door reads as a
 *      bug even when it would be technically defensible.
 *
 * All three are hidden behind a ~0.26s fade, which is also long enough to
 * read the room name card that fades in on the other side. That card is
 * doing real work: it is the only thing that tells a player who has been
 * wandering for ten minutes that they have arrived somewhere new.
 *
 * WHY GATES ARE LOCKED IN THE WORLD RATHER THAN IN A MODAL
 *
 * A sealed door you can walk up to, look at, and walk away from is content.
 * A dialog that appears when you try to leave is an interruption. The two
 * cost the same to build. The sealed art keeps the same silhouette as an
 * open door precisely so the player files it as "later", not as "wall".
 */

export interface GateHit {
  gate: Gate;
  open: boolean;
  reason: "pro" | "requires" | null;
}

export interface WorldSystem {
  root: THREE.Group;
  readonly room: Room;
  readonly stage: RoomStage;
  /** Build and enter a room. `fromGate` is the gate id in the NEW room. */
  enter(roomId: string, fromGate: string | null): { x: number; y: number };
  /** Gate the body is currently inside, if any. */
  gateAt(x: number, y: number): GateHit | null;
  update(cameraX: number, cameraY: number, elapsed: number): void;
  /** Somewhere safe to stand next to a locked pit. */
  ledgeBeside(gate: Gate): number;
  /** 0 = clear, 1 = black. */
  setFade(v: number): void;
  markBossDefeated(roomId: string): void;
  refreshGateSeals(): void;
  dispose(): void;
}

export interface WorldOptions {
  progress: Progress;
  isPro: boolean;
  /** Called whenever progress changes, so the screen can persist it. */
  onProgress?: (p: Progress) => void;
}

export function createWorld(
  scene: THREE.Scene,
  camera: THREE.OrthographicCamera,
  viewWidth: number,
  viewHeight: number,
  options: WorldOptions,
): WorldSystem {
  const root = new THREE.Group();
  root.name = "world";
  scene.add(root);

  let room: Room = getRoom("crossroads");
  let stage: RoomStage | null = null;

  // ---- Fade quad ---------------------------------------------------------
  // Parented to the camera so it covers the screen regardless of where the
  // camera is. Oversized by 2.4x so camera shake during a transition can
  // never reveal an edge.
  const fadeGeo = new THREE.PlaneGeometry(viewWidth * 2.4, viewHeight * 2.4);
  const fadeMat = new THREE.MeshBasicMaterial({
    color: 0x05030a,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const fadeQuad = new THREE.Mesh(fadeGeo, fadeMat);
  // In front of the camera, not behind it. A child at +Z is behind an ortho
  // camera's near plane and is clipped away — the fade was silently never
  // drawing, which is why room transitions cut rather than faded.
  fadeQuad.position.z = -1;
  fadeQuad.renderOrder = 9999;
  fadeQuad.visible = false;
  camera.add(fadeQuad);
  if (!scene.children.includes(camera)) scene.add(camera);

  function gateOpen(g: Gate): { open: boolean; reason: "pro" | "requires" | null } {
    if (g.pro && !options.isPro) return { open: false, reason: "pro" };
    if (g.requires && options.progress.bosses.length < g.requires) {
      return { open: false, reason: "requires" };
    }
    return { open: true, reason: null };
  }

  /** Solid ground beside a pit, for bouncing a player off a locked bottom gate. */
  function ledgeBeside(gate: Gate): number {
    const side = gate.at >= (room.minX + room.maxX) * 0.5 ? -1 : 1;
    const x = gate.at + side * (gate.size * 0.5 + 3.5);
    return Math.max(room.minX + 2.5, Math.min(room.maxX - 2.5, x));
  }

  function applySeals(): void {
    if (!stage) return;
    for (const g of room.gates) stage.setGateOpen(g.id, gateOpen(g).open);
  }

  return {
    root,

    get room() {
      return room;
    },

    get stage() {
      // Callers only reach for this after enter(), which always builds one.
      return stage as RoomStage;
    },

    enter(roomId, fromGate) {
      if (stage) {
        stage.dispose();
        stage = null;
      }

      room = getRoom(roomId);
      setActiveRoom(room);
      setSealed(false);

      stage = createRoomStage(room);
      root.add(stage.root);
      applySeals();

      if (!options.progress.discovered.includes(roomId)) {
        options.progress.discovered.push(roomId);
        options.onProgress?.(options.progress);
      }

      // A boss room whose boss is already dead keeps its bench-like calm:
      // nothing spawns, the gate stays open.
      const gate = fromGate ? findGate(room, fromGate) : null;
      if (gate) return arrivalPoint(room, gate);
      if (room.bench) return { x: room.bench.x, y: 0 };
      return { x: (room.minX + room.maxX) * 0.5, y: 0 };
    },

    gateAt(x, y) {
      for (const g of room.gates) {
        const { open, reason } = gateOpen(g);
        let inside = false;
        switch (g.side) {
          case "left":
            inside = x <= room.minX + 1.4 && Math.abs(y + 0.8 - g.at) < g.size * 0.5;
            break;
          case "right":
            inside = x >= room.maxX - 1.4 && Math.abs(y + 0.8 - g.at) < g.size * 0.5;
            break;
          case "top":
            inside = y >= room.ceilingY - 3.2 && Math.abs(x - g.at) < g.size * 0.5;
            break;
          case "bottom":
            // You reach a bottom gate by FALLING through a hole in the floor.
            inside = y <= -3.5 && Math.abs(x - g.at) < g.size * 0.5 + 2.5;
            break;
        }
        if (inside) return { gate: g, open, reason };
      }
      return null;
    },

    update(cameraX, cameraY, elapsed) {
      stage?.update(cameraX, cameraY, elapsed);
    },

    ledgeBeside,

    setFade(v) {
      const clamped = Math.max(0, Math.min(1, v));
      fadeMat.opacity = clamped;
      fadeQuad.visible = clamped > 0.002;
    },

    markBossDefeated(roomId) {
      if (options.progress.bosses.includes(roomId)) return;
      options.progress.bosses.push(roomId);
      options.onProgress?.(options.progress);
      applySeals();
    },

    refreshGateSeals() {
      applySeals();
    },

    dispose() {
      stage?.dispose();
      stage = null;
      fadeQuad.removeFromParent();
      fadeGeo.dispose();
      fadeMat.dispose();
      root.removeFromParent();
    },
  };
}

/** Sky gradient for a room's biome. */
export function skyStopsFor(roomId: string): readonly number[] {
  const r = ROOMS[roomId];
  return BIOMES[r ? r.biome : "hollow"].sky;
}
