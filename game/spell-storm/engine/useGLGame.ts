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
  /** Builds the game once the GL context exists. */
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
 * WHY THIS FILE IS SO CONSERVATIVE
 *
 * Every non-trivial thing I tried here caused a fresh regression.
 *
 *   - Shrinking `setSize` below the buffer dimensions leaves gl.viewport
 *     covering only part of the display, because expo-gl has no CSS layer to
 *     upscale the backing store the way a browser canvas does. That was the
 *     black band down the right of the screen.
 *   - Rendering into an offscreen WebGLRenderTarget and blitting up looks
 *     right in isolation, but relies on `renderer.setRenderTarget(null)`
 *     returning to the framebuffer expo-gl actually presents. expo-gl does
 *     NOT guarantee that its presentable framebuffer is FBO 0, and when it
 *     isn't, the blit lands somewhere nobody ever shows. Black screen, HUD
 *     on top of it. Same shape as this bug report.
 *
 * The path here is now the original, minimal one: full-size renderer, no
 * indirection, `render(scene, camera)` + `endFrameEXP()`. Any optimisation
 * that saves fragments belongs in the scene itself (fewer draw calls, cheaper
 * shaders) rather than in the presentation path. `RENDER.resolutionScale`
 * and `RENDER.offscreenUpscale` are kept in the config as documentation of
 * what NOT to do until this is validated on a real device.
 *
 * The FrameOptions we keep despite the simplification are the ones that
 * turned out to be correctness, not performance:
 *
 *   - cancelAnimationFrame on unmount — without it the loop runs forever
 *     after the user leaves the screen.
 *   - `Disposer.disposeAll()` in the same cleanup — without it every mesh,
 *     material and texture the scene ever touched stays resident.
 *   - Fixed-timestep simulation with real-time rendering — without it a
 *     120Hz ProMotion device runs the game at literally double speed.
 *   - Clamping oversized deltas — without it, backgrounding the app for a
 *     minute produces one 60-second step on resume and teleports the player
 *     through hazards.
 */
export function useGLGame({ factory, paused = false, onReady }: UseGLGameOptions): UseGLGameResult {
  const handleRef = useRef<GameHandle | null>(null);
  const rafRef = useRef<number | null>(null);
  const disposerRef = useRef<Disposer | null>(null);
  const glRef = useRef<ExpoGLContext | null>(null);
  const pausedRef = useRef(paused);
  const mountedRef = useRef(true);

  // Latest factory / onReady, in a ref. The reason:
  //
  // `onContextCreate` is passed to <GLView />. GLView calls it once, when the
  // native surface is ready. If `onContextCreate` were re-derived every time
  // `factory` changed identity, and the parent re-rendered before the
  // surface fired, we would either build the scene with a stale factory or
  // fail to build it at all. Reading the factory from a ref inside a stable
  // callback makes the identity of `onContextCreate` independent of how the
  // parent memoises things.
  const factoryRef = useRef(factory);
  factoryRef.current = factory;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  pausedRef.current = paused;

  const onContextCreate = useCallback((gl: ExpoGLContext) => {
    if (!mountedRef.current) return;

    const bufferW = gl.drawingBufferWidth;
    const bufferH = gl.drawingBufferHeight;

    const disposer = new Disposer();
    disposerRef.current = disposer;
    glRef.current = gl;

    const renderer = new THREE.WebGLRenderer({
      context: gl as unknown as WebGLRenderingContext,
      // HD pass: MSAA on. Smoother silhouettes on every paper card
      // outline. If a device chugs on this, config.RENDER.antialias
      // can be checked here to disable it selectively.
      antialias: RENDER.antialias,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(bufferW, bufferH, false);
    renderer.setPixelRatio(1); // expo-gl already gave us device pixels
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Not black. If ever the scene stops drawing for any reason at all, the
    // player sees THIS colour rather than a black screen with a live HUD.
    // Debugging "why is the game black" without a clue in the clear colour
    // is guessing; debugging "why is the game skyZenith-purple" tells you
    // instantly that presentation is working and something is culling the
    // scene.
    renderer.setClearColor(0x140b2e, 1);
    disposer.track(renderer);

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
      handle = factoryRef.current(ctx);
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

      if (!pausedRef.current) {
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
      }

      // updateMatrixWorld normally auto-runs during render(), but only for
      // objects reachable from the scene root. Sky and fadeQuad are children
      // of the CAMERA, and the camera itself is only in the scene graph
      // because world.ts explicitly puts it there. Forcing the update
      // guarantees their world matrices are current no matter what the
      // rendered subtree includes.
      camera.updateMatrixWorld(true);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };

    rafRef.current = requestAnimationFrame(loop);
    onReadyRef.current?.(handle);
  }, []);

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
