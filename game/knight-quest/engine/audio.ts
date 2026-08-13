import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Audio — RN edition.
//
// The web build has a full WebAudio synth (`src/engine/audio.ts`) with
// procedural SFX + a step-sequenced dungeon loop. WebAudio is not available
// on React Native, so this file exposes the SAME `sfx.*` API shape but as a
// haptic-only stub. Every gameplay system calls into it without knowing
// which platform it's on.
//
// The right future path is one of:
//   1) `expo-audio` — pre-baked SFX files (record procedural output once)
//   2) `react-native-track-player` — already in Magic World, could stream a
//      dungeon-ambient track under the game
//
// Until then, hits and pickups still feel punchy via haptics.
// ---------------------------------------------------------------------------

let enabled = true;
let hapticsEnabled = true;

export function initAudio(): void {
  // no-op on RN. Kept for API parity with the web build.
}

export function setMuted(m: boolean): void {
  enabled = !m;
  hapticsEnabled = !m;
}

export function isMuted(): boolean {
  return !enabled;
}

function light(): void {
  if (!hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
function medium(): void {
  if (!hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
function heavy(): void {
  if (!hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}
function success(): void {
  if (!hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
function warning(): void {
  if (!hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
function error(): void {
  if (!hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

// Same names/signatures as the web build so gameplay systems don't care.
export const sfx = {
  swing: () => light(),
  hitEnemy: () => medium(),
  hitBlocked: () => light(),
  playerHurt: () => heavy(),
  enemyDie: () => success(),
  roll: () => light(),
  coin: () => light(),
  heart: () => success(),
  key: () => success(),
  chest: () => success(),
  gateClose: () => heavy(),
  gateOpen: () => medium(),
  doorUnlock: () => success(),
  barrelBreak: () => medium(),
  spikes: () => warning(),
  bossRoar: () => heavy(),
  bolt: () => light(),
  awaken: () => warning(),
  victory: () => success(),
  gameOver: () => error(),
};

export function startMusic(): void {
  // no-op. If you want a music bed here, hook into
  // react-native-track-player from the parent screen and pass a controller
  // in. Keeping this module dependency-free of TrackPlayer lets the game
  // simulation stay pure.
}

export function stopMusic(): void {
  // no-op — same reasoning as startMusic.
}
