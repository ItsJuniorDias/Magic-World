import * as THREE from "three";
import { createRoomStage, type RoomStage } from "../art/roomStage";
import { createNpc, NPC_INTERACT_RADIUS, type NpcVisual } from "../art/npc";
import { PaperKit } from "../art/paper";
import { Disposer } from "../engine/Disposer";
import { BIOMES, arrivalPoint, findGate, getRoom, ROOMS, type Gate, type Room } from "../world/rooms";
import { npcsInRoom, type NpcPlacement } from "../world/npcs";
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
  update(cameraX: number, cameraY: number, elapsed: number, playerX: number, playerY: number): void;
  /** Somewhere safe to stand next to a locked pit. */
  ledgeBeside(gate: Gate): number;
  /** 0 = clear, 1 = black. */
  setFade(v: number): void;
  markBossDefeated(roomId: string): void;
  refreshGateSeals(): void;
  /**
   * Nearest NPC placement to the given world position within the
   * interact radius, or null. Cheap — there is at most one NPC per
   * room, so the "nearest" case is really "the room's NPC if we're
   * close enough".
   */
  nearestNpc(x: number, y: number): NpcPlacement | null;
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
  /**
   * A PaperKit shared with the top-level orchestrator. NPCs allocate
   * cards through this so their materials and geometries live under
   * the same disposer as the mage and the boss. Rooms build their own
   * kits (per-biome caches), so NPCs deliberately DON'T reuse the
   * room's kit — they persist across room transitions in memory even
   * if invisible, which would leak the fungal palette into ember.
   */
  npcKit: PaperKit,
): WorldSystem {
  const root = new THREE.Group();
  root.name = "world";
  scene.add(root);

  let room: Room = getRoom("crossroads");
  let stage: RoomStage | null = null;
  /**
   * Live NPC visuals in the current room. Rebuilt on every enter()
   * because the room they belong to is being torn down. Two-tuple
   * so we can walk them in update() without a Map lookup per frame.
   */
  const npcs: { placement: NpcPlacement; visual: NpcVisual }[] = [];

  function disposeNpcs(): void {
    for (const n of npcs) n.visual.dispose();
    npcs.length = 0;
  }

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
      disposeNpcs();

      room = getRoom(roomId);
      setActiveRoom(room);
      setSealed(false);

      stage = createRoomStage(room);
      root.add(stage.root);
      applySeals();

      // NPCs. Placed on the floor at their scripted x. A boss room has
      // no NPC placements, so this loop is a no-op there.
      for (const placement of npcsInRoom(roomId)) {
        const visual = createNpc(npcKit, placement.x, placement.hue);
        stage.root.add(visual.root);
        npcs.push({ placement, visual });
      }

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

    update(cameraX, cameraY, elapsed, playerX, playerY) {
      stage?.update(cameraX, cameraY, elapsed);
      // NPC visuals: tell each one whether the player is inside its
      // interaction radius so the prompt lights up. Position update is
      // just the bob — NPCs don't move.
      for (const n of npcs) {
        const dx = playerX - n.placement.x;
        const dy = playerY + 0.9 - 1.2; // roughly chest-height difference
        const near = Math.hypot(dx, dy) < NPC_INTERACT_RADIUS;
        n.visual.setNear(near);
        n.visual.update(elapsed, playerX, playerY);
      }
    },

    ledgeBeside,

    nearestNpc(x, y) {
      for (const n of npcs) {
        const dx = x - n.placement.x;
        const dy = y + 0.4 - 1.0;
        if (Math.hypot(dx, dy) < NPC_INTERACT_RADIUS) return n.placement;
      }
      return null;
    },

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
      disposeNpcs();
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
