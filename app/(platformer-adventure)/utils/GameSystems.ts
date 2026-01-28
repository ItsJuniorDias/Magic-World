// src/game/GameSystems.ts
import * as THREE from "three";
import { CONFIG } from "./config";

// --- SISTEMA DE INIMIGOS ---
export type Enemy = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  hp: number;
  maxHp: number;
  hpBar: THREE.Mesh;
  hitFlash: number;
  attackCooldown: number;
};

const enemyGeo = new THREE.CapsuleGeometry(0.5, 1);
const enemyMat = new THREE.MeshStandardMaterial({ color: 0xaa2222 });

export function spawnEnemy(scene: THREE.Scene, playerPos: THREE.Vector3): Enemy {
  const en = new THREE.Mesh(enemyGeo, enemyMat.clone());
  
  // Posição aleatória ao redor do player
  const ang = Math.random() * 6.28;
  const dist = 15 + Math.random() * 15;
  const spawnPos = playerPos.clone().add(new THREE.Vector3(Math.cos(ang) * dist, 0, Math.sin(ang) * dist));
  
  en.position.set(spawnPos.x, 1, spawnPos.z);
  scene.add(en);

  // Barra de vida
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.15), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  bar.position.y = 1.8;
  en.add(bar);

  return {
    mesh: en,
    material: en.material as THREE.MeshStandardMaterial,
    hp: 10,
    maxHp: 10,
    hpBar: bar,
    hitFlash: 0,
    attackCooldown: 0,
  };
}

// --- SISTEMA DE PARTÍCULAS ---
export type Particle = {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
};

export function createParticle(scene: THREE.Scene, pos: THREE.Vector3, type: "spark" | "smoke", colorHex?: number): Particle {
  const color = colorHex || (type === "spark" ? 0xffaa00 : 0xcccccc);
  const size = type === "spark" ? 0.2 : 0.4;
  
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshBasicMaterial({ color, transparent: true })
  );
  
  mesh.position.copy(pos).add(new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5));
  scene.add(mesh);

  return {
    mesh,
    vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.4, (Math.random() - 0.5) * 0.3),
    life: 25,
  };
}