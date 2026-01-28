// src/game/PlayerSystem.ts
import * as THREE from "three";
import { loadAsync } from "expo-three";
import { MODELS } from "./config";

export async function createPlayerSystem(scene: THREE.Scene) {
  const assets: any = {};
  
  // Carrega Soldado e Espada
  try {
    assets.soldier = await loadAsync(MODELS.soldier);
    assets.sword = await loadAsync(MODELS.sword);
  } catch (e) {
    console.error("Erro ao carregar modelos", e);
    return null;
  }

  const playerGroup = new THREE.Group();
  scene.add(playerGroup);

  const model = assets.soldier.scene;
  model.scale.set(1.5, 1.5, 1.5);
  model.rotation.y = Math.PI;

  // --- 1. APARÊNCIA (Dark Armor) ---
  model.traverse((o: any) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) {
        o.material = o.material.clone();
        o.material.color.setHex(0x111111); // Preto
        o.material.roughness = 0.7;
      }
    }
  });

  // --- 2. ENCONTRAR MÃO ---
  let rightHandBone: THREE.Object3D | null = null;
  model.traverse((child: any) => {
    if (child.isBone && (child.name === "mixamorigRightHand" || child.name.includes("RightHand"))) {
      rightHandBone = child;
    }
  });

  playerGroup.add(model);

  // --- 3. CONFIGURAR ESPADA ---
  const swordContainer = new THREE.Group();
  const swordMeshes: THREE.Mesh[] = [];

  if (assets.sword) {
    const swordModel = assets.sword.scene;
    swordModel.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        swordMeshes.push(child);
      }
    });
    swordContainer.add(swordModel);
  } else {
    // Fallback cubo vermelho
    swordContainer.add(new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), new THREE.MeshBasicMaterial({ color: 0xff0000 })));
  }

  // --- 4. ANEXAR E ALINHAR ---
  if (rightHandBone) {
    rightHandBone.add(swordContainer);
    
    // SETUP DE POSIÇÃO DA ESPADA (AQUI É ONDE VOCÊ MEXE)
    swordContainer.scale.set(10, 10, 10);
    swordContainer.rotation.set(-Math.PI / 2, Math.PI, 0); // Vira para cima
    swordContainer.position.set(0.08, 0.7, 0.02); // Ajuste Fino (X, Y, Z)
    
  } else {
    playerGroup.add(swordContainer);
    swordContainer.position.set(0.65, 1.35, 0.5);
  }

  // --- 5. ANIMAÇÕES ---
  const mixer = new THREE.AnimationMixer(model);
  const actions: any = {};
  if (assets.soldier.animations.length > 0) {
    actions["Idle"] = mixer.clipAction(assets.soldier.animations[0]);
    actions["Run"] = mixer.clipAction(assets.soldier.animations[1]);
    actions["Idle"].play();
  }

  return { playerGroup, swordContainer, swordMeshes, mixer, actions };
}