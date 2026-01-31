import React, { useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  PanResponder,
  Animated,
} from "react-native";
import { ExpoWebGLRenderingContext, GLView } from "expo-gl";
import * as THREE from "three";
import { Renderer } from "expo-three";
import * as ScreenOrientation from "expo-screen-orientation";

const MOVE_SPEED = 0.16;
const ROTATION_SPEED = 0.05;

export default function SoulsCombatScreen() {
  const requestRef = useRef<number>();
  const movement = useRef({ x: 0, y: 0 });
  const actions = useRef({
    dash: false,
    attackLight: false,
    attackHeavy: false,
  });

  // Estado das animações: tempos e tipos
  const animState = useRef({
    attackTime: 0,
    attackType: "none", // 'light' ou 'heavy'
    dashCooldown: 0,
  });

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const maxDist = 60;
        movement.current.x = Math.max(
          -1,
          Math.min(1, gestureState.dx / maxDist),
        );
        movement.current.y = Math.max(
          -1,
          Math.min(1, -gestureState.dy / maxDist),
        );
      },
      onPanResponderRelease: () => {
        movement.current.x = 0;
        movement.current.y = 0;
      },
    }),
  ).current;

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    renderer.setClearColor("#050508");

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050508, 10, 60);
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    // CHÃO
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // PLAYER
    const player = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 1, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x444444 }),
    );
    body.position.y = 1;
    player.add(body);

    // ESPADA
    const sword = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x000000 }),
    );
    sword.position.set(0.6, 1.2, 0.8);
    player.add(sword);
    scene.add(player);

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);

      // --- MOVIMENTO ---
      if (Math.abs(movement.current.y) > 0.1)
        player.translateZ(movement.current.y * MOVE_SPEED);
      if (Math.abs(movement.current.x) > 0.1)
        player.rotation.y -= movement.current.x * ROTATION_SPEED;

      // --- LÓGICA DE ATAQUE ---
      if (actions.current.attackLight && animState.current.attackTime === 0) {
        animState.current.attackTime = 15; // Duração rápida
        animState.current.attackType = "light";
      }
      if (actions.current.attackHeavy && animState.current.attackTime === 0) {
        animState.current.attackTime = 35; // Duração longa (preparação)
        animState.current.attackType = "heavy";
      }

      if (animState.current.attackTime > 0) {
        if (animState.current.attackType === "light") {
          // Ataque Fraco: Arco rápido lateral
          sword.rotation.y = Math.sin(animState.current.attackTime * 0.5) * 2;
          sword.material.emissive.setHex(0x0044ff); // Brilho Azul
        } else {
          // Ataque Forte: Preparação e golpe vertical
          if (animState.current.attackTime > 20) {
            // Fase de preparação (puxa a espada para trás)
            sword.rotation.x = -1.2;
            sword.position.z = 0.2;
            sword.material.emissive.setHex(0x330000);
          } else {
            // Fase de impacto
            sword.rotation.x = Math.sin(animState.current.attackTime * 0.3) * 4;
            sword.position.z = 1.2;
            sword.material.emissive.setHex(0xffaa00); // Brilho Laranja/Fogo
          }
        }
        animState.current.attackTime--;
      } else {
        // Reset da posição da espada
        sword.rotation.set(0, 0, 0);
        sword.position.set(0.6, 1.2, 0.8);
        sword.material.emissive.setHex(0x000000);
      }

      // --- CÂMERA FOLLOW ---
      const camPos = new THREE.Vector3(0, 5, -10);
      camPos.applyQuaternion(player.quaternion);
      camera.position.lerp(player.position.clone().add(camPos), 0.1);
      camera.lookAt(
        player.position.x,
        player.position.y + 1,
        player.position.z,
      );

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  return (
    <View style={styles.container}>
      <GLView
        style={StyleSheet.absoluteFillObject}
        onContextCreate={onContextCreate}
      />

      <View style={styles.uiOverlay} pointerEvents="box-none">
        {/* JOYSTICK */}
        <View style={styles.joystickContainer} {...panResponder.panHandlers}>
          <View style={styles.joystickBase}>
            <View style={styles.joystickStick} />
          </View>
        </View>

        {/* BOTÕES DE ATAQUE */}
        <View style={styles.actionContainer}>
          <ActionButton
            label="R2 HEAVY"
            color="rgba(255,100,0,0.3)"
            onPressIn={() => (actions.current.attackHeavy = true)}
            onPressOut={() => (actions.current.attackHeavy = false)}
          />
          <ActionButton
            label="R1 LIGHT"
            color="rgba(0,150,255,0.3)"
            onPressIn={() => (actions.current.attackLight = true)}
            onPressOut={() => (actions.current.attackLight = false)}
          />
        </View>
      </View>
    </View>
  );
}

function ActionButton({ label, color, onPressIn, onPressOut }: any) {
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: color }]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  uiOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: 40,
  },
  joystickContainer: {
    width: 150,
    height: 150,
    justifyContent: "center",
    alignItems: "center",
  },
  joystickBase: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  joystickStick: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  actionContainer: { alignItems: "center" },
  btn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    margin: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 10,
    textAlign: "center",
  },
});
