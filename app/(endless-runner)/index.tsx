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
import { Asset } from "expo-asset";
import { GLTFLoader } from "three-stdlib";
import addCraters from "@/utils/addCraters";
import { Colors } from "@/constants/theme";
import { router } from "expo-router";

// --- POLYFILLS ---
const noop = () => {};
if (typeof document === "undefined") {
  (global as any).document = {
    readyState: "complete",
    createElement: () => ({ style: {}, addEventListener: noop }),
    createElementNS: () => ({ style: {}, addEventListener: noop }),
    getElementsByTagName: () => [],
    addEventListener: noop,
    documentElement: {},
  } as any;
}

const randomRange = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const PLANET_PALETTE = [
  { base: 0x00ffff, emissive: 0x004444 },
  { base: 0xff00ff, emissive: 0x440044 },
  { base: 0x00ff00, emissive: 0x004400 },
  { base: 0xffff00, emissive: 0x444400 },
];

const BG_MUSIC_URL =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3";

export default function FantasyRunnerEndGame() {
  const { width } = useWindowDimensions();
  const [isLoaded, setIsLoaded] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [lives, setLives] = useState(3);

  const playerRef = useRef<THREE.Group | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const moonRef = useRef<THREE.Group | null>(null);
  const phoenixRef = useRef<THREE.Group | null>(null);
  const obstaclesRef = useRef<THREE.Object3D[]>([]);
  const explosionRef = useRef<THREE.Group | null>(null);
  const flamesRef = useRef<THREE.Mesh[]>([]);

  // Itens de Recompensa
  const heartRef = useRef<THREE.Mesh | null>(null);
  const coinRef = useRef<THREE.Mesh | null>(null);

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

  const randomizePlanetColor = (planetGroup: THREE.Group | null) => {
    if (!planetGroup) return;
    const colorPair =
      PLANET_PALETTE[Math.floor(Math.random() * PLANET_PALETTE.length)];
    planetGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh)
          .material as THREE.MeshStandardMaterial;
        mat.color.setHex(colorPair.base);
        mat.emissive.setHex(colorPair.emissive);
      }
    });
  };

  const restartGame = () => {
    setScore(0);
    setLives(3);
    setIsGameOver(false);
    speedRef.current = 0.35;
    panX.current = 0;
    gameActive.current = true;
    if (playerRef.current) {
      playerRef.current.position.set(0, 1, 0);
      playerRef.current.visible = true;
    }
    if (explosionRef.current) explosionRef.current.visible = false;

    // Reset Itens
    if (heartRef.current)
      heartRef.current.position.set(randomRange(-5, 5), 0.8, -100);
    if (coinRef.current)
      coinRef.current.position.set(randomRange(-5, 5), 0.8, -120);

    obstaclesRef.current.forEach((obj, i) =>
      obj.position.set(randomRange(-6, 6), 0.8, -i * 15 - 30),
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
    scene.background = new THREE.Color(0x020205);
    scene.fog = new THREE.Fog(0x020205, 10, 130);

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 1, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(5, 15, 10);
    scene.add(sun);

    // Estrelas
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200 * 3; i++) starPos[i] = (Math.random() - 0.5) * 150;
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 }),
    );
    scene.add(stars);
    starsRef.current = stars;

    const loader = new GLTFLoader();
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

      const [shipData, asteroidData, moonData, phoenixData] = await Promise.all(
        [
          loader.loadAsync(assets.ship.uri),
          loader.loadAsync(assets.asteroid.uri),
          loader.loadAsync(assets.moon.uri),
          loader.loadAsync(assets.phoenix.uri),
        ],
      );

      // --- CONFIGURAÇÃO DA NAVE (COM PIVÔ CORRIGIDO) ---
      const shipModel = shipData.scene;
      const shipBox = new THREE.Box3().setFromObject(shipModel);
      const shipSize = shipBox.getSize(new THREE.Vector3());
      const shipCenter = shipBox.getCenter(new THREE.Vector3());

      const shipContainer = new THREE.Group();
      shipModel.position.sub(shipCenter);
      shipContainer.add(shipModel);

      // Chamas
      const flameGeo = new THREE.ConeGeometry(0.08, 0.6, 8);
      flameGeo.rotateX(-Math.PI / 2);
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });

      const leftFlame = new THREE.Mesh(flameGeo, flameMat.clone());
      const rightFlame = new THREE.Mesh(flameGeo, flameMat.clone());

      const rearZ = shipSize.z / 2;
      const posX = shipSize.x * 0.22;
      const posY = -shipSize.y * 0.1;

      leftFlame.position.set(-posX, posY, rearZ);
      rightFlame.position.set(posX, posY, rearZ);

      shipContainer.add(leftFlame, rightFlame);
      flamesRef.current = [leftFlame, rightFlame];

      const playerGroup = new THREE.Group();
      playerGroup.add(shipContainer);
      playerGroup.position.set(0, 1, 0);
      scene.add(playerGroup);
      playerRef.current = playerGroup;

      // Obstáculos
      const asteroidMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
      });
      const obstacles: THREE.Object3D[] = [];
      for (let i = 0; i < 8; i++) {
        const obs = asteroidData.scene.clone();
        obs.scale.set(0.12, 0.12, 0.12);
        obs.traverse((c: any) => {
          if (c.isMesh) c.material = asteroidMaterial;
        });
        obs.position.set(randomRange(-6, 6), 0.8, -i * 15 - 30);
        scene.add(obs);
        obstacles.push(obs);
      }
      obstaclesRef.current = obstacles;

      // Planetas (Parallax)
      const moon = moonData.scene;
      moon.position.set(-25, 12, -70);
      moon.scale.set(4, 4, 4);
      scene.add(moon);
      moonRef.current = moon;

      const phoenix = phoenixData.scene;
      phoenix.position.set(25, 18, -120);
      phoenix.scale.set(5, 5, 5);
      scene.add(phoenix);
      phoenixRef.current = phoenix;

      setIsLoaded(true);
    } catch (e) {
      console.error(e);
    }

    // --- SISTEMA DE ITENS (RECOMPENSAS) ---
    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x003300 }),
    );
    heart.position.set(randomRange(-5, 5), 0.8, -100);
    scene.add(heart);
    heartRef.current = heart;

    const coin = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.08, 12, 24),
      new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x444400 }),
    );
    coin.rotation.x = Math.PI / 2;
    coin.position.set(randomRange(-5, 5), 0.8, -120);
    scene.add(coin);
    coinRef.current = coin;

    // Explosão
    const explosionGroup = new THREE.Group();
    for (let i = 0; i < 20; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x00ffff }),
      );
      (p as any).velocity = new THREE.Vector3(
        randomRange(-0.4, 0.4),
        randomRange(-0.4, 0.4),
        randomRange(-0.4, 0.4),
      );
      explosionGroup.add(p);
    }
    explosionGroup.visible = false;
    scene.add(explosionGroup);
    explosionRef.current = explosionGroup;

    const animate = () => {
      if (!gl) return;
      requestAnimationFrame(animate);

      if (gameActive.current) {
        const speed = speedRef.current;
        speedRef.current += 0.00005;

        // Movimento Nave
        if (playerRef.current) {
          playerRef.current.position.x +=
            (panX.current - playerRef.current.position.x) * 0.12;
          playerRef.current.rotation.z =
            (playerRef.current.position.x - panX.current) * 0.3;

          const shipPos = playerRef.current.position;

          // Colisão Obstáculos
          obstaclesRef.current.forEach((obs) => {
            obs.position.z += speed;
            obs.rotation.x += 0.01;
            if (shipPos.distanceTo(obs.position) < 1.3) {
              cameraShakeRef.current = 0.6;
              setLives((l) => {
                if (l <= 1) {
                  gameActive.current = false;
                  playerRef.current!.visible = false;
                  explosionGroup.position.copy(shipPos);
                  explosionGroup.visible = true;
                  setIsGameOver(true);
                  return 0;
                }
                return l - 1;
              });
              obs.position.z = -100;
              obs.position.x = randomRange(-6, 6);
            }
            if (obs.position.z > 15) {
              obs.position.z = -100;
              obs.position.x = randomRange(-7, 7);
              setScore((s) => s + 10);
            }
          });

          // Lógica dos Itens (Coração e Moeda)
          [heart, coin].forEach((item) => {
            item.position.z += speed;
            item.rotation.y += 0.05;

            if (shipPos.distanceTo(item.position) < 1.4) {
              if (item === heart) setLives((l) => Math.min(l + 1, 3));
              if (item === coin) setScore((s) => s + 150);
              item.position.z = -150;
              item.position.x = randomRange(-6, 6);
            }

            if (item.position.z > 15) {
              item.position.z = -150;
              item.position.x = randomRange(-6, 6);
            }
          });
        }

        // Parallax Planetas
        if (moonRef.current) {
          moonRef.current.position.z += speed * 0.2;
          moonRef.current.rotation.y += 0.002;
          if (moonRef.current.position.z > 40) {
            moonRef.current.position.z = -140;
            randomizePlanetColor(moonRef.current);
          }
        }
        if (phoenixRef.current) {
          phoenixRef.current.position.z += speed * 0.15;
          phoenixRef.current.rotation.y -= 0.001;
          if (phoenixRef.current.position.z > 40) {
            phoenixRef.current.position.z = -180;
            randomizePlanetColor(phoenixRef.current);
          }
        }

        // Flicker das Chamas
        flamesRef.current.forEach((f, i) => {
          const s = 1 + Math.sin(Date.now() * 0.02 + i) * 0.2;
          f.scale.set(s, s, s * 1.6);
          (f.material as THREE.MeshBasicMaterial).opacity =
            0.6 + Math.random() * 0.4;
        });
      } else if (explosionRef.current?.visible) {
        explosionRef.current.children.forEach((p: any) =>
          p.position.add(p.velocity),
        );
      }

      // Camera Shake
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
          fontFamily="regular"
          title={`BEST: ${highScore}`}
          fontSize={14}
          style={{ color: "#00ffff", opacity: 0.6 }}
        />
        <Text
          fontFamily="regular"
          title={`LIVES: ${"❤️".repeat(lives)}`}
          fontSize={18}
          style={{ color: "#fff", marginTop: 5 }}
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
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#333" }]}
            onPress={() => router.back()}
          >
            <Text
              title="QUIT"
              fontSize={18}
              fontFamily="bold"
              style={{ color: "#fff" }}
            />
          </TouchableOpacity>
        </View>
      )}

      {!isLoaded && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#00ffff" />
          <Text
            fontFamily="bold"
            title="LOADING..."
            fontSize={14}
            style={{ color: "#00ffff", marginTop: 10 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020205" },
  hud: { position: "absolute", top: 50, left: 25, zIndex: 10 },
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
    borderRadius: 30,
    marginTop: 25,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#020205",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
});
