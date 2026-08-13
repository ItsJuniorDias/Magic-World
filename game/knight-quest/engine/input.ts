import { INPUT } from "../config";
import type { InputState } from "../types";

// ---------------------------------------------------------------------------
// Input
//
// Same philosophy as Spell Storm's engine/input.ts: raw device events write
// into a plain InputState struct; game systems only ever read the struct.
// Keyboard (desktop) and the virtual touch controls (ui/touch.ts) both feed
// the same state, so systems don't know or care which one is active.
//
// Attack uses a small input buffer (Zelda feel): a press slightly before the
// previous swing ends still chains the combo.
// ---------------------------------------------------------------------------

export function createInputState(): InputState {
  return {
    moveX: 0,
    moveY: 0,
    attackPressed: false,
    attackBuffered: 0,
    rollPressed: false,
    blockHeld: false,
    interactPressed: false,
  };
}

/** Clear one-frame flags. Call at the END of each update tick. */
export function endFrame(input: InputState, dt: number): void {
  input.attackPressed = false;
  input.rollPressed = false;
  input.interactPressed = false;
  input.attackBuffered = Math.max(0, input.attackBuffered - dt);
}

export function pressAttack(input: InputState): void {
  input.attackPressed = true;
  input.attackBuffered = INPUT.bufferTime;
}

export function applyStick(input: InputState, dx: number, dy: number): void {
  const len = Math.hypot(dx, dy);
  if (len < INPUT.deadzone) {
    input.moveX = 0;
    input.moveY = 0;
    return;
  }
  const scale = Math.min(1, len) / len;
  input.moveX = dx * scale;
  input.moveY = dy * scale;
}

// --------------------------- keyboard ---------------------------------------
//
// On the web this hooks into `window` keydown/keyup. On React Native we
// have no DOM and no physical keyboard on the target devices, so the
// exports become no-ops. The touch UI feeds InputState directly via
// applyStick() and pressAttack() from ui/GameControls.tsx.

export function attachKeyboard(_input: InputState): () => void {
  return () => {};
}

export function pollKeyboard(_input: InputState, _touchActive: boolean): void {
  // no-op on RN
}
