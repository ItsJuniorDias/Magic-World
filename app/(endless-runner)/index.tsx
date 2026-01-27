import React, { useRef, useEffect, useState } from "react";
import {
  View,
  PanResponder,
  useWindowDimensions,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { GLView } from "expo-gl";
import * as THREE from "three";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Text from "@/components/text";
import { Asset } from "expo-asset";
import { GLTFLoader } from "three-stdlib";
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
  { base: 0xff6600, emissive: 0x442200 },
  { base: 0x6600ff, emissive: 0x220044 },
];

export default function FantasyRunnerEndGame() {
  const { width } = useWindowDimensions();
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [lives, setLives] = useState(3);
  const [hasShield, setHasShield] = useState(false);

  const damageOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const playerRef = useRef<THREE.Group | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const galaxiesRef = useRef<THREE.Group | null>(null);
  const moonRef = useRef<THREE.Group | null>(null);
  const phoenixRef = useRef<THREE.Group | null>(null);
  const obstaclesRef = useRef<THREE.Object3D[]>([]);
  const explosionRef = useRef<THREE.Group | null>(null);
  const flamesRef = useRef<THREE.Mesh[]>([]);
  const heartRef = useRef<THREE.Mesh | null>(null);
  const coinRef = useRef<THREE.Mesh | null>(null);
  const shieldMeshRef = useRef<THREE.Mesh | null>(null);
  const shieldItemRef = useRef<THREE.Group | null>(null);

  const gameActive = useRef(true);
  const speedRef = useRef(0.35);
  const panX = useRef(0);
  const scoreCounter = useRef(0);
  const bgmRef = useRef<Audio.Sound | null>(null);
  const cameraShakeRef = useRef(0);
  const activeShield = useRef(false);

  const STAR_COUNT = 800;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: loadProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [loadProgress]);

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
          {
            uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
          },
          { shouldPlay: true, isLooping: true, volume: 0.2 },
        );
        bgmRef.current = sound;
      } catch (e) {}
    }
    init();
    return () => {
      bgmRef.current?.unloadAsync();
    };
  }, []);

  const updateScore = (points: number) => {
    scoreCounter.current += points;
    setScore(scoreCounter.current);
  };

  const randomizePlanetColor = (
    planetGroup: THREE.Group | THREE.Object3D | null,
  ) => {
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

  const triggerDamageEffect = () => {
    cameraShakeRef.current = 1.5;
    damageOpacity.setValue(0.7);
    Animated.timing(damageOpacity, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const restartGame = () => {
    scoreCounter.current = 0;
    setScore(0);
    setLives(3);
    setHasShield(false);
    activeShield.current = false;
    setIsGameOver(false);
    speedRef.current = 0.35;
    panX.current = 0;
    gameActive.current = true;
    if (playerRef.current) {
      playerRef.current.position.set(0, 1, 0);
      playerRef.current.rotation.set(0, 0, 0);
      playerRef.current.visible = true;
    }
    if (shieldMeshRef.current) shieldMeshRef.current.visible = false;
    if (explosionRef.current) explosionRef.current.visible = false;
    obstaclesRef.current.forEach((obj, i) => {
      obj.position.set(randomRange(-6, 6), 0.8, -i * 15 - 30);
      const s = randomRange(0.06, 0.12);
      obj.scale.set(
        s * randomRange(0.8, 1.2),
        s * randomRange(0.8, 1.2),
        s * randomRange(0.8, 1.2),
      );
      (obj as any).hitRadius = s * 14; // Re-calcula raio de colisão no reset
    });
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
    scene.fog = new THREE.Fog(0x020205, 10, 200);

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(0, 5, 12);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 4);
    sun.position.set(5, 15, 10);
    scene.add(sun);

    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 400;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
      starPos[i * 3 + 2] = Math.random() * -600;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
      }),
    );
    scene.add(stars);
    starsRef.current = stars;

    const loader = new GLTFLoader();
    try {
      const assetsList = [
        { id: "ship", mod: require("../../assets/models/craft_speederA.glb") },
        {
          id: "ast",
          mod: require("../../assets/models/asteroid_low_poly.glb"),
        },
        { id: "moon", mod: require("../../assets/models/moon_planet.glb") },
        {
          id: "phx",
          mod: require("../../assets/models/planet_of_phoenix.glb"),
        },
      ];

      const models: any = {};
      for (let i = 0; i < assetsList.length; i++) {
        const asset = Asset.fromModule(assetsList[i].mod);
        await asset.downloadAsync();
        const gltf = await loader.loadAsync(asset.uri!);
        models[assetsList[i].id] = gltf.scene;
        setLoadProgress((i + 1) / assetsList.length);
      }

      const shipBox = new THREE.Box3().setFromObject(models.ship);
      const shipSize = shipBox.getSize(new THREE.Vector3());
      const shipCenter = shipBox.getCenter(new THREE.Vector3());
      const shipContainer = new THREE.Group();
      models.ship.position.sub(shipCenter);
      shipContainer.add(models.ship);

      const sGeo = new THREE.IcosahedronGeometry(1.8, 1);
      const sMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      const shieldMesh = new THREE.Mesh(sGeo, sMat);
      shieldMesh.visible = false;
      shipContainer.add(shieldMesh);
      shieldMeshRef.current = shieldMesh;

      const flameGeo = new THREE.ConeGeometry(0.1, 0.8, 8).rotateX(
        -Math.PI / 2,
      );
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      });
      const lF = new THREE.Mesh(flameGeo, flameMat.clone());
      const rF = new THREE.Mesh(flameGeo, flameMat.clone());
      lF.position.set(-shipSize.x * 0.22, -0.05, shipSize.z / 2);
      rF.position.set(shipSize.x * 0.22, -0.05, shipSize.z / 2);
      shipContainer.add(lF, rF);
      flamesRef.current = [lF, rF];

      const pGroup = new THREE.Group();
      pGroup.add(shipContainer);
      scene.add(pGroup);
      playerRef.current = pGroup;

      for (let i = 0; i < 8; i++) {
        const obs = models.ast.clone();
        obs.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
              color: 0x444444,
              roughness: 0.85,
              metalness: 0.2,
            });
          }
        });

        const baseScale = randomRange(0.06, 0.12);
        obs.scale.set(
          baseScale * randomRange(0.8, 1.3),
          baseScale * randomRange(0.8, 1.3),
          baseScale * randomRange(0.8, 1.3),
        );

        obs.position.set(randomRange(-6, 6), 0.8, -i * 15 - 30);
        (obs as any).rotationSpeed = (0.04 / baseScale) * 0.01;

        // --- COLISÃO AUMENTADA ---
        // hitRadius baseado no tamanho visual, multiplicado por um fator de sensibilidade
        (obs as any).hitRadius = baseScale * 14.5;

        scene.add(obs);
        obstaclesRef.current.push(obs);
      }

      heartRef.current = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.4, 0),
        new THREE.MeshStandardMaterial({ color: 0xff0066, emissive: 0x440022 }),
      );
      heartRef.current.position.set(0, 0.8, -100);
      scene.add(heartRef.current);

      coinRef.current = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.08, 12, 32),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0x664400 }),
      );
      coinRef.current.position.set(2, 0.8, -120);
      scene.add(coinRef.current);

      const sItem = new THREE.Group();
      sItem.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.6, 0.6),
          new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }),
        ),
        new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.3, 0.3),
          new THREE.MeshBasicMaterial({ color: 0x00ffff }),
        ),
      );
      sItem.position.set(randomRange(-6, 6), 0.8, -180);
      scene.add(sItem);
      shieldItemRef.current = sItem;

      models.moon.scale.set(4, 4, 4);
      models.moon.position.set(-25, 12, -80);
      moonRef.current = models.moon;
      scene.add(models.moon);

      models.phx.scale.set(5, 5, 5);
      models.phx.position.set(25, 15, -130);
      phoenixRef.current = models.phx;
      scene.add(models.phx);

      setIsLoaded(true);
    } catch (e) {
      console.error(e);
    }

    const expG = new THREE.Group();
    for (let i = 0; i < 20; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xff4400 }),
      );
      (p as any).velocity = new THREE.Vector3(
        randomRange(-0.5, 0.5),
        randomRange(-0.5, 0.5),
        randomRange(-0.5, 0.5),
      );
      expG.add(p);
    }
    expG.visible = false;
    scene.add(expG);
    explosionRef.current = expG;

    const animate = () => {
      if (!gl) return;
      requestAnimationFrame(animate);

      if (gameActive.current && playerRef.current) {
        const difficultyFactor = 1 + (scoreCounter.current / 1000) * 0.2;
        const currentSpeed = speedRef.current * difficultyFactor;
        speedRef.current += 0.00002;

        if (starsRef.current) {
          const positions = starsRef.current.geometry.attributes.position
            .array as Float32Array;
          const warpMultiplier = 14 * difficultyFactor;
          for (let i = 0; i < STAR_COUNT; i++) {
            positions[i * 3 + 2] += currentSpeed * warpMultiplier;
            if (positions[i * 3 + 2] > 15) {
              positions[i * 3 + 2] = -600;
              positions[i * 3] = (Math.random() - 0.5) * 400;
              positions[i * 3 + 1] = (Math.random() - 0.5) * 400;
            }
          }
          starsRef.current.geometry.attributes.position.needsUpdate = true;
        }

        const prevX = playerRef.current.position.x;
        playerRef.current.position.x += (panX.current - prevX) * 0.12;
        const deltaX = playerRef.current.position.x - prevX;
        playerRef.current.rotation.z = -deltaX * 2.5;
        playerRef.current.rotation.y = deltaX * 0.8;

        obstaclesRef.current.forEach((obs) => {
          obs.position.z += currentSpeed;
          const rSpeed = (obs as any).rotationSpeed || 0.02;
          obs.rotation.x += rSpeed * difficultyFactor;
          obs.rotation.y += rSpeed * 0.5;

          // --- LÓGICA DE COLISÃO REALISTA (AUMENTADA) ---
          // Agora usamos o hitRadius individual de cada meteoro
          const distance = playerRef.current!.position.distanceTo(obs.position);
          const collisionThreshold = (obs as any).hitRadius || 1.2;

          if (distance < collisionThreshold) {
            if (activeShield.current) {
              activeShield.current = false;
              setHasShield(false);
              if (shieldMeshRef.current) shieldMeshRef.current.visible = false;
              cameraShakeRef.current = 1.0;
            } else {
              triggerDamageEffect();
              setLives((l) => {
                if (l <= 1) {
                  gameActive.current = false;
                  playerRef.current!.visible = false;
                  explosionRef.current!.position.copy(
                    playerRef.current!.position,
                  );
                  explosionRef.current!.visible = true;
                  setIsGameOver(true);
                  if (scoreCounter.current > highScore) {
                    AsyncStorage.setItem(
                      "@high_score",
                      scoreCounter.current.toString(),
                    );
                    setHighScore(scoreCounter.current);
                  }
                  return 0;
                }
                return l - 1;
              });
            }
            obs.position.z = -120;
          }

          if (obs.position.z > 15) {
            obs.position.z = -120;
            obs.position.x = randomRange(-7, 7);
            const newBase = randomRange(0.06, 0.12);
            obs.scale.set(
              newBase * randomRange(0.8, 1.3),
              newBase * randomRange(0.8, 1.3),
              newBase * randomRange(0.8, 1.3),
            );
            (obs as any).rotationSpeed = (0.04 / newBase) * 0.01;
            (obs as any).hitRadius = newBase * 14.5; // Atualiza raio na reciclagem
            updateScore(10);
          }
        });

        // ITENS
        [heartRef.current, coinRef.current, shieldItemRef.current].forEach(
          (item) => {
            if (!item) return;
            item.position.z += currentSpeed;
            item.rotation.y += 0.04;
            if (playerRef.current!.position.distanceTo(item.position) < 1.4) {
              if (item === heartRef.current)
                setLives((l) => Math.min(l + 1, 3));
              if (item === coinRef.current) updateScore(250);
              if (item === shieldItemRef.current) {
                activeShield.current = true;
                setHasShield(true);
                if (shieldMeshRef.current) shieldMeshRef.current.visible = true;
              }
              item.position.z = -randomRange(150, 250);
              item.position.x = randomRange(-6, 6);
            }
            if (item.position.z > 15) {
              item.position.z = -randomRange(150, 250);
              item.position.x = randomRange(-6, 6);
            }
          },
        );

        flamesRef.current.forEach((f, i) => {
          const pulse = 1 + Math.sin(Date.now() * 0.03 + i) * 0.3;
          f.scale.set(
            pulse * (0.8 + difficultyFactor * 0.2),
            pulse * (0.8 + difficultyFactor * 0.2),
            pulse * (1.5 + difficultyFactor * 1.0),
          );
          (f.material as THREE.MeshBasicMaterial).color.setHex(
            difficultyFactor > 2 ? 0x00ffff : 0xff4400,
          );
        });

        if (shieldMeshRef.current?.visible) {
          shieldMeshRef.current.rotation.y += 0.05;
          const sPulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.1;
          shieldMeshRef.current.scale.set(sPulse, sPulse, sPulse);
        }

        if (moonRef.current) {
          moonRef.current.position.z += currentSpeed * 0.15;
          if (moonRef.current.position.z > 40) {
            moonRef.current.position.z = -140;
            randomizePlanetColor(moonRef.current);
          }
        }
        if (phoenixRef.current) {
          phoenixRef.current.position.z += currentSpeed * 0.1;
          if (phoenixRef.current.position.z > 40) {
            phoenixRef.current.position.z = -180;
            randomizePlanetColor(phoenixRef.current);
          }
        }
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
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "red",
            opacity: damageOpacity,
            pointerEvents: "none",
          },
        ]}
      />

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
          fontSize={18}
          color="#00ffff"
        />
        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
        >
          <Text
            fontFamily="regular"
            title={`${"❤️".repeat(lives)}`}
            fontSize={18}
          />
          {hasShield && (
            <View style={styles.shieldBadge}>
              <Text
                title="🛡️ GRID ACTIVE"
                fontSize={12}
                fontFamily="bold"
                style={{ color: "#00ffff" }}
              />
            </View>
          )}
        </View>
      </View>

      {isGameOver && (
        <View style={styles.overlay}>
          <Text
            title="GAME OVER"
            fontSize={40}
            fontFamily="bold"
            style={styles.gameOverText}
          />
          <TouchableOpacity style={styles.btn} onPress={restartGame}>
            <Text
              title="RETRY"
              fontSize={20}
              fontFamily="bold"
              style={{ color: "#000" }}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
            <Text
              title="BACK"
              fontSize={20}
              fontFamily="bold"
              style={{ color: "#000" }}
            />
          </TouchableOpacity>
        </View>
      )}

      {!isLoaded && (
        <View style={styles.loader}>
          <Text
            title="LOADING ..."
            fontSize={18}
            fontFamily="bold"
            style={{ color: "#00ffff", marginBottom: 20 }}
          />
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020205" },
  hud: { position: "absolute", top: 55, left: 25, zIndex: 10 },
  neonText: {
    color: "#00ffff",
    textShadowColor: "#00ffff",
    textShadowRadius: 15,
  },
  shieldBadge: {
    marginLeft: 12,
    backgroundColor: "rgba(0, 255, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#00ffff",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  gameOverText: {
    color: "#ff00ff",
    textShadowColor: "#ff00ff",
    textShadowRadius: 20,
  },
  btn: {
    backgroundColor: "#00ffff",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 4,
    marginTop: 20,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#020205",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  progressBarContainer: {
    width: "70%",
    height: 4,
    backgroundColor: "rgba(0, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: "#00ffff" },
});
