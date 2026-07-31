import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { setAudioModeAsync } from "expo-audio";
import { GLView } from "expo-gl";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "@/components/ui/Text";
import { useProStatus } from "@/hooks/useProStatus";
import {
  BIOMES,
  createDefaultProgress,
  createSpellStorm,
  INPUT,
  MAP_EXTENT,
  PALETTE,
  PLAYER,
  ROOMS,
  ROOM_IDS,
  STORAGE_KEYS,
  WEAPONS,
  type HudSnapshot,
  type Progress,
  type SoundId,
  type SpellStorm,
  type GateSide,
} from "@/game/spell-storm";
import {
  createMusicController,
  type MusicController,
} from "@/game/spell-storm/audio/procedural";
import { applyStick } from "@/game/spell-storm/engine/input";
import {
  useGLGame,
  type ExpoGLContext,
} from "@/game/spell-storm/engine/useGLGame";
import type { GameContext } from "@/game/spell-storm/types";

/**
 * Spell Storm — screen shell.
 *
 * The React layer owns three things and nothing else: the HUD, the touch
 * controls, and the overlays. It never touches the scene graph.
 *
 * THE HUD IS POLLED, NOT PUSHED
 *
 * Ten times a second on an interval, rather than driven by React state from
 * inside the game loop. setState sixty times a second would re-render this
 * tree sixty times a second on the JS thread — the same thread the game loop
 * runs on — and the frame rate would collapse. 10Hz is imperceptible for a
 * score counter and costs nothing.
 *
 * THE VISUAL LANGUAGE
 *
 * Everything chrome-side is a blurred capsule with a hairline border and a
 * continuous corner curve: the platform's own vocabulary, so the controls
 * read as part of the phone rather than as part of the game. The game itself
 * is flat cut paper; the interface is glass over the top of it. Keeping those
 * two languages strictly separate is what stops the HUD competing with the
 * art for attention.
 *
 * Buttons spring on press rather than dimming. A 0.94 scale with a stiff
 * spring is about 90ms of movement — below the threshold where it reads as
 * animation, above the threshold where it reads as nothing.
 */

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

const HAIRLINE = "rgba(255,255,255,0.16)";
const GLASS_TINT = "rgba(12,8,24,0.34)";

/**
 * The loader is held for at least this long even if the GL context finishes
 * initialising in fifty milliseconds. Two reasons:
 *
 *   1. The paper-theatre intro sequence is part of the game's identity now.
 *      A player who spends half a second on the loader learns that Spell
 *      Storm has a look; a player who blows straight through it doesn't.
 *
 *   2. It gives the rotating tip time to be read. The tips teach mechanics
 *      that used to live in a wall of text on the start overlay — nobody
 *      knew about the aim latch or the pogo without them.
 *
 * If the context takes longer than this floor, the loader stays until it
 * does. The two conditions gate the transition independently.
 */
const LOAD_DURATION_MS = 5000;

// ---------------------------------------------------------------------------
// Glass primitives
// ---------------------------------------------------------------------------

function Glass({
  children,
  style,
  intensity = 28,
  radius = 22,
}: {
  children?: React.ReactNode;
  style?: any;
  intensity?: number;
  radius?: number;
}) {
  return (
    <View
      style={[
        { borderRadius: radius, borderCurve: "continuous", overflow: "hidden" },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: GLASS_TINT }]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: HAIRLINE,
          },
        ]}
      />
      {children}
    </View>
  );
}

/**
 * An action button. Squircle, glass, springs on press.
 *
 * `onPressIn`/`onPressOut` rather than `onPress`: this is a game pad, and a
 * fire button that only registers on release is unusable.
 */
function ActionButton({
  label,
  tint,
  size,
  onDown,
  onUp,
}: {
  label: string;
  tint: string;
  size: number;
  onDown: () => void;
  onUp: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = useCallback(
    (to: number) => {
      Animated.spring(scale, {
        toValue: to,
        useNativeDriver: true,
        speed: 40,
        bounciness: 4,
      }).start();
    },
    [scale],
  );

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => {
          spring(0.93);
          onDown();
        }}
        onPressOut={() => {
          spring(1);
          onUp();
        }}
        hitSlop={12}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size * 0.34,
            borderCurve: "continuous",
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BlurView
            intensity={34}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: size * 0.34,
                borderCurve: "continuous",
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.28)",
              },
            ]}
          />
          <Text
            variant="heading"
            size="md"
            color="#FFFFFF"
            style={styles.actionLabel}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

export default function SpellStormScreen() {
  const insets = useSafeAreaInsets();
  const { isPro, loading: proLoading } = useProStatus();

  const gameRef = useRef<SpellStorm | null>(null);
  const progressRef = useRef<Progress | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);

  // The old code had a single `ready` boolean that flipped once the GL
  // context reported itself alive. We split that into two conditions now:
  //
  //   contextReady   — the WebGL context has come up and the scene graph is
  //                    populated. Driven by useGLGame's onReady callback.
  //   minTimeReached — the enforced floor from LOAD_DURATION_MS has passed.
  //
  // The derived `ready` requires BOTH, plus the progress load and pro-status
  // check. Anything less and the loader stays up.
  const [contextReady, setContextReady] = useState(false);
  const [minTimeReached, setMinTimeReached] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  // Observed container size, populated by onLayout. This gates GLView
  // mounting so that:
  //
  //   - The GL context is never created before the container has a real
  //     size — an expo-gl backing buffer is fixed at creation time, so
  //     starting one at 0x0 or mid-rotation dimensions is a one-way trip
  //     to the black-screen bug documented in _layout.tsx.
  //   - The game only mounts when the container is actually landscape,
  //     which is what the world is authored for. In portrait we show a
  //     rotate prompt instead.
  const [layoutSize, setLayoutSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const inLandscape = !!layoutSize && layoutSize.width > layoutSize.height;

  const ready = contextReady && minTimeReached && progressLoaded && !proLoading;

  const [hud, setHud] = useState<HudSnapshot>({
    phase: "loading",
    hearts: PLAYER.startHearts,
    maxHearts: PLAYER.maxHearts,
    score: 0,
    combo: 1,
    weapon: "bolt",
    weaponTimer: 0,
    roomId: "crossroads",
    roomName: "",
    roomTitle: 0,
    atBench: false,
    bossActive: false,
    bossHp: 0,
    bossMaxHp: 1,
    bossName: "",
    bossTitle: "",
    bossInvulnerable: false,
    bossesDefeated: 0,
    totalBosses: 7,
    discovered: [],
    defeatedRooms: [],
    dashActive: false,
    dashReady: true,
    airDashArmed: false,
    aimLatched: false,
    sealed: null,
  });

  // ---- Persistence -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEYS.progress)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Progress;

            // A save from the v2 pre-release could point `bench` at any room
            // the player fell into via the misplaced hub pit — including
            // rooms that have no bench. The game boots by teleporting the
            // player to `progress.bench`, so a bench field that names a
            // benchless room lands them on empty floor with an inaccurate
            // room-title card and no way to save. THAT is what "The Long
            // Fall" on the black screen was.
            //
            // Anything that fails the check falls back to the crossroads,
            // which every build has always been able to start from.
            const savedBench =
              typeof parsed.bench === "string" ? parsed.bench : "";
            const bench =
              ROOMS[savedBench] && ROOMS[savedBench].bench
                ? savedBench
                : "crossroads";

            progressRef.current = {
              bosses: Array.isArray(parsed.bosses)
                ? parsed.bosses.filter(
                    (id) => typeof id === "string" && !!ROOMS[id],
                  )
                : [],
              discovered: Array.isArray(parsed.discovered)
                ? parsed.discovered.filter(
                    (id) => typeof id === "string" && !!ROOMS[id],
                  )
                : [],
              bench,
              benchX: typeof parsed.benchX === "number" ? parsed.benchX : 0,
              essence: typeof parsed.essence === "number" ? parsed.essence : 0,
            };
          } catch {
            progressRef.current = createDefaultProgress();
          }
        } else {
          progressRef.current = createDefaultProgress();
        }
        setProgressLoaded(true);
      })
      .catch(() => {
        progressRef.current = createDefaultProgress();
        setProgressLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Minimum loader-visible time. Starts on mount and runs in PARALLEL with
  // the async progress load and the GL context init — so if everything
  // resolves in 200ms the player still gets the full paper-theatre intro,
  // and if the context init runs long the loader waits for it.
  useEffect(() => {
    const t = setTimeout(() => setMinTimeReached(true), LOAD_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  const handleProgress = useCallback((p: Progress) => {
    progressRef.current = p;
    AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(p)).catch(
      () => {},
    );
  }, []);

  const handleSound = useCallback((id: SoundId) => {
    // Haptics stand in for audio. Only the events that matter get one —
    // buzzing on every shot would be exhausting and would drain battery.
    switch (id) {
      case "hurt":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        break;
      case "pickup":
      case "gate":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        break;
      case "bench":
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        break;
      case "bossRoar":
      case "sealed":
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
        break;
      case "bossDown":
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        break;
      case "gameover":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
        break;
      default:
        break;
    }
  }, []);

  // ---- Engine ------------------------------------------------------------
  const factory = useCallback(
    (ctx: GameContext) => {
      const game = createSpellStorm(ctx, {
        isPro,
        progress: progressRef.current ?? createDefaultProgress(),
        onProgress: handleProgress,
        onSound: handleSound,
      });
      gameRef.current = game;
      return game;
    },
    [isPro, handleProgress, handleSound],
  );

  const { onContextCreate, handleRef } = useGLGame({
    factory,
    // Also pause when the container drops out of landscape: if the player
    // rotates mid-run we cover the (now mis-sized) framebuffer with the
    // rotate prompt and freeze the sim behind it. When they rotate back,
    // paused flips false, the aim latch and dash timers pick up where they
    // were, no run lost.
    paused: mapOpen || !inLandscape,
    onReady: () => setContextReady(true),
  });

  // Rotation.
  //
  // Two jobs, in this order every time:
  //
  //   1. Publish the current container size to `layoutSize`. This is the
  //      gate that lets <GLView /> mount at all: no size, no context —
  //      that guarantees `onContextCreate` never fires against a 0x0 or
  //      mid-rotation buffer, which was the whole cause of the first-entry
  //      black screen.
  //   2. If the game already exists, hand it the new size so the camera
  //      frustum re-fits. The old build never called resize at all, so
  //      turning the phone left the frustum on the previous aspect ratio
  //      and stretched everything.
  //
  // Guarding the resize call on `contextReady` (rather than the combined
  // `ready`) avoids a resize call against a null handle that used to look
  // silently benign but poisoned the frustum on the very first frame. But
  // the layoutSize publish happens unconditionally — that is the whole
  // point of separating it from the resize path.
  //
  // The dimensions are in DIPs and the camera fit wants pixels. cameraRig.fit
  // divides by height to get an aspect ratio, and the ratio is the same in
  // both, so no PixelRatio multiplication is needed.
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width < 1 || height < 1) return;
      setLayoutSize((prev) => {
        if (prev && prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
      if (contextReady) {
        handleRef.current?.resize(width, height);
      }
    },
    [handleRef, contextReady],
  );

  useEffect(() => {
    const id = setInterval(() => {
      const game = gameRef.current;
      if (game) setHud({ ...game.hud });
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ---- Music -------------------------------------------------------------
  //
  // The whole soundtrack is generated at runtime — no mp3s in the bundle.
  // See game/spell-storm/audio/procedural.ts for the DSP; from here we
  // only care about the controller's small imperative surface:
  //
  //   setBiome(id)     switch to a biome's loop (cached after first visit)
  //   setPaused(bool)  freeze / resume the current loop
  //   dispose()        release native players on unmount
  //
  // We tie setBiome to `hud.roomId` (which biome the room lives in) and
  // setPaused to the combined "should the game be running" predicate:
  // paused when the map overlay is open, when the phone is in portrait,
  // or when we're between phases (loading / dead). Same predicate the
  // sim uses, so audio and gameplay pause together.
  const musicRef = useRef<MusicController | null>(null);
  useEffect(() => {
    // playsInSilentMode is the #1 reason background music is silent on a
    // real iPhone with the ringer switch off — without this the whole
    // procedural score plays into the void. mixWithOthers so we don't
    // duck whatever the player is listening to before opening the game;
    // Spell Storm's music is a mood layer, not a message.
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch((e) =>
      // eslint-disable-next-line no-console
      console.warn("[spell-storm] setAudioModeAsync failed", e),
    );

    const controller = createMusicController();
    musicRef.current = controller;
    return () => {
      controller.dispose();
      musicRef.current = null;
    };
  }, []);

  // Biome sync: whenever the room changes, poke the controller at the
  // biome id. The controller de-dupes so this is a no-op if we're already
  // on the right biome (which happens when the room changes within a
  // biome — Fungal Hollow → Fungal Deep stays on the same loop).
  useEffect(() => {
    const controller = musicRef.current;
    if (!controller) return;
    const room = ROOMS[hud.roomId];
    if (!room) return;
    void controller.setBiome(room.biome);
  }, [hud.roomId]);

  // Paused sync. This deliberately excludes `!ready` from the pause
  // predicate — we WANT the music to start as soon as the biome loads,
  // even if the loader is still up. It gives the loader a soundtrack.
  const musicPaused =
    mapOpen ||
    !inLandscape ||
    hud.phase === "loading" ||
    hud.phase === "dead";
  useEffect(() => {
    musicRef.current?.setPaused(musicPaused);
  }, [musicPaused]);

  // ---- Compass objective -------------------------------------------------
  //
  // Recomputed whenever the room changes, a boss is defeated, or the pro
  // status flips (a pro purchase mid-run should immediately re-route the
  // compass through the now-open gates). BFS is cheap — twenty rooms and
  // change — so we don't memo aggressively; the useMemo is a formality
  // to skip work on unrelated hud updates like score ticking.
  const objective = useMemo(
    () =>
      findObjective(
        hud.roomId,
        hud.defeatedRooms,
        hud.bossesDefeated,
        isPro,
      ),
    [hud.roomId, hud.defeatedRooms, hud.bossesDefeated, isPro],
  );

  // ---- Touch controls ----------------------------------------------------
  const [stickOrigin, setStickOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [stickKnob, setStickKnob] = useState({ x: 0, y: 0 });

  // Dash triggers on double-tap on the movement zone. We track the moment
  // of the previous release and its final direction (from the last stick
  // reading before release), and treat a new touch within the window as
  // "the player asked for a dash in the direction they most recently held".
  //
  // Two implementation details worth calling out:
  //
  //   - `Date.now()` rather than the frame clock, because touch input is
  //     driven by the OS and doesn't share a frame timeline with the sim.
  //   - The direction is captured on RELEASE, not on the second GRANT.
  //     Reading the stick on grant is always (0,0) because the finger just
  //     landed; reading it on release records the actual travel direction.
  const lastReleaseAt = useRef(0);
  const lastReleaseDir = useRef<0 | 1 | -1>(0);
  const currentStickDx = useRef(0);

  const stickResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // The stick appears wherever the thumb lands rather than living at a
        // fixed spot. On a phone the player cannot see their own thumb, and a
        // fixed stick means constantly hunting for it mid-fight.
        onPanResponderGrant: (evt) => {
          setStickOrigin({
            x: evt.nativeEvent.locationX,
            y: evt.nativeEvent.locationY,
          });
          setStickKnob({ x: 0, y: 0 });
          const now = Date.now() / 1000;
          if (
            now - lastReleaseAt.current < 0.28 &&
            lastReleaseDir.current !== 0 &&
            gameRef.current
          ) {
            gameRef.current.input.dashRequest = lastReleaseDir.current;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
          }
        },
        onPanResponderMove: (_evt, gesture) => {
          const game = gameRef.current;
          if (game) applyStick(game.input, gesture.dx, gesture.dy);
          currentStickDx.current = gesture.dx;
          const len = Math.hypot(gesture.dx, gesture.dy);
          const clamp = Math.min(len, INPUT.stickRadius);
          const scale = len > 0 ? clamp / len : 0;
          setStickKnob({ x: gesture.dx * scale, y: gesture.dy * scale });
        },
        onPanResponderRelease: () => {
          const game = gameRef.current;
          if (game) applyStick(game.input, 0, 0);
          // Only credit a direction for double-tap if the thumb actually
          // travelled — a stationary tap-and-release should not arm the
          // next tap into a dash.
          const dx = currentStickDx.current;
          lastReleaseAt.current = Date.now() / 1000;
          lastReleaseDir.current = dx > 18 ? 1 : dx < -18 ? -1 : 0;
          currentStickDx.current = 0;
          setStickOrigin(null);
          setStickKnob({ x: 0, y: 0 });
        },
        onPanResponderTerminate: () => {
          const game = gameRef.current;
          if (game) applyStick(game.input, 0, 0);
          currentStickDx.current = 0;
          setStickOrigin(null);
        },
      }),
    [],
  );

  const pressJump = useCallback((down: boolean) => {
    const game = gameRef.current;
    if (!game) return;
    game.input.jumpHeld = down;
    if (down) {
      game.input.jumpPressed = true;
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const pressFire = useCallback((down: boolean) => {
    const game = gameRef.current;
    if (!game) return;
    game.input.fireHeld = down;
    if (down) {
      // The press edge is the signal for the aim latch. Set it here so the
      // simulation catches it on its very next fixed step, before it has a
      // chance to update aim from the stick and lose the intended direction.
      game.input.firePressed = true;
    }
  }, []);

  const startRun = useCallback(() => {
    gameRef.current?.start();
    setHud((h) => ({ ...h, phase: "playing" }));
  }, []);

  // ---- Render ------------------------------------------------------------
  const playing =
    hud.phase === "playing" ||
    hud.phase === "transition" ||
    hud.phase === "bossIntro" ||
    hud.phase === "bossDefeated" ||
    hud.phase === "dead";

  const weaponSpec = WEAPONS[hud.weapon];
  const bossPct = Math.max(
    0,
    Math.min(1, hud.bossHp / Math.max(1, hud.bossMaxHp)),
  );

  // Loader subtitle mirrors what the app is actually waiting on, so a slow
  // async progress load doesn't sit silently under "Preparing the arena".
  const loaderSubtitle = !progressLoaded
    ? "Restoring your progress"
    : proLoading
      ? "Checking your grimoire"
      : !contextReady
        ? "Preparing the arena"
        : "Almost ready";

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar hidden />

      {/*
        GLView is mounted once THREE conditions are met:
        progress-load + pro-status + landscape container. The landscape
        gate is the important one: expo-gl fixes its backing framebuffer
        at context creation, so if we let this mount while the container
        was portrait or mid-rotation the buffer would be born the wrong
        size and never recover. Waiting for `inLandscape` guarantees the
        onContextCreate that fires here reads the FINAL, stable landscape
        drawingBufferWidth / Height.
      */}
      {progressLoaded && !proLoading && inLandscape && (
        <GLView
          style={StyleSheet.absoluteFill}
          onContextCreate={onContextCreate as (gl: ExpoGLContext) => void}
        />
      )}

      {/* ---------------- HUD ---------------- */}
      {ready && playing && (
        <View
          pointerEvents="box-none"
          style={[
            styles.hudLayer,
            {
              paddingTop: insets.top + 10,
              paddingHorizontal: insets.left + 18,
            },
          ]}
        >
          <View style={styles.hudRow} pointerEvents="box-none">
            {/* Hearts + essence */}
            <Glass style={styles.statusPill} radius={20}>
              <View style={styles.statusInner}>
                <View style={styles.hearts}>
                  {Array.from({ length: hud.maxHearts }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.heart,
                        {
                          backgroundColor:
                            i < hud.hearts
                              ? hex(PALETTE.heart)
                              : "rgba(255,255,255,0.14)",
                        },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.divider} />
                <Text
                  variant="heading"
                  size="md"
                  color="#FFFFFF"
                  style={styles.essence}
                >
                  {hud.score.toLocaleString()}
                </Text>
                {hud.combo > 1 && (
                  <Text
                    variant="body"
                    size="sm"
                    color={hex(PALETTE.gold)}
                    style={styles.combo}
                  >
                    {hud.combo.toFixed(1)}×
                  </Text>
                )}
              </View>
            </Glass>

            {/* Sigils + compass + map */}
            <View style={styles.hudRight} pointerEvents="box-none">
              <Glass style={styles.sigilPill} radius={18}>
                <View style={styles.sigilInner}>
                  {Array.from({ length: hud.totalBosses }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.sigil,
                        {
                          backgroundColor:
                            i < hud.bossesDefeated
                              ? hex(PALETTE.gold)
                              : "rgba(255,255,255,0.14)",
                        },
                      ]}
                    />
                  ))}
                </View>
              </Glass>

              {/*
                One button, two faces. When there IS an objective (which is
                most of the game), the button becomes a compass — a gold
                arrow pointing toward the next reachable boss. When the
                player is inside a boss room, or when nothing reachable is
                unbeaten, it falls back to the classic map grid glyph.
                Either way, tapping opens the full map. One affordance
                beats two side-by-side buttons that do the same thing.
              */}
              <Pressable onPress={() => setMapOpen(true)} hitSlop={10}>
                <Glass
                  style={objective ? styles.compassButton : styles.iconButton}
                  radius={objective ? 20 : 17}
                >
                  <View style={styles.iconInner}>
                    {objective ? (
                      <CompassArrow side={objective.side} />
                    ) : (
                      <>
                        <View style={styles.mapGlyphRow}>
                          <View style={styles.mapGlyphCell} />
                          <View
                            style={[
                              styles.mapGlyphCell,
                              styles.mapGlyphCellDim,
                            ]}
                          />
                        </View>
                        <View style={styles.mapGlyphRow}>
                          <View
                            style={[
                              styles.mapGlyphCell,
                              styles.mapGlyphCellDim,
                            ]}
                          />
                          <View style={styles.mapGlyphCell} />
                        </View>
                      </>
                    )}
                  </View>
                </Glass>
              </Pressable>
            </View>
          </View>

          {/* Weapon timer */}
          {hud.weapon !== "bolt" && (
            <View style={styles.weaponRow} pointerEvents="none">
              <Glass style={styles.weaponPill} radius={14}>
                <View style={styles.weaponInner}>
                  <Text variant="label" size="sm" color={hex(PALETTE.arcane)}>
                    {weaponSpec.label} · {Math.ceil(hud.weaponTimer)}s
                  </Text>
                </View>
              </Glass>
            </View>
          )}
        </View>
      )}

      {/* ---------------- Room name card ---------------- */}
      {ready && playing && hud.roomTitle > 0 && (
        <View
          pointerEvents="none"
          style={[styles.roomCard, { top: insets.top + 84 }]}
        >
          <Text
            variant="heading"
            size="lg"
            color="#FFFFFF"
            style={styles.roomName}
          >
            {hud.roomName}
          </Text>
          <View style={styles.roomRule} />
        </View>
      )}

      {/* ---------------- Boss bar ---------------- */}
      {ready && playing && hud.bossActive && (
        <View
          pointerEvents="none"
          style={[styles.bossWrap, { bottom: insets.bottom + 20 }]}
        >
          <Text
            variant="heading"
            size="md"
            color="#FFFFFF"
            style={styles.bossName}
          >
            {hud.bossName}
          </Text>
          {!!hud.bossTitle && (
            <Text
              variant="body"
              size="sm"
              color="rgba(255,255,255,0.5)"
              style={styles.bossTitle}
            >
              {hud.bossTitle}
            </Text>
          )}
          <View style={styles.bossTrack}>
            <View
              style={[
                styles.bossFill,
                {
                  width: `${bossPct * 100}%`,
                  backgroundColor: hud.bossInvulnerable
                    ? "rgba(255,255,255,0.4)"
                    : hex(PALETTE.heart),
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* ---------------- Bench prompt ---------------- */}
      {ready && playing && hud.atBench && (
        <View
          pointerEvents="none"
          style={[styles.benchWrap, { bottom: insets.bottom + 118 }]}
        >
          <Glass style={styles.benchPill} radius={16}>
            <View style={styles.benchInner}>
              <Text variant="label" size="sm" color={hex(PALETTE.gold)}>
                Rested · progress saved
              </Text>
            </View>
          </Glass>
        </View>
      )}

      {/* ---------------- Sealed door ---------------- */}
      {ready && playing && hud.sealed && (
        <View
          style={[styles.sealedWrap, { bottom: insets.bottom + 118 }]}
          pointerEvents="box-none"
        >
          <Glass style={styles.sealedCard} radius={20}>
            <View style={styles.sealedInner}>
              <Text variant="label" size="sm" color={hex(PALETTE.gold)}>
                {hud.sealed.label}
              </Text>
              {hud.sealed.pro && (
                <Pressable
                  onPress={() => router.push("/(subscribe)")}
                  style={styles.sealedCta}
                >
                  <Text variant="heading" size="sm" color="#04121A">
                    Unlock
                  </Text>
                </Pressable>
              )}
            </View>
          </Glass>
        </View>
      )}

      {/* ---------------- Controls ---------------- */}
      {ready && playing && !mapOpen && (
        <>
          <View style={styles.stickZone} {...stickResponder.panHandlers}>
            {stickOrigin && (
              <>
                <View
                  pointerEvents="none"
                  style={[
                    styles.stickBase,
                    {
                      left: stickOrigin.x - INPUT.stickRadius,
                      top: stickOrigin.y - INPUT.stickRadius,
                    },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.stickKnob,
                    {
                      left: stickOrigin.x + stickKnob.x - 27,
                      top: stickOrigin.y + stickKnob.y - 27,
                    },
                  ]}
                />
              </>
            )}
          </View>

          <View
            style={[
              styles.actions,
              { right: insets.right + 26, bottom: insets.bottom + 30 },
            ]}
            pointerEvents="box-none"
          >
            {/*
              The dash indicator sits beside CAST rather than being a
              button. Making it a button would eat thumb real estate;
              making it a status pip teaches the player that dash is
              available WITHOUT adding another target to hit.
              
              Four states:
                white + big  →  dash is firing right now
                gold         →  airborne, JUMP will fire an air dash
                cyan         →  cooldown ready (double-tap dash works)
                dim          →  cooldown active, no dash of any kind
            */}
            <View
              pointerEvents="none"
              style={[
                styles.dashPip,
                {
                  backgroundColor: hud.dashActive
                    ? "#FFFFFF"
                    : hud.airDashArmed
                      ? hex(PALETTE.gold)
                      : hud.dashReady
                        ? hex(PALETTE.arcane)
                        : "rgba(255,255,255,0.22)",
                  transform: [{ scale: hud.dashActive ? 1.3 : 1 }],
                },
              ]}
            />
            <ActionButton
              label="CAST"
              size={86}
              tint="rgba(111,233,255,0.34)"
              onDown={() => pressFire(true)}
              onUp={() => pressFire(false)}
            />
            <ActionButton
              label="JUMP"
              size={76}
              tint="rgba(255,201,74,0.34)"
              onDown={() => pressJump(true)}
              onUp={() => pressJump(false)}
            />
          </View>
        </>
      )}

      {/* ---------------- Start overlay ---------------- */}
      {ready && hud.phase === "ready" && (
        <Overlay
          title="Spell Storm"
          subtitle="Drag to move. Tilt the stick to aim, cast to lock it. Double-tap the stick to dash. Fire down in the air to pogo off enemies."
          primaryLabel={
            (progressRef.current?.bosses.length ?? 0) > 0 ||
            (progressRef.current?.discovered.length ?? 0) > 1
              ? "Continue"
              : "Begin"
          }
          onPrimary={startRun}
          secondaryLabel="Back to Arcade"
          onSecondary={() => router.back()}
          stats={
            (progressRef.current?.bosses.length ?? 0) > 0
              ? `${progressRef.current?.bosses.length}/7 sigils · ${progressRef.current?.discovered.length} rooms found`
              : undefined
          }
        />
      )}

      {/* ---------------- Map ---------------- */}
      {ready && mapOpen && (
        <View style={styles.mapOverlay}>
          <BlurView
            intensity={44}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(8,4,18,0.62)" },
            ]}
          />
          {/*
            HEADER
            Left: current room name + biome + progress counters.
            Right: compass badge showing where the next objective lies
                   (mirrors the HUD compass exactly) + close button.
            The header is the single source of "where am I / where am I
            going", which is the whole reason a map exists.
          */}
          <View
            style={[
              styles.mapHeader,
              {
                paddingTop: insets.top + 16,
                paddingHorizontal: insets.left + 24,
              },
            ]}
          >
            <View style={{ flexShrink: 1 }}>
              <Text
                variant="heading"
                size="lg"
                color="#FFFFFF"
                numberOfLines={1}
              >
                {ROOMS[hud.roomId]?.name ?? "The World"}
              </Text>
              <Text
                variant="body"
                size="sm"
                color="rgba(255,255,255,0.5)"
                numberOfLines={1}
              >
                {BIOMES[ROOMS[hud.roomId]?.biome ?? "hollow"].label} ·{" "}
                {hud.discovered.length} of {ROOM_IDS.length} rooms ·{" "}
                {hud.bossesDefeated} of {hud.totalBosses} sigils
              </Text>
            </View>
            <View style={styles.mapHeaderRight}>
              {objective && (
                <View style={styles.mapCompassCallout}>
                  <Glass style={styles.compassButton} radius={20}>
                    <View style={styles.iconInner}>
                      <CompassArrow side={objective.side} />
                    </View>
                  </Glass>
                  <View style={{ marginLeft: 10, maxWidth: 140 }}>
                    <Text
                      variant="label"
                      size="xs"
                      color="rgba(255,255,255,0.55)"
                    >
                      NEXT
                    </Text>
                    <Text
                      variant="heading"
                      size="sm"
                      color="#FFFFFF"
                      numberOfLines={1}
                    >
                      {objective.targetBossName}
                    </Text>
                  </View>
                </View>
              )}
              <Pressable onPress={() => setMapOpen(false)} hitSlop={14}>
                <Glass style={styles.iconButton} radius={17}>
                  <View style={styles.iconInner}>
                    <View style={styles.closeBarA} />
                    <View style={styles.closeBarB} />
                  </View>
                </Glass>
              </Pressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.mapScroll}
            showsVerticalScrollIndicator={false}
          >
            <WorldMap hud={hud} target={objective?.targetRoomId ?? null} />
          </ScrollView>

          {/*
            LEGEND
            Four glyphs matching what appears in the grid, so the player
            can decode a cell without hovering (there is no hover on a
            touchscreen). Sits at the bottom of the overlay so it doesn't
            fight the header for attention.
          */}
          <View
            style={[
              styles.mapLegend,
              { paddingBottom: insets.bottom + 12 },
            ]}
            pointerEvents="none"
          >
            <View style={styles.mapLegendItem}>
              <View style={[styles.legendDiamond, { backgroundColor: hex(PALETTE.heart) }]} />
              <Text variant="label" size="xs" color="rgba(255,255,255,0.62)">
                Boss
              </Text>
            </View>
            <View style={styles.mapLegendItem}>
              <View style={[styles.legendDiamond, { backgroundColor: hex(PALETTE.gold) }]} />
              <Text variant="label" size="xs" color="rgba(255,255,255,0.62)">
                Defeated
              </Text>
            </View>
            <View style={styles.mapLegendItem}>
              <View style={styles.legendBench} />
              <Text variant="label" size="xs" color="rgba(255,255,255,0.62)">
                Bench
              </Text>
            </View>
            <View style={styles.mapLegendItem}>
              <View style={styles.legendYouCircle} />
              <Text variant="label" size="xs" color="rgba(255,255,255,0.62)">
                You
              </Text>
            </View>
            <View style={styles.mapLegendItem}>
              <View style={styles.legendTargetCircle} />
              <Text variant="label" size="xs" color="rgba(255,255,255,0.62)">
                Next
              </Text>
            </View>
          </View>
        </View>
      )}

      {/*
        The loader is the very last (game-side) node so it sits above every
        other layer. It renders with pointerEvents="auto" and covers the
        whole viewport, which is what stops the player from stabbing at the
        CAST button while the arena is still being drawn. It only shows
        when the container is landscape — in portrait the RotatePrompt
        below takes its place.
      */}
      {!ready && inLandscape && (
        <Loader subtitle={loaderSubtitle} duration={LOAD_DURATION_MS} />
      )}

      {/*
        Rotate prompt. Shown once we KNOW the container is portrait —
        we wait for `layoutSize` before rendering it so a landscape entry
        doesn't flash a rotate icon for one frame while onLayout is still
        pending. On the pre-layout frame the styles.root background
        (#05030A, the same as the loader) is what the player sees, so
        there is no visible pop.
        Covers whatever is behind it, which is what lets us keep the game
        mounted during a mid-run rotation without the player seeing a
        torn frame or a resized-wrong sky through the gap.
      */}
      {layoutSize && !inLandscape && <RotatePrompt />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Compass — where should the player go next?
//
// A metroidvania without a hint is a metroidvania that only works if you
// like being lost, which turns out to be a taste most players don't
// share. The compass answers the one question that keeps the player
// engaged instead of confused: which door is the next boss behind?
//
// The algorithm is BFS from the current room, expanding only through
// gates the player can actually walk through right now. The first non-
// current boss room the search reaches wins. We return the side of the
// FIRST gate on that shortest path — that's the direction the compass
// arrow points, and it's stable: as long as the player keeps moving
// toward the objective, the arrow stays consistent rather than flipping
// on every step.
//
// Sealed gates that COULD open later (pro branches for non-members, the
// storm gate before six sigils) are treated as walls. When the player
// unlocks pro or clears the sixth sigil, the BFS naturally starts
// finding paths through them without any special code.
//
// Returns null when the player is already inside a boss room (the
// objective IS this room) or when nothing reachable is unbeaten (which
// means either they've cleared everything they can access, or every
// path forward is sealed behind pro).
// ---------------------------------------------------------------------------

interface Objective {
  side: GateSide;
  targetRoomId: string;
  targetBossName: string;
}

function findObjective(
  currentRoomId: string,
  defeatedRooms: string[],
  bossesDefeated: number,
  isPro: boolean,
): Objective | null {
  const currentRoom = ROOMS[currentRoomId];
  // Standing INSIDE a boss room — there is no "which way" to point.
  // Either they're fighting it or they've beaten it and are just visiting.
  if (currentRoom?.boss) return null;

  const queue: { room: string; firstSide: GateSide | null }[] = [
    { room: currentRoomId, firstSide: null },
  ];
  const visited = new Set<string>([currentRoomId]);

  while (queue.length) {
    const node = queue.shift()!;
    const room = ROOMS[node.room];
    if (!room) continue;

    // Objective: a boss room we haven't cleared. Skip the origin — we
    // already excluded standing-in-a-boss-room above, so this only
    // filters the seed of the BFS which by definition can't be an
    // objective anyway.
    if (
      node.room !== currentRoomId &&
      room.boss &&
      !defeatedRooms.includes(node.room) &&
      node.firstSide
    ) {
      return {
        side: node.firstSide,
        targetRoomId: node.room,
        targetBossName: room.bossName ?? room.name,
      };
    }

    for (const gate of room.gates) {
      if (visited.has(gate.to)) continue;
      const sealed =
        (gate.requires !== undefined && bossesDefeated < gate.requires) ||
        (gate.pro === true && !isPro);
      if (sealed) continue;
      visited.add(gate.to);
      queue.push({
        room: gate.to,
        // The first gate we cross fixes the direction for the whole
        // path. Downstream expansions inherit it.
        firstSide: node.firstSide ?? gate.side,
      });
    }
  }
  return null;
}

/**
 * Which way the arrow visually points. Base arrow points UP (0deg), and
 * each gate side rotates from there. `top` means "the gate is on the
 * ceiling of this room", which reads as pointing UP on screen.
 */
const COMPASS_ROTATION: Record<GateSide, string> = {
  top: "0deg",
  right: "90deg",
  bottom: "180deg",
  left: "-90deg",
};

/**
 * A tiny arrow. Two Views: a thin shaft and a triangular head. Sized to
 * fit a 40x40 icon button with 8px of breathing room on every side.
 */
function CompassArrow({ side }: { side: GateSide }) {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        transform: [{ rotate: COMPASS_ROTATION[side] }],
      }}
    >
      {/* Shaft. Sits vertically, gets rotated by the parent. */}
      <View
        style={{
          position: "absolute",
          left: 10.5,
          top: 8,
          width: 3,
          height: 14,
          borderRadius: 1.5,
          backgroundColor: hex(PALETTE.gold),
        }}
      />
      {/* Arrowhead. Upward triangle using the border trick. */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 6,
          width: 0,
          height: 0,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderBottomWidth: 9,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: hex(PALETTE.gold),
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Map overlay
//
// A grid, not a scale drawing. Hollow Knight's map isn't to scale either —
// what a player needs from a map is topology (what connects to what, where
// haven't I been) and the grid delivers that in a fraction of the code a
// true-to-scale minimap would take.
// ---------------------------------------------------------------------------

// Cells shrunk from 78→60 and the gap from 26→18 in the v3.3 pass. The
// old dimensions overflowed vertically on landscape iPhone SE and had
// too much text-per-cell to read at a glance. The new size fits the
// whole 7×5 grid inside a landscape iPhone frame without scrolling and
// leaves enough room for icons but not for room names — which was the
// point. Names live in the header now; cells just show WHAT.
const CELL = 60;
const GAP = 18;

function WorldMap({
  hud,
  target,
}: {
  hud: HudSnapshot;
  /** Room id that the compass points to. Rendered with a gold outline. */
  target: string | null;
}) {
  const width = MAP_EXTENT.cols * CELL + (MAP_EXTENT.cols - 1) * GAP;
  const height = MAP_EXTENT.rows * CELL + (MAP_EXTENT.rows - 1) * GAP;

  // Pulse animation for the "you are here" marker and the target boss.
  // A single Animated.Value drives both interpolations — cheaper than two
  // parallel timelines, and they read as belonging to the same beat.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const connectors = useMemo(() => {
    // A connector is a straight rectangle. For horizontal or vertical gate
    // pairs, one segment does the job. For the one diagonal pair we still
    // have — crossroads → storm_ascent — we emit an L-shape: a vertical
    // stub up from the origin's column, meeting a horizontal run across the
    // destination's row.
    //
    // `sealed` is set when the gate is either pro-locked or boss-locked and
    // the player hasn't unlocked it yet. Sealed connectors render dashed so
    // the map reads "there is more this way, you can't get through yet"
    // rather than "there is a door here". Once the seal is broken the
    // connector snaps back to solid on the next map open.
    const out: {
      key: string;
      left: number;
      top: number;
      w: number;
      h: number;
      sealed: boolean;
    }[] = [];
    const seen = new Set<string>();
    const bossCount = hud.bossesDefeated;
    for (const id of ROOM_IDS) {
      const room = ROOMS[id];
      for (const gate of room.gates) {
        const other = ROOMS[gate.to];
        if (!other) continue;
        const key = [id, gate.to].sort().join("|") + `|${gate.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!hud.discovered.includes(id) || !hud.discovered.includes(gate.to))
          continue;

        const sealed =
          (gate.requires !== undefined && bossCount < gate.requires) ||
          (gate.pro === true);

        const ax = room.map.col * (CELL + GAP);
        const ay = room.map.row * (CELL + GAP);
        const bx = other.map.col * (CELL + GAP);
        const by = other.map.row * (CELL + GAP);

        if (room.map.row === other.map.row) {
          out.push({
            key,
            left: Math.min(ax, bx) + CELL,
            top: ay + CELL / 2 - 2,
            w: Math.abs(bx - ax) - CELL,
            h: 4,
            sealed,
          });
        } else if (room.map.col === other.map.col) {
          out.push({
            key,
            left: ax + CELL / 2 - 2,
            top: Math.min(ay, by) + CELL,
            w: 4,
            h: Math.abs(by - ay) - CELL,
            sealed,
          });
        } else {
          // L-shape for diagonal room pairs. Two segments meeting at the
          // origin column / destination row corner. See v3.2 notes above
          // for the full derivation — this is unchanged since then.
          const acx = ax + CELL / 2;
          const bcy = by + CELL / 2;
          const bDown = by > ay;
          const bRight = bx > ax;

          const vStart = bDown ? ay + CELL : ay;
          const vEnd = bcy;
          out.push({
            key: `${key}-v`,
            left: acx - 2,
            top: Math.min(vStart, vEnd),
            w: 4,
            h: Math.abs(vEnd - vStart),
            sealed,
          });
          const hStart = acx;
          const hEnd = bRight ? bx : bx + CELL;
          out.push({
            key: `${key}-h`,
            left: Math.min(hStart, hEnd),
            top: bcy - 2,
            w: Math.abs(hEnd - hStart),
            h: 4,
            sealed,
          });
        }
      }
    }
    return out;
  }, [hud.discovered, hud.bossesDefeated]);

  return (
    <View style={{ width, height }}>
      {connectors.map((c) => (
        <View
          key={c.key}
          style={{
            position: "absolute",
            left: c.left,
            top: c.top,
            width: Math.max(4, c.w),
            height: Math.max(4, c.h),
            backgroundColor: c.sealed
              ? "transparent"
              : "rgba(255,255,255,0.18)",
            borderRadius: 2,
            borderStyle: c.sealed ? "dashed" : "solid",
            borderColor: c.sealed ? "rgba(255,255,255,0.28)" : "transparent",
            borderTopWidth: c.sealed && c.w >= c.h ? 2 : 0,
            borderLeftWidth: c.sealed && c.h > c.w ? 2 : 0,
          }}
        />
      ))}

      {ROOM_IDS.map((id) => {
        const room = ROOMS[id];
        const found = hud.discovered.includes(id);
        const here = hud.roomId === id;
        const cleared = hud.defeatedRooms.includes(id);
        const isTarget = target === id;
        const tint = BIOMES[room.biome].mapTint;

        // Border priority: current room wins over target wins over
        // discovered wins over undiscovered. A cell that is both current
        // AND target (edge case: you just teleported to the target)
        // shows as current — you don't need the "next" hint when you're
        // already there.
        const borderColor = here
          ? "#FFFFFF"
          : isTarget
            ? hex(PALETTE.gold)
            : found
              ? `${tint}66`
              : "rgba(255,255,255,0.08)";
        const borderWidth = here || isTarget ? 2 : 1;

        const cellStyle = {
          position: "absolute" as const,
          left: room.map.col * (CELL + GAP),
          top: room.map.row * (CELL + GAP),
          width: CELL,
          height: CELL,
          borderRadius: 14,
          borderCurve: "continuous" as const,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          padding: 4,
          backgroundColor: found ? `${tint}22` : "rgba(255,255,255,0.04)",
          borderWidth,
          borderColor,
        };

        // Only the current cell and the target cell pulse. Everything
        // else gets identity transform. We still use Animated.View for
        // every cell so the rendered subtree is stable — swapping the
        // wrapper mid-run based on state would remount the cell and
        // lose the pulse mid-cycle.
        const animatedStyle =
          here || isTarget ? { transform: [{ scale: pulseScale }] } : null;

        return (
          <Animated.View key={id} style={[cellStyle, animatedStyle]}>
            {found ? (
              <>
                {/*
                  Boss diamond. Red until beaten, gold after. Sits at
                  the top of the cell so a bench (bottom) doesn't
                  collide with it visually.
                */}
                {!!room.boss && (
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      borderCurve: "continuous",
                      transform: [{ rotate: "45deg" }],
                      backgroundColor: cleared
                        ? hex(PALETTE.gold)
                        : hex(PALETTE.heart),
                    }}
                  />
                )}
                {/*
                  Regular-room dot. Only shown when there's no boss —
                  it's a "there is something here" signal, and the boss
                  diamond already provides that. A small biome-tinted
                  disc; matches the cell's tint so it reads as coherent.
                */}
                {!room.boss && (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: here
                        ? "#FFFFFF"
                        : `${tint}CC`,
                    }}
                  />
                )}
                {/*
                  Bench mark. A gold underline at the bottom edge of the
                  cell. Two rooms in the world have one, and knowing
                  where they are is the difference between "one more
                  try" and "restart the branch".
                */}
                {!!room.bench && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 6,
                      width: 18,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: hex(PALETTE.gold),
                    }}
                  />
                )}
              </>
            ) : (
              <Text
                variant="body"
                size="md"
                color="rgba(255,255,255,0.28)"
              >
                ?
              </Text>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

// ===========================================================================
// Rotate prompt
//
// Shown whenever the container is not landscape. Two jobs:
//
//   1. Cover the whole screen so that whatever is behind — the (possibly
//      mis-sized) GLView, the loader, or nothing at all on the very first
//      frame — is never visible in portrait. This is what turns the first
//      pre-layout frame from a "black flash" into an intentional prompt.
//
//   2. Ask for a physical rotation. The game is authored for landscape;
//      running it in portrait would work but crop the world in half. A
//      static illustration of a phone rocking from portrait toward
//      landscape teaches the action without a paragraph of copy.
//
// The animation uses the native driver (transform-only), so this can run
// while the GL context is coming up on the JS thread without eating into
// its frame budget.
// ===========================================================================
function RotatePrompt() {
  const rock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rock, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(rock, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [rock]);

  const rotate = rock.interpolate({
    inputRange: [0, 1],
    outputRange: ["-8deg", "82deg"],
  });

  return (
    <View style={styles.rotatePrompt} pointerEvents="auto">
      <Animated.View
        style={[styles.rotatePhone, { transform: [{ rotate }] }]}
      >
        <View style={styles.rotatePhoneScreen} />
        <View style={styles.rotatePhoneNotch} />
      </Animated.View>
      <Text
        variant="heading"
        size="lg"
        color="#FFFFFF"
        style={styles.rotateTitle}
      >
        Rotate your phone
      </Text>
      <Text
        variant="body"
        size="md"
        color="rgba(255,255,255,0.66)"
        style={styles.rotateSubtitle}
      >
        Spell Storm plays in landscape
      </Text>
    </View>
  );
}

// ===========================================================================
// Loader
//
// The old loader was a single pulsing square with a title. This one is a
// tiny composed intro sequence — the paper-theatre stage, but assembled at
// runtime from primitives the game itself uses:
//
//   - A three-band sky (zenith → rose → ember), the same palette the arena
//     backdrops paint themselves with, so the loader doesn't look like a
//     screen from a different app.
//
//   - A field of 32 randomly-placed stars, each with its own twinkle loop
//     on the native driver — no work on the JS thread.
//
//   - Six runes orbiting the centre on a slow spin (14s per revolution),
//     each a 45°-rotated capsule outlined in gold. Read as "something
//     magical is being assembled" without asking the eye to track anything.
//
//   - A halo + orb at the centre, both pulsing at ~1Hz. This is the same
//     visual vocabulary as the arcane pickup in the arena, so a player who
//     spends five seconds on the loader has already been taught what an
//     orb means.
//
//   - Occasional lightning flashes — a full-screen white sheet fading in
//     and out over 120ms, on a poisson-ish random schedule between 3 and 6
//     seconds. The name of the game IS Spell Storm; a stormless loader is
//     a missed beat.
//
//   - A linear progress bar (not a spinner — this reports a KNOWN duration)
//     with dynamic phase text: "Weaving the arena" → "Conjuring the storm"
//     → "Awakening the sigils" → "Almost ready".
//
//   - A rotating tip that teaches one control per launch. The tips are the
//     answer to "nobody knew about the aim latch" — this is where you
//     catch the player, right before they press Begin.
//
// Nothing here mounts a texture. Everything is Views, colours, and
// Animated values. Fifty-odd Animated loops sound like a lot but each
// runs on the native driver, so the JS thread is essentially idle
// throughout — which matters because the GL context is currently coming
// up on that same thread.
// ===========================================================================

const TIPS = [
  "Push the stick up, then hold CAST. You fire straight up while running.",
  "Double-tap the stick to dash. Short i-frames — use it as a dodge.",
  "In the air, fire down onto an enemy to pogo. Chain them across pits.",
  "The reticle glows brighter when your aim is latched under CAST.",
  "Benches heal and save. Sit at one before you tackle a boss.",
  "Sealed doors keep their silhouette. That's a door you'll come back to.",
  "Every boss has a 65% and a 30% phase. The rhythm is the same for all seven.",
  "The map remembers rooms you've entered — open it whenever you're lost.",
  "Weapon pickups are temporary. Watch the timer under the score.",
];

const LOADER_PHASES: { threshold: number; label: string }[] = [
  { threshold: 0.25, label: "Weaving the arena" },
  { threshold: 0.55, label: "Conjuring the storm" },
  { threshold: 0.85, label: "Awakening the sigils" },
  { threshold: 1.0, label: "Almost ready" },
];

const STAR_COUNT = 32;
const RUNE_COUNT = 6;
const RUNE_RADIUS = 96;

interface StarSpec {
  id: number;
  left: string;
  top: string;
  size: number;
  delay: number;
  duration: number;
  baseOpacity: number;
  peakOpacity: number;
}

function makeStars(): StarSpec[] {
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: i,
    // Confined to the upper 65% of the viewport — anything lower would sit
    // behind the tip card and progress bar and look like a stuck pixel.
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 65}%`,
    size: 1 + Math.random() * 2.4,
    delay: Math.random() * 2400,
    duration: 1200 + Math.random() * 2600,
    baseOpacity: 0.05 + Math.random() * 0.15,
    peakOpacity: 0.6 + Math.random() * 0.4,
  }));
}

function Star({ spec }: { spec: StarSpec }) {
  // Each star owns its own Animated.Value so their twinkle phases don't
  // lock-step with one another. The alternative (one shared value, per-star
  // interpolate offset) is cheaper but the result marches — very obviously
  // synthetic. This is closer to how a real starfield feels.
  const opacity = useRef(new Animated.Value(spec.baseOpacity)).current;

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: spec.peakOpacity,
            duration: spec.duration / 2,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
          Animated.timing(opacity, {
            toValue: spec.baseOpacity,
            duration: spec.duration / 2,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
        ]),
      );
      loop.start();
    }, spec.delay);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [opacity, spec.baseOpacity, spec.peakOpacity, spec.delay, spec.duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: spec.left,
        top: spec.top,
        width: spec.size,
        height: spec.size,
        borderRadius: spec.size / 2,
        backgroundColor: "#FFFFFF",
        opacity,
      }}
    />
  );
}

function Loader({
  subtitle,
  duration = 5000,
}: {
  subtitle?: string;
  duration?: number;
}) {
  const [tip, setTip] = useState(
    () => TIPS[Math.floor(Math.random() * TIPS.length)],
  );
  const [phaseLabel, setPhaseLabel] = useState(LOADER_PHASES[0].label);
  const [percent, setPercent] = useState(0);

  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const runeSpin = useRef(new Animated.Value(0)).current;
  const tipOpacity = useRef(new Animated.Value(1)).current;
  const stageOpacity = useRef(new Animated.Value(0)).current;
  const stageScale = useRef(new Animated.Value(0.92)).current;
  const lightning = useRef(new Animated.Value(0)).current;

  const stars = useMemo(() => makeStars(), []);

  // Fade the whole stage in on mount. Without this the loader appears with
  // a jarring pop; a 260ms ease-out lets it settle into the frame.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(stageOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(stageScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 8,
        bounciness: 3,
      }),
    ]).start();
  }, [stageOpacity, stageScale]);

  // Progress: linear from 0 to 1 over the requested duration. `false` on
  // useNativeDriver because we want to read the value via a listener AND
  // interpolate width — neither is native-driver-safe.
  //
  // The listener throttles to per-integer updates so React only re-renders
  // 100 times over 5 seconds instead of 300+.
  useEffect(() => {
    let lastPct = -1;
    const listener = progress.addListener(({ value }) => {
      const pct = Math.floor(value * 100);
      if (pct === lastPct) return;
      lastPct = pct;
      setPercent(pct);
      const phase =
        LOADER_PHASES.find((p) => value <= p.threshold) ??
        LOADER_PHASES[LOADER_PHASES.length - 1];
      setPhaseLabel(phase.label);
    });
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: false,
      easing: Easing.inOut(Easing.quad),
    });
    anim.start();
    return () => {
      progress.removeListener(listener);
      anim.stop();
    };
  }, [duration, progress]);

  // Orb + halo breathing loop.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Rune orbit: one full revolution every 14 seconds. Slow enough that the
  // eye doesn't feel dragged along; fast enough that you can see them move.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(runeSpin, {
        toValue: 1,
        duration: 14000,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [runeSpin]);

  // Lightning flashes. The scheduling is recursive-setTimeout rather than
  // setInterval so each flash rolls a new gap of 2.4–5.6 seconds — no
  // metronomic rhythm.
  useEffect(() => {
    let cancelled = false;
    const flash = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.timing(lightning, {
          toValue: 1,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(lightning, {
          toValue: 0.2,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(lightning, {
          toValue: 0.6,
          duration: 40,
          useNativeDriver: true,
        }),
        Animated.timing(lightning, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]).start();
      const next = 2400 + Math.random() * 3200;
      setTimeout(flash, next);
    };
    const kickoff = setTimeout(flash, 1400);
    return () => {
      cancelled = true;
      clearTimeout(kickoff);
    };
  }, [lightning]);

  // Rotating tip with a crossfade. The state update happens IN THE MIDDLE
  // of the fade (opacity == 0) so the switch is invisible.
  useEffect(() => {
    const id = setInterval(() => {
      Animated.sequence([
        Animated.timing(tipOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(tipOpacity, {
          toValue: 1,
          duration: 340,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(() => {
        setTip((prev) => {
          let next = TIPS[Math.floor(Math.random() * TIPS.length)];
          for (let tries = 0; next === prev && tries < 6; tries++) {
            next = TIPS[Math.floor(Math.random() * TIPS.length)];
          }
          return next;
        });
      }, 300);
    }, 3400);
    return () => clearInterval(id);
  }, [tipOpacity]);

  const orbScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.14],
  });
  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.4],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.32, 0.72],
  });
  const runeRotate = runeSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const runeCounter = runeSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-360deg"],
  });
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  const lightningOpacity = lightning.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.14],
  });

  return (
    <View style={styles.loader}>
      {/*
        Sky — three stacked translucent bands over a base zenith fill.
        This is the same trick the arena uses; no linear-gradient
        dependency needed.
      */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: hex(PALETTE.skyZenith) },
        ]}
      />
      <View style={[StyleSheet.absoluteFill, styles.loaderBandMid]} />
      <View style={[StyleSheet.absoluteFill, styles.loaderBandLow]} />

      {/* Stars — mounted in a single absolute-fill wrapper so their
          percentage positions resolve against the viewport. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {stars.map((spec) => (
          <Star key={spec.id} spec={spec} />
        ))}
      </View>

      {/* Lightning sheet. Sits above the sky but below the stage so the
          flash tints the runes with it. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "#F4EEFF", opacity: lightningOpacity },
        ]}
      />

      <Animated.View
        style={[
          styles.loaderStage,
          {
            opacity: stageOpacity,
            transform: [{ scale: stageScale }],
          },
        ]}
      >
        {/*
          Halo, orb, and rune orbit are all centred on the same point. The
          orbit sits BEHIND the orb (drawn first) so runes pass in front
          of the halo but behind the core, which reads more layered than
          a flat stack.
        */}
        <View style={styles.centrepiece}>
          <Animated.View
            style={[
              styles.loaderHalo,
              {
                transform: [{ scale: haloScale }],
                opacity: haloOpacity,
              },
            ]}
          />

          <Animated.View
            pointerEvents="none"
            style={[styles.runeOrbit, { transform: [{ rotate: runeRotate }] }]}
          >
            {Array.from({ length: RUNE_COUNT }).map((_, i) => {
              const angle = (i / RUNE_COUNT) * Math.PI * 2;
              const x = Math.cos(angle) * RUNE_RADIUS;
              const y = Math.sin(angle) * RUNE_RADIUS;
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.rune,
                    {
                      transform: [
                        { translateX: x },
                        { translateY: y },
                        // Counter-rotate each rune so they stay upright as
                        // the whole ring spins — otherwise a rune rotates
                        // 360° per revolution around its OWN centre, which
                        // reads as chaotic.
                        { rotate: runeCounter },
                        { rotate: "45deg" },
                      ],
                    },
                  ]}
                />
              );
            })}
          </Animated.View>

          <Animated.View
            style={[
              styles.loaderOrb,
              {
                transform: [{ scale: orbScale }],
              },
            ]}
          />
        </View>

        <Text
          variant="display"
          size="display"
          color="#FFFFFF"
          style={styles.loaderTitle}
        >
          Spell Storm
        </Text>

        {/* Progress rail + phase / percent label. */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth }]}
          />
        </View>

        <View style={styles.progressLabelRow}>
          <Text
            variant="label"
            size="xs"
            color="rgba(255,255,255,0.62)"
            style={styles.progressPhase}
          >
            {phaseLabel}
          </Text>
          <Text
            variant="label"
            size="xs"
            color={hex(PALETTE.arcane)}
            style={styles.progressPercent}
          >
            {percent}%
          </Text>
        </View>

        {!!subtitle && (
          <Text
            variant="label"
            size="sm"
            color="rgba(255,255,255,0.45)"
            style={styles.loaderSubtitle}
          >
            {subtitle}
          </Text>
        )}

        <Animated.View style={[styles.loaderTipWrap, { opacity: tipOpacity }]}>
          <View style={styles.loaderTipGlyph} />
          <Text
            variant="body"
            size="sm"
            color="rgba(255,255,255,0.72)"
            style={styles.loaderTip}
          >
            {tip}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------

interface OverlayProps {
  title: string;
  subtitle: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  stats?: string;
}

function Overlay({
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  stats,
}: OverlayProps) {
  return (
    <View style={styles.overlay}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(10,5,24,0.6)" },
        ]}
      />
      <View style={styles.panel}>
        <Text
          variant="display"
          size="display"
          color="#FFFFFF"
          style={styles.overlayTitle}
        >
          {title}
        </Text>
        <Text
          variant="body"
          size="md"
          color="rgba(255,255,255,0.72)"
          style={styles.overlayBody}
        >
          {subtitle}
        </Text>
        {stats && (
          <Text
            variant="label"
            size="sm"
            color={hex(PALETTE.gold)}
            style={styles.overlayStats}
          >
            {stats}
          </Text>
        )}

        <Pressable onPress={onPrimary} style={styles.primary}>
          <Text variant="heading" size="md" color="#04121A">
            {primaryLabel}
          </Text>
        </Pressable>

        <Pressable onPress={onSecondary} style={styles.secondary}>
          <Text variant="body" size="sm" color="rgba(255,255,255,0.6)">
            {secondaryLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05030A" },

  hudLayer: { position: "absolute", top: 0, left: 0, right: 0 },
  hudRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  hudRight: { flexDirection: "row", alignItems: "center", gap: 10 },

  statusPill: { alignSelf: "flex-start" },
  statusInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
  },
  hearts: { flexDirection: "row", gap: 6 },
  heart: { width: 16, height: 16, borderRadius: 5, borderCurve: "continuous" },
  divider: { width: 1, height: 16, backgroundColor: "rgba(255,255,255,0.16)" },
  essence: { letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  combo: { letterSpacing: -0.2 },

  sigilPill: {},
  sigilInner: {
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  sigil: {
    width: 7,
    height: 7,
    borderRadius: 2,
    borderCurve: "continuous",
    transform: [{ rotate: "45deg" }],
  },

  iconButton: { width: 40, height: 40 },
  compassButton: {
    width: 40,
    height: 40,
    // A subtle gold ring to make the compass read as ONE thing that
    // matters, not a peer of the equally-sized map button next door.
    borderWidth: 1.4,
    borderColor: "rgba(232,197,110,0.55)",
  },
  iconInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  mapGlyphRow: { flexDirection: "row", gap: 2 },
  mapGlyphCell: {
    width: 7,
    height: 7,
    borderRadius: 2,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  mapGlyphCellDim: { backgroundColor: "rgba(255,255,255,0.3)" },
  closeBarA: {
    position: "absolute",
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#fff",
    transform: [{ rotate: "45deg" }],
  },
  closeBarB: {
    position: "absolute",
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#fff",
    transform: [{ rotate: "-45deg" }],
  },

  weaponRow: { marginTop: 10, alignItems: "flex-start" },
  weaponPill: { alignSelf: "flex-start" },
  weaponInner: { paddingHorizontal: 12, paddingVertical: 6 },

  roomCard: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  roomName: { letterSpacing: 1.4, textAlign: "center" },
  roomRule: {
    marginTop: 8,
    width: 54,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  bossWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  bossName: { letterSpacing: 1.2 },
  bossTitle: { marginTop: 1, letterSpacing: 0.4 },
  bossTrack: {
    marginTop: 8,
    width: "72%",
    maxWidth: 460,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  bossFill: { height: "100%", borderRadius: 3 },

  benchWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  benchPill: {},
  benchInner: { paddingHorizontal: 16, paddingVertical: 8 },

  sealedWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  sealedCard: {},
  sealedInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sealedCta: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderCurve: "continuous",
    backgroundColor: hex(PALETTE.gold),
  },

  stickZone: {
    position: "absolute",
    left: 0,
    bottom: 0,
    top: "34%",
    width: "46%",
  },
  stickBase: {
    position: "absolute",
    width: INPUT.stickRadius * 2,
    height: INPUT.stickRadius * 2,
    borderRadius: INPUT.stickRadius,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  stickKnob: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.26)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },

  actions: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
  },
  dashPip: {
    width: 8,
    height: 8,
    borderRadius: 3,
    borderCurve: "continuous",
    transform: [{ rotate: "45deg" }],
    alignSelf: "center",
    marginBottom: 40,
    marginRight: -8,
  },
  actionLabel: { letterSpacing: 0.8 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  panel: { alignItems: "center", maxWidth: 460 },
  overlayTitle: { textAlign: "center", marginBottom: 10, letterSpacing: -0.5 },
  overlayBody: { textAlign: "center", lineHeight: 22, marginBottom: 10 },
  overlayStats: { marginBottom: 26 },
  primary: {
    paddingHorizontal: 44,
    paddingVertical: 15,
    borderRadius: 999,
    borderCurve: "continuous",
    backgroundColor: hex(PALETTE.arcane),
  },
  secondary: { marginTop: 18, padding: 10 },

  mapOverlay: { ...StyleSheet.absoluteFillObject },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 12,
    gap: 16,
  },
  // Right side of the header: compass callout + close button, aligned so
  // they don't fight the room-name column for space if the name is long.
  mapHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  // The "NEXT: BossName" pill next to the header compass. Only ever
  // rendered when there IS a next objective — no dead pill.
  mapCompassCallout: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  mapScroll: {
    paddingHorizontal: 32,
    // paddingBottom leaves room for the legend, which is absolutely
    // positioned at the bottom of the overlay — without this the last
    // row of cells would hide behind it on shorter phones.
    paddingBottom: 60,
    paddingTop: 4,
    alignItems: "center",
    flexGrow: 1,
  },
  // Legacy — kept because other bits of the file still reference this
  // name for cells that were removed. Cheap to leave in.
  mapLabel: { textAlign: "center", lineHeight: 12 },

  // -------- Map legend --------
  mapLegend: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  mapLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDiamond: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderCurve: "continuous",
    transform: [{ rotate: "45deg" }],
  },
  legendBench: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: hex(PALETTE.gold),
  },
  legendYouCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  legendTargetCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: hex(PALETTE.gold),
  },

  // -------- Loader --------
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    overflow: "hidden",
  },
  // Two extra translucent panels layered on top of the base fill produce a
  // gradient without a linear-gradient dependency. The top one is warm and
  // sits at ~40% opacity, the bottom is cooler and pushes the horizon
  // toward the amber-to-dusk band.
  loaderBandMid: {
    top: "45%",
    backgroundColor: hex(PALETTE.skyRose),
    opacity: 0.32,
  },
  loaderBandLow: {
    top: "65%",
    backgroundColor: hex(PALETTE.skyEmber),
    opacity: 0.26,
  },
  loaderStage: { alignItems: "center", maxWidth: 480, width: "100%" },

  // Centrepiece wrapper. Fixed size so the halo can bleed past the orb
  // without pushing surrounding layout around.
  centrepiece: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 34,
  },
  loaderHalo: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: hex(PALETTE.arcane),
  },
  runeOrbit: {
    position: "absolute",
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  rune: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 4,
    borderCurve: "continuous",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: hex(PALETTE.gold),
  },
  loaderOrb: {
    width: 74,
    height: 74,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: hex(PALETTE.arcaneCore),
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: hex(PALETTE.arcane),
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  loaderTitle: {
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 22,
    textTransform: "uppercase",
  },

  progressTrack: {
    width: "80%",
    maxWidth: 320,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: hex(PALETTE.arcane),
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "80%",
    maxWidth: 320,
    marginTop: 10,
  },
  progressPhase: { letterSpacing: 1.4, textTransform: "uppercase" },
  progressPercent: { letterSpacing: 0.4, fontVariant: ["tabular-nums"] },

  loaderSubtitle: {
    marginTop: 14,
    letterSpacing: 1,
    textAlign: "center",
    textTransform: "uppercase",
  },
  loaderTipWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 30,
    maxWidth: 380,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(12,8,24,0.44)",
  },
  loaderTipGlyph: {
    width: 6,
    height: 6,
    borderRadius: 2,
    borderCurve: "continuous",
    backgroundColor: hex(PALETTE.gold),
    transform: [{ rotate: "45deg" }],
    marginTop: 2,
  },
  loaderTip: { flex: 1, textAlign: "left", lineHeight: 20 },

  // -------- Rotate prompt --------
  rotatePrompt: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#05030A",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  // A phone silhouette: taller than wide, gold outline, a screen area
  // inset and a notch near the top edge. Sized so the whole prompt reads
  // at arm's length on the smallest supported iPhone.
  rotatePhone: {
    width: 62,
    height: 100,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 2,
    borderColor: hex(PALETTE.gold),
    marginBottom: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  rotatePhoneScreen: {
    position: "absolute",
    top: 10,
    left: 6,
    right: 6,
    bottom: 10,
    borderRadius: 6,
    borderCurve: "continuous",
    backgroundColor: "rgba(212,175,55,0.14)",
  },
  rotatePhoneNotch: {
    position: "absolute",
    top: 3,
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: hex(PALETTE.gold),
    opacity: 0.6,
  },
  rotateTitle: {
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  rotateSubtitle: {
    letterSpacing: 1,
    textAlign: "center",
    textTransform: "uppercase",
  },
});
