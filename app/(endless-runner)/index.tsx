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
import addCraters from "@/utils/addCraters";
import { Colors } from "@/constants/theme";
import { router } from "expo-router";

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

// Paleta de Cores Neon para os Planetas
const PLANET_PALETTE = [
  { base: 0x00ffff, emissive: 0x004444 }, // Ciano
  { base: 0xff00ff, emissive: 0x440044 }, // Magenta
  { base: 0x00ff00, emissive: 0x004400 }, // Lima
  { base: 0xffff00, emissive: 0x444400 }, // Amarelo
  { base: 0xff8800, emissive: 0x442200 }, // Laranja
  { base: 0x8800ff, emissive: 0x220044 }, // Roxo
];

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
  const moonRef = useRef<THREE.Group | null>(null);
  const phoenixRef = useRef<THREE.Group | null>(null);

  const obstaclesRef = useRef<THREE.Object3D[]>([]);
  const shieldMeshRef = useRef<THREE.Mesh | null>(null);
  const heartRef = useRef<THREE.Mesh | null>(null);
  const coinRef = useRef<THREE.Mesh | null>(null);
  const shieldItemRef = useRef<THREE.Mesh | null>(null);

  const gameActive = useRef(true);
  const speedRef = useRef(0.35);
  const panX = useRef(0);
  const bgmRef = useRef<Audio.Sound | null>(null);
  const cameraShakeRef = useRef(0);

  // Helper para mudar cor do planeta
  const randomizePlanetColor = (planetGroup: THREE.Group | null) => {
    if (!planetGroup) return;
    const colorPair =
      PLANET_PALETTE[Math.floor(Math.random() * PLANET_PALETTE.length)];
    planetGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.setHex(colorPair.base);
        mat.emissive.setHex(colorPair.emissive);
      }
    });
  };

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
      playerRef.current.rotation.set(0, 0, 0);
    }

    if (moonRef.current) moonRef.current.position.z = -60;
    if (phoenixRef.current) phoenixRef.current.position.z = -100;

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
    scene.fog = new THREE.Fog(0x020205, 10, 130);

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 1, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 3.5);
    sun.position.set(5, 15, 10);
    scene.add(sun);

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

    // const grid = new THREE.GridHelper(300, 70, 0xff00ff, 0x110022);
    // scene.add(grid);
    // gridRef.current = grid;

    const loader = new GLTFLoader();
    const loadModel = (uri: string) =>
      new Promise<THREE.Group>((resolve, reject) => {
        loader.load(uri, (gltf) => resolve(gltf.scene), undefined, reject);
      });

    try {
      const assets = {
        ship: Asset.fromModule(
          require("../../assets/models/craft_speederA.glb"),
        ),
        asteroid: Asset.fromModule(
          require("../../assets/models/asteroid_low_poly.glb"),
        ),
        moon: Asset.fromModule(require("../../assets/models/moon_planet.glb")),
        phoenix: Asset.fromModule(
          require("../../assets/models/planet_of_phoenix.glb"),
        ),
      };

      await Promise.all(Object.values(assets).map((a) => a.downloadAsync()));

      const [shipModel, asteroidModel, moonModel, phoenixModel] =
        await Promise.all([
          loadModel(assets.ship.uri!),
          loadModel(assets.asteroid.uri!),
          loadModel(assets.moon.uri!),
          loadModel(assets.phoenix.uri!),
        ]);

      // NAVE

      const shipBox = new THREE.Box3().setFromObject(shipModel);
      const shipCenter = shipBox.getCenter(new THREE.Vector3());

      shipModel.position.sub(shipCenter);

      const playerGroup = new THREE.Group();

      playerGroup.add(shipModel);
      playerGroup.position.set(0, 1, 0);
      scene.add(playerGroup);
      playerRef.current = playerGroup;

      // METEOROS
      const asteroidMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 1,
      });

      const obstacles: THREE.Object3D[] = [];
      for (let i = 0; i < 8; i++) {
        const obs = asteroidModel.clone();
        obs.scale.set(0.12, 0.12, 0.12);
        obs.traverse((child: any) => {
          if (child.isMesh) {
            child.material = asteroidMaterial;
            addCraters(child.geometry, 20, 0.5, 30);
          }
        });
        obs.position.set(randomRange(-6, 6), 0.8, -i * 15 - 30);
        scene.add(obs);
        obstacles.push(obs);
      }
      obstaclesRef.current = obstacles;

      // LUA (Parallax)
      const moonGroup = new THREE.Group();
      moonModel.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5,
          });
        }
      });
      moonGroup.add(moonModel);
      moonGroup.position.set(-22, 12, -60);
      moonGroup.scale.set(4, 4, 4);
      scene.add(moonGroup);
      moonRef.current = moonGroup;

      // FÊNIX (Parallax)
      const phoenixGroup = new THREE.Group();
      phoenixModel.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.8,
            side: THREE.DoubleSide,
          });
        }
      });
      phoenixGroup.add(phoenixModel);
      phoenixGroup.position.set(24, 18, -110);
      phoenixGroup.scale.set(5.5, 5.5, 5.5);
      scene.add(phoenixGroup);
      phoenixRef.current = phoenixGroup;

      setIsLoaded(true);
    } catch (e) {
      console.error(e);
    }

    // EXPLOSÃO
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

    const animate = () => {
      if (!gl) return;
      requestAnimationFrame(animate);

      if (gameActive.current) {
        const speed = speedRef.current;
        speedRef.current += 0.00004;

        if (starsRef.current) starsRef.current.scale.z = 1 + speed * 2;

        // --- PARALLAX COM NOVAS CORES ---
        if (moonRef.current) {
          moonRef.current.position.z += speed * 0.18;
          moonRef.current.rotation.y += 0.003;

          // Efeito Sutil de Shimmer (Degrade temporal)
          moonRef.current.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              const mat = (c as THREE.Mesh)
                .material as THREE.MeshStandardMaterial;
              mat.emissiveIntensity = 0.4 + Math.sin(Date.now() * 0.002) * 0.2;
            }
          });

          if (moonRef.current.position.z > 30) {
            moonRef.current.position.z = -140;
            moonRef.current.position.x = randomRange(-30, -18);
            randomizePlanetColor(moonRef.current); // Muda a cor no ressurgimento
          }
        }

        if (phoenixRef.current) {
          phoenixRef.current.position.z += speed * 0.1;
          phoenixRef.current.rotation.y -= 0.002;

          if (phoenixRef.current.position.z > 30) {
            phoenixRef.current.position.z = -190;
            phoenixRef.current.position.x = randomRange(18, 30);
            randomizePlanetColor(phoenixRef.current); // Muda a cor no ressurgimento
          }
        }

        if (gridRef.current) {
          gridRef.current.position.z += speed;
          if (gridRef.current.position.z > 4.2) gridRef.current.position.z = 0;
          const currentLevel = Math.floor(score / 1000) % LEVEL_COLORS.length;
          (gridRef.current.material as THREE.LineBasicMaterial).color.lerp(
            new THREE.Color(LEVEL_COLORS[currentLevel]),
            0.05,
          );
        }

        if (playerRef.current) {
          const ship = playerRef.current;
          ship.position.x += (panX.current - ship.position.x) * 0.15;
          ship.rotation.z = (ship.position.x - panX.current) * 0.35;

          obstaclesRef.current.forEach((obj) => {
            obj.position.z += speed;
            obj.rotation.x += 0.01;
            if (ship.position.distanceTo(obj.position) < 1.2) {
              cameraShakeRef.current = 0.8;
              setLives((l) => {
                if (l <= 1) {
                  gameActive.current = false;
                  ship.visible = false;
                  explosionGroup.position.copy(ship.position);
                  explosionGroup.visible = true;
                  setIsGameOver(true);
                  bgmRef.current?.stopAsync();
                  return 0;
                }
                return l - 1;
              });
              obj.position.z = -100;
            }
            if (obj.position.z > 12) {
              obj.position.z = -100;
              obj.position.x = randomRange(-7, 7);
              setScore((s) => s + 20);
            }
          });

          [heart, coin].forEach((item) => {
            if (!item) return;
            item.position.z += speed;
            item.rotation.y += 0.04;
            if (ship.position.distanceTo(item.position) < 1.5) {
              if (item === heart) setLives((l) => Math.min(l + 1, 3));
              if (item === coin) setScore((s) => s + 100);
              item.position.z = -150;
              item.position.x = randomRange(-6, 6);
            }
            if (item.position.z > 15) item.position.z = -150;
          });
        }
      } else if (explosionGroup.visible) {
        explosionGroup.children.forEach((p: any) =>
          p.position.add(p.userData.velocity),
        );
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
          fontFamily="regular"
          fontSize={14}
          style={{ color: "#00ffff", opacity: 0.6 }}
        />
        <Text
          fontFamily="regular"
          title={`LIVES: ${"❤️".repeat(lives)}`}
          fontSize={18}
          style={{ marginTop: 5, color: Colors.dark.text, opacity: 0.8 }}
        />
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

          <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
            <Text
              title="BACK TO HUB"
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
          <Text
            title="CALIBRATING CHROMATIC DRIFT..."
            fontSize={14}
            fontFamily="bold"
            style={{ color: "#00ffff", marginTop: 10 }}
          />
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
    zIndex: 999,
  },
});
