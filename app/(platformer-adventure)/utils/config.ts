// src/game/config.ts
import { Dimensions } from "react-native";

export const SCREEN = Dimensions.get("window");

export const CONFIG = {
  MOVE_SPEED: 0.15,
  ROTATION_SPEED: 0.08,
  JOYSTICK_RADIUS: 40,
  SKY_COLOR: 0x0b1026,
  ATTACK_RANGE: 6.0,
  PLAYER_MAX_HP: 100,
  SPAWN_RATE: 120, // Frames para nascer novo inimigo
  MAX_ENEMIES: 8,
};

export const TEXTURES = {
  grass: require("../../../assets/texture/grass.jpg"),
  bark: require("../../../assets/texture/bark.jpg"),
  leaves: require("../../../assets/texture/leaves.jpg"),
};

export const MODELS = {
  soldier: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb",
  sword: require("../../../assets/models/sword_of_artorias.glb"),
};