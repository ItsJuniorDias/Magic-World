// src/game/PlayerSystem.ts
import * as THREE from "three";
import { loadAsync } from "expo-three";
import { MODELS } from "./config";

export async function createPlayerSystem(scene: THREE.Scene) {
  const assets: any = {};
  
  // --- CARREGAMENTO ---
  try {
    assets.soldier = await loadAsync(MODELS.soldier);
    assets.sword = await loadAsync(MODELS.sword);
  } catch (e) {
    console.error("Erro ao carregar modelos", e);
    return null;
  }

  // Grupo Principal do Jogador
  const playerGroup = new THREE.Group();
  scene.add(playerGroup);

  // Configuração do Soldado
  const model = assets.soldier.scene;
  model.scale.set(1.5, 1.5, 1.5);
  model.rotation.y = Math.PI; // Vira o soldado para frente

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

  // --- 2. ENCONTRAR MÃO (Bone) ---
  let rightHandBone: THREE.Object3D | null = null;
  model.traverse((child: any) => {
    if (child.isBone && (child.name === "mixamorigRightHand" || child.name.includes("RightHand"))) {
      rightHandBone = child;
    }
  });

  playerGroup.add(model);

  // --- 3. CONFIGURAR E CENTRALIZAR ESPADA ---
  const swordContainer = new THREE.Group();
  const swordMeshes: THREE.Mesh[] = [];

  if (assets.sword) {
    const swordModel = assets.sword.scene;

    // >>> LÓGICA DE PIVÔ AUTOMÁTICA <<<
    const box = new THREE.Box3().setFromObject(swordModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // 1. Centraliza a geometria (0,0,0)
    swordModel.position.x += (swordModel.position.x - center.x);
    swordModel.position.y += (swordModel.position.y - center.y);
    swordModel.position.z += (swordModel.position.z - center.z);
    
    // 2. Ajuste do Cabo (O Pulo do Gato que funcionou)
    swordModel.position.y -= size.y * 0.45; 

    swordModel.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        swordMeshes.push(child);
      }
    });
    
    swordContainer.add(swordModel);
  } else {
    // Fallback cubo
    swordContainer.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), new THREE.MeshBasicMaterial({ color: 0xff0000 })));
  }

  // --- 4. ANEXAR E ALINHAR NA MÃO ---
  if (rightHandBone) {
    rightHandBone.add(swordContainer);

    // Configurações Finais que deram certo
    swordContainer.scale.set(25.0, 25.0, 25.0);
    swordContainer.rotation.set(Math.PI, 0, 0); 
    swordContainer.position.set(0, 0, 0); 

  } else {
    // Fallback se não achar o osso da mão
    playerGroup.add(swordContainer);
    swordContainer.position.set(0.5, 1.5, -0.5);
    swordContainer.scale.set(4, 4, 4);
  }

  // --- 5. ANIMAÇÕES ---
  const mixer = new THREE.AnimationMixer(model);
  const actions: any = {};
  
  if (assets.soldier.animations.length > 0) {
    actions["Idle"] = mixer.clipAction(assets.soldier.animations[0]);
    const runAnim = assets.soldier.animations.find((a: any) => a.name.toLowerCase().includes("run")) || assets.soldier.animations[1];
    if (runAnim) actions["Run"] = mixer.clipAction(runAnim);
    
    actions["Idle"].play();
  }

  return { playerGroup, swordContainer, swordMeshes, mixer, actions };
}