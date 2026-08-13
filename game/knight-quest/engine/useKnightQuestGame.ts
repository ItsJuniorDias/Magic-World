import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RENDER } from "../config";
import { Disposer } from "./Disposer";
import { createKnightQuest, type KnightQuestGame } from "../game";

// ---------------------------------------------------------------------------
// DOM polyfill — SAME rationale as Spell Storm's useGLGame. three.js touches
// `document` in a handful of places (texture loading paths, WebGLRenderer
// feature detection). React Native has no DOM, so we install a minimal stub
// once, at module scope, before any renderer is constructed.
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

export interface UseKnightQuestGameOptions {
  paused?: boolean;
  onReady?: (game: KnightQuestGame) => void;
  onLoadProgress?: (done: number, total: number, label: string) => void;
}

export interface UseKnightQuestGameResult {
  onContextCreate: (gl: ExpoGLContext) => void;
  gameRef: React.MutableRefObject<KnightQuestGame | null>;
  /** True once the game has finished loading and started rendering. */
  ready: boolean;
}

/**
 * Owns the entire lifecycle of the Knight Quest three.js scene inside an
 * expo-gl surface. Same conservative shape as Spell Storm's useGLGame —
 * see that file for the long-form rationale on `setSize`, offscreen
 * targets, and shadow map + FBO 0 ownership.
 */
export function useKnightQuestGame({
  paused = false,
  onReady,
  onLoadProgress,
}: UseKnightQuestGameOptions = {}): UseKnightQuestGameResult {
  const gameRef = useRef<KnightQuestGame | null>(null);
  const rafRef = useRef<number | null>(null);
  const disposerRef = useRef<Disposer | null>(null);
  const glRef = useRef<ExpoGLContext | null>(null);
  const pausedRef = useRef(paused);
  const mountedRef = useRef(true);
  const [ready, setReady] = useState(false);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onProgressRef = useRef(onLoadProgress);
  onProgressRef.current = onLoadProgress;

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
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(bufferW, bufferH, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x151024, 1);
    // Shadow map deliberately not enabled on RN — the render-target swap it
    // requires breaks expo-gl's framebuffer presentation and results in a
    // black scene with a working HUD. See config.ts for the long version.
    if (RENDER.shadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    disposer.track(renderer);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      RENDER.camFov,
      bufferW / bufferH,
      0.5,
      220,
    );

    (async () => {
      let game: KnightQuestGame;
      try {
        game = await createKnightQuest(
          { scene, camera, renderer, pixelWidth: bufferW, pixelHeight: bufferH },
          (done, total, label) => onProgressRef.current?.(done, total, label),
        );
      } catch (err) {
        console.error("[knight-quest] failed to build game", err);
        disposer.disposeAll();
        return;
      }
      if (!mountedRef.current) {
        game.dispose();
        disposer.disposeAll();
        return;
      }
      gameRef.current = game;
      onReadyRef.current?.(game);
      setReady(true);

      // -------- fixed-timestep loop --------
      let last = 0;
      let accumulator = 0;
      const STEP = 1 / 60;

      const loop = (now: number) => {
        if (!mountedRef.current) return;
        rafRef.current = requestAnimationFrame(loop);

        if (last === 0) {
          last = now;
          return;
        }
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.25) dt = 0.25; // recover from app-backgrounded stalls

        if (pausedRef.current) return;

        accumulator += dt;
        while (accumulator >= STEP) {
          game.frame(STEP);
          accumulator -= STEP;
        }

        gl.endFrameEXP();
      };
      rafRef.current = requestAnimationFrame(loop);
    })();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      gameRef.current?.dispose();
      disposerRef.current?.disposeAll();
    };
  }, []);

  return { onContextCreate, gameRef, ready };
}
