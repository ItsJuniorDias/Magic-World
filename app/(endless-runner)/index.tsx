import React, { useRef, useEffect, useState } from "react";
import {
  View,
  PanResponder,
  useWindowDimensions,
  PixelRatio,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { GLView } from "expo-gl";
import * as THREE from "three";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Text from "@/components/text";

const noop = () => {};
const dummyElement = {
  style: {},
  addEventListener: noop,
  removeEventListener: noop,
  setAttribute: noop,
  getAttribute: noop,
  getContext: () => ({}),
  dispatchEvent: noop,
};
if (typeof document === "undefined") {
  (global as any).document = {
    readyState: "complete",
    createElement: () => dummyElement,
    createElementNS: () => dummyElement,
    getElementsByTagName: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    documentElement: dummyElement,
    body: dummyElement,
  } as any;
}
if (typeof window === "undefined") {
  (global as any).window = {
    addEventListener: noop,
    removeEventListener: noop,
    innerWidth: 0,
    innerHeight: 0,
    devicePixelRatio: PixelRatio.get(),
    location: { href: "" },
  } as any;
}

const randomRange = (min: number, max: number) =>
  Math.random() * (max - min) + min;

// URLs de áudio (Padrão Synthwave)
const BG_MUSIC =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3";

export default function FantasyRunnerSupreme() {
  const { width } = useWindowDimensions();
  const [isLoaded, setIsLoaded] = useState(false);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasShield, setHasShield] = useState(false); // NOVO: Estado do escudo

  const playerRef = useRef<THREE.Group | null>(null); // Agora é um Grupo (Nave)
  const shieldMeshRef = useRef<THREE.Mesh | null>(null);
  const obstaclesRef = useRef<THREE.Mesh[]>([]);
  const heartRef = useRef<THREE.Mesh | null>(null);
  const coinRef = useRef<THREE.Mesh | null>(null);
  const shieldItemRef = useRef<THREE.Mesh | null>(null); // NOVO: Item de escudo no mapa

  const panX = useRef(0);
  const requestRef = useRef<number>();
  const canBeHit = useRef(true);
  const gameActive = useRef(true);
  const bgmRef = useRef<Audio.Sound | null>(null);

  const speedRef = useRef(0.3);
  const cameraShakeRef = useRef(0);
  const trailParticlesRef = useRef<THREE.Mesh[]>([]);

  // 1. GESTÃO DE ÁUDIO
  useEffect(() => {
    async function setupAudio() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: BG_MUSIC },
          { shouldPlay: true, isLooping: true, volume: 0.25 },
        );
        bgmRef.current = sound;
      } catch (e) {}
    }
    setupAudio();
    return () => {
      bgmRef.current?.unloadAsync();
    };
  }, []);

  // 2. RECORDE
  useEffect(() => {
    AsyncStorage.getItem("@high_score").then(
      (val) => val && setHighScore(Number(val)),
    );
  }, []);

  useEffect(() => {
    if (isGameOver && score > highScore) {
      setHighScore(score);
      AsyncStorage.setItem("@high_score", String(score));
    }
  }, [isGameOver]);

  const restartGame = () => {
    setLives(3);
    setScore(0);
    setIsGameOver(false);
    setHasShield(false);
    speedRef.current = 0.3;
    panX.current = 0;
    canBeHit.current = true;
    gameActive.current = true;
    if (playerRef.current) playerRef.current.position.set(0, 1, 0);
    if (shieldMeshRef.current) shieldMeshRef.current.visible = false;
    obstaclesRef.current.forEach((obj, i) =>
      obj.position.set(randomRange(-6, 6), 0.5, -i * 15 - 20),
    );
    bgmRef.current?.playFromPositionAsync(0);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (!isGameOver) panX.current = (gs.dx / width) * 14;
      },
    }),
  ).current;

  const onContextCreate = async (gl: any) => {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true });
    renderer.setSize(w, h);

    const scene = new THREE.Scene();
    const bgColor = new THREE.Color(0x050510);
    scene.background = bgColor;
    scene.fog = new THREE.Fog(bgColor, 15, 75);

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(0, 4.5, 11);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.PointLight(0xff00ff, 1.5, 100);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    // ESTRELAS
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000 * 3; i++) starPos[i] = (Math.random() - 0.5) * 180;
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 }),
      ),
    );

    // --- NOVA NAVE (3D COMPLEMENTAR) ---
    const shipGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.3, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x222222 }),
    );
    const wingL = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.1, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x00ffff }),
    );
    wingL.position.set(-0.7, 0, 0.2);
    const wingR = wingL.clone();
    wingR.position.x = 0.7;
    const cabine = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xff00ff }),
    );
    cabine.position.set(0, 0.2, 0.4);
    shipGroup.add(body, wingL, wingR, cabine);
    shipGroup.position.y = 1;
    scene.add(shipGroup);
    playerRef.current = shipGroup;

    // --- ESCUDO (AURA) ---
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.2,
        wireframe: true,
      }),
    );
    shield.visible = false;
    shipGroup.add(shield);
    shieldMeshRef.current = shield;

    const grid = new THREE.GridHelper(200, 60, 0xff00ff, 0x220022);
    scene.add(grid);

    const obstacles: THREE.Mesh[] = [];
    const obsMat = new THREE.MeshStandardMaterial({
      color: 0xff3344,
      emissive: 0x330000,
    });
    for (let i = 0; i < 8; i++) {
      const obj = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), obsMat);
      obj.position.set(randomRange(-6, 6), 0.6, -i * 15 - 20);
      scene.add(obj);
      obstacles.push(obj);
    }
    obstaclesRef.current = obstacles;

    // ITENS
    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x003300 }),
    );
    heart.position.set(0, 0.8, -100);
    scene.add(heart);
    heartRef.current = heart;

    const coin = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.1, 12, 24),
      new THREE.MeshStandardMaterial({ color: 0xffff00 }),
    );
    coin.rotation.x = Math.PI / 2;
    coin.position.set(2, 0.8, -120);
    scene.add(coin);
    coinRef.current = coin;

    const shieldItem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.6),
      new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x004444 }),
    );
    shieldItem.position.set(-2, 0.8, -150);
    scene.add(shieldItem);
    shieldItemRef.current = shieldItem;

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      if (gameActive.current) {
        const speed = speedRef.current;
        speedRef.current += 0.00003;
        grid.position.z += speed;
        if (grid.position.z > 3.33) grid.position.z = 0;

        shipGroup.position.x += (panX.current - shipGroup.position.x) * 0.15;
        shipGroup.rotation.z = (shipGroup.position.x - panX.current) * 0.3;
        shipGroup.rotation.y = (panX.current - shipGroup.position.x) * 0.1;

        if (shield.visible) shield.rotation.y += 0.05;

        // Obstáculos e Colisão
        obstacles.forEach((obj) => {
          obj.position.z += speed;
          if (
            shipGroup.position.distanceTo(obj.position) < 1.3 &&
            canBeHit.current
          ) {
            if (shield.visible) {
              shield.visible = false;
              setHasShield(false);
              canBeHit.current = false;
              setTimeout(() => (canBeHit.current = true), 1000);
              obj.position.z = -100;
            } else {
              canBeHit.current = false;
              cameraShakeRef.current = 0.8;
              setLives((l) => {
                if (l <= 1) {
                  gameActive.current = false;
                  setIsGameOver(true);
                  bgmRef.current?.stopAsync();
                  return 0;
                }
                return l - 1;
              });
              setTimeout(() => {
                if (gameActive.current) canBeHit.current = true;
              }, 1200);
            }
          }
          if (obj.position.z > 12) {
            obj.position.z = -80;
            obj.position.x = randomRange(-6, 6);
            setScore((s) => s + 10);
          }
        });

        // Itens
        [heart, coin, shieldItem].forEach((item) => {
          item.position.z += speed;
          item.rotation.y += 0.04;
          if (shipGroup.position.distanceTo(item.position) < 1.4) {
            if (item === heart) setLives((l) => Math.min(l + 1, 3));
            if (item === coin) setScore((s) => s + 100);
            if (item === shieldItem) {
              shield.visible = true;
              setHasShield(true);
            }
            item.position.z = -120;
            item.position.x = randomRange(-5, 5);
          }
          if (item.position.z > 12) item.position.z = -120;
        });
      }

      if (cameraShakeRef.current > 0) {
        camera.position.x = (Math.random() - 0.5) * cameraShakeRef.current;
        camera.position.y =
          4.5 + (Math.random() - 0.5) * cameraShakeRef.current;
        cameraShakeRef.current *= 0.9;
      } else {
        camera.position.set(0, 4.5, 11);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
    setTimeout(() => setIsLoaded(true), 1200);
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <GLView style={styles.glView} onContextCreate={onContextCreate} />
      <View style={styles.hud}>
        <Text
          title={`SCORE: ${score}`}
          fontSize={24}
          fontFamily="bold"
          style={styles.neonText}
        />
        <Text
          title={`BEST: ${highScore.toString()}`}
          fontSize={14}
          style={{ color: "#00ffff", opacity: 0.8 }}
        />
        <Text
          title={`LIVES: ${"❤️".repeat(lives)}`}
          fontSize={18}
          style={{ marginTop: 5 }}
        />
        {hasShield && (
          <Text
            title="🛡️ SHIELD READY"
            fontSize={14}
            style={{ color: "#00ffff", fontWeight: "bold" }}
          />
        )}
      </View>

      {isGameOver && (
        <View style={styles.overlay}>
          <Text
            title="CRASHED!"
            fontSize={42}
            fontFamily="bold"
            style={{ color: "#ff0055" }}
          />
          <TouchableOpacity style={styles.btn} onPress={restartGame}>
            <Text
              title="PLAY AGAIN"
              fontSize={20}
              fontFamily="bold"
              style={{ color: "#000" }}
            />
          </TouchableOpacity>
        </View>
      )}
      {!isLoaded && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#00ffff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050510" },
  glView: { flex: 1 },
  hud: { position: "absolute", top: 60, left: 25, zIndex: 10 },
  neonText: {
    color: "#00ffff",
    textShadowColor: "#00ffff",
    textShadowRadius: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  btn: {
    backgroundColor: "#00ffff",
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    marginTop: 20,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050510",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
});
