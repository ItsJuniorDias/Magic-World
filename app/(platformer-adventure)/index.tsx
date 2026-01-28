import React, { useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
} from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import * as THREE from "three";
import { Renderer, loadAsync } from "expo-three";
import * as ScreenOrientation from "expo-screen-orientation";
import Text from "@/components/text";

/* ================= ASSETS ================= */
const TEXTURES = {
  grass: require("../../assets/texture/grass.jpg"),
  bark: require("../../assets/texture/bark.jpg"),
  leaves: require("../../assets/texture/leaves.jpg"),
};

const MODEL_URL =
  "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb";

/* ================= CONFIGURAÇÕES ================= */
const MOVE_SPEED = 0.15;
const ROTATION_SPEED = 0.08;
const JOYSTICK_RADIUS = 40;
const SKY_COLOR = 0x0b1026;
const ATTACK_RANGE = 5.0; // Alcance aumentado para facilitar
const PLAYER_MAX_HP = 100;
const SPAWN_RATE = 120; // Frames entre nascimento de inimigos

type Enemy = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  hp: number;
  maxHp: number;
  hpBar: THREE.Mesh;
  hitFlash: number;
  attackCooldown: number;
};

type Particle = {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  type: "spark" | "smoke";
};

// Props opcionais
interface Props {
  onBackToHub?: () => void;
}

export default function EldoriaFinalBattle({ onBackToHub }: Props) {
  const { width, height } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const [loadingText, setLoadingText] = useState("Iniciando...");

  // --- ESTADO DA UI ---
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [isGameOverUI, setIsGameOverUI] = useState(false); // Controla visibilidade do Modal
  const redFlashOpacity = useRef(new Animated.Value(0)).current;

  // --- REFS LÓGICAS (PERFORMANCE) ---
  const movement = useRef({ x: 0, y: 0 });
  const anim = useRef({
    attackTimer: 0,
    attackType: "none",
    dash: 0,
    dashCooldown: 0,
    currentAction: "Idle",
  });
  const gameActiveRef = useRef(true); // Ref para controlar o loop sem re-renderizar
  const spawnTimer = useRef(0);
  const cameraShake = useRef(0);

  // --- REFS THREE.JS ---
  const sceneRef = useRef<THREE.Scene | null>(null);
  const enemies = useRef<Enemy[]>([]);
  const particles = useRef<Particle[]>([]);
  const requestRef = useRef<number>();
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<{ [key: string]: THREE.AnimationAction }>({});
  const clock = useRef(new THREE.Clock());

  const swordRef = useRef<THREE.Group | null>(null);
  const bladeMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const playerStats = useRef({ hp: PLAYER_MAX_HP });

  // Métodos acessíveis dentro do loop
  const gameMethods = useRef({
    spawnParticles: (
      pos: THREE.Vector3,
      type: "spark" | "smoke",
      count: number,
      color?: number,
    ) => {},
    takeDamage: (amount: number) => {},
    spawnEnemy: () => {},
  });

  const stickPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
    ).then(() => setReady(true));
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  /* ================= JOYSTICK ================= */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        if (!gameActiveRef.current) return;
        const d = Math.min(Math.sqrt(g.dx ** 2 + g.dy ** 2), JOYSTICK_RADIUS);
        const a = Math.atan2(g.dy, g.dx);
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        stickPos.setValue({ x, y });
        movement.current.x = x / JOYSTICK_RADIUS;
        movement.current.y = -y / JOYSTICK_RADIUS;
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

  /* ================= LÓGICA DE JOGO ================= */
  const handlePlayerDamage = (amount: number) => {
    if (!gameActiveRef.current) return;

    playerStats.current.hp -= amount;

    // Atualiza UI
    setPlayerHp(Math.max(0, playerStats.current.hp));

    // Flash Vermelho
    redFlashOpacity.setValue(0.8);
    Animated.timing(redFlashOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
    cameraShake.current = 0.6; // Shake forte

    // MORTE
    if (playerStats.current.hp <= 0) {
      playerStats.current.hp = 0;
      gameActiveRef.current = false; // Pausa lógica
      setIsGameOverUI(true); // Mostra modal
    }
  };

  const resetGame = () => {
    // Reseta variaveis
    playerStats.current.hp = PLAYER_MAX_HP;
    setPlayerHp(PLAYER_MAX_HP);
    enemies.current.forEach((e) => {
      sceneRef.current?.remove(e.mesh);
    });
    enemies.current = [];
    particles.current.forEach((p) => {
      sceneRef.current?.remove(p.mesh);
    });
    particles.current = [];

    if (playerRef.current) playerRef.current.position.set(0, 0, 0);

    gameActiveRef.current = true;
    setIsGameOverUI(false);

    // Spawn inicial
    for (let i = 0; i < 3; i++) gameMethods.current.spawnEnemy();
  };

  /* ================= THREE.JS ENGINE ================= */
  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(SKY_COLOR);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.Fog(SKY_COLOR, 15, 70);

    const camera = new THREE.PerspectiveCamera(
      60,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000,
    );

    gameMethods.current.takeDamage = handlePlayerDamage;

    // --- PARTÍCULAS ---
    gameMethods.current.spawnParticles = (pos, type, count, colorHex) => {
      const color = colorHex || (type === "spark" ? 0xffaa00 : 0xcccccc);
      const size = type === "spark" ? 0.2 : 0.4;
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size, size, size),
          new THREE.MeshBasicMaterial({ color, transparent: true }),
        );
        mesh.position
          .copy(pos)
          .add(
            new THREE.Vector3(
              Math.random() - 0.5,
              Math.random(),
              Math.random() - 0.5,
            ),
          );
        scene.add(mesh);
        particles.current.push({
          mesh,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            Math.random() * 0.4,
            (Math.random() - 0.5) * 0.3,
          ),
          life: 25,
          type,
        });
      }
    };

    // --- SPAWN INIMIGO ---
    const enemyGeo = new THREE.CapsuleGeometry(0.5, 1);
    const enemyMat = new THREE.MeshStandardMaterial({ color: 0xaa2222 });
    gameMethods.current.spawnEnemy = () => {
      if (!playerRef.current) return;
      const en = new THREE.Mesh(enemyGeo, enemyMat.clone());
      const ang = Math.random() * 6.28;
      const dist = 15 + Math.random() * 15;
      const spawnPos = playerRef.current.position
        .clone()
        .add(new THREE.Vector3(Math.cos(ang) * dist, 0, Math.sin(ang) * dist));
      en.position.set(spawnPos.x, 1, spawnPos.z);
      scene.add(en);
      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.15),
        new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      );
      bar.position.y = 1.8;
      en.add(bar);
      enemies.current.push({
        mesh: en,
        material: en.material as any,
        hp: 10,
        maxHp: 10,
        hpBar: bar,
        hitFlash: 0,
        attackCooldown: 0,
      });
    };

    // --- ASSETS ---
    setLoadingText("Carregando...");
    let loadedAssets: any = {};
    const assetsToLoad = [
      { key: "grass", res: TEXTURES.grass },
      { key: "bark", res: TEXTURES.bark },
      { key: "leaves", res: TEXTURES.leaves },
      { key: "knight", res: MODEL_URL },
    ];
    await Promise.all(
      assetsToLoad.map(async (item) => {
        try {
          loadedAssets[item.key] = await loadAsync(item.res);
        } catch (e) {}
      }),
    );
    setLoadingText("");

    const { grass, bark, leaves, knight } = loadedAssets;
    if (grass) {
      grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
      grass.repeat.set(20, 20);
    }

    // --- CENÁRIO ---
    scene.add(new THREE.AmbientLight(0x404050, 0.6));
    const moon = new THREE.DirectionalLight(0xaaccff, 1.2);
    moon.position.set(20, 50, 20);
    moon.castShadow = true;
    scene.add(moon);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
        map: grass || null,
        color: grass ? 0xffffff : 0x112211,
        roughness: 0.8,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Árvores
    const trunkG = new THREE.CylinderGeometry(0.3, 0.6, 3.5, 6);
    const leafG = new THREE.ConeGeometry(2.5, 6, 8);
    const trunkM = new THREE.MeshStandardMaterial({
      map: bark || null,
      color: 0x553311,
    });
    const leafM = new THREE.MeshStandardMaterial({
      map: leaves || null,
      color: 0x225522,
    });
    for (let i = 0; i < 20; i++) {
      const g = new THREE.Group();
      const t = new THREE.Mesh(trunkG, trunkM);
      t.position.y = 1.75;
      t.castShadow = true;
      const l = new THREE.Mesh(leafG, leafM);
      l.position.y = 4.5;
      l.castShadow = true;
      g.add(t);
      g.add(l);
      const a = Math.random() * 6.28;
      const r = 10 + Math.random() * 60;
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      scene.add(g);
    }

    // --- PLAYER ---
    const player = new THREE.Group();
    playerRef.current = player;
    scene.add(player);

    if (knight) {
      const model = knight.scene;
      model.scale.set(1.5, 1.5, 1.5);
      model.rotation.y = Math.PI;
      player.add(model);
      model.traverse((o: any) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.material) {
            o.material = o.material.clone();
            o.material.color.setHex(0x111111);
          }
        }
      });

      // ESPADA ANEXADA AO CORPO (Estabilidade para correr e atacar)
      const createSword = () => {
        const grp = new THREE.Group();
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 1.8, 0.08),
          new THREE.MeshStandardMaterial({
            color: 0x8899aa,
            emissive: 0x000000,
          }),
        );
        bladeMatRef.current = blade.material as THREE.MeshStandardMaterial;
        blade.position.y = 0.9;
        grp.add(blade);
        const guard = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.08, 0.15),
          new THREE.MeshStandardMaterial({ color: 0x111111 }),
        );
        guard.position.y = 0;
        grp.add(guard);
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.5),
          new THREE.MeshStandardMaterial({ color: 0x5c3a21 }),
        );
        handle.position.y = -0.25;
        grp.add(handle);
        return grp;
      };
      const sword = createSword();
      swordRef.current = sword;
      player.add(sword); // Fixa no grupo do player
      sword.position.set(0.65, 1.35, 0.5); // Posição da mão direita
      sword.rotation.set(Math.PI / 2, 0, 0); // Aponta pra frente

      if (knight.animations.length > 0) {
        mixer.current = new THREE.AnimationMixer(model);
        actions.current["Idle"] = mixer.current.clipAction(
          knight.animations[0],
        );
        actions.current["Run"] = mixer.current.clipAction(knight.animations[1]);
        actions.current["Idle"].play();
      }
    }

    // Spawn inicial
    for (let i = 0; i < 3; i++) gameMethods.current.spawnEnemy();

    // --- LOOP PRINCIPAL (CORRIGIDO PARA NÃO CRASHAR) ---
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);

      // 1. Renderiza SEMPRE, mesmo se Game Over (evita crash de contexto)
      renderer.render(scene, camera);

      // 2. Se Game Over, pula a lógica de atualização e só desenha o frame
      if (!gameActiveRef.current) {
        gl.endFrameEXP();
        return;
      }

      const delta = clock.current.getDelta();
      if (mixer.current) mixer.current.update(delta);

      // -- MOVIMENTO --
      const isMoving =
        Math.abs(movement.current.x) > 0 || Math.abs(movement.current.y) > 0;
      const target = isMoving ? "Run" : "Idle";
      if (target !== anim.current.currentAction && actions.current[target]) {
        actions.current[anim.current.currentAction].fadeOut(0.2);
        actions.current[target].reset().fadeIn(0.2).play();
        anim.current.currentAction = target;
      }

      player.rotation.y -= movement.current.x * ROTATION_SPEED;
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
      let spd = movement.current.y * MOVE_SPEED;

      if (anim.current.dash > 0) {
        spd += 0.4;
        anim.current.dash--;
        gameMethods.current.spawnParticles(player.position.clone(), "smoke", 1);
      }
      if (anim.current.dashCooldown > 0) anim.current.dashCooldown--;
      player.position.add(fwd.multiplyScalar(spd));

      // -- ESPADA --
      if (swordRef.current && bladeMatRef.current) {
        const mat = bladeMatRef.current;
        if (anim.current.attackTimer > 0) {
          anim.current.attackTimer--;
          // Swing: Vai de 90 (PI/2) a 180 (PI) e volta
          const progress = 1 - anim.current.attackTimer / 20;
          const angle =
            progress < 0.5
              ? THREE.MathUtils.lerp(Math.PI / 2, Math.PI, progress * 2)
              : THREE.MathUtils.lerp(
                  Math.PI,
                  Math.PI / 2,
                  (progress - 0.5) * 2,
                );
          swordRef.current.rotation.x = angle;

          if (anim.current.attackType === "light") {
            mat.emissive.setHex(0x00ffff);
            mat.emissiveIntensity = 2.0;
          } else {
            mat.emissive.setHex(0xff3300);
            mat.emissiveIntensity = 3.0;
          }
        } else {
          swordRef.current.rotation.x = Math.PI / 2;
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }

      // -- INIMIGOS E SPAWN --
      if (spawnTimer.current > 0) spawnTimer.current--;
      if (enemies.current.length < 8 && spawnTimer.current <= 0) {
        gameMethods.current.spawnEnemy();
        spawnTimer.current = SPAWN_RATE;
      }

      enemies.current.forEach((e) => {
        const dist = player.position.distanceTo(e.mesh.position);
        // IA Simples
        if (dist > 1.2)
          e.mesh.position.add(
            player.position
              .clone()
              .sub(e.mesh.position)
              .normalize()
              .multiplyScalar(0.04),
          );

        // Dano no Jogador
        if (dist < 1.5 && e.attackCooldown <= 0) {
          gameMethods.current.takeDamage(10);
          e.attackCooldown = 60;
        }
        if (e.attackCooldown > 0) e.attackCooldown--;

        e.mesh.lookAt(player.position);
        e.hpBar.lookAt(camera.position);
        if (e.hitFlash > 0) {
          e.hitFlash--;
          e.material.emissive.setHex(0xffffff);
        } else {
          e.material.emissive.setHex(0x000000);
        }
      });

      // -- PARTICULAS --
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.life--;
        p.mesh.position.add(p.vel);
        if (p.life <= 0) {
          scene.remove(p.mesh);
          particles.current.splice(i, 1);
        }
      }

      // -- CAMERA SHAKE --
      let sx = 0,
        sy = 0;
      if (cameraShake.current > 0) {
        sx = (Math.random() - 0.5) * cameraShake.current;
        sy = (Math.random() - 0.5) * cameraShake.current;
        cameraShake.current *= 0.9;
        if (cameraShake.current < 0.01) cameraShake.current = 0;
      }
      const camOff = new THREE.Vector3(sx, 5 + sy, -6).applyQuaternion(
        player.quaternion,
      );
      camera.position.lerp(player.position.clone().add(camOff), 0.1);
      camera.lookAt(player.position.clone().add(new THREE.Vector3(sx, 1, 0)));

      gl.endFrameEXP();
    };
    animate();
  };

  /* ================= CONTROLES ================= */
  const handleAttack = (type: "light" | "heavy") => {
    if (!gameActiveRef.current || anim.current.attackTimer > 0) return;
    anim.current.attackType = type;
    anim.current.attackTimer = 20;
    const dmg = type === "light" ? 4 : 8; // Dano aumentado

    if (playerRef.current) {
      const pPos = playerRef.current.position;
      const pFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(
        playerRef.current.quaternion,
      );
      enemies.current.forEach((e) => {
        const dist = pPos.distanceTo(e.mesh.position);
        const dir = e.mesh.position.clone().sub(pPos).normalize();
        if (dist < ATTACK_RANGE && pFwd.dot(dir) > 0.3) {
          e.hp -= dmg;
          e.hitFlash = 5;
          e.hpBar.scale.x = Math.max(0, e.hp / e.maxHp);
          gameMethods.current.spawnParticles(
            e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)),
            "spark",
            5,
            type === "light" ? 0x00ffff : 0xff3300,
          );
        }
      });
      // Limpar mortos
      for (let i = enemies.current.length - 1; i >= 0; i--) {
        if (enemies.current[i].hp <= 0) {
          sceneRef.current?.remove(enemies.current[i].mesh);
          enemies.current.splice(i, 1);
        }
      }
    }
  };

  if (!ready) return <View style={{ flex: 1, backgroundColor: SKY_COLOR }} />;

  return (
    <View style={[styles.container, { width, height }]}>
      <GLView
        style={StyleSheet.absoluteFillObject}
        onContextCreate={onContextCreate}
      />

      {/* FLASH DANO */}
      <Animated.View
        style={[styles.damageFlash, { opacity: redFlashOpacity }]}
        pointerEvents="none"
      />

      {/* HUD HP */}
      {!isGameOverUI && (
        <View style={styles.playerStats} pointerEvents="none">
          <View style={styles.hpBarContainer}>
            <View
              style={[
                styles.hpBarFill,
                { width: `${(playerHp / PLAYER_MAX_HP) * 100}%` },
              ]}
            />
          </View>
          <Text
            title={`HP: ${Math.ceil(playerHp)}`}
            style={{ color: "white", marginTop: 5 }}
          />
        </View>
      )}

      {/* LOADING */}
      {loadingText !== "" && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text title={loadingText} style={{ color: "white", marginTop: 10 }} />
        </View>
      )}

      {/* GAME OVER MODAL */}
      <Modal visible={isGameOverUI} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text
              title="VOCÊ MORREU"
              style={{ color: "#ff4444", fontSize: 32, marginBottom: 10 }}
              fontFamily="bold"
            />
            <Text
              title="Os inimigos te dominaram."
              style={{ color: "#aaa", marginBottom: 20 }}
            />
            <TouchableOpacity style={styles.modalBtn} onPress={resetGame}>
              <Text
                title="TENTAR NOVAMENTE"
                style={{ color: "white" }}
                fontFamily="bold"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#444" }]}
              onPress={onBackToHub}
            >
              <Text
                title="VOLTAR AO HUB"
                style={{ color: "white" }}
                fontFamily="bold"
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CONTROLES */}
      {!isGameOverUI && (
        <View style={styles.overlay} pointerEvents="box-none">
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
                  if (anim.current.dashCooldown <= 0) {
                    anim.current.dash = 15;
                    anim.current.dashCooldown = 40;
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
  playerStats: { position: "absolute", top: 20, left: 20, zIndex: 6 },
  hpBarContainer: {
    width: 200,
    height: 20,
    backgroundColor: "#330000",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#555",
  },
  hpBarFill: { height: "100%", backgroundColor: "#ff0000", borderRadius: 4 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 30,
  },
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
    width: 60,
    height: 60,
    borderRadius: 30,
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
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
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
});
