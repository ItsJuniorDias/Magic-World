// Public surface for the Knight Quest module. The expo-router screen at
// app/(knight-quest)/index.tsx imports only from here.

export { createKnightQuest } from "./game";
export type { KnightQuestGame, HudSnapshot } from "./game";
export {
  useKnightQuestGame,
  type ExpoGLContext,
} from "./engine/useKnightQuestGame";
export { applyStick, pressAttack, createInputState } from "./engine/input";
export type { InputState } from "./types";
export { PLAYER, INPUT, COLORS } from "./config";
export { ROOMS, roomAt, START_ROOM_KEY, BOSS_ROOM_KEY } from "./world/dungeon";
