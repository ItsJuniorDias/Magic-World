// src/game/utils/GameSystems.ts
import * as THREE from "three";
import { loadAsync } from "expo-three";

let cachedEnemyModel: THREE.Group | null = null;
let enemyAnimations: THREE.AnimationClip[] = [];

export type Enemy = {
  mesh: THREE.Group;
  material: THREE.MeshStandardMaterial;
  hp: number;
  maxHp: number;
  hpBar: THREE.Mesh;
  hitFlash: number;
  attackCooldown: number;
  mixer: THREE.AnimationMixer;
  actions: { [key: string]: THREE.AnimationAction };
};

export type Particle = { mesh: THREE.Mesh; vel: THREE.Vector3; life: number };

const hpBarGeo = new THREE.PlaneGeometry(1, 0.15);
const hpBarMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

export async function loadEnemyAssets(modelSource: any) {
  try {
    const gltf = await loadAsync(modelSource); 
    cachedEnemyModel = gltf.scene;
    enemyAnimations = gltf.animations; // Guardamos as animações originais
    
    cachedEnemyModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return true;
  } catch (error) {
    return false;
  }
}

export function spawnEnemy(scene: THREE.Scene, playerPos: THREE.Vector3): Enemy {
  const en = cachedEnemyModel ? cachedEnemyModel.clone() : new THREE.Group();
  
  // AJUSTE DE TAMANHO ALEATÓRIO (Cirúrgico)
const scale = 0.5 + Math.random() * 0.3; 
  en.scale.set(scale, scale, scale);

  let mainMat = new THREE.MeshStandardMaterial({ color: 0xaa2222 });
  const mixer = new THREE.AnimationMixer(en);
  const actions: { [key: string]: THREE.AnimationAction } = {};

  // Mapear animações do robô
  enemyAnimations.forEach((clip) => {
    actions[clip.name] = mixer.clipAction(clip);
  });

  en.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).material = ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).clone();
      mainMat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
    }
  });

  const ang = Math.random() * Math.PI * 2;
  const dist = 15 + Math.random() * 10;
  en.position.set(playerPos.x + Math.cos(ang) * dist, 0, playerPos.z + Math.sin(ang) * dist);
  scene.add(en);

  const bar = new THREE.Mesh(hpBarGeo, hpBarMat.clone());
  bar.position.y = 2.4; 
  en.add(bar);

  // Começar com Idle ou Walk
  if (actions["Walk"]) actions["Walk"].play();

  return { mesh: en, material: mainMat, hp: 10, maxHp: 10, hpBar: bar, hitFlash: 0, attackCooldown: 0, mixer, actions };
}

export function createParticle(scene: THREE.Scene, pos: THREE.Vector3, type: "spark" | "smoke"): Particle {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2), 
    new THREE.MeshBasicMaterial({ color: type === "spark" ? 0xffaa00 : 0x444444, transparent: true, opacity: 0.8 })
  );
  mesh.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*0.4, Math.random()*0.5, (Math.random()-0.5)*0.4));
  scene.add(mesh);
  return { mesh, vel: new THREE.Vector3((Math.random()-0.5)*0.1, Math.random()*0.2, (Math.random()-0.5)*0.1), life: 25 };
}