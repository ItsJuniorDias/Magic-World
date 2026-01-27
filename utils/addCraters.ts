import * as THREE from "three";

export default function addCraters(
  geometry: THREE.BufferGeometry,
  craterCount = 12,
  radius = 0.4,
  depth = 0.3,
) {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const center = new THREE.Vector3();

  for (let c = 0; c < craterCount; c++) {
    // ponto aleatório da cratera
    center.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
    ).normalize();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);

      const d = v.distanceTo(center);
      if (d < radius) {
        const strength = (1 - d / radius) * depth;
        v.addScaledVector(v.clone().normalize(), -strength);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}
