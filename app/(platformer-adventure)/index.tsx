import React, { useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import { ExpoWebGLRenderingContext, GLView } from "expo-gl";
import * as THREE from "three";
import { Renderer } from "expo-three";
import * as ScreenOrientation from "expo-screen-orientation";

const MOVE_SPEED = 0.25;
const ROTATION_SPEED = 0.06;
const PLAYER_RADIUS = 0.6;
const JOYSTICK_RADIUS = 40;

export default function EldoriaFinalFix() {
  const { width, height } = useWindowDimensions();
  const [isReady, setIsReady] = useState(false); // Controle de montagem do GLView
  const requestRef = useRef<number>();

  const movement = useRef({ x: 0, y: 0 });
  const animState = useRef({ dashTime: 0 });
  const obstacles = useRef<THREE.Box3[]>([]);
  const stickPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    async function prepare() {
      // 1. Força a orientação
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      );
      // 2. Pequeno delay para o sistema operacional atualizar o layout da View
      setTimeout(() => setIsReady(true), 500);
    }
    prepare();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const dist = Math.sqrt(g.dx ** 2 + g.dy ** 2);
        const angle = Math.atan2(g.dy, g.dx);
        const limitedDist = Math.min(dist, JOYSTICK_RADIUS);
        const moveX = Math.cos(angle) * limitedDist;
        const moveY = Math.sin(angle) * limitedDist;
        stickPos.setValue({ x: moveX, y: moveY });
        movement.current.x = moveX / JOYSTICK_RADIUS;
        movement.current.y = -moveY / JOYSTICK_RADIUS;
      },
      onPanResponderRelease: () => {
        Animated.spring(stickPos, {
          toValue: { x: 0, y: 0 },
          friction: 7,
          useNativeDriver: false,
        }).start();
        movement.current.x = 0;
        movement.current.y = 0;
      },
    }),
  ).current;

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    // Pegamos a largura e altura diretamente do buffer da GPU para não errar
    const dw = gl.drawingBufferWidth;
    const dh = gl.drawingBufferHeight;

    const renderer = new Renderer({ gl });
    renderer.setSize(dw, dh);
    renderer.setClearColor(0x050208);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050208, 10, 60);
    const camera = new THREE.PerspectiveCamera(75, dw / dh, 0.1, 1000);

    scene.add(new THREE.AmbientLight(0x4040ff, 0.4));
    const moon = new THREE.DirectionalLight(0xffffff, 0.8);
    moon.position.set(20, 50, 20);
    scene.add(moon);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 2000),
      new THREE.MeshStandardMaterial({ color: 0x151515 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const player = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 }),
    );
    body.position.y = 0.8;
    player.add(body);
    player.position.set(0, 0, 0);
    scene.add(player);

    // Gerar ambiente
    for (let i = 1; i < 40; i++) {
      const zPos = i * -18;
      [-1, 1].forEach((side) => {
        const h = 6 + Math.random() * 8;
        const house = new THREE.Mesh(
          new THREE.BoxGeometry(6, h, 8),
          new THREE.MeshStandardMaterial({ color: 0x2a1a12 }),
        );
        house.position.set(side * 15, h / 2, zPos);
        scene.add(house);
        obstacles.current.push(new THREE.Box3().setFromObject(house));
      });
    }

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      let currentSpeed = movement.current.y * MOVE_SPEED;
      if (animState.current.dashTime > 0) {
        currentSpeed += 0.7;
        animState.current.dashTime--;
      }

      player.rotation.y -= movement.current.x * ROTATION_SPEED;
      const nextPos = player.position.clone();
      const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(
        player.quaternion,
      );
      nextPos.add(direction.multiplyScalar(currentSpeed));

      const playerBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(nextPos.x, 1.0, nextPos.z),
        new THREE.Vector3(PLAYER_RADIUS * 2, 1.5, PLAYER_RADIUS * 2),
      );

      let isBlocked = false;
      for (const obs of obstacles.current) {
        if (playerBox.intersectsBox(obs)) {
          isBlocked = true;
          break;
        }
      }
      if (!isBlocked) player.position.copy(nextPos);

      const idealOffset = new THREE.Vector3(0, 5, -10).applyQuaternion(
        player.quaternion,
      );
      camera.position.lerp(player.position.clone().add(idealOffset), 0.1);
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

  // Se não estiver pronto, mostra uma tela vazia para evitar erro de proporção
  if (!isReady) return <View style={{ flex: 1, backgroundColor: "#050208" }} />;

  return (
    <View style={[styles.container, { width, height }]}>
      <GLView
        style={StyleSheet.absoluteFillObject}
        onContextCreate={onContextCreate}
      />
      <View style={styles.uiOverlay} pointerEvents="box-none">
        <View style={styles.hudRow} pointerEvents="box-none">
          <View style={styles.joystickArea} {...panResponder.panHandlers}>
            <View style={styles.joyBase}>
              <Animated.View
                style={[
                  styles.joyStick,
                  {
                    transform: [
                      { translateX: stickPos.x },
                      { translateY: stickPos.y },
                    ],
                  },
                ]}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.btnRoll}
            onPress={() => (animState.current.dashTime = 12)}
          >
            <Animated.Text style={styles.btnText}>DASH</Animated.Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#050208" },
  uiOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 40,
  },
  hudRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  joystickArea: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  joyBase: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  joyStick: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffaa00",
  },
  btnRoll: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: "rgba(255,170,0,0.15)",
    borderWidth: 2,
    borderColor: "#ffaa00",
    justifyContent: "center",
    alignItems: "center",
  },
  btnText: { color: "#ffaa00", fontSize: 13, fontWeight: "bold" },
});
