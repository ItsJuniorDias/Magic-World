import * as THREE from "three";

export const createBase = (
  scene: THREE.Scene,
  x: number,
  z: number,
  color: number = 0x00d4ff,
) => {
  const baseGroup = new THREE.Group();

  // 1. Fundação (Plataforma elevada)
  const foundationGeom = new THREE.CylinderGeometry(5, 5.5, 1.2, 8);
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x333344,
    metalness: 0.9,
    roughness: 0.1,
  });
  const foundation = new THREE.Mesh(foundationGeom, metalMat);
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  baseGroup.add(foundation);

  // 2. Domo Principal (A área habitável)
  const domeGeom = new THREE.SphereGeometry(
    4,
    32,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    metalness: 0.2,
    roughness: 0.1,
  });
  const dome = new THREE.Mesh(domeGeom, domeMat);
  dome.position.y = 0.6; // Ajustado para sentar na fundação
  baseGroup.add(dome);

  // 3. Janelas (Pequenos círculos brilhantes ao redor do domo)
  for (let i = 0; i < 5; i++) {
    const windowGeom = new THREE.CircleGeometry(0.4, 16);
    const windowMat = new THREE.MeshBasicMaterial({ color: color });
    const window = new THREE.Mesh(windowGeom, windowMat);

    // Posicionamento circular ao redor do domo
    const angle = (i / 5) * Math.PI * 2;
    window.position.set(Math.cos(angle) * 3.8, 2.5, Math.sin(angle) * 3.8);
    window.lookAt(new THREE.Vector3(0, 2.5, 0).add(baseGroup.position));
    baseGroup.add(window);
  }

  // 4. Antena de Comunicação
  const poleGeom = new THREE.CylinderGeometry(0.05, 0.05, 3);
  const antennaPole = new THREE.Mesh(poleGeom, metalMat);
  antennaPole.position.set(2, 5, -2);
  antennaPole.rotation.z = 0.2;
  baseGroup.add(antennaPole);

  const tipGeom = new THREE.SphereGeometry(0.2, 8, 8);
  const tipMat = new THREE.MeshBasicMaterial({ color: color });
  const tip = new THREE.Mesh(tipGeom, tipMat);
  tip.position.set(2.3, 6.5, -2);
  baseGroup.add(tip);

  // 5. Anel de Energia na Base (Neon)
  const ringGeom = new THREE.TorusGeometry(5.2, 0.1, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: color });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  baseGroup.add(ring);

  // 6. Luz de Presença
  const light = new THREE.PointLight(color, 10, 15);
  light.position.set(0, 5, 0);
  baseGroup.add(light);

  // Posicionamento Final
  baseGroup.position.set(x, 0, z);
  scene.add(baseGroup);

  return baseGroup;
};
