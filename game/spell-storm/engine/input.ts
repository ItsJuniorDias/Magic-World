import { INPUT } from "../config";
import type { InputState } from "../types";

export function createInputState(): InputState {
  return {
    moveX: 0,
    moveY: 0,
    jumpHeld: false,
    jumpPressed: false,
    fireHeld: false,
    firePressed: false,
    dashRequest: 0,
  };
}

export function resetInput(input: InputState): void {
  input.moveX = 0;
  input.moveY = 0;
  input.jumpHeld = false;
  input.jumpPressed = false;
  input.fireHeld = false;
  input.firePressed = false;
  input.dashRequest = 0;
}

/**
 * Converts raw stick displacement (in points, from the touch handler) into a
 * normalised vector with a deadzone.
 *
 * The deadzone matters more on touch than on a physical stick: a thumb
 * resting on glass drifts by a few points constantly, and without this the
 * mage creeps sideways whenever the player stops moving.
 */
export function applyStick(input: InputState, dx: number, dy: number): void {
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) {
    input.moveX = 0;
    input.moveY = 0;
    return;
  }
  const clamped = Math.min(len, INPUT.stickRadius) / INPUT.stickRadius;
  if (clamped < INPUT.deadzone) {
    input.moveX = 0;
    input.moveY = 0;
    return;
  }
  // Rescale so the usable range starts right at the deadzone edge. Without
  // this the stick jumps from 0 to 0.18 the instant it engages.
  const scaled = (clamped - INPUT.deadzone) / (1 - INPUT.deadzone);
  input.moveX = (dx / len) * scaled;
  // Screen Y grows downward; world Y grows upward.
  input.moveY = (-dy / len) * scaled;
}

/**
 * Snaps a direction to one of 8 compass headings, the way a d-pad does.
 *
 * Metal Slug aims in 8 directions, not 360, and that is a design choice
 * rather than a hardware limitation: discrete aiming is readable, repeatable
 * and forgiving. On a touch screen it matters even more, because a thumb
 * cannot hold a precise analogue angle while also moving.
 *
 * Returns a unit vector. Falls back to `fallbackX` horizontal when the input
 * is neutral, so the mage always has a valid firing direction.
 */
export function snapAim(
  x: number,
  y: number,
  fallbackX: 1 | -1,
): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < INPUT.deadzone) return { x: fallbackX, y: 0 };

  const sector = (Math.PI * 2) / INPUT.aimDirections;
  const angle = Math.atan2(y, x);
  const snapped = Math.round(angle / sector) * sector;
  return { x: Math.cos(snapped), y: Math.sin(snapped) };
}

/**
 * Same 8-way snap, but when the stick is idle it returns null instead of
 * falling back horizontal. Used at the moment CAST is pressed: if the
 * player was already tilting the stick, that direction gets latched. If
 * they weren't, the caller keeps whatever aim they had (facing) rather
 * than being forced sideways.
 */
export function snapAimStrict(x: number, y: number): { x: number; y: number } | null {
  const len = Math.hypot(x, y);
  if (len < INPUT.deadzone) return null;
  const sector = (Math.PI * 2) / INPUT.aimDirections;
  const angle = Math.atan2(y, x);
  const snapped = Math.round(angle / sector) * sector;
  return { x: Math.cos(snapped), y: Math.sin(snapped) };
}
