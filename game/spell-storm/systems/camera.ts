import * as THREE from "three";
import { CAMERA, FEEL } from "../config";
import { ARENA_STATE } from "./arena";
import { damp } from "./physics";

/**
 * Camera rig.
 *
 * Four decisions worth calling out:
 *
 * FRAMING. The rig owns the orthographic frustum, not just the position.
 * `fit()` derives the view box from the device aspect and clamps the WIDTH,
 * which is the single most important fix in this file. The old rig fixed
 * viewHeight at 15.5 and let width fall out of the aspect ratio — on a
 * landscape phone (aspect ~2.2) that is 34 world units of width, wider than
 * the entire 32wu arena the game used to have. The whole level fitted on one
 * screen, the camera never moved, and the map felt like a diorama.
 *
 * LOOK-AHEAD. The camera leads the player in the direction they are moving
 * rather than centring them. In a game where things shoot at you, the space
 * ahead is worth more than the space behind.
 *
 * THE VERTICAL DEADZONE. Vertical follow used to be a flat 0.42 multiplier
 * on the player's height, which is fine in a room 13wu tall and useless in a
 * shaft 62wu tall. It now follows fully, but only once the player has left a
 * deadzone band — otherwise the view pumps up and down on every small hop and
 * the horizon never settles.
 *
 * ROOM CLAMPING. The frustum is clamped inside the room's bounds so the void
 * outside a room is never visible. In rooms narrower or shorter than the
 * frustum the camera locks to the centre instead, which is why boss arenas
 * are authored at ~56wu: wide enough to move in, tight enough to stay framed.
 */

/**
 * The visible world box for a given surface size. Exported because the sky
 * and the engine both need it before a rig exists.
 */
export function computeView(pixelWidth: number, pixelHeight: number): {
  width: number;
  height: number;
  aspect: number;
} {
  const aspect = Math.max(0.2, pixelWidth / Math.max(1, pixelHeight));
  let height: number = CAMERA.viewHeight;
  if (height * aspect > CAMERA.maxViewWidth) {
    height = Math.max(CAMERA.minViewHeight, CAMERA.maxViewWidth / aspect);
  }
  return { width: height * aspect, height, aspect };
}

export interface CameraRig {
  update(dt: number, targetX: number, targetY: number, velocityX: number, maxSpeed: number): void;
  addShake(amount: number): void;
  /** Where the camera is actually looking, for parallax and the sky. */
  readonly focusX: number;
  readonly focusY: number;
  /** Half-extents of the visible box in world units. */
  readonly halfW: number;
  readonly halfH: number;
  /** Recompute the frustum for a new surface size. */
  fit(pixelWidth: number, pixelHeight: number): void;
  /** Pull back while a boss is alive. */
  setBossFraming(active: boolean): void;
  reset(x: number, y: number): void;
}

export function createCameraRig(camera: THREE.OrthographicCamera): CameraRig {
  let focusX = 0;
  let focusY: number = CAMERA.baseY;
  let lookAhead = 0;
  let shake = 0;

  let baseHalfW = 12;
  let baseHalfH = 7;
  let zoom = 1;
  let zoomTarget = 1;
  let aspect = 16 / 9;

  // The rig's fixed orientation. Everything below translates the camera in
  // world space while this stays constant, which keeps panning parallel to
  // the play plane no matter what the tilt is.
  const TILT_Y = THREE.MathUtils.degToRad(-7);
  const TILT_X = THREE.MathUtils.degToRad(-4);
  const DISTANCE = 120;

  const offset = new THREE.Vector3(
    Math.sin(-TILT_Y) * DISTANCE,
    Math.sin(-TILT_X) * DISTANCE,
    Math.cos(TILT_Y) * Math.cos(TILT_X) * DISTANCE,
  );

  function applyFrustum(): void {
    const halfW = baseHalfW * zoom;
    const halfH = baseHalfH * zoom;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }

  function fit(pixelWidth: number, pixelHeight: number): void {
    aspect = Math.max(0.2, pixelWidth / Math.max(1, pixelHeight));

    // Start from the authored height, then shrink it if that would reveal
    // more than maxViewWidth horizontally. On a 19.5:9 phone held landscape
    // this is the branch that actually runs.
    let height: number = CAMERA.viewHeight;
    if (height * aspect > CAMERA.maxViewWidth) {
      height = Math.max(CAMERA.minViewHeight, CAMERA.maxViewWidth / aspect);
    }
    baseHalfH = height / 2;
    baseHalfW = (height * aspect) / 2;
    applyFrustum();
  }

  /**
   * Keeps the visible box inside the room. When the room is smaller than the
   * box on an axis, lock to the room's centre on that axis — a camera that
   * pans inside a room it already fully contains just wobbles.
   */
  function clampToRoom(x: number, y: number): { x: number; y: number } {
    const halfW = baseHalfW * zoom;
    const halfH = baseHalfH * zoom;

    const minCX = ARENA_STATE.minX + halfW;
    const maxCX = ARENA_STATE.maxX - halfW;
    const outX = minCX > maxCX ? (ARENA_STATE.minX + ARENA_STATE.maxX) * 0.5 : Math.max(minCX, Math.min(maxCX, x));

    // The floor sits at y=0 but the ground card extends below it, so allow a
    // little headroom under the floor line before clamping.
    const minCY = ARENA_STATE.floorY - 1.2 + halfH;
    const maxCY = ARENA_STATE.ceilingY - halfH;
    const outY = minCY > maxCY ? (ARENA_STATE.floorY + ARENA_STATE.ceilingY) * 0.5 : Math.max(minCY, Math.min(maxCY, y));

    return { x: outX, y: outY };
  }

  function apply(x: number, y: number, shakeX: number, shakeY: number): void {
    camera.position.set(x + offset.x + shakeX, y + offset.y + shakeY, offset.z);
    camera.lookAt(x + shakeX, y + shakeY, 0);
  }

  applyFrustum();
  apply(0, CAMERA.baseY, 0, 0);

  return {
    get focusX() {
      return focusX;
    },
    get focusY() {
      return focusY;
    },
    get halfW() {
      return baseHalfW * zoom;
    },
    get halfH() {
      return baseHalfH * zoom;
    },

    fit,

    setBossFraming(active) {
      zoomTarget = active ? CAMERA.bossZoomOut : 1;
    },

    update(dt, targetX, targetY, velocityX, maxSpeed) {
      if (Math.abs(zoom - zoomTarget) > 0.0005) {
        zoom = damp(zoom, zoomTarget, CAMERA.bossZoomLerp, dt);
        applyFrustum();
      }

      // Look-ahead is itself smoothed, or the camera snaps every time the
      // player changes direction and the whole screen judders.
      const desiredLookAhead = (velocityX / Math.max(0.001, maxSpeed)) * CAMERA.lookAheadX;
      lookAhead = damp(lookAhead, desiredLookAhead, CAMERA.lookAheadLerp, dt);

      const desiredX = targetX + lookAhead;

      // Vertical deadzone: the player can drift this far from the resting
      // sightline before the camera commits to following.
      const sightline = targetY + CAMERA.baseY;
      let desiredY: number = focusY;
      if (sightline > focusY + CAMERA.deadzoneY) desiredY = sightline - CAMERA.deadzoneY;
      else if (sightline < focusY - CAMERA.deadzoneY) desiredY = sightline + CAMERA.deadzoneY;

      // A room transition moves the player by tens of units in one step.
      // Lerping across that would smear the whole screen, so snap instead.
      if (Math.hypot(desiredX - focusX, desiredY - focusY) > CAMERA.teleportDistance) {
        focusX = desiredX;
        focusY = desiredY;
        lookAhead = 0;
      } else {
        focusX = damp(focusX, desiredX, CAMERA.followLerp, dt);
        focusY = damp(focusY, desiredY, CAMERA.followLerpY, dt);
      }

      const clamped = clampToRoom(focusX, focusY);

      // Shake decays exponentially and is sampled from noise, not a sine —
      // a sine reads as a wobble, noise reads as an impact.
      let shakeX = 0;
      let shakeY = 0;
      if (shake > 0.001) {
        shake = damp(shake, 0, FEEL.shakeDecay, dt);
        const mag = Math.min(1, shake) * FEEL.shakeMaxOffset;
        shakeX = (Math.random() - 0.5) * 2 * mag;
        shakeY = (Math.random() - 0.5) * 2 * mag;
      } else {
        shake = 0;
      }

      apply(clamped.x, clamped.y, shakeX, shakeY);
    },

    addShake(amount) {
      // Take the max rather than summing, so a burst of small hits cannot
      // stack into something that looks like an earthquake.
      shake = Math.max(shake, amount);
    },

    reset(x, y) {
      focusX = x;
      focusY = y + CAMERA.baseY;
      lookAhead = 0;
      shake = 0;
      zoom = zoomTarget;
      applyFrustum();
      const clamped = clampToRoom(focusX, focusY);
      apply(clamped.x, clamped.y, 0, 0);
    },
  };
}
