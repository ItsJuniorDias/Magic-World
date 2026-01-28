import React, { useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import * as THREE from "three";
import { Renderer, loadAsync } from "expo-three";
import * as ScreenOrientation from "expo-screen-orientation";
import Text from "@/components/text";

// Importando nossos módulos separados
import { CONFIG, TEXTURES } from "./utils/config";
import { createPlayerSystem } from "./utils/PlayerSystem";
import {
  spawnEnemy,
  createParticle,
  loadEnemyAssets,
  Enemy,
  Particle,
} from "./utils/GameSystems";
import { router } from "expo-router";

export default function EldoriaFinalBattle({
  onBackToHub,
}: {
  onBackToHub?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // UI States
  const [playerHp, setPlayerHp] = useState(CONFIG.PLAYER_MAX_HP);
  const [isGameOver, setIsGameOver] = useState(false);
  const redFlashOpacity = useRef(new Animated.Value(0)).current;

  // Refs do Jogo
  const sceneRef = useRef<THREE.Scene | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const swordRef = useRef<THREE.Group | null>(null);
  const swordMeshesRef = useRef<THREE.Mesh[]>([]);

  const enemies = useRef<Enemy[]>([]);
  const particles = useRef<Particle[]>([]);

  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<any>({});

  const gameActive = useRef(true);
  const clock = useRef(new THREE.Clock());
  const movement = useRef({ x: 0, y: 0 });

  // Refs de Lógica
  const logic = useRef({
    attackTimer: 0,
    attackType: "none",
    dash: 0,
    dashCooldown: 0,
    currentAction: "Idle",
    spawnTimer: 0,
    cameraShake: 0,
    hp: CONFIG.PLAYER_MAX_HP,
  });

  const requestRef = useRef<number>();
  const stickPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // LIMPEZA E ORIENTAÇÃO
  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
    ).then(() => setReady(true));

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      sceneRef.current?.traverse((object: any) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((m: any) => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, []);

  // --- JOYSTICK ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        if (!gameActive.current) return;
        const d = Math.min(
          Math.sqrt(g.dx ** 2 + g.dy ** 2),
          CONFIG.JOYSTICK_RADIUS,
        );
        const a = Math.atan2(g.dy, g.dx);
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        stickPos.setValue({ x, y });
        movement.current.x = x / CONFIG.JOYSTICK_RADIUS;
        movement.current.y = -y / CONFIG.JOYSTICK_RADIUS;
      },
      onPanResponderRelease: () => {
        Animated.spring(stickPos, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
        movement.current.x = 0;
        movement.current.y = 0;
      },
    }),
  ).current;

  // --- ENGINE ---
  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(CONFIG.SKY_COLOR);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.Fog(CONFIG.SKY_COLOR, 15, 80);

    const camera = new THREE.PerspectiveCamera(
      60,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000,
    );

    // Luz e Chão
    scene.add(new THREE.AmbientLight(0x404050, 0.6));
    const dirLight = new THREE.DirectionalLight(0xaaccff, 1.2);
    dirLight.position.set(20, 50, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Carregamento de Assets em Paralelo
    const [pData, eLoaded, moonTex] = await Promise.all([
      createPlayerSystem(scene),
      loadEnemyAssets(require("../../assets/models/robot.glb")),
      loadAsync(TEXTURES.moon),
    ]);

    if (pData) {
      playerRef.current = pData.playerGroup;
      swordRef.current = pData.swordContainer;
      swordMeshesRef.current = pData.swordMeshes;
      mixer.current = pData.mixer;
      actions.current = pData.actions;
    }

    if (moonTex) {
      moonTex.wrapS = moonTex.wrapT = THREE.RepeatWrapping;
      moonTex.repeat.set(20, 20);
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshStandardMaterial({ map: moonTex, roughness: 0.8 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
    }

    setLoading(false);

    // Spawn Inicial
    if (playerRef.current) {
      for (let i = 0; i < 3; i++) {
        enemies.current.push(spawnEnemy(scene, playerRef.current.position));
      }
    }

    // --- LOOP PRINCIPAL ---
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);

      if (!gameActive.current || !playerRef.current) {
        gl.endFrameEXP();
        return;
      }

      const delta = clock.current.getDelta();
      if (mixer.current) mixer.current.update(delta);

      // 1. Movimento do Player
      const p = playerRef.current;
      const isMoving =
        Math.abs(movement.current.x) > 0 || Math.abs(movement.current.y) > 0;
      const targetAnim = isMoving ? "Run" : "Idle";

      if (
        actions.current[targetAnim] &&
        logic.current.currentAction !== targetAnim
      ) {
        actions.current[logic.current.currentAction]?.fadeOut(0.2);
        actions.current[targetAnim].reset().fadeIn(0.2).play();
        logic.current.currentAction = targetAnim;
      }

      p.rotation.y -= movement.current.x * CONFIG.ROTATION_SPEED;
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(p.quaternion);
      let speed = movement.current.y * CONFIG.MOVE_SPEED;

      if (logic.current.dash > 0) {
        speed += 0.4;
        logic.current.dash--;
        particles.current.push(
          createParticle(scene, p.position.clone(), "smoke"),
        );
      }
      if (logic.current.dashCooldown > 0) logic.current.dashCooldown--;
      p.position.add(fwd.multiplyScalar(speed));

      // 2. Lógica da Espada
      if (swordRef.current && logic.current.attackTimer > 0) {
        logic.current.attackTimer--;
        const prog = 1 - logic.current.attackTimer / 20;
        const swing =
          prog < 0.5
            ? THREE.MathUtils.lerp(0, Math.PI / 1.5, prog * 2)
            : THREE.MathUtils.lerp(Math.PI / 1.5, 0, (prog - 0.5) * 2);
        swordRef.current.rotation.x = -Math.PI / 2 + swing;

        const color =
          logic.current.attackType === "light" ? 0x00ffff : 0xff0000;
        swordMeshesRef.current.forEach((m) => {
          (m.material as THREE.MeshStandardMaterial).emissive.setHex(color);
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 2;
        });
      } else if (swordRef.current) {
        swordRef.current.rotation.x = -Math.PI / 2;
        swordMeshesRef.current.forEach((m) => {
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        });
      }

      // 3. Inimigos (IA + ANIMAÇÕES + ESCALA)

      if (logic.current.spawnTimer > 0) logic.current.spawnTimer--;
      if (
        enemies.current.length < CONFIG.MAX_ENEMIES &&
        logic.current.spawnTimer <= 0
      ) {
        enemies.current.push(spawnEnemy(scene, p.position));
        logic.current.spawnTimer = CONFIG.SPAWN_RATE;
      }

      enemies.current.forEach((e) => {
        // Atualiza animação individual do robô
        e.mixer.update(delta);

        const dist = p.position.distanceTo(e.mesh.position);

        // IA de Movimento
        if (dist > 1.3) {
          const moveDir = p.position.clone().sub(e.mesh.position).normalize();
          // Velocidade inversamente proporcional à escala (maiores são mais lentos)
          const step = 0.04 / (e.mesh.scale.x * 0.9);
          e.mesh.position.add(moveDir.multiplyScalar(step));

          if (e.actions["Walk"] && !e.actions["Walk"].isRunning()) {
            e.actions["Idle"]?.fadeOut(0.2);
            e.actions["Walk"].reset().fadeIn(0.2).play();
          }
        } else {
          if (e.actions["Idle"] && !e.actions["Idle"].isRunning()) {
            e.actions["Walk"]?.fadeOut(0.2);
            e.actions["Idle"].reset().fadeIn(0.2).play();
          }
        }

        e.mesh.lookAt(p.position);
        e.hpBar.lookAt(camera.position);

        if (dist < 1.5 && e.attackCooldown <= 0) {
          takeDamage(10);
          e.attackCooldown = 60;
          if (e.actions["Attack"]) e.actions["Attack"].reset().play();
        }

        if (e.attackCooldown > 0) e.attackCooldown--;

        // Efeito de Hit Flash
        if (e.hitFlash > 0) {
          e.hitFlash--;
          e.material.emissive.setHex(0xffffff);
          e.material.emissiveIntensity = 1;
        } else {
          e.material.emissive.setHex(0x000000);
          e.material.emissiveIntensity = 0;
        }
      });

      // 4. Partículas
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const pt = particles.current[i];
        pt.life--;
        pt.mesh.position.add(pt.vel);
        if (pt.life <= 0) {
          scene.remove(pt.mesh);
          particles.current.splice(i, 1);
        }
      }

      // 5. Câmera (Follow + Shake)
      let sx = 0,
        sy = 0;
      if (logic.current.cameraShake > 0) {
        sx = (Math.random() - 0.5) * logic.current.cameraShake;
        sy = (Math.random() - 0.5) * logic.current.cameraShake;
        logic.current.cameraShake *= 0.9;
      }
      const camOffset = new THREE.Vector3(
        0.8 + sx,
        3.5 + sy,
        -6.0,
      ).applyQuaternion(p.quaternion);
      camera.position.lerp(p.position.clone().add(camOffset), 0.1);
      camera.lookAt(p.position.clone().add(new THREE.Vector3(0, 1.8, 0)));

      gl.endFrameEXP();
    };
    animate();
  };

  const takeDamage = (amount: number) => {
    if (!gameActive.current) return;
    logic.current.hp -= amount;
    setPlayerHp(Math.max(0, logic.current.hp));

    redFlashOpacity.setValue(0.8);
    Animated.timing(redFlashOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
    logic.current.cameraShake = 0.6;

    if (logic.current.hp <= 0) {
      gameActive.current = false;
      setIsGameOver(true);
    }
  };

  const handleAttack = (type: "light" | "heavy") => {
    if (
      !gameActive.current ||
      logic.current.attackTimer > 0 ||
      !playerRef.current
    )
      return;

    logic.current.attackType = type;
    logic.current.attackTimer = 20;
    const dmg = type === "light" ? 4 : 8;

    const pPos = playerRef.current.position;
    const pFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(
      playerRef.current.quaternion,
    );

    enemies.current.forEach((e) => {
      const dir = e.mesh.position.clone().sub(pPos).normalize();
      const dist = pPos.distanceTo(e.mesh.position);
      if (dist < CONFIG.ATTACK_RANGE && pFwd.dot(dir) > 0.3) {
        e.hp -= dmg;
        e.hitFlash = 5;
        e.hpBar.scale.x = Math.max(0, e.hp / e.maxHp);
        particles.current.push(
          createParticle(
            sceneRef.current!,
            e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)),
            "spark",
          ),
        );
      }
    });

    for (let i = enemies.current.length - 1; i >= 0; i--) {
      if (enemies.current[i].hp <= 0) {
        sceneRef.current?.remove(enemies.current[i].mesh);
        enemies.current.splice(i, 1);
      }
    }
  };

  const resetGame = () => {
    logic.current.hp = CONFIG.PLAYER_MAX_HP;
    setPlayerHp(CONFIG.PLAYER_MAX_HP);
    enemies.current.forEach((e) => sceneRef.current?.remove(e.mesh));
    enemies.current = [];
    if (playerRef.current) playerRef.current.position.set(0, 0, 0);
    gameActive.current = true;
    setIsGameOver(false);
    for (let i = 0; i < 3; i++) {
      if (playerRef.current)
        enemies.current.push(
          spawnEnemy(sceneRef.current!, playerRef.current.position),
        );
    }
  };

  if (!ready) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  return (
    <View style={[styles.container, { width, height }]}>
      <GLView
        style={StyleSheet.absoluteFillObject}
        onContextCreate={onContextCreate}
      />
      <Animated.View
        style={[styles.damageFlash, { opacity: redFlashOpacity }]}
        pointerEvents="none"
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text
            title="Carregando Eldoria..."
            style={{ color: "white", marginTop: 10 }}
          />
        </View>
      )}

      {isGameOver && (
        <View style={styles.gameOverOverlay}>
          <View style={styles.modalContent}>
            <Text
              title="YOU DIED"
              style={{ color: "#ff4444", fontSize: 32, marginBottom: 10 }}
              fontFamily="bold"
            />
            <TouchableOpacity style={styles.modalBtn} onPress={resetGame}>
              <Text
                title="TRY AGAIN"
                style={{ color: "white" }}
                fontFamily="bold"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.back} onPress={() => router.back()}>
              <Text
                title="BACK TO HUB"
                style={{ color: "white" }}
                fontFamily="bold"
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isGameOver && !loading && (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.playerStats}>
            <View style={styles.hpBarContainer}>
              <View
                style={[
                  styles.hpBarFill,
                  { width: `${(playerHp / CONFIG.PLAYER_MAX_HP) * 100}%` },
                ]}
              />
            </View>
          </View>

          <View style={styles.hud} pointerEvents="box-none">
            <View style={styles.joyArea} {...panResponder.panHandlers}>
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
            <View style={styles.pad}>
              <TouchableOpacity
                style={[styles.btn, styles.heavy, styles.up]}
                onPress={() => handleAttack("heavy")}
              >
                <Text
                  title="H"
                  style={{ color: "white" }}
                  fontFamily="bold"
                  fontSize={20}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.light, styles.left]}
                onPress={() => handleAttack("light")}
              >
                <Text
                  title="L"
                  style={{ color: "white" }}
                  fontFamily="bold"
                  fontSize={20}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.dash, styles.right]}
                onPress={() => {
                  if (logic.current.dashCooldown <= 0) {
                    logic.current.dash = 15;
                    logic.current.dashCooldown = 40;
                  }
                }}
              >
                <Text
                  title="D"
                  style={{ color: "white" }}
                  fontFamily="bold"
                  fontSize={20}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#0b1026" },
  damageFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "red",
    zIndex: 5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,1)",
  },
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    zIndex: 20,
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555",
  },
  modalBtn: {
    width: "100%",
    padding: 15,
    backgroundColor: "#ff4444",
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  back: {
    width: "100%",
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 30,
  },
  playerStats: { position: "absolute", top: 20, left: 20 },
  hpBarContainer: {
    width: 200,
    height: 20,
    backgroundColor: "#330000",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#555",
  },
  hpBarFill: { height: "100%", backgroundColor: "#ff0000", borderRadius: 4 },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    alignItems: "flex-end",
  },
  joyArea: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  joyBase: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  joyStick: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 200, 50, 0.8)",
  },
  pad: { width: 160, height: 160 },
  btn: {
    width: 80,
    height: 80,
    borderRadius: 50,
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  up: { top: 0, left: 50 },
  left: { top: 60, left: 0 },
  right: { top: 60, right: 0 },
  light: { borderColor: "#66ccff" },
  heavy: { borderColor: "#ff4444" },
  dash: { borderColor: "#ffaa00" },
});
