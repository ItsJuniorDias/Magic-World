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

// IMPORTS PARA 3D LOCAL
import { Asset } from "expo-asset";
import { GLTFLoader } from "three-stdlib";

// --- POLYFILLS ---
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
const BG_MUSIC_URL =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3";

const LEVEL_COLORS = [0xff00ff, 0x00ffff, 0xffff00, 0x00ff00, 0xff0055];

export default function FantasyRunnerEndGame() {
  const { width } = useWindowDimensions();
  const [isLoaded, setIsLoaded] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [lives, setLives] = useState(3);
  const [hasShield, setHasShield] = useState(false);

  const playerRef = useRef<THREE.Group | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const explosionRef = useRef<THREE.Group | null>(null);
  const fogRef = useRef<THREE.Fog | null>(null);

  const obstaclesRef = useRef<THREE.Mesh[]>([]);
  const shieldMeshRef = useRef<THREE.Mesh | null>(null);
  const heartRef = useRef<THREE.Mesh | null>(null);
  const coinRef = useRef<THREE.Mesh | null>(null);
  const shieldItemRef = useRef<THREE.Mesh | null>(null);

  const gameActive = useRef(true);
  const speedRef = useRef(0.35);
  const panX = useRef(0);
  const bgmRef = useRef<Audio.Sound | null>(null);
  const cameraShakeRef = useRef(0);

  useEffect(() => {
    async function init() {
      const saved = await AsyncStorage.getItem("@high_score");
      if (saved) setHighScore(Number(saved));
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: BG_MUSIC_URL },
          { shouldPlay: true, isLooping: true, volume: 0.25 },
        );
        bgmRef.current = sound;
      } catch (e) {}
    }
    init();
    return () => {
      bgmRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (isGameOver && score > highScore) {
      setHighScore(score);
      AsyncStorage.setItem("@high_score", String(score));
    }
  }, [isGameOver]);

  const restartGame = () => {
    setScore(0);
    setLives(3);
    setIsGameOver(false);
    setHasShield(false);
    speedRef.current = 0.35;
    panX.current = 0;
    gameActive.current = true;

    if (playerRef.current) {
      playerRef.current.position.set(0, 1, 0);
      playerRef.current.visible = true;

      // --- CORREÇÃO AQUI ---
      // Resetar para (0,0,0) garante que ela olhe pra frente
      playerRef.current.rotation.set(0, 0, 0);
    }
    if (explosionRef.current) explosionRef.current.visible = false;
    if (shieldMeshRef.current) shieldMeshRef.current.visible = false;

    obstaclesRef.current.forEach((obj, i) =>
      obj.position.set(randomRange(-6, 6), 0.6, -i * 15 - 30),
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
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020205);
    const fog = new THREE.Fog(0x020205, 15, 75);
    scene.fog = fog;
    fogRef.current = fog;

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 1, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(5, 15, 5);
    scene.add(sun);

    // --- WARP DRIVE ---
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500 * 3; i++) starPos[i] = (Math.random() - 0.5) * 150;
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.15,
        transparent: true,
      }),
    );
    scene.add(stars);
    starsRef.current = stars;

    // --- NAVE ---
    const loader = new GLTFLoader();

    try {
      const shipAsset = Asset.fromModule(
        require("../../assets/models/craft_speederA.glb"),
      );
      await shipAsset.downloadAsync();

      if (!shipAsset.uri) throw new Error("Asset localUri undefined");

      loader.load(
        shipAsset.uri,
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(1, 1, 1);

          // Rotação inicial corrigida
          model.rotation.y = 0;

          // Centralização
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);

          const playerGroup = new THREE.Group();
          playerGroup.add(model);
          playerGroup.position.set(0, 1, 0);

          const shield = new THREE.Mesh(
            new THREE.SphereGeometry(2.0, 32, 32),
            new THREE.MeshBasicMaterial({
              color: 0x00ffff,
              transparent: true,
              opacity: 0.2,
              wireframe: true,
            }),
          );
          shield.visible = false;
          playerGroup.add(shield);
          shieldMeshRef.current = shield;

          scene.add(playerGroup);
          playerRef.current = playerGroup;
        },
        undefined,
        (error) => {
          console.error("ERRO NO GLTFLoader:", error);
        },
      );
    } catch (e) {
      console.error("ERRO GERAL:", e);
      const g = new THREE.Group();
      g.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color: "red" }),
        ),
      );
      g.position.y = 1;
      scene.add(g);
      playerRef.current = g;
    }

    // --- EXPLOSÃO ---
    const explosionGroup = new THREE.Group();
    for (let i = 0; i < 25; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x00ffff }),
      );
      (p as any).userData = {
        velocity: new THREE.Vector3(
          randomRange(-0.5, 0.5),
          randomRange(-0.5, 0.5),
          randomRange(-0.5, 0.5),
        ),
      };
      explosionGroup.add(p);
    }
    explosionGroup.visible = false;
    scene.add(explosionGroup);
    explosionRef.current = explosionGroup;

    // --- GRID ---
    const grid = new THREE.GridHelper(300, 70, 0xff00ff, 0x110022);
    scene.add(grid);
    gridRef.current = grid;

    // OBSTÁCULOS
    const obstacles: THREE.Mesh[] = [];
    const obsMat = new THREE.MeshStandardMaterial({
      color: 0xff3344,
      emissive: 0x330000,
    });
    for (let i = 0; i < 8; i++) {
      const obj = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), obsMat);
      obj.position.set(randomRange(-6, 6), 0.65, -i * 15 - 30);
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
      new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x006666 }),
    );
    shieldItem.position.set(-3, 0.8, -150);
    scene.add(shieldItem);
    shieldItemRef.current = shieldItem;

    const animate = () => {
      if (!gl) return;
      requestAnimationFrame(animate);

      if (gameActive.current) {
        const speed = speedRef.current;
        speedRef.current += 0.00005;

        if (starsRef.current) starsRef.current.scale.z = 1 + speed * 2;

        const currentLevel = Math.floor(score / 1000) % LEVEL_COLORS.length;
        const targetColor = new THREE.Color(LEVEL_COLORS[currentLevel]);
        if (gridRef.current)
          (gridRef.current.material as THREE.LineBasicMaterial).color.lerp(
            targetColor,
            0.05,
          );

        if (gridRef.current) {
          gridRef.current.position.z += speed;
          if (gridRef.current.position.z > 4.2) gridRef.current.position.z = 0;
        }

        if (playerRef.current) {
          const ship = playerRef.current;
          ship.position.x += (panX.current - ship.position.x) * 0.15;
          ship.rotation.z = (ship.position.x - panX.current) * 0.35;

          if (shieldMeshRef.current?.visible)
            shieldMeshRef.current.rotation.y += 0.05;

          obstacles.forEach((obj) => {
            obj.position.z += speed;
            if (ship.position.distanceTo(obj.position) < 1.4) {
              if (shieldMeshRef.current?.visible) {
                shieldMeshRef.current.visible = false;
                setHasShield(false);
                obj.position.z = -120;
              } else {
                cameraShakeRef.current = 0.8;
                setLives((l) => {
                  if (l <= 1) {
                    gameActive.current = false;
                    ship.visible = false;
                    explosionGroup.position.copy(ship.position);
                    explosionGroup.visible = true;
                    explosionGroup.children.forEach((p) =>
                      p.position.set(0, 0, 0),
                    );
                    setIsGameOver(true);
                    bgmRef.current?.stopAsync();
                    return 0;
                  }
                  return l - 1;
                });
                obj.position.z = -100;
              }
            }
            if (obj.position.z > 12) {
              obj.position.z = -100;
              obj.position.x = randomRange(-7, 7);
              setScore((s) => s + 20);
            }
          });

          [heart, coin, shieldItem].forEach((item) => {
            item.position.z += speed;
            item.rotation.y += 0.04;
            if (ship.position.distanceTo(item.position) < 1.5) {
              if (item === heart) setLives((l) => Math.min(l + 1, 3));
              if (item === coin) setScore((s) => s + 100);
              if (item === shieldItem) {
                shieldMeshRef.current!.visible = true;
                setHasShield(true);
              }
              item.position.z = -150;
              item.position.x = randomRange(-6, 6);
            }
            if (item.position.z > 15) item.position.z = -150;
          });
        }
      } else if (explosionGroup.visible) {
        explosionGroup.children.forEach((p: any) => {
          p.position.add(p.userData.velocity);
          p.rotation.x += 0.1;
          p.rotation.y += 0.1;
        });
      }

      if (cameraShakeRef.current > 0) {
        camera.position.x = (Math.random() - 0.5) * cameraShakeRef.current;
        camera.position.y = 5 + (Math.random() - 0.5) * cameraShakeRef.current;
        cameraShakeRef.current *= 0.9;
      } else {
        camera.position.set(0, 5, 12);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };

    animate();
    setIsLoaded(true);
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
      <View style={styles.hud}>
        <Text
          title={`SCORE: ${score}`}
          fontSize={28}
          fontFamily="bold"
          style={styles.neonText}
        />
        <Text
          title={`BEST: ${highScore}`}
          fontSize={14}
          fontFamily="regular"
          style={{ color: "#00ffff", opacity: 0.6 }}
        />
        <Text
          title={`LIVES: ${"❤️".repeat(lives)}`}
          fontSize={18}
          fontFamily="regular"
          style={{ marginTop: 5 }}
        />
        {hasShield && (
          <Text
            title="🛡️ SHIELD READY"
            fontSize={14}
            fontFamily="regular"
            style={{ color: "#00ffff", marginTop: 5 }}
          />
        )}
      </View>
      {isGameOver && (
        <View style={styles.overlay}>
          <Text
            title="SYSTEM FAILURE"
            fontSize={35}
            fontFamily="bold"
            style={{ color: "#ff0055" }}
          />
          <TouchableOpacity style={styles.btn} onPress={restartGame}>
            <Text
              title="REBOOT"
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
  container: { flex: 1, backgroundColor: "#020205" },
  hud: { position: "absolute", top: 60, left: 25, zIndex: 10 },
  neonText: {
    color: "#00ffff",
    textShadowColor: "#00ffff",
    textShadowRadius: 15,
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
    paddingHorizontal: 50,
    paddingVertical: 15,
    borderRadius: 40,
    marginTop: 30,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#020205",
    justifyContent: "center",
    alignItems: "center",
  },
});
