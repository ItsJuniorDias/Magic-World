import * as THREE from "three";
import { ARENA, CAMERA, FEEL } from "../config";
import { damp } from "./physics";

/**
 * Camera rig.
 *
 * Two decisions worth calling out:
 *
 * Look-ahead. The camera leads the player in the direction they are moving
 * rather than centring them. In a game where things shoot at you, the space
 * ahead is worth more than the space behind, and centring wastes half the
 * screen on where you have already been.
 *
 * The tilt. The camera sits a few degrees off the Z axis instead of looking
 * straight down it. Orthographically head-on, an extruded card is pixel-
 * identical to a flat quad and the entire paper aesthetic disappears. Seven
 * degrees is enough to catch the side walls without introducing enough
 * parallax to make aiming feel wrong.
 */

export interface CameraRig {
  update(dt: number, targetX: number, targetY: number, velocityX: number, maxSpeed: number): void;
  addShake(amount: number): void;
  /** Where the camera is actually looking, for parallax and the sky. */
  readonly focusX: number;
  reset(x: number, y: number): void;
}

export function createCameraRig(camera: THREE.OrthographicCamera): CameraRig {
  let focusX = 0;
  let focusY: number = CAMERA.baseY;
  let lookAhead = 0;
  let shake = 0;

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

  function apply(x: number, y: number, shakeX: number, shakeY: number): void {
    camera.position.set(x + offset.x + shakeX, y + offset.y + shakeY, offset.z);
    camera.lookAt(x + shakeX, y + shakeY, 0);
  }

  apply(0, CAMERA.baseY, 0, 0);

  return {
    get focusX() {
      return focusX;
    },

    update(dt, targetX, targetY, velocityX, maxSpeed) {
      // Look-ahead is itself smoothed, or the camera snaps every time the
      // player changes direction and the whole screen judders.
      const desiredLookAhead = (velocityX / Math.max(0.001, maxSpeed)) * CAMERA.lookAheadX;
      lookAhead = damp(lookAhead, desiredLookAhead, CAMERA.lookAheadLerp, dt);

      const desiredX = targetX + lookAhead;
      const desiredY = CAMERA.baseY + (targetY - ARENA.floorY) * CAMERA.followY;

      focusX = damp(focusX, desiredX, CAMERA.followLerp, dt);
      focusY = damp(focusY, desiredY, CAMERA.followLerp, dt);

      // Keep the arena edges off-screen.
      const limit = ARENA.halfWidth - ARENA.cameraMargin;
      const clampedX = Math.max(-limit, Math.min(limit, focusX));

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

      apply(clampedX, focusY, shakeX, shakeY);
    },

    addShake(amount) {
      // Take the max rather than summing, so a burst of small hits can't
      // stack into something that looks like an earthquake.
      shake = Math.max(shake, amount);
    },

    reset(x, y) {
      focusX = x;
      focusY = CAMERA.baseY + y * CAMERA.followY;
      lookAhead = 0;
      shake = 0;
      apply(focusX, focusY, 0, 0);
    },
  };
}
