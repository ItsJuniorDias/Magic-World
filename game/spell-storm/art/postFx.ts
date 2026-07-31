import * as THREE from "three";
import type { Disposer } from "../engine/Disposer";
import { PALETTE } from "./palette";

/**
 * SPELL STORM — post-processing (HD pass).
 *
 * A proper EffectComposer + full render targets don't play well with
 * expo-gl (see engine/useGLGame.ts on why `renderer.setRenderTarget(null)`
 * can land on the wrong framebuffer and produce a black screen). Rather
 * than adding a real post-process stack that could regress the app, this
 * module ships CAMERA-SPACE OVERLAY EFFECTS: geometry attached to the
 * camera so it always fills the screen, with no offscreen render pass.
 *
 * What it provides:
 *
 *   VIGNETTE. A radial gradient darkening the corners of the screen.
 *   Written as a MeshBasicMaterial with vertex colours on a subdivided
 *   plane, so it costs one draw call and no shader compile risk. Cheap
 *   and reads as cinematic.
 *
 *   GRAIN. A subtle animated dot pattern, drawn as a Points cloud
 *   overlaid on the screen. Not "film grain" in the technical sense —
 *   just a low-density scatter of dim white dots that shift each frame
 *   so the eye reads "atmosphere".
 *
 *   FLASH. A full-screen tint quad triggered when the boss hits phase 2
 *   or 3, or when the player takes a fatal hit. Fades over ~0.3s.
 *
 *   COLOR MOOD. A very-low-alpha coloured quad over the whole screen
 *   that can be tinted per-biome to shift the mood. E.g. a warm amber
 *   tint in the ember rooms, a cool cyan in the cistern. Fakes the
 *   grading pass a colour grader would do.
 *
 * None of this indirection needs a render target. The overlays are
 * children of the camera, so they render after the world, in the same
 * pass, with no offscreen target and no risk of the presentable-FBO
 * bug that killed the earlier attempts.
 */

export interface PostFx {
  root: THREE.Group;
  /** Set the biome mood tint, e.g. PALETTE.fogWarm for ember. */
  setMood(hex: number, intensity?: number): void;
  /** Trigger a full-screen flash. `duration` in seconds. */
  flash(hex: number, intensity?: number, duration?: number): void;
  update(dt: number, elapsed: number): void;
  dispose(): void;
}

export function createPostFx(
  disposer: Disposer,
  camera: THREE.OrthographicCamera,
  viewWidth: number,
  viewHeight: number,
): PostFx {
  const root = new THREE.Group();
  root.name = "postFx";

  // Oversized so the effect doesn't clip when the camera shakes.
  const w = viewWidth * 1.6;
  const h = viewHeight * 1.6;

  // --- Vignette -----------------------------------------------------------
  // A subdivided plane with a radial darkening painted into its vertex
  // colours. Multiplicative alpha via a dark colour with additive blending
  // fails on many mobile GL drivers, so we use a normal transparent
  // material with dark vertex colours instead — reads the same on screen.
  {
    const segments = 20;
    const geo = new THREE.PlaneGeometry(w, h, segments, segments);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const alphas = new Float32Array(pos.count);
    const cornerBoost = 1.0;
    const halfW = w / 2;
    const halfH = h / 2;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i) / halfW;
      const py = pos.getY(i) / halfH;
      // Radial distance normalized on a squared frame — a bit oval to fit
      // landscape phones.
      const d = Math.sqrt(px * px * 0.8 + py * py * 1.1);
      const eased = Math.max(0, Math.pow(Math.min(1, d), 1.7));
      const vig = Math.min(0.72, eased * cornerBoost);
      colors[i * 3] = 0.04;
      colors[i * 3 + 1] = 0.02;
      colors[i * 3 + 2] = 0.08;
      alphas[i] = vig;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    // Pack alpha into a custom attribute — but WebGL alpha on
    // BufferAttribute isn't automatic; use a shader instead. Actually,
    // simpler: since we set `transparent: true` and `vertexColors: true`
    // three-way, we need alpha in vertex color which needs a 4-component
    // attribute. Easier to keep vertex colors 3-channel and use a
    // single-channel opacity attribute driven through a tiny shader.
    disposer.track(geo);

    const vignetteMat = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 color;
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(vColor, vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    geo.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
    disposer.track(vignetteMat);
    const vignette = new THREE.Mesh(geo, vignetteMat);
    vignette.renderOrder = 200;
    vignette.position.z = -0.5;
    root.add(vignette);
  }

  // --- Grain --------------------------------------------------------------
  // A Points cloud filling the screen with dim white dots. Positions are
  // reshuffled every few frames so the pattern reads as atmosphere.
  const GRAIN_COUNT = 260;
  const grainGeo = new THREE.BufferGeometry();
  const grainPos = new Float32Array(GRAIN_COUNT * 3);
  for (let i = 0; i < GRAIN_COUNT; i++) {
    grainPos[i * 3] = (Math.random() - 0.5) * w;
    grainPos[i * 3 + 1] = (Math.random() - 0.5) * h;
    grainPos[i * 3 + 2] = -0.4;
  }
  grainGeo.setAttribute("position", new THREE.BufferAttribute(grainPos, 3));
  disposer.track(grainGeo);
  const grainMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.4,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });
  disposer.track(grainMat);
  const grain = new THREE.Points(grainGeo, grainMat);
  grain.renderOrder = 199;
  root.add(grain);

  // --- Mood tint ----------------------------------------------------------
  const moodGeo = new THREE.PlaneGeometry(w, h);
  disposer.track(moodGeo);
  const moodMat = new THREE.MeshBasicMaterial({
    color: PALETTE.fogWarm,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  disposer.track(moodMat);
  const mood = new THREE.Mesh(moodGeo, moodMat);
  mood.renderOrder = 198;
  mood.position.z = -0.55;
  root.add(mood);

  // --- Flash --------------------------------------------------------------
  const flashGeo = new THREE.PlaneGeometry(w, h);
  disposer.track(flashGeo);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  disposer.track(flashMat);
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.renderOrder = 201;
  flash.position.z = -0.6;
  root.add(flash);

  // Parent to camera so overlay is always screen-locked.
  root.position.set(0, 0, -50);
  camera.add(root);

  let flashLife = 0;
  let flashDuration = 0.3;
  let flashPeak = 0;
  let grainShuffleAccum = 0;

  return {
    root,
    setMood(hex: number, intensity = 0.06) {
      moodMat.color.setHex(hex);
      moodMat.opacity = intensity;
    },
    flash(hex: number, intensity = 0.6, duration = 0.3) {
      flashMat.color.setHex(hex);
      flashPeak = intensity;
      flashLife = duration;
      flashDuration = duration;
    },
    update(dt) {
      // Flash fades from peak → 0 over `flashDuration`.
      if (flashLife > 0) {
        flashLife = Math.max(0, flashLife - dt);
        const t = flashLife / flashDuration;
        flashMat.opacity = flashPeak * t * t;
      }

      // Grain shuffle every ~120ms so the dots read as movement rather
      // than as a fixed pattern.
      grainShuffleAccum += dt;
      if (grainShuffleAccum > 0.12) {
        grainShuffleAccum = 0;
        for (let i = 0; i < GRAIN_COUNT; i++) {
          grainPos[i * 3] = (Math.random() - 0.5) * w;
          grainPos[i * 3 + 1] = (Math.random() - 0.5) * h;
        }
        grainGeo.attributes.position.needsUpdate = true;
      }
    },
    dispose() {
      root.removeFromParent();
    },
  };
}
