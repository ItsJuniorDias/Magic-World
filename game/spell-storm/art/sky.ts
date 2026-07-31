import * as THREE from "three";
import type { Disposer } from "../engine/Disposer";
import { PALETTE, recede, shift } from "./palette";
import { PaperKit } from "./paper";

/**
 * The backdrop — HD pass.
 *
 * The old backdrop was: a five-stop gradient, a sun, a starfield and cloud
 * cards. Beautiful minimally, but on a phone with an OLED panel the black
 * band above the horizon had literal 0 nits — the paper theatre grammar
 * broke down at the top of the sky because there was nothing there.
 *
 * This pass adds four things without changing the shape of the module:
 *
 *   1. A larger, richer gradient with a warm horizon band and a deep zenith,
 *      giving the top half of the screen texture.
 *   2. A pale moon carded on the opposite side of the sun. Two celestial
 *      bodies means the eye finds asymmetry at every camera position, which
 *      is what stops the sky from feeling like a wallpaper.
 *   3. Aurora ribbons — three long slanted card strips using additive blend,
 *      drifting slowly. They land in the upper-mid band where the gradient
 *      is dark enough for cyan/magenta to pop.
 *   4. A nebula patch and a second, denser starfield with two star colours
 *      (warm and cool) plus a scattering of brighter "hero" stars.
 *   5. God rays — soft angled cones fanning out from the sun.
 *
 * The whole rig is still parented to the camera so it never scrolls with
 * the world. Everything animates at a snail's pace so the sky reads as
 * "atmospheric" rather than "busy".
 */

export interface Sky {
  root: THREE.Group;
  update(dt: number, elapsed: number, cameraX: number): void;
}

/** Horizon-to-zenith stops. Biomes override these; this is the default dusk. */
const DEFAULT_STOPS: [number, number, number, number, number, number] = [
  PALETTE.skyHorizon,
  PALETTE.skyAmber,
  PALETTE.skyEmber,
  PALETTE.skyRose,
  PALETTE.skyMid,
  PALETTE.skyZenith,
];

const STOP_POSITIONS = [0.0, 0.1, 0.24, 0.44, 0.7, 1.0];

function sampleGradient(
  t: number,
  out: THREE.Color,
  stops: readonly number[],
): THREE.Color {
  const clamped = Math.min(1, Math.max(0, t));
  const positions = STOP_POSITIONS.slice(0, stops.length);
  // Redistribute if the caller gave a different length (bioma-specific).
  if (stops.length !== STOP_POSITIONS.length) {
    for (let i = 0; i < stops.length; i++) positions[i] = i / (stops.length - 1);
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = { at: positions[i], hex: stops[i] };
    const b = { at: positions[i + 1], hex: stops[i + 1] };
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
  const w = viewWidth * 1.8;
  const h = viewHeight * 1.8;

  // --- Gradient -----------------------------------------------------------
  // 1 column, 40 rows: enough vertical resolution for a smooth ramp with the
  // extra stop, and only 82 vertices.
  const gradientGeo = new THREE.PlaneGeometry(w, h, 1, 40);
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

  // --- Nebula patches -----------------------------------------------------
  // Two large, soft additive blobs high up. They're barely visible but they
  // give the top half of the sky an "inhabited" quality.
  for (let i = 0; i < 2; i++) {
    const hex = i === 0 ? PALETTE.nebulaCore : PALETTE.nebulaEdge;
    const nebula = kit.glowDisc(viewHeight * (0.42 + i * 0.1), hex, 40, 1.5);
    nebula.position.set(
      (i === 0 ? -0.28 : 0.34) * viewWidth,
      viewHeight * (0.22 + i * 0.08),
      0.3,
    );
    (nebula.material as THREE.Material).opacity = 0.18 - i * 0.06;
    nebula.renderOrder = -99;
    root.add(nebula);
  }

  // --- Sun ----------------------------------------------------------------
  // Sits low, partly below the horizon line, so the ground silhouette cuts
  // into it. That overlap is what sells the depth.
  const sunGroup = new THREE.Group();
  root.add(sunGroup);
  sunGroup.renderOrder = -98;

  const sunHalo = kit.glowDisc(viewHeight * 0.48, PALETTE.skyAmber, 36, 1.4);
  sunHalo.position.set(viewWidth * 0.16, -viewHeight * 0.28, 0.4);
  sunGroup.add(sunHalo);

  const sunGlow = kit.glowDisc(viewHeight * 0.28, PALETTE.skyAmber, 32);
  sunGlow.position.set(viewWidth * 0.16, -viewHeight * 0.28, 0.5);
  sunGroup.add(sunGlow);

  // Sun disc — brighter core using the ember hue for warmth.
  const sunDiscGeo = new THREE.CircleGeometry(viewHeight * 0.09, 40);
  disposer.track(sunDiscGeo);
  const sunDiscMat = kit.glowMaterial(PALETTE.skyHorizon, 0.98);
  const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
  sunDisc.position.set(viewWidth * 0.16, -viewHeight * 0.26, 0.6);
  sunGroup.add(sunDisc);

  // God rays — four soft cones fanning out from the sun. Each on its own
  // pivot so they can slowly counter-rotate.
  const godRays: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(viewWidth * 0.16, -viewHeight * 0.28, 0.55);
    pivot.rotation.z = (i / 5) * Math.PI - Math.PI / 4;
    sunGroup.add(pivot);

    const ray = kit.godRay(viewHeight * 0.16, viewHeight * (0.5 + i * 0.08), PALETTE.skyAmber, 0.16);
    ray.position.y = 0;
    pivot.add(ray);
    godRays.push(pivot);
  }

  // --- Moon ---------------------------------------------------------------
  // Sits opposite the sun, high in the darker part of the sky. Pale so it
  // reads even against the deep purple zenith band.
  const moonGroup = new THREE.Group();
  root.add(moonGroup);

  const moonHalo = kit.glowDisc(viewHeight * 0.14, PALETTE.moonGlow, 32, 1.6);
  moonHalo.position.set(-viewWidth * 0.28, viewHeight * 0.32, 0.4);
  (moonHalo.material as THREE.Material).opacity = 0.65;
  moonGroup.add(moonHalo);

  const moonBevel = viewHeight * 0.003;
  const moonDisc = kit.card(
    PaperKit.blob(viewHeight * 0.055, 5, 0.02, 4.4, 1),
    PALETTE.moonFace,
    PALETTE.moonEdge,
    { depth: 0.05, order: -97, bevel: moonBevel },
  );
  moonDisc.position.set(-viewWidth * 0.28, viewHeight * 0.32, 0.5);
  moonGroup.add(moonDisc);

  // Two little craters as tiny dark blob cards. Sub-detail that only shows
  // on tablets but doesn't cost anything on phones.
  for (const [dx, dy, r] of [[-0.012, 0.006, 0.011], [0.008, -0.01, 0.008]] as const) {
    const crater = kit.card(
      PaperKit.blob(viewHeight * r, 4, 0.15, 9.1 + dx * 10, 1),
      shift(PALETTE.moonFace, -0.24),
      shift(PALETTE.moonFace, -0.34),
      { depth: 0.03, order: -96 },
    );
    crater.position.set(
      -viewWidth * 0.28 + viewHeight * dx * 6,
      viewHeight * 0.32 + viewHeight * dy * 6,
      0.55,
    );
    moonGroup.add(crater);
  }

  // --- Aurora ribbons -----------------------------------------------------
  // Three horizontal card strips, tilted, using additive blend. Drift slowly
  // across the upper sky. Each has its own colour so together they read as
  // "aurora" rather than "streak".
  interface Aurora {
    mesh: THREE.Mesh;
    speed: number;
    baseY: number;
    baseX: number;
    phase: number;
  }
  const auroras: Aurora[] = [];
  const auroraColors = [PALETTE.auroraA, PALETTE.auroraC, PALETTE.auroraB];
  for (let i = 0; i < 3; i++) {
    const width = viewWidth * (1.4 + i * 0.2);
    const height = viewHeight * 0.06;
    const shape = new THREE.Shape();
    const steps = 18;
    shape.moveTo(-width / 2, 0);
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const x = -width / 2 + width * t;
      const y = Math.sin(t * Math.PI * 2 + i) * height * 0.7 + height * 0.5;
      shape.lineTo(x, y);
    }
    for (let j = steps; j >= 0; j--) {
      const t = j / steps;
      const x = -width / 2 + width * t;
      const y = Math.sin(t * Math.PI * 2 + i) * height * 0.7 - height * 0.5;
      shape.lineTo(x, y);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape, 16);
    disposer.track(geo);
    const mat = kit.glowMaterial(auroraColors[i], 0.14);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = ((i - 1) * 0.18);
    const baseY = viewHeight * (0.3 + i * 0.06);
    const baseX = (i - 1) * viewWidth * 0.14;
    mesh.position.set(baseX, baseY, 0.35);
    mesh.renderOrder = -96;
    root.add(mesh);
    auroras.push({ mesh, speed: 0.06 + i * 0.03, baseY, baseX, phase: i * 1.7 });
  }

  // --- Stars --------------------------------------------------------------
  // Densified, two colours, and a scattering of brighter "hero" stars.
  const STAR_COUNT = 240;
  const HERO_STAR_COUNT = 12;

  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(STAR_COUNT * 3);
  const starPhase = new Float32Array(STAR_COUNT);
  const starColors = new Float32Array(STAR_COUNT * 3);
  const cool = new THREE.Color(PALETTE.starCool);
  const warm = new THREE.Color(PALETTE.starWarm);
  for (let i = 0; i < STAR_COUNT; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * w * 0.95;
    // Bias upward: sqrt pushes the distribution toward the zenith.
    starPos[i * 3 + 1] = Math.sqrt(Math.random()) * (h * 0.5) + h * 0.02;
    starPos[i * 3 + 2] = 0.4;
    starPhase[i] = Math.random() * Math.PI * 2;
    const useWarm = Math.random() < 0.35;
    const c = useWarm ? warm : cool;
    const brightness = 0.7 + Math.random() * 0.3;
    starColors[i * 3] = c.r * brightness;
    starColors[i * 3 + 1] = c.g * brightness;
    starColors[i * 3 + 2] = c.b * brightness;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  disposer.track(starGeo);
  const starMat = new THREE.PointsMaterial({
    vertexColors: true,
    size: viewHeight * 0.011,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });
  disposer.track(starMat);
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -95;
  root.add(stars);

  // Hero stars — a handful of glow discs so a few points on the sky pop.
  const heroStars: { mesh: THREE.Mesh; phase: number }[] = [];
  for (let i = 0; i < HERO_STAR_COUNT; i++) {
    const useWarm = Math.random() < 0.4;
    const hex = useWarm ? PALETTE.starWarm : PALETTE.starCool;
    const disc = kit.glowDisc(viewHeight * (0.012 + Math.random() * 0.006), hex, 20, 1.3);
    disc.position.set(
      (Math.random() - 0.5) * w * 0.9,
      Math.sqrt(Math.random()) * (h * 0.48) + h * 0.02,
      0.42,
    );
    (disc.material as THREE.Material).opacity = 0.7;
    disc.renderOrder = -94;
    root.add(disc);
    heroStars.push({ mesh: disc, phase: Math.random() * Math.PI * 2 });
  }

  // --- Clouds -------------------------------------------------------------
  // Flat blob cards, tinted most of the way toward the sky so they read as
  // haze rather than as objects. HD pass adds a rim so they catch the sun.
  interface Cloud {
    mesh: THREE.Mesh;
    speed: number;
    baseY: number;
  }
  const clouds: Cloud[] = [];
  for (let i = 0; i < 11; i++) {
    const scale = 0.55 + Math.random() * 1.1;
    const shape = PaperKit.blob(viewHeight * 0.09 * scale, 5, 0.34, i * 3.7, 0.42);
    const depth = i / 11;
    const face = recede(PALETTE.skyRose, 0.2 + depth * 0.3, PALETTE.skyAmber);
    const rim = recede(PALETTE.skyAmber, 0.15 + depth * 0.2, PALETTE.skyHorizon);
    const cloud = kit.card(shape, face, face, { depth: 0.02, order: -93 });

    // A small rim highlight card behind the cloud, slightly larger, so the
    // top edge catches the sun. Adds three cards per cloud but total
    // count is still tiny.
    const rimCard = kit.card(shape, rim, rim, { depth: 0.01, order: -94 });
    rimCard.scale.setScalar(1.05);
    rimCard.position.z = -0.02;
    (rimCard.material as THREE.Material[])[0].transparent = true;
    (rimCard.material as THREE.Material[])[0].opacity = 0.65;
    (rimCard.material as THREE.Material[])[1].transparent = true;
    (rimCard.material as THREE.Material[])[1].opacity = 0.65;
    cloud.add(rimCard);

    const y = viewHeight * (0.02 + Math.random() * 0.32);
    cloud.position.set((Math.random() - 0.5) * w, y, 0.3);
    cloud.scale.setX(1.9 + Math.random() * 1.2);
    root.add(cloud);
    clouds.push({ mesh: cloud, speed: 0.06 + Math.random() * 0.16, baseY: y });
  }

  // --- Horizon haze band --------------------------------------------------
  // A thin bright quad sitting on the horizon line. Fakes the "hot" strip
  // where the atmosphere is thickest and the sun's colour bleeds sideways.
  {
    const hazeGeo = new THREE.PlaneGeometry(w * 1.05, viewHeight * 0.08);
    disposer.track(hazeGeo);
    const hazeMat = kit.glowMaterial(PALETTE.skyHorizon, 0.4);
    const haze = new THREE.Mesh(hazeGeo, hazeMat);
    haze.position.set(0, -viewHeight * 0.38, 0.35);
    haze.renderOrder = -95;
    root.add(haze);
  }

  // Parented to the camera: the backdrop is painted on the inside of the
  // viewport and never moves with the world.
  root.position.set(0, 0, -60);
  camera.add(root);

  return {
    root,
    update(dt, elapsed, cameraX) {
      // Twinkle: one sine over the whole field, cheap and legible.
      starMat.opacity = 0.68 + Math.sin(elapsed * 1.7) * 0.22;

      // Hero stars breathe with their own phases.
      for (const hs of heroStars) {
        const pulse = 0.62 + Math.sin(elapsed * 1.4 + hs.phase) * 0.28;
        (hs.mesh.material as THREE.Material).opacity = pulse;
      }

      // Sun corona pulses slowly.
      (sunHalo.material as THREE.Material).opacity =
        0.5 + Math.sin(elapsed * 0.6) * 0.12;

      // God rays counter-rotate imperceptibly slowly.
      for (let i = 0; i < godRays.length; i++) {
        godRays[i].rotation.z += dt * (i % 2 === 0 ? 0.02 : -0.02) * (0.5 + i * 0.1);
      }

      // Auroras drift horizontally and vertically float.
      for (const a of auroras) {
        a.mesh.position.x = a.baseX + Math.sin(elapsed * a.speed + a.phase) * viewWidth * 0.14;
        a.mesh.position.y = a.baseY + Math.sin(elapsed * a.speed * 0.5 + a.phase) * viewHeight * 0.025;
        (a.mesh.material as THREE.Material).opacity =
          0.10 + Math.max(0, Math.sin(elapsed * 0.4 + a.phase)) * 0.08;
      }

      // Clouds drift horizontally, gently float vertically.
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
