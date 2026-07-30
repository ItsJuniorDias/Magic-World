import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { CAMERA, RENDER } from "../config";
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
      const renderW = Math.max(1, Math.floor(bufferW * RENDER.resolutionScale));
      const renderH = Math.max(1, Math.floor(bufferH * RENDER.resolutionScale));

      const disposer = new Disposer();
      disposerRef.current = disposer;
      glRef.current = gl;

      const renderer = new THREE.WebGLRenderer({
        context: gl as unknown as WebGLRenderingContext,
        antialias: false, // MSAA is expensive; the flat art doesn't need it
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setSize(renderW, renderH, false);
      renderer.setPixelRatio(1); // expo-gl already gave us device pixels
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 1);
      disposer.track(renderer);

      const scene = new THREE.Scene();
      const aspect = bufferW / bufferH;
      const viewHeight = CAMERA.viewHeight;
      const viewWidth = viewHeight * aspect;

      const camera = new THREE.OrthographicCamera(
        -viewWidth / 2,
        viewWidth / 2,
        viewHeight / 2,
        -viewHeight / 2,
        0.1,
        400,
      );
      camera.position.set(0, CAMERA.baseY, 100);
      camera.lookAt(0, CAMERA.baseY, 0);

      const ctx: GameContext = {
        scene,
        camera,
        renderer,
        track: (r) => disposer.track(r),
        viewWidth,
        viewHeight,
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

        renderer.render(scene, camera);
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
