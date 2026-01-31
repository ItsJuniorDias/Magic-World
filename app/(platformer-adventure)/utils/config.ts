// src/game/config.ts
import { Dimensions } from "react-native";
import swordModel from "../../../assets/models/straight_long_sword.glb";

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
  moon: require("../../../assets/texture/moon.jpg"),
  bark: require("../../../assets/texture/bark.jpg"),
  leaves: require("../../../assets/texture/leaves.jpg"),
  grass: require("../../../assets/texture/grass.jpg"),
  earth: require("../../../assets/texture/earth.jpg"),
};
export const MODELS = {
  soldier: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb",
  sword: swordModel,
};