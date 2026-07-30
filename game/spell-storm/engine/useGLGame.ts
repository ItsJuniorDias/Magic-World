import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { RENDER } from "../config";
import { computeView } from "../systems/camera";
import type { GameContext, GameHandle } from "../types";
import { Disposer } from "./Disposer";

// ---------------------------------------------------------------------------
// DOM polyfill
//
// three.js touches `document` in a handful of places (texture loading paths,
// WebGLRenderer feature detection). React Native has no DOM, so we install a
// minimal stub *once*, at module scope, before any renderer is constructed.
// ---------------------------------------------------------------------------
const noop = () => {};
if (typeof (globalThis as { document?: unknown }).document === "undefined") {
  (globalThis as unknown as { document: unknown }).document = {
    readyState: "complete",
    createElement: () => ({ style: {}, addEventListener: noop, getContext: () => null }),
    createElementNS: () => ({ style: {}, addEventListener: noop }),
    getElementsByTagName: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    documentElement: { style: {} },
  };
}

/** The subset of the expo-gl context we actually use. */
export interface ExpoGLContext extends WebGLRenderingContext {
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  endFrameEXP(): void;
}

export type GameFactory = (ctx: GameContext) => GameHandle;

interface UseGLGameOptions {
  /** Builds the game once the GL context exists. Must be stable. */
  factory: GameFactory;
  /** Pause the loop without tearing down (e.g. a modal is open). */
  paused?: boolean;
  /** Called after the game is constructed and the first frame is scheduled. */
  onReady?: (handle: GameHandle) => void;
}

export interface UseGLGameResult {
  /** Pass to <GLView onContextCreate={...} />. */
  onContextCreate: (gl: ExpoGLContext) => void;
  /** Null until the context exists. */
  handleRef: React.MutableRefObject<GameHandle | null>;
}

/**
 * Owns the entire lifecycle of a three.js scene inside an expo-gl surface.
 *
 * What this fixes compared to writing the loop inline in a screen component:
 *
 *   1. requestAnimationFrame is cancelled on unmount. Without this the loop
 *      keeps running forever after the user navigates away, burning battery
 *      and pinning the whole scene graph in memory.
 *   2. Every GPU resource is disposed. See Disposer.
 *   3. The simulation is driven by REAL TIME, not frames. A game that does
 *      `x += speed` per frame runs at double speed on a 120Hz ProMotion
 *      device. Here the sim advances in fixed 1/60 steps and never varies
 *      with refresh rate.
 *   4. Backgrounding the app produces one enormous delta on resume; we clamp
 *      it so the player doesn't teleport into a hazard.
 */
export function useGLGame({ factory, paused = false, onReady }: UseGLGameOptions): UseGLGameResult {
  const handleRef = useRef<GameHandle | null>(null);
  const rafRef = useRef<number | null>(null);
  const disposerRef = useRef<Disposer | null>(null);
  const glRef = useRef<ExpoGLContext | null>(null);
  const pausedRef = useRef(paused);
  const mountedRef = useRef(true);

  pausedRef.current = paused;

  const onContextCreate = useCallback(
    (gl: ExpoGLContext) => {
      if (!mountedRef.current) return;

      const bufferW = gl.drawingBufferWidth;
      const bufferH = gl.drawingBufferHeight;

      const disposer = new Disposer();
      disposerRef.current = disposer;
      glRef.current = gl;

      const renderer = new THREE.WebGLRenderer({
        context: gl as unknown as WebGLRenderingContext,
        antialias: false, // MSAA is expensive; the flat art doesn't need it
        alpha: false,
        powerPreference: "high-performance",
      });

      // -----------------------------------------------------------------
      // THE BLACK BAND BUG
      //
      // This used to read:
      //
      //     renderer.setSize(bufferW * 0.75, bufferH * 0.75, false);
      //
      // In a browser that is a legitimate trick: it shrinks the canvas
      // backing store and CSS stretches it back to full size, so you pay for
      // 56% of the fragments and the user sees a full-screen, slightly soft
      // image.
      //
      // React Native has no CSS. The expo-gl surface stays at its full pixel
      // size; all `setSize` does is call `gl.viewport(0, 0, w*0.75, h*0.75)`.
      // The scene is drawn into the bottom-left 75% x 75% of the display and
      // the rest of the framebuffer keeps the clear colour, which is black.
      // That is the vertical black band down the right side of the screen and
      // the dead strip along the top — the game was rendering correctly, just
      // into three quarters of the screen.
      //
      // The renderer is now always sized to the FULL drawing buffer. To keep
      // the fragment saving, the scene is rendered into an offscreen target
      // at `resolutionScale` and blitted up to full size with a single
      // textured quad. Same GPU saving, no black band.
      // -----------------------------------------------------------------
      renderer.setSize(bufferW, bufferH, false);
      renderer.setPixelRatio(1); // expo-gl already gave us device pixels
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 1);
      disposer.track(renderer);

      // ---- Offscreen target + blit pass --------------------------------
      const scale = Math.max(0.35, Math.min(1, RENDER.resolutionScale));
      const wantsOffscreen = RENDER.offscreenUpscale && scale < 0.995;

      let target: THREE.WebGLRenderTarget | null = null;
      let blitScene: THREE.Scene | null = null;
      let blitCamera: THREE.OrthographicCamera | null = null;

      // expo-gl does not promise that its presentable surface is FBO 0.
      // Capture whatever is bound before we touch anything, so the blit can
      // be pointed back at the real thing rather than at framebuffer zero.
      const defaultFramebuffer = wantsOffscreen
        ? (gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null)
        : null;

      if (wantsOffscreen) {
        try {
          const rw = Math.max(1, Math.floor(bufferW * scale));
          const rh = Math.max(1, Math.floor(bufferH * scale));
          target = new THREE.WebGLRenderTarget(rw, rh, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: true,
            stencilBuffer: false,
          });
          disposer.track(target);

          blitScene = new THREE.Scene();
          // A 2x2 quad in front of a unit ortho camera is exactly the screen.
          blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
          const blitGeo = new THREE.PlaneGeometry(2, 2);
          const blitMat = new THREE.MeshBasicMaterial({
            map: target.texture,
            depthTest: false,
            depthWrite: false,
          });
          disposer.track(blitGeo);
          disposer.track(blitMat);
          blitScene.add(new THREE.Mesh(blitGeo, blitMat));
        } catch (err) {
          console.warn("[spell-storm] offscreen target unavailable, rendering direct", err);
          target = null;
          blitScene = null;
          blitCamera = null;
        }
      }

      const scene = new THREE.Scene();
      const view = computeView(bufferW, bufferH);

      const camera = new THREE.OrthographicCamera(
        -view.width / 2,
        view.width / 2,
        view.height / 2,
        -view.height / 2,
        0.1,
        400,
      );
      camera.position.set(0, 0, 100);
      camera.lookAt(0, 0, 0);

      const ctx: GameContext = {
        scene,
        camera,
        renderer,
        track: (r) => disposer.track(r),
        viewWidth: view.width,
        viewHeight: view.height,
        pixelWidth: bufferW,
        pixelHeight: bufferH,
      };

      let handle: GameHandle;
      try {
        handle = factory(ctx);
      } catch (err) {
        console.error("[spell-storm] failed to build game", err);
        disposer.disposeAll();
        return;
      }
      handleRef.current = handle;

      // ---------------------------------------------------------------
      // Fixed-timestep loop
      //
      // Rendering happens once per animation frame at whatever rate the
      // display runs. Simulation happens in fixed 1/60 slices drained from
      // an accumulator. Physics therefore behaves identically at 60Hz and
      // 120Hz, which is what makes high scores comparable across devices.
      // ---------------------------------------------------------------
      let last = 0;
      let accumulator = 0;

      const loop = (now: number) => {
        if (!mountedRef.current) return;
        rafRef.current = requestAnimationFrame(loop);

        if (last === 0) {
          last = now;
          return;
        }

        let dt = (now - last) / 1000;
        last = now;

        // App was backgrounded, or the JS thread stalled on a GC pause.
        // Drop the excess rather than simulating a huge jump.
        if (dt > RENDER.maxDeltaTime) dt = RENDER.fixedStep;

        if (pausedRef.current) return;

        accumulator += dt;
        let steps = 0;
        while (accumulator >= RENDER.fixedStep && steps < RENDER.maxStepsPerFrame) {
          handle.frame(RENDER.fixedStep);
          accumulator -= RENDER.fixedStep;
          steps += 1;
        }
        // If we blew the step budget the device can't keep up; drop the
        // backlog instead of spiralling into a death loop.
        if (steps >= RENDER.maxStepsPerFrame) accumulator = 0;

        if (target && blitScene && blitCamera) {
          // Scene at reduced resolution...
          renderer.setRenderTarget(target);
          renderer.clear();
          renderer.render(scene, camera);
          // ...then one textured quad filling the real surface.
          renderer.setRenderTarget(null);
          // three caches framebuffer state and believes "null" means zero.
          // Rebind by hand and drop the cache, or the blit goes to a buffer
          // expo-gl never presents.
          if (defaultFramebuffer !== null) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, defaultFramebuffer);
            renderer.resetState();
            renderer.setViewport(0, 0, bufferW, bufferH);
          }
          renderer.clear();
          renderer.render(blitScene, blitCamera);
        } else {
          renderer.render(scene, camera);
        }
        gl.endFrameEXP();
      };

      rafRef.current = requestAnimationFrame(loop);
      onReady?.(handle);
    },
    [factory, onReady],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;

      // Order matters: stop the loop before freeing anything it touches.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      try {
        handleRef.current?.dispose();
      } catch (err) {
        console.warn("[spell-storm] game dispose failed", err);
      }
      handleRef.current = null;

      disposerRef.current?.disposeAll();
      disposerRef.current = null;
      glRef.current = null;
    };
  }, []);

  return { onContextCreate, handleRef };
}
