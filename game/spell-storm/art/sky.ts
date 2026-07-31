import * as THREE from "three";
import type { Disposer } from "../engine/Disposer";
import { PALETTE, recede } from "./palette";
import { PaperKit } from "./paper";

/**
 * The backdrop: a five-stop vertical gradient with a sun sitting on the
 * horizon, a field of stars in the upper band, and slow cloud cards.
 *
 * The gradient is a plane with vertex colours, not a texture and not a
 * shader. On mobile GL that is the cheapest possible fullscreen fill: one
 * draw call, no fragment work beyond interpolation, no texture upload, and
 * it resizes to any aspect ratio without resampling.
 *
 * The whole rig is parented to the camera so it never scrolls. Clouds and
 * stars get their own slow drift instead, which reads as depth without the
 * cost of actually placing them in the world.
 */

export interface Sky {
  root: THREE.Group;
  update(dt: number, elapsed: number, cameraX: number): void;
}

/** Horizon-to-zenith stops. Biomes override these; this is the default dusk. */
const DEFAULT_STOPS: [number, number, number, number, number] = [
  PALETTE.skyAmber,
  PALETTE.skyEmber,
  PALETTE.skyRose,
  PALETTE.skyMid,
  PALETTE.skyZenith,
];

const STOP_POSITIONS = [0.0, 0.16, 0.38, 0.68, 1.0];

function sampleGradient(
  t: number,
  out: THREE.Color,
  stops: readonly number[],
): THREE.Color {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = { at: STOP_POSITIONS[i], hex: stops[i] };
    const b = { at: STOP_POSITIONS[i + 1], hex: stops[i + 1] };
    if (clamped >= a.at && clamped <= b.at) {
      const local = (clamped - a.at) / (b.at - a.at);
      out.setHex(a.hex).lerp(new THREE.Color(b.hex), local);
      return out;
    }
  }
  return out.setHex(stops[stops.length - 1]);
}

export function createSky(
  kit: PaperKit,
  disposer: Disposer,
  camera: THREE.OrthographicCamera,
  viewWidth: number,
  viewHeight: number,
  stops: readonly number[] = DEFAULT_STOPS,
): Sky {
  const root = new THREE.Group();
  root.name = "sky";

  // Oversized so a bit of camera shake never reveals the edge.
  const w = viewWidth * 1.6;
  const h = viewHeight * 1.6;

  // --- Gradient -----------------------------------------------------------
  // 1 column, 24 rows: enough vertical resolution for a smooth ramp, and
  // only 50 vertices.
  const gradientGeo = new THREE.PlaneGeometry(w, h, 1, 24);
  const posAttr = gradientGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const scratch = new THREE.Color();
  for (let i = 0; i < posAttr.count; i++) {
    // Map plane Y (-h/2..h/2) to gradient t (0 at horizon, 1 at zenith).
    const t = (posAttr.getY(i) + h / 2) / h;
    sampleGradient(t, scratch, stops);
    colors[i * 3] = scratch.r;
    colors[i * 3 + 1] = scratch.g;
    colors[i * 3 + 2] = scratch.b;
  }
  gradientGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  disposer.track(gradientGeo);

  const gradientMat = new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false });
  disposer.track(gradientMat);
  const gradient = new THREE.Mesh(gradientGeo, gradientMat);
  gradient.renderOrder = -100;
  root.add(gradient);

  // --- Sun ----------------------------------------------------------------
  // Sits low, partly below the horizon line, so the ground silhouette cuts
  // into it. That overlap is what sells the depth.
  const sunGlow = kit.glowDisc(viewHeight * 0.34, PALETTE.skyAmber, 28);
  sunGlow.position.set(viewWidth * 0.16, -viewHeight * 0.28, 0.5);
  sunGlow.renderOrder = -99;
  root.add(sunGlow);

  const sunDisc = kit.quad(0, 0, kit.glowMaterial(PALETTE.skyAmber, 0.95));
  {
    const geo = new THREE.CircleGeometry(viewHeight * 0.085, 30);
    disposer.track(geo);
    sunDisc.geometry = geo;
  }
  sunDisc.position.set(viewWidth * 0.16, -viewHeight * 0.26, 0.6);
  sunDisc.renderOrder = -98;
  root.add(sunDisc);

  // --- Stars --------------------------------------------------------------
  // Concentrated in the upper half where the sky is dark enough to see them.
  const STAR_COUNT = 90;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(STAR_COUNT * 3);
  const starPhase = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * w * 0.95;
    // Bias upward: sqrt pushes the distribution toward the zenith.
    starPos[i * 3 + 1] = Math.sqrt(Math.random()) * (h * 0.46) + h * 0.02;
    starPos[i * 3 + 2] = 0.4;
    starPhase[i] = Math.random() * Math.PI * 2;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  disposer.track(starGeo);
  const starMat = new THREE.PointsMaterial({
    color: 0xfff3d0,
    size: viewHeight * 0.012,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });
  disposer.track(starMat);
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -97;
  root.add(stars);

  // --- Clouds -------------------------------------------------------------
  // Flat blob cards, tinted most of the way toward the sky so they read as
  // haze rather than as objects.
  interface Cloud {
    mesh: THREE.Mesh;
    speed: number;
    baseY: number;
  }
  const clouds: Cloud[] = [];
  for (let i = 0; i < 7; i++) {
    const scale = 0.55 + Math.random() * 1.1;
    const shape = PaperKit.blob(viewHeight * 0.09 * scale, 4, 0.34, i * 3.7, 0.42);
    const depth = i / 7;
    const face = recede(PALETTE.skyRose, 0.25 + depth * 0.3, PALETTE.skyAmber);
    const mesh = kit.card(shape, face, face, { depth: 0.02, order: -96 });
    const y = viewHeight * (0.02 + Math.random() * 0.3);
    mesh.position.set((Math.random() - 0.5) * w, y, 0.3);
    mesh.scale.setX(1.9 + Math.random() * 1.2);
    root.add(mesh);
    clouds.push({ mesh, speed: 0.08 + Math.random() * 0.16, baseY: y });
  }

  // Parented to the camera: the backdrop is painted on the inside of the
  // viewport and never moves with the world.
  root.position.set(0, 0, -60);
  camera.add(root);

  return {
    root,
    update(dt, elapsed, cameraX) {
      // Twinkle: one sine over the whole field, cheap and legible.
      starMat.opacity = 0.62 + Math.sin(elapsed * 1.7) * 0.2;

      for (const cloud of clouds) {
        cloud.mesh.position.x += cloud.speed * dt;
        if (cloud.mesh.position.x > w * 0.55) cloud.mesh.position.x = -w * 0.55;
        cloud.mesh.position.y = cloud.baseY + Math.sin(elapsed * 0.35 + cloud.baseY) * 0.12;
      }

      // A whisper of counter-parallax so the sky isn't perfectly rigid when
      // the camera pans. 2% of the camera's travel, in the same direction.
      root.position.x = cameraX * 0.02;
      void starPhase;
    },
  };
}
