import React, { useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import * as THREE from "three";
import { Renderer } from "expo-three";
import * as ScreenOrientation from "expo-screen-orientation";

/* ================= CONSTANTES ================= */
const MOVE_SPEED = 0.25;
const ROTATION_SPEED = 0.06;
const JOYSTICK_RADIUS = 40;

/* ================= TIPOS ================= */
type Enemy = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  hp: number;
  maxHp: number;
  hpBar: THREE.Mesh;
  hitFlash: number;
  strafe: number;
};

type Particle = {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
};

export default function EldoriaCombatFinal() {
  const { width, height } = useWindowDimensions();
  const [ready, setReady] = useState(false);

  const movement = useRef({ x: 0, y: 0 });
  const anim = useRef({
    attack: 0,
    swordAngle: 0,
    swordTarget: 0,
    dash: 0,
    dashCooldown: 0,
  });
  const attack = useRef({ light: false, heavy: false });

  const enemies = useRef<Enemy[]>([]);
  const particles = useRef<Particle[]>([]);
  const requestRef = useRef<number>();

  const stickPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    ).then(() => setTimeout(() => setReady(true), 300));

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  /* ================= JOYSTICK ================= */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
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

  /* ================= THREE ================= */
  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x07060c);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x07060c, 20, 120);

    const camera = new THREE.PerspectiveCamera(
      75,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000,
    );

    /* ---------- LUZ ---------- */
    scene.add(new THREE.AmbientLight(0x4040ff, 0.35));
    const moon = new THREE.DirectionalLight(0xffffff, 0.9);
    moon.position.set(20, 40, 20);
    scene.add(moon);

    /* ---------- CHÃO ---------- */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 3000),
      new THREE.MeshStandardMaterial({ color: 0x1b1b1b }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    /* ---------- ÁRVORES ---------- */
    const treeMatTrunk = new THREE.MeshStandardMaterial({ color: 0x5a3b1e });
    const treeMatLeaf = new THREE.MeshStandardMaterial({ color: 0x1f5f2f });

    for (let i = 0; i < 80; i++) {
      const z = -i * 20 - 20;
      [-1, 1].forEach((side) => {
        const tree = new THREE.Group();

        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.4, 3),
          treeMatTrunk,
        );
        trunk.position.y = 1.5;

        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(1.6, 8, 8),
          treeMatLeaf,
        );
        leaf.position.y = 3.5;

        tree.add(trunk);
        tree.add(leaf);

        tree.position.set(side * (10 + Math.random() * 6), 0, z);
        scene.add(tree);
      });
    }

    /* ---------- PLAYER ---------- */
    const player = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xeaeaea }),
    );
    body.position.y = 0.8;
    player.add(body);

    /* ---------- ESPADA ---------- */
    const sword = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.9, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 1,
        roughness: 0.2,
      }),
    );
    sword.position.set(0.45, 0.9, 0);
    sword.rotation.z = Math.PI / 6;
    player.add(sword);

    scene.add(player);

    /* ---------- PARTICULAS ---------- */
    const spawnHitParticles = (pos: THREE.Vector3) => {
      for (let i = 0; i < 6; i++) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.05),
          new THREE.MeshBasicMaterial({ color: 0xff3333 }),
        );
        mesh.position.copy(pos);
        scene.add(mesh);

        particles.current.push({
          mesh,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            Math.random() * 0.3,
            (Math.random() - 0.5) * 0.3,
          ),
          life: 30,
        });
      }
    };

    /* ---------- INIMIGOS ---------- */
    for (let i = 0; i < 6; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: 0x882222,
        emissive: 0x220000,
      });

      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 0.7),
        material,
      );
      mesh.position.set((Math.random() - 0.5) * 12, 0.8, -20 - i * 12);
      scene.add(mesh);

      const hpBar = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.15),
        new THREE.MeshBasicMaterial({ color: 0xff3333 }),
      );
      hpBar.position.y = 1.6;
      mesh.add(hpBar);

      enemies.current.push({
        mesh,
        material,
        hp: 6,
        maxHp: 6,
        hpBar,
        hitFlash: 0,
        strafe: Math.random() > 0.5 ? 1 : -1,
      });
    }

    /* ---------- ATAQUE ---------- */
    const doAttack = (power: number) => {
      if (anim.current.attack > 0) return;

      anim.current.attack = power === 1 ? 14 : 26;
      anim.current.swordTarget = power === 1 ? -1.4 : -2.4;

      enemies.current.forEach((e) => {
        const dist = e.mesh.position.distanceTo(player.position);
        if (dist < 2) {
          e.hp -= power;
          e.hitFlash = 6;
          spawnHitParticles(e.mesh.position.clone());
          e.hpBar.scale.x = Math.max(e.hp / e.maxHp, 0);
        }
      });

      enemies.current = enemies.current.filter((e) => {
        if (e.hp <= 0) {
          scene.remove(e.mesh);
          return false;
        }
        return true;
      });
    };

    /* ---------- LOOP ---------- */
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);

      if (anim.current.attack > 0) anim.current.attack--;
      if (anim.current.dashCooldown > 0) anim.current.dashCooldown--;

      /* PLAYER MOV */
      player.rotation.y -= movement.current.x * ROTATION_SPEED;
      const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);

      let speed = movement.current.y * MOVE_SPEED;

      if (anim.current.dash > 0) {
        speed += 0.9;
        anim.current.dash--;
      }

      player.position.add(dir.multiplyScalar(speed));

      /* ESPADA */
      anim.current.swordAngle +=
        (anim.current.swordTarget - anim.current.swordAngle) * 0.35;
      sword.rotation.z = anim.current.swordAngle;
      if (Math.abs(anim.current.swordAngle) < 0.05)
        anim.current.swordTarget = 0;

      /* INIMIGOS */
      enemies.current.forEach((e) => {
        const toPlayer = player.position.clone().sub(e.mesh.position);
        const dist = toPlayer.length();
        toPlayer.normalize();

        const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
        e.mesh.position.add(toPlayer.multiplyScalar(dist < 3 ? 0.05 : 0.025));
        e.mesh.position.add(side.multiplyScalar(0.02 * e.strafe));
        e.mesh.lookAt(player.position);

        if (e.hitFlash > 0) {
          e.material.emissive.setHex(0xffffff);
          e.hitFlash--;
        } else {
          e.material.emissive.setHex(0x220000);
        }
      });

      /* PARTICULAS */
      particles.current.forEach((p) => {
        p.vel.y -= 0.01;
        p.mesh.position.add(p.vel);
        p.life--;
      });

      particles.current = particles.current.filter((p) => {
        if (p.life <= 0) {
          scene.remove(p.mesh);
          return false;
        }
        return true;
      });

      /* ATAQUES */
      if (attack.current.light) doAttack(1);
      if (attack.current.heavy) doAttack(2);

      /* CAMERA */
      const camOffset = new THREE.Vector3(0, 5, -10).applyQuaternion(
        player.quaternion,
      );
      camera.position.lerp(player.position.clone().add(camOffset), 0.1);
      camera.lookAt(player.position.x, 1, player.position.z);

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };

    animate();
  };

  if (!ready) return <View style={{ flex: 1, backgroundColor: "#07060c" }} />;

  /* ================= UI ================= */
  return (
    <View style={[styles.container, { width, height }]}>
      <GLView
        style={StyleSheet.absoluteFillObject}
        onContextCreate={onContextCreate}
      />

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
              onPressIn={() => (attack.current.heavy = true)}
              onPressOut={() => (attack.current.heavy = false)}
            />
            <TouchableOpacity
              style={[styles.btn, styles.light, styles.left]}
              onPressIn={() => (attack.current.light = true)}
              onPressOut={() => (attack.current.light = false)}
            />
            <TouchableOpacity
              style={[styles.btn, styles.dash, styles.right]}
              onPress={() => {
                if (anim.current.dashCooldown <= 0) {
                  anim.current.dash = 10;
                  anim.current.dashCooldown = 40;
                }
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { backgroundColor: "#07060c" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 40,
  },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  joyArea: { width: 100, height: 100 },
  joyBase: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  joyStick: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffaa00",
  },
  pad: { width: 160, height: 120 },
  btn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
  },
  up: { top: 0, left: 48 },
  left: { top: 48, left: 0 },
  right: { top: 48, right: 0 },
  light: { borderColor: "#66ccff" },
  heavy: { borderColor: "#ff4444" },
  dash: { borderColor: "#ffaa00" },
});
