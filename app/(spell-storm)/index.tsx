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
  SHOP_CATALOG,
  VESSEL_CAP,
  type ShopItem,
  type ShopItemId,
} from "@/game/spell-storm/systems/shop";
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
  // Bench-travel modal. Opens from the Travel pill next to the bench
  // save banner, closes on selection, backdrop tap, or when the player
  // walks off the bench (see effect below).
  const [travelOpen, setTravelOpen] = useState(false);

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
    benchesRested: [],
    canTravel: false,
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
    shield: 0,
    shop: null,
    dialogue: null,
    nearbyNpc: null,
    nearbyNpcName: "",
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
              // Migrate saves from before the shop shipped: field will be
              // undefined and the game reads it as zero everywhere. Also
              // clamp to VESSEL_CAP so a corrupted or tampered save can't
              // hand the player 40 hearts.
              bonusMaxHearts:
                typeof parsed.bonusMaxHearts === "number"
                  ? Math.max(0, Math.min(VESSEL_CAP, parsed.bonusMaxHearts))
                  : 0,
              // Cutscene / NPC tracking added in the story pass. Old
              // saves start with empty arrays — the player just gets
              // to (re-)see any cutscenes they hadn't earned yet.
              watchedCutscenes: Array.isArray(parsed.watchedCutscenes)
                ? parsed.watchedCutscenes.filter(
                    (id: unknown) => typeof id === "string",
                  )
                : [],
              metNpcs: Array.isArray(parsed.metNpcs)
                ? parsed.metNpcs.filter((id: unknown) => typeof id === "string")
                : [],
              // Travel history — added with the bench-teleport feature.
              // Migration path: if the save is pre-feature, seed the list
              // with the last-rested bench. This way an existing player
              // who has been playing for weeks doesn't have to re-rest
              // at Crossroads to unlock travel; their current bench
              // is already in the pool.
              benchesRested: Array.isArray(parsed.benchesRested)
                ? parsed.benchesRested.filter(
                    (id: unknown): id is string =>
                      typeof id === "string" && !!ROOMS[id] && !!ROOMS[id].bench,
                  )
                : bench
                  ? [bench]
                  : [],
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
        // Suppress the compass only during an ACTIVE boss encounter —
        // walking through a cleared boss room should still show the
        // next-target arrow, per the v3.7 fix.
        hud.bossActive,
      ),
    [hud.roomId, hud.defeatedRooms, hud.bossesDefeated, hud.bossActive, isPro],
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

  // ---- Shop --------------------------------------------------------------
  //
  // Two imperative surfaces, both thin wrappers. The overlay renders off
  // hud.shop (which the game populates only while the shop phase is up),
  // so all the React side needs to do is forward taps to the game.
  //
  // Haptics fire on both hits and misses because a silent failure would
  // look like the button didn't register — the reason string is what
  // tells the overlay whether to flash "not enough essence" or "already
  // owned", but the haptic tick is the "your press was registered" ack.
  const handleShopBuy = useCallback((id: ShopItemId) => {
    const game = gameRef.current;
    if (!game) return;
    const result = game.buyShopItem(id);
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
    }
    // Force an immediate HUD refresh so the overlay's essence counter and
    // "owned" state react on the frame the tap lands, rather than waiting
    // for the 10Hz polling tick.
    setHud({ ...game.hud });
  }, []);

  const handleShopEnter = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {},
    );
    game.closeShop();
    setHud({ ...game.hud });
  }, []);

  // ---- Dialogue ----------------------------------------------------------
  //
  // Three imperative surfaces, all trivial. Advance is what a tap on the
  // dialogue bubble does; skip is the header button on cutscenes; talk is
  // the "TAP TO TALK" prompt above the mage when an NPC is in range.
  //
  // Same push-HUD-immediately pattern as the shop so the overlay reacts
  // on the tap frame instead of after the 10Hz poll tick.
  const handleDialogueAdvance = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    Haptics.selectionAsync().catch(() => {});
    game.advanceDialogue();
    setHud({ ...game.hud });
  }, []);

  const handleDialogueSkip = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    game.skipDialogue();
    setHud({ ...game.hud });
  }, []);

  const handleTalkToNpc = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    game.talkToNpc();
    setHud({ ...game.hud });
  }, []);

  // ---- Travel ------------------------------------------------------------
  //
  // Bench-to-bench teleport. Rejection is silent from the game's side —
  // travelToBench returns false when the phase isn't right — so the UI
  // handles the "did it actually go" question by:
  //   - only surfacing the button when hud.canTravel is true
  //   - a warning haptic when the game rejects
  //
  // Modal closes optimistically on success: the game phase flips to
  // "transition" immediately, so by the time the fade begins the player
  // needs to see the destination room, not the modal that picked it.
  const handleTravel = useCallback((roomId: string) => {
    const game = gameRef.current;
    if (!game) return;
    const ok = game.travelToBench(roomId);
    if (ok) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setTravelOpen(false);
      setHud({ ...game.hud });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
    }
  }, []);

  // Auto-close travel modal if the player walks off the bench or the
  // phase changes out of "playing" (death, boss intro, transition).
  // Without this the modal would stay open with a now-invalid list of
  // destinations, and tapping any of them would silently no-op because
  // the game's travelToBench guard would reject.
  useEffect(() => {
    if (travelOpen && !hud.canTravel) setTravelOpen(false);
  }, [travelOpen, hud.canTravel]);

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
                {/* Arcane Shield pip. Shown only while the player has one
                    active — a persistent slot even at zero would fight for
                    attention with the hearts. Sits between hearts and the
                    essence divider so it reads as "an extra layer of
                    protection", left-to-right. */}
                {hud.shield > 0 && (
                  <View
                    style={[
                      styles.shieldPip,
                      { backgroundColor: hex(0x8ff0e8) },
                    ]}
                  />
                )}
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
                arrow pointing toward the next reachable boss (or a
                near-white arrow when it's the fallback bench target).
                When the player is inside an ACTIVE boss fight, or when
                nothing at all is reachable, it falls back to the classic
                map grid glyph. Either way, tapping opens the full map.
              */}
              <Pressable onPress={() => setMapOpen(true)} hitSlop={10}>
                <Glass
                  style={
                    objective
                      ? objective.kind === "boss"
                        ? styles.compassButton
                        : styles.compassButtonBench
                      : styles.iconButton
                  }
                  radius={objective ? 20 : 17}
                >
                  <View style={styles.iconInner}>
                    {objective ? (
                      <CompassArrow
                        side={objective.side}
                        color={
                          objective.kind === "boss"
                            ? hex(PALETTE.gold)
                            : "rgba(255,255,255,0.85)"
                        }
                      />
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
      {/*
        Two-piece row: the passive "Rested · progress saved" pill and
        (only when the player has more than one bench in their travel
        pool) a Travel button.
        
        The wrapper is box-none rather than none so the Travel Pressable
        remains tappable; the "Rested" pill inside is left pointerEvents
        untouched because it's inert text and doesn't need to intercept
        anything.
      */}
      {ready && playing && hud.atBench && (
        <View
          pointerEvents="box-none"
          style={[styles.benchWrap, { bottom: insets.bottom + 118 }]}
        >
          <View style={styles.benchRow} pointerEvents="box-none">
            <Glass style={styles.benchPill} radius={16}>
              <View style={styles.benchInner}>
                <Text variant="label" size="sm" color={hex(PALETTE.gold)}>
                  Rested · progress saved
                </Text>
              </View>
            </Glass>
            {hud.canTravel && (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setTravelOpen(true);
                }}
                hitSlop={10}
              >
                <Glass style={styles.travelPill} radius={16}>
                  <View style={styles.travelInner}>
                    {/*
                      A tiny arrow-in-square glyph is enough here — the
                      word "Travel" is what does the work, the icon
                      just anchors it visually. Two small views form an
                      L-shape; cheaper than shipping a vector.
                    */}
                    <View style={styles.travelIcon}>
                      <View style={styles.travelIconArrow} />
                    </View>
                    <Text
                      variant="heading"
                      size="sm"
                      color="#FFFFFF"
                      style={{ marginLeft: 6 }}
                    >
                      Travel
                    </Text>
                  </View>
                </Glass>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* ---------------- Travel modal ---------------- */}
      {/*
        Full-screen chooser. Shown only while the player is standing at
        a bench with somewhere to go; auto-closes when either condition
        stops being true (walked away, boss started, transition began).
        
        Renders BEHIND the Loader (which sits at the very end of the
        tree) but ABOVE the game HUD, so the tap targets are the modal
        buttons and nothing else.
      */}
      {ready && travelOpen && hud.canTravel && (
        <TravelModal
          benchesRested={hud.benchesRested}
          currentRoomId={hud.roomId}
          defeatedRooms={hud.defeatedRooms}
          onSelect={handleTravel}
          onClose={() => setTravelOpen(false)}
          insets={{ top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right }}
        />
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

      {/* ---------------- Controls ----------------
        Hidden during the shop phase — the overlay owns the whole screen
        while the player is deciding what to buy, and a live stick under
        a modal is a great way to fall out of the room the moment they
        press "Enter the arena". Also hidden during cutscenes and
        NPC dialogues for the same reason — no accidental jumps mid-line.
      */}
      {ready && playing && !mapOpen &&
        hud.phase !== "shop" &&
        hud.phase !== "cutscene" &&
        hud.phase !== "dialogue" && (
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

      {/* ---------------- TAP TO TALK prompt ----------------
        Shown when the player is in an NPC's interaction radius. Sits
        just above the mage, subtle so it doesn't fight with the boss
        bar when both would render, and clearly tappable to disambiguate
        it from the passive prompt that also floats over the NPC in the
        world (that one just glows, this one lets you actually talk).
      */}
      {ready && playing && hud.phase === "playing" && hud.nearbyNpc && (
        <View
          style={[styles.talkWrap, { bottom: insets.bottom + 118 }]}
          pointerEvents="box-none"
        >
          <Pressable onPress={handleTalkToNpc} hitSlop={12}>
            <Glass style={styles.talkPill} radius={16}>
              <View style={styles.talkInner}>
                <View
                  style={[
                    styles.talkGlyph,
                    { backgroundColor: hex(PALETTE.gold) },
                  ]}
                />
                <Text
                  variant="label"
                  size="sm"
                  color={hex(PALETTE.gold)}
                  style={styles.talkLabel}
                >
                  TALK TO {hud.nearbyNpcName.toUpperCase()}
                </Text>
              </View>
            </Glass>
          </Pressable>
        </View>
      )}

      {/* ---------------- Dialogue overlay ----------------
        Fires for boss cutscenes (kind="bossIntro", "bossDefeat",
        "epilogue") and NPC chats (kind="npc"). Same overlay body —
        speaker card, line body, tap-to-advance affordance — but with
        a "SKIP" header button only on boss cutscenes, since NPC chats
        are already short enough that skipping is more effort than
        reading.
      */}
      {ready && hud.dialogue && (
        <DialogueOverlay
          dialogue={hud.dialogue}
          onAdvance={handleDialogueAdvance}
          onSkip={handleDialogueSkip}
          insets={insets}
        />
      )}

      {/* ---------------- Shop ----------------
        Fires on the first frame the player enters an uncleared boss
        room. The game state's shop panel is either set (open) or null
        (not open); we render iff both the phase and the panel say so,
        so any transient state where one is set and the other isn't
        keeps the overlay hidden until they agree.
      */}
      {ready && hud.phase === "shop" && hud.shop && (
        <ShopOverlay
          panel={hud.shop}
          hearts={hud.hearts}
          maxHearts={hud.maxHearts}
          shield={hud.shield}
          weapon={hud.weapon}
          onBuy={handleShopBuy}
          onEnter={handleShopEnter}
          insets={insets}
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
                  <Glass
                    style={
                      objective.kind === "boss"
                        ? styles.compassButton
                        : styles.compassButtonBench
                    }
                    radius={20}
                  >
                    <View style={styles.iconInner}>
                      <CompassArrow
                        side={objective.side}
                        color={
                          objective.kind === "boss"
                            ? hex(PALETTE.gold)
                            : "rgba(255,255,255,0.85)"
                        }
                      />
                    </View>
                  </Glass>
                  <View style={{ marginLeft: 10, maxWidth: 140 }}>
                    <Text
                      variant="label"
                      size="xs"
                      color="rgba(255,255,255,0.55)"
                    >
                      {objective.kind === "boss" ? "NEXT" : "NEAREST BENCH"}
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
            <WorldMap
              hud={hud}
              target={objective?.targetRoomId ?? null}
              path={objective?.path ?? null}
            />
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
            <View style={styles.mapLegendItem}>
              <View style={styles.legendPathLine} />
              <Text variant="label" size="xs" color="rgba(255,255,255,0.62)">
                Path
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
  /** Display label — boss name for a boss target, room name for a bench target. */
  targetBossName: string;
  /** What kind of target this is, so the arrow can be styled differently. */
  kind: "boss" | "bench" | "start";
  /**
   * Caminho completo (inclusive a sala atual e a sala alvo) reconstruído a
   * partir do BFS. O mapa usa isso pra destacar toda a trilha que leva até
   * a quest — não só o alvo. Vira a diferença entre "aqui é o objetivo"
   * (que já mostrávamos) e "por aqui você chega até o objetivo" (que é
   * o que o jogador realmente precisa saber no meio de um mapa grande).
   */
  path: string[];
}

/**
 * BFS from the current room through open gates, looking for an
 * uncleared boss. Returns the direction of the FIRST gate on the
 * shortest path, or null if there is none.
 *
 * The old version returned null in two situations that turned out to
 * be user-hostile: (1) standing INSIDE a boss room (even one already
 * cleared, when you're just passing through), and (2) when every
 * accessible boss was already dead. Both left the player with no
 * arrow to follow — which is exactly when they're most confused
 * about where to go.
 *
 * v3.7 fixes: we now run the BFS even from inside a cleared boss
 * room, and if no uncleared boss is reachable we fall back to
 * pointing at the nearest bench (comfort target — you can travel
 * from there). Only truly return null when the player is in an
 * ACTIVE boss fight, where the whole screen is the objective anyway.
 */
function findObjective(
  currentRoomId: string,
  defeatedRooms: string[],
  bossesDefeated: number,
  isPro: boolean,
  bossFightActive: boolean,
): Objective | null {
  const currentRoom = ROOMS[currentRoomId];
  if (!currentRoom) return null;
  // Only suppress the compass while a boss is being fought — then the
  // arrow would tell the player to leave, which is a) impossible
  // (sealed) and b) a bad UI cue for "focus".
  if (currentRoom.boss && !defeatedRooms.includes(currentRoomId) && bossFightActive) {
    return null;
  }

  // BFS clássico com predecessores.
  //
  // Antes rastreávamos só `firstSide` (a direção do primeiro portão) e
  // parávamos no primeiro boss encontrado. Agora precisamos do CAMINHO
  // inteiro pra desenhar a trilha no mapa — então guardamos, pra cada
  // sala visitada, quem foi o "pai" (a sala anterior) e o portão pelo
  // qual chegamos. No fim, reconstruímos o caminho subindo dos "pais"
  // até a sala atual.
  //
  // Custo é o mesmo do BFS antigo (linear no número de salas), só que
  // agora com um Map<string,string> em vez de guardar `firstSide`.
  const parent = new Map<string, string>();
  const firstGateSide = new Map<string, GateSide>();
  const queue: string[] = [currentRoomId];
  const visited = new Set<string>([currentRoomId]);

  let bossTargetId: string | null = null;
  let benchTargetId: string | null = null;

  while (queue.length) {
    const roomId = queue.shift()!;
    const room = ROOMS[roomId];
    if (!room) continue;

    // Boss target — primeira sala com boss ativo é o alvo primário. Como
    // BFS visita em ordem de distância, esse é o boss mais próximo.
    if (
      !bossTargetId &&
      roomId !== currentRoomId &&
      room.boss &&
      !defeatedRooms.includes(roomId)
    ) {
      bossTargetId = roomId;
      break; // sai imediato: boss vence sobre bench, não precisa continuar
    }

    // Bench fallback — mais próximo bench diferente da sala atual.
    if (
      !benchTargetId &&
      roomId !== currentRoomId &&
      room.bench
    ) {
      benchTargetId = roomId;
    }

    for (const gate of room.gates) {
      if (visited.has(gate.to)) continue;
      const sealed =
        (gate.requires !== undefined && bossesDefeated < gate.requires) ||
        (gate.pro === true && !isPro);
      if (sealed) continue;
      visited.add(gate.to);
      parent.set(gate.to, roomId);
      // Se estamos saindo da sala atual, esse é o "primeiro portão" — a
      // direção que a bússola aponta. Se estamos mais fundo, herdamos do
      // pai, garantindo que toda cadeia derivada da mesma primeira saída
      // registre a mesma direção.
      firstGateSide.set(
        gate.to,
        roomId === currentRoomId ? gate.side : firstGateSide.get(roomId)!,
      );
      queue.push(gate.to);
    }
  }

  const targetId = bossTargetId ?? benchTargetId;
  if (!targetId) return null;

  const target = ROOMS[targetId];
  const side = firstGateSide.get(targetId);
  if (!side) return null;

  // Reconstrói o caminho, subindo do alvo até a sala atual.
  const reversed: string[] = [targetId];
  let cursor: string | undefined = targetId;
  while (cursor && cursor !== currentRoomId) {
    const p = parent.get(cursor);
    if (!p) break;
    reversed.push(p);
    cursor = p;
  }
  const path = reversed.reverse();

  const kind: "boss" | "bench" = bossTargetId ? "boss" : "bench";
  return {
    side,
    targetRoomId: targetId,
    targetBossName: kind === "boss" ? (target.bossName ?? target.name) : target.name,
    kind,
    path,
  };
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
/**
 * A tiny arrow. Two Views: a thin shaft and a triangular head. Sized to
 * fit a 40x40 icon button with 8px of breathing room on every side.
 *
 * `color` defaults to gold — the primary boss-target hue. Bench
 * fallback callers pass near-white so the eye reads it as "hint,
 * not urgent".
 */
function CompassArrow({ side, color = hex(PALETTE.gold) }: { side: GateSide; color?: string }) {
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
          backgroundColor: color,
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
          borderBottomColor: color,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Travel modal
//
// A vertical list of rested benches. Tap a row → the game does the fade,
// the modal closes optimistically, and the player wakes up at the chosen
// bench. Each row shows: biome swatch, room name, biome label, and any
// boss sigil for that branch (defeated OR ready-for-a-visit).
//
// WHY A LIST AND NOT THE MAP GRID
//
// The map grid is spatial — you read it to understand where things ARE.
// The travel list is a menu — you read it to pick where to GO. Rebuilding
// the grid here would force the player to hunt for the right cell every
// time they wanted to travel; a top-down list is instant to scan and
// keeps the "recent benches" naturally at the top of the reading order.
//
// The current room appears with a HERE badge and isn't tappable, so a
// player who opens the modal by mistake can close it via the tap they
// would have used to pick anyway.
// ---------------------------------------------------------------------------

function TravelModal({
  benchesRested,
  currentRoomId,
  defeatedRooms,
  onSelect,
  onClose,
  insets,
}: {
  benchesRested: string[];
  currentRoomId: string;
  defeatedRooms: string[];
  onSelect: (roomId: string) => void;
  onClose: () => void;
  insets: { top: number; bottom: number; left: number; right: number };
}) {
  // Only benches that still exist AND still have a bench field. Both
  // conditions guard against stale data from a broken save or a room
  // renamed between builds — a dead reference would render an empty
  // row that no-op'd on tap.
  const rows = useMemo(() => {
    return benchesRested
      .filter((id) => ROOMS[id] && ROOMS[id].bench)
      .map((id) => {
        const room = ROOMS[id];
        const biome = BIOMES[room.biome];
        // Which boss (if any) sits at the end of this branch. Walking
        // outward one gate to look for a `boss` field is the cheapest
        // way to find it — the graph is shallow; boss rooms are always
        // one hop from a bench in the same branch. Falls back to null
        // for the hub (crossroads) and for benches whose branch has
        // multiple bosses (spire → nightwing, but that's still one hop).
        let bossRoomId: string | null = null;
        for (const gate of room.gates) {
          const dest = ROOMS[gate.to];
          if (dest?.boss) {
            bossRoomId = gate.to;
            break;
          }
        }
        return {
          id,
          name: room.name,
          biomeLabel: biome.label,
          biomeTint: biome.mapTint,
          bossRoomId,
          bossDefeated: bossRoomId
            ? defeatedRooms.includes(bossRoomId)
            : false,
          isCurrent: id === currentRoomId,
        };
      });
  }, [benchesRested, currentRoomId, defeatedRooms]);

  return (
    <View style={styles.travelOverlay}>
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
        Tap the backdrop to dismiss. Placed BEFORE the header/scroll so
        it captures only taps that miss those interactive surfaces —
        the scroll and header sit above it and stop propagation on
        their own taps.
      */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
      />
      <View
        style={[
          styles.travelHeader,
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
            Travel
          </Text>
          <Text
            variant="body"
            size="sm"
            color="rgba(255,255,255,0.5)"
            numberOfLines={1}
          >
            {rows.length} {rows.length === 1 ? "bench" : "benches"} rested at
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={14}>
          <Glass style={styles.iconButton} radius={17}>
            <View style={styles.iconInner}>
              <View style={styles.closeBarA} />
              <View style={styles.closeBarB} />
            </View>
          </Glass>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.travelScroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row) => {
          const isCurrent = row.isCurrent;
          const body = (
            <Glass style={{}} radius={16}>
              <View style={styles.travelRow}>
                <View style={styles.travelRowLeft}>
                  <View
                    style={[
                      styles.travelSwatch,
                      { backgroundColor: row.biomeTint },
                    ]}
                  />
                  <View style={{ flexShrink: 1 }}>
                    <Text
                      variant="heading"
                      size="sm"
                      color="#FFFFFF"
                      numberOfLines={1}
                    >
                      {row.name}
                    </Text>
                    <Text
                      variant="label"
                      size="xs"
                      color="rgba(255,255,255,0.55)"
                      numberOfLines={1}
                    >
                      {row.biomeLabel}
                    </Text>
                  </View>
                </View>
                {isCurrent ? (
                  <View style={styles.travelHere}>
                    <Text
                      variant="label"
                      size="xs"
                      color="rgba(255,255,255,0.85)"
                    >
                      HERE
                    </Text>
                  </View>
                ) : row.bossRoomId ? (
                  <View style={styles.travelSigilRow}>
                    <View
                      style={[
                        styles.travelSigilDot,
                        !row.bossDefeated && {
                          backgroundColor: "rgba(255,255,255,0.22)",
                        },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
            </Glass>
          );
          if (isCurrent) {
            // Current room: not tappable, dimmed by 40% via wrapper
            // opacity so the eye skips it. Placing the opacity on the
            // wrapper (not the Glass) keeps the blur crisp underneath.
            return (
              <View key={row.id} style={{ opacity: 0.55 }}>
                {body}
              </View>
            );
          }
          return (
            <Pressable
              key={row.id}
              onPress={() => onSelect(row.id)}
              hitSlop={4}
            >
              {body}
            </Pressable>
          );
        })}
      </ScrollView>
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
  path,
}: {
  hud: HudSnapshot;
  /** Room id that the compass points to. Rendered with a gold outline. */
  target: string | null;
  /**
   * Caminho BFS completo (da sala atual até o alvo, inclusive as duas
   * pontas). Usado pra iluminar a trilha da quest — as salas do caminho
   * ficam com um tom dourado quente, e os conectores entre elas ficam
   * dourados sólidos em vez do branco 18% padrão. Quando o jogador já
   * viu como se chega, o cinza de rua vira estrada iluminada.
   */
  path: string[] | null;
}) {
  const width = MAP_EXTENT.cols * CELL + (MAP_EXTENT.cols - 1) * GAP;
  const height = MAP_EXTENT.rows * CELL + (MAP_EXTENT.rows - 1) * GAP;

  // Set de salas no caminho pra lookup O(1) por célula, e set de pares
  // ordenados pra saber quais conectores fazem parte da trilha.
  const pathRoomSet = useMemo(() => new Set(path ?? []), [path]);
  const pathEdgeSet = useMemo(() => {
    if (!path || path.length < 2) return new Set<string>();
    const set = new Set<string>();
    for (let i = 0; i < path.length - 1; i++) {
      // Chave simétrica: [a,b] e [b,a] geram a mesma. Isso combina com
      // como os conectores são chaveados abaixo (sort + join).
      const key = [path[i], path[i + 1]].sort().join("|");
      set.add(key);
    }
    return set;
  }, [path]);

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
      /** True quando este conector é parte da trilha da quest atual. */
      onPath: boolean;
    }[] = [];
    const seen = new Set<string>();
    const bossCount = hud.bossesDefeated;
    for (const id of ROOM_IDS) {
      const room = ROOMS[id];
      for (const gate of room.gates) {
        const other = ROOMS[gate.to];
        if (!other) continue;
        const pairKey = [id, gate.to].sort().join("|");
        const key = pairKey + `|${gate.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!hud.discovered.includes(id) || !hud.discovered.includes(gate.to))
          continue;

        const sealed =
          (gate.requires !== undefined && bossCount < gate.requires) ||
          (gate.pro === true);

        // Um conector faz parte da trilha só se ele NÃO está selado (uma
        // trilha selada não é uma trilha). Portas seladas continuam com
        // o visual de tracejado; o dourado é reservado pra caminho real.
        const onPath = !sealed && pathEdgeSet.has(pairKey);

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
            onPath,
          });
        } else if (room.map.col === other.map.col) {
          out.push({
            key,
            left: ax + CELL / 2 - 2,
            top: Math.min(ay, by) + CELL,
            w: 4,
            h: Math.abs(by - ay) - CELL,
            sealed,
            onPath,
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
            onPath,
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
            onPath,
          });
        }
      }
    }
    return out;
  }, [hud.discovered, hud.bossesDefeated, pathEdgeSet]);

  return (
    <View style={{ width, height }}>
      {connectors.map((c) => {
        // Três estados visuais:
        //  - selado: tracejado branco 28% (só uma pista de que existe)
        //  - onPath: dourado sólido opaco (a trilha da quest)
        //  - normal: branco 18% (uma rua qualquer)
        //
        // Conectores da quest ficam um pouco mais grossos que os normais
        // — 5px em vez de 4px — pra puxar o olho antes mesmo de o
        // jogador registrar a cor.
        const isPath = c.onPath;
        const thickness = isPath ? 5 : 4;
        return (
          <View
            key={c.key}
            style={{
              position: "absolute",
              left: c.left - (isPath ? 0.5 : 0),
              top: c.top - (isPath ? 0.5 : 0),
              width: Math.max(thickness, c.w),
              height: Math.max(thickness, c.h),
              backgroundColor: c.sealed
                ? "transparent"
                : isPath
                  ? hex(PALETTE.gold)
                  : "rgba(255,255,255,0.18)",
              borderRadius: 2,
              borderStyle: c.sealed ? "dashed" : "solid",
              borderColor: c.sealed ? "rgba(255,255,255,0.28)" : "transparent",
              borderTopWidth: c.sealed && c.w >= c.h ? 2 : 0,
              borderLeftWidth: c.sealed && c.h > c.w ? 2 : 0,
            }}
          />
        );
      })}

      {ROOM_IDS.map((id) => {
        const room = ROOMS[id];
        const found = hud.discovered.includes(id);
        const here = hud.roomId === id;
        const cleared = hud.defeatedRooms.includes(id);
        const isTarget = target === id;
        // Sala "no meio" do caminho: nem é a atual, nem é o alvo, mas o
        // BFS passou por ela pra chegar no alvo. Vai receber uma borda
        // dourada mais fraca, deixando a hierarquia visual clara:
        //   você (branco 100%) > alvo (dourado 100%) > trilha (dourado 44%) > resto
        const onPath = !!pathRoomSet.has(id) && !here && !isTarget;
        const tint = BIOMES[room.biome].mapTint;

        // Border priority: current room > target > on-path > discovered
        // > undiscovered. A cell that is both current AND target (edge
        // case: you just teleported to the target) shows as current —
        // you don't need the "next" hint when you're already there.
        const borderColor = here
          ? "#FFFFFF"
          : isTarget
            ? hex(PALETTE.gold)
            : onPath
              ? `${hex(PALETTE.gold)}88`
              : found
                ? `${tint}66`
                : "rgba(255,255,255,0.08)";
        const borderWidth = here || isTarget ? 2 : onPath ? 2 : 1;

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
          // Salas no caminho ficam com um véu dourado leve por cima do
          // tint do bioma. `hex(PALETTE.gold)` + "18" (10% opacity) é o
          // ponto onde a mudança é visível mas não sobrepõe totalmente a
          // cor do bioma — dá pra ler "estrada dourada" e "esta é uma
          // sala de spire" ao mesmo tempo.
          backgroundColor: onPath
            ? `${hex(PALETTE.gold)}18`
            : found
              ? `${tint}22`
              : "rgba(255,255,255,0.04)",
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
// Dialogue overlay
//
// Drives both boss cutscenes and NPC chats. The design keeps the game world
// visible behind a light dim rather than the near-opaque backdrop of the
// shop — the whole point of the cutscene is to see the boss's room, the
// whole point of an NPC chat is to see where you are while listening.
//
// Layout:
//
//   [ header ]     boss name + subtitle when this is a boss cutscene;
//                  NPC name for NPC chats; empty for narrator lines.
//
//   [ body   ]     the current line, big enough to read from arm's length.
//                  Speaker names live above the body so the eye locks on
//                  who's talking before what they're saying.
//
//   [ footer ]     "TAP TO CONTINUE" hint + progress dots (index/total).
//
// The whole surface is pressable — tap anywhere to advance — because a
// dedicated "next" button in the corner is a target you have to look
// for. The tap-anywhere pattern reads as "you are reading, tap when
// done" without any UI vocabulary.
//
// SKIP behaves differently by dialogue kind:
//   - bossIntro   → visible; skips to the shop (some players re-run)
//   - npc         → hidden; NPC chats are 4-6 lines, skip is overkill
//   - bossDefeat  → visible; if the fight was hard the player wants to
//                   read it, but a returning player has read it already
//   - epilogue    → hidden; you EARNED this one
// ---------------------------------------------------------------------------

interface DialogueOverlayProps {
  dialogue: NonNullable<HudSnapshot["dialogue"]>;
  onAdvance: () => void;
  onSkip: () => void;
  insets: { top: number; bottom: number; left: number; right: number };
}

/** Tints per speaker so the eye can lock on who's talking at a glance. */
const SPEAKER_TINT: Record<string, { face: string; edge: string }> = {
  mage: { face: hex(PALETTE.arcane), edge: "rgba(196,162,255,0.75)" },
  boss: { face: hex(PALETTE.heart), edge: "rgba(232,90,120,0.7)" },
  npc: { face: hex(PALETTE.gold), edge: "rgba(232,197,110,0.7)" },
  narrator: { face: "rgba(255,255,255,0.6)", edge: "rgba(255,255,255,0.28)" },
};

function DialogueOverlay({
  dialogue,
  onAdvance,
  onSkip,
  insets,
}: DialogueOverlayProps) {
  const { line, index, total, kind, bossName, bossTitle } = dialogue;
  const tint = SPEAKER_TINT[line.speaker] ?? SPEAKER_TINT.narrator;
  const showSkip = kind === "bossIntro" || kind === "bossDefeat";
  const showHeader = kind === "bossIntro" && bossName;

  return (
    // Full-surface pressable — tap anywhere on the darkened area to advance.
    <Pressable style={styles.dialogueSurface} onPress={onAdvance}>
      {/* Backdrop. Lighter than the shop backdrop so the boss room is
          still readable behind the text. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(4,2,10,0.44)" },
        ]}
      />

      {/* Optional skip button. Top-right so it doesn't compete with the
          bubble at the bottom. */}
      {showSkip && (
        <View
          style={[
            styles.dialogueSkip,
            { top: insets.top + 16, right: insets.right + 20 },
          ]}
        >
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            hitSlop={12}
          >
            <Glass style={styles.dialogueSkipBtn} radius={14}>
              <Text
                variant="label"
                size="xs"
                color="rgba(255,255,255,0.65)"
                style={styles.dialogueSkipLabel}
              >
                SKIP
              </Text>
            </Glass>
          </Pressable>
        </View>
      )}

      {/* Header — boss identity for cutscenes. NPC chats and narrator
          lines skip this entirely; the speaker name in the bubble is
          enough. */}
      {showHeader && (
        <View
          pointerEvents="none"
          style={[styles.dialogueHeader, { top: insets.top + 28 }]}
        >
          <Text
            variant="label"
            size="xs"
            color="rgba(255,255,255,0.5)"
            style={styles.dialogueEyebrow}
          >
            ENCOUNTER
          </Text>
          <Text
            variant="display"
            size="lg"
            color="#FFFFFF"
            style={styles.dialogueHeaderName}
            numberOfLines={1}
          >
            {bossName}
          </Text>
          {!!bossTitle && (
            <Text
              variant="body"
              size="sm"
              color="rgba(255,255,255,0.58)"
              numberOfLines={1}
            >
              {bossTitle}
            </Text>
          )}
        </View>
      )}

      {/* Bubble. Sits at the bottom, wide but not full-width, with a
          coloured leader stripe on the left that carries the speaker
          tint. The stripe is what makes "who is talking" readable at
          a glance without portraits. */}
      <View
        pointerEvents="none"
        style={[
          styles.dialogueBubbleWrap,
          {
            bottom: insets.bottom + 32,
            marginHorizontal: Math.max(insets.left, insets.right, 20) + 40,
          },
        ]}
      >
        <View style={styles.dialogueBubble}>
          <BlurView
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(10,6,20,0.72)" },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 22,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.14)",
              },
            ]}
          />
          {/* Leader stripe */}
          <View
            pointerEvents="none"
            style={[styles.dialogueStripe, { backgroundColor: tint.edge }]}
          />
          <View style={styles.dialogueBubbleInner}>
            {line.speaker !== "narrator" && !!line.name && (
              <Text
                variant="label"
                size="sm"
                style={[styles.dialogueSpeaker, { color: tint.face }]}
              >
                {line.name.toUpperCase()}
              </Text>
            )}
            <Text
              variant={line.speaker === "narrator" ? "body" : "heading"}
              size="md"
              color={
                line.speaker === "narrator"
                  ? "rgba(255,255,255,0.72)"
                  : "#FFFFFF"
              }
              style={[
                styles.dialogueBody,
                line.speaker === "narrator" && styles.dialogueNarrator,
              ]}
            >
              {line.body}
            </Text>

            {/* Footer — progress dots + hint. */}
            <View style={styles.dialogueFooter}>
              <View style={styles.dialogueDots}>
                {Array.from({ length: total }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dialogueDot,
                      {
                        backgroundColor:
                          i <= index
                            ? hex(PALETTE.gold)
                            : "rgba(255,255,255,0.16)",
                      },
                    ]}
                  />
                ))}
              </View>
              <Text
                variant="label"
                size="xs"
                color="rgba(255,255,255,0.5)"
                style={styles.dialogueHint}
              >
                TAP TO CONTINUE
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Shop overlay
//
// The pre-boss shop is a full-screen overlay that fires whenever the player
// steps into a boss room they haven't cleared. Under the overlay the room
// is already sealed and the camera is already framed for the fight — the
// boss just hasn't spawned. Everything the player buys in here applies to
// their current entity: healing tops them up, the shield charges up their
// live shield count, weapon items grant an extended (300s) buff, and the
// Vessel Fragment mutates their max heart count directly.
//
// LAYOUT
//
// Header — boss name and title, essence counter to the right. The essence
// figure is what the whole overlay is negotiating over; putting it in the
// header rather than under every button means the player never loses track
// of it while deciding.
//
// Grid  — six item cards, two columns on landscape phones. Each card
// shows label + description + cost, dims when unaffordable / owned /
// capped, and offers a "Buy" tap target you don't have to be precise
// with.
//
// Footer — one big commit button. There is no "back to the corridor"
// option because a shop that lets you leave is a shop that lets you farm
// the corridor's respawns forever, and the whole point of stationing the
// shop at the boss room is that the fight is imminent.
//
// STYLING
//
// Same glass-and-hairline vocabulary as the rest of the HUD, so the shop
// reads as part of the game's interface rather than as a modal from a
// different app. Item cards are opaque cards (not blurred glass) because
// blur is what says "chrome"; the items are content and want to sit
// visually one level deeper than the surrounding frame.
// ---------------------------------------------------------------------------

interface ShopOverlayProps {
  panel: NonNullable<HudSnapshot["shop"]>;
  hearts: number;
  maxHearts: number;
  shield: number;
  weapon: HudSnapshot["weapon"];
  onBuy: (id: ShopItemId) => void;
  onEnter: () => void;
  insets: { top: number; bottom: number; left: number; right: number };
}

/**
 * Returns the reason this specific item can't be bought right now, or
 * null if the buy button should be active. The overlay uses this to grey
 * cards and swap their footer text — "OWNED", "MAX", "NEED 250" — so the
 * player understands the shape of the room before they tap anything.
 */
function shopItemBlockedReason(
  item: ShopItem,
  props: {
    essence: number;
    purchased: Partial<Record<ShopItemId, number>>;
    hearts: number;
    maxHearts: number;
    shield: number;
    weapon: HudSnapshot["weapon"];
    bonusMaxHearts: number;
  },
): { label: string; kind: "owned" | "cap" | "poor" | "full" } | null {
  const owned = props.purchased[item.id] ?? 0;
  if (owned >= item.maxStack) return { label: "OWNED", kind: "owned" };
  // Full Heal on full hearts is technically legal (the backend accepts
  // it), but selling a heal to a full-health player is user-hostile. Grey
  // it out and label it clearly.
  if (item.id === "healFull" && props.hearts >= props.maxHearts) {
    return { label: "AT FULL", kind: "full" };
  }
  // Weapons that are already the active weapon are functionally already
  // bought — the player would just be re-paying to reset the timer to
  // 300s, which is more expensive than the same result from letting the
  // ambient drop table hand them another scroll later. Discourage it
  // rather than forbid it; the backend allows a re-buy if they insist.
  if (
    (item.id === "tripleSpark" && props.weapon === "triple") ||
    (item.id === "seekerSwarm" && props.weapon === "homing") ||
    (item.id === "starLance" && props.weapon === "beam")
  ) {
    return { label: "ACTIVE", kind: "owned" };
  }
  if (item.id === "arcaneShield" && props.shield > 0) {
    return { label: "ACTIVE", kind: "owned" };
  }
  if (item.id === "vesselFragment" && props.bonusMaxHearts >= VESSEL_CAP) {
    return { label: "AT CAP", kind: "cap" };
  }
  if (props.essence < item.cost) {
    return { label: `NEED ${item.cost - props.essence}`, kind: "poor" };
  }
  return null;
}

const CATEGORY_TINT: Record<ShopItem["category"], string> = {
  restore: "rgba(232,90,120,0.32)",
  defense: "rgba(120,180,255,0.32)",
  offense: "rgba(196,162,255,0.32)",
  vessel: "rgba(255,201,74,0.32)",
};

const CATEGORY_ACCENT: Record<ShopItem["category"], number> = {
  restore: PALETTE.heart,
  defense: 0x8ff0e8,
  offense: PALETTE.arcane,
  vessel: PALETTE.gold,
};

function ShopOverlay({
  panel,
  hearts,
  maxHearts,
  shield,
  weapon,
  onBuy,
  onEnter,
  insets,
}: ShopOverlayProps) {
  return (
    <View style={styles.overlay}>
      <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(6,3,14,0.72)" },
        ]}
      />

      <View
        style={[
          styles.shopFrame,
          {
            paddingTop: insets.top + 22,
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: Math.max(insets.left, insets.right, 24) + 8,
          },
        ]}
      >
        {/* HEADER — boss identity on the left, essence on the right. */}
        <View style={styles.shopHeader}>
          <View style={{ flexShrink: 1 }}>
            <Text
              variant="label"
              size="xs"
              color="rgba(255,255,255,0.5)"
              style={styles.shopEyebrow}
            >
              Rest & Prepare
            </Text>
            <Text
              variant="display"
              size="lg"
              color="#FFFFFF"
              style={styles.shopBossName}
              numberOfLines={1}
            >
              {panel.bossName}
            </Text>
            {!!panel.bossTitle && (
              <Text
                variant="body"
                size="sm"
                color="rgba(255,255,255,0.58)"
                numberOfLines={1}
              >
                {panel.bossTitle}
              </Text>
            )}
          </View>

          <Glass style={styles.shopEssence} radius={18}>
            <View style={styles.shopEssenceInner}>
              <Text
                variant="label"
                size="xs"
                color="rgba(255,255,255,0.55)"
                style={styles.shopEssenceLabel}
              >
                ESSENCE
              </Text>
              <Text
                variant="heading"
                size="lg"
                color={hex(PALETTE.gold)}
                style={styles.shopEssenceValue}
              >
                {panel.essence.toLocaleString()}
              </Text>
            </View>
          </Glass>
        </View>

        {/* GRID — six cards in a 3-column layout on landscape phones.
            
            The critical piece here is `style={{ flex: 1, minHeight: 0 }}`.
            Without flex: 1 the ScrollView takes its INTRINSIC content
            height, which for six 92-tall cards + gaps is ~200wu — and
            in landscape (which this screen is always in) that pushes
            past the space the flex column left for it. The footer then
            landed on top of the cards instead of below them. flex: 1
            makes the ScrollView bind to the space between header and
            footer; minHeight: 0 is the RN-flex incantation that lets
            the child actually shrink below its content size when the
            parent tells it to.  */}
        <ScrollView
          style={styles.shopGridScroll}
          contentContainerStyle={styles.shopGrid}
          showsVerticalScrollIndicator={false}
        >
          {SHOP_CATALOG.map((item) => {
            const blocked = shopItemBlockedReason(item, {
              essence: panel.essence,
              purchased: panel.purchased,
              hearts,
              maxHearts,
              shield,
              weapon,
              bonusMaxHearts: panel.bonusMaxHearts,
            });
            const disabled = blocked !== null;
            return (
              <Pressable
                key={item.id}
                onPress={disabled ? undefined : () => onBuy(item.id)}
                style={[
                  styles.shopCard,
                  {
                    backgroundColor: CATEGORY_TINT[item.category],
                    opacity: disabled ? 0.44 : 1,
                  },
                ]}
              >
                <View style={styles.shopCardHeader}>
                  <View
                    style={[
                      styles.shopCardDot,
                      { backgroundColor: hex(CATEGORY_ACCENT[item.category]) },
                    ]}
                  />
                  <Text
                    variant="heading"
                    size="md"
                    color="#FFFFFF"
                    style={styles.shopCardLabel}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </View>
                <Text
                  variant="body"
                  size="sm"
                  color="rgba(255,255,255,0.72)"
                  style={styles.shopCardDesc}
                >
                  {item.description}
                </Text>
                <View style={styles.shopCardFooter}>
                  {blocked ? (
                    <Text
                      variant="label"
                      size="sm"
                      color={
                        blocked.kind === "poor"
                          ? "rgba(255,255,255,0.5)"
                          : hex(PALETTE.gold)
                      }
                      style={styles.shopCardStatus}
                    >
                      {blocked.label}
                    </Text>
                  ) : (
                    <Text
                      variant="label"
                      size="sm"
                      color={hex(PALETTE.gold)}
                      style={styles.shopCardCost}
                    >
                      {item.cost.toLocaleString()}
                    </Text>
                  )}
                  {!blocked && (
                    <Text
                      variant="heading"
                      size="sm"
                      color="#FFFFFF"
                      style={styles.shopCardBuy}
                    >
                      BUY
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* FOOTER — one commit button, no back-out. Small status line
            above showing what the player is walking in with, so they
            confirm their loadout before spending the fight learning it. */}
        <View style={styles.shopFooter}>
          <Text
            variant="body"
            size="sm"
            color="rgba(255,255,255,0.55)"
            style={styles.shopLoadout}
          >
            {hearts}/{maxHearts} hearts
            {shield > 0 ? ` · shield ${shield}` : ""}
            {weapon !== "bolt" ? ` · ${WEAPONS[weapon].label}` : ""}
          </Text>
          <Pressable onPress={onEnter} style={styles.shopEnter}>
            <Text variant="heading" size="md" color="#04121A">
              Enter the Arena
            </Text>
          </Pressable>
        </View>
      </View>
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
  shieldPip: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderCurve: "continuous",
    transform: [{ rotate: "45deg" }],
    marginLeft: 4,
  },
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
    width: 44,
    height: 44,
    // Ring width and opacity both bumped in v3.7 — the old value read
    // as decoration next to the sigil pill instead of "look here". A
    // thicker, brighter ring plus a slight size increase (40→44) is
    // what makes the compass READ as a compass at a glance.
    borderWidth: 2,
    borderColor: "rgba(255,201,74,0.85)",
  },
  compassButtonBench: {
    // Bench-fallback variant. Same footprint as the boss compass so
    // the button doesn't jump around when the objective flips, but
    // the ring is neutral so the eye still separates "urgent target"
    // from "somewhere useful to head".
    width: 44,
    height: 44,
    borderWidth: 1.4,
    borderColor: "rgba(255,255,255,0.4)",
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
  benchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  benchPill: {},
  benchInner: { paddingHorizontal: 16, paddingVertical: 8 },
  travelPill: {},
  travelInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  travelIcon: {
    width: 14,
    height: 14,
    borderWidth: 1.4,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 3,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  travelIconArrow: {
    width: 6,
    height: 6,
    borderTopWidth: 1.4,
    borderRightWidth: 1.4,
    borderColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }, { translateX: -1 }],
  },

  // ---- Travel modal ----
  travelOverlay: { ...StyleSheet.absoluteFillObject },
  travelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 16,
  },
  travelScroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 10,
  },
  travelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  travelRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  travelSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderCurve: "continuous",
    transform: [{ rotate: "45deg" }],
  },
  travelHere: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  travelSigilRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  travelSigilDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
    borderCurve: "continuous",
    transform: [{ rotate: "45deg" }],
    backgroundColor: hex(PALETTE.gold),
  },

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
  // Uma barra dourada mais grossa que a do bench — o bench é uma âncora
  // pontual num room; o path é uma estrada contínua entre eles. Mais
  // comprida (18px) e mais grossa (5px) que a barra do bench (14x3).
  legendPathLine: {
    width: 18,
    height: 5,
    borderRadius: 2,
    backgroundColor: hex(PALETTE.gold),
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

  // -------- Shop overlay --------
  //
  // The frame is a full-viewport column split into three: a header row
  // (boss + essence), a scrollable 2-column grid of item cards, and a
  // pinned footer with the loadout summary + commit button.
  shopFrame: { flex: 1, flexDirection: "column", gap: 18 },
  shopHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  shopEyebrow: {
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  shopBossName: { letterSpacing: -0.6, marginBottom: 2 },
  shopEssence: { alignSelf: "flex-start", minWidth: 130 },
  shopEssenceInner: { paddingHorizontal: 16, paddingVertical: 10, gap: 2 },
  shopEssenceLabel: {
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "right",
  },
  shopEssenceValue: {
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },

  // Grid container. The ScrollView itself takes the leftover flex-1
  // space between header and footer; the content inside is a wrapping
  // row so cards spill to a second line when the catalog grows past
  // three items.
  //
  // WHY 3 COLUMNS
  //
  // Six catalog items in two columns = three rows = ~300wu of vertical
  // stack, which does NOT fit in landscape on shorter phones (iPhone SE
  // has ~330wu of vertical space to play with after the header, footer
  // and safe areas). Six items in three columns = two rows = ~200wu,
  // which fits everywhere without scrolling — and if the catalog ever
  // grows past six, the ScrollView is already wired up to handle it.
  shopGridScroll: {
    // flex: 1 is what makes the scroll region actually claim the space
    // between header and footer; without it the intrinsic content
    // height wins and the footer gets shoved off-screen or on top of
    // the cards. minHeight: 0 is the RN-flex escape hatch that lets
    // the scroll region shrink below its content on constrained
    // devices — required for the internal scroll to engage.
    flex: 1,
    minHeight: 0,
  },
  shopGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 8,
  },
  shopCard: {
    // 31% + a 12 gap on either side wraps to exactly three per row on
    // landscape phones — flexGrow: 1 lets the last row expand to fill
    // if the catalog isn't a multiple of three.
    flexBasis: "31%",
    flexGrow: 1,
    // minHeight dropped 118 → 92 alongside the layout change: the
    // content in a card (dot + label + 2 lines of description + cost
    // row) is ~86wu tall including padding, so 92 gives one wu of
    // slack for descender clipping without leaving a lot of dead
    // space when text wraps to fewer lines than the max.
    minHeight: 92,
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 14,
    justifyContent: "space-between",
    gap: 8,
  },
  shopCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  shopCardDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderCurve: "continuous",
    transform: [{ rotate: "45deg" }],
  },
  shopCardLabel: { letterSpacing: -0.2, flex: 1 },
  shopCardDesc: { lineHeight: 18 },
  shopCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  shopCardCost: {
    letterSpacing: 0.4,
    fontVariant: ["tabular-nums"],
  },
  shopCardStatus: {
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  shopCardBuy: {
    letterSpacing: 1.6,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.16)",
    overflow: "hidden",
  },

  shopFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingTop: 6,
  },
  shopLoadout: {
    flexShrink: 1,
    letterSpacing: 0.3,
  },
  shopEnter: {
    backgroundColor: hex(PALETTE.gold),
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 18,
    borderCurve: "continuous",
  },

  // -------- TAP TO TALK prompt --------
  talkWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  talkPill: {},
  talkInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  talkGlyph: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderCurve: "continuous",
    transform: [{ rotate: "45deg" }],
  },
  talkLabel: { letterSpacing: 1.6 },

  // -------- Dialogue overlay --------
  //
  // Full-screen pressable surface — tap anywhere advances. Content is
  // laid out with absolute-position blocks (header top, bubble bottom)
  // because a column layout would trap the tap area between them.
  dialogueSurface: { ...StyleSheet.absoluteFillObject },
  dialogueSkip: { position: "absolute" },
  dialogueSkipBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  dialogueSkipLabel: {
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  dialogueHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  dialogueEyebrow: {
    letterSpacing: 2.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  dialogueHeaderName: {
    letterSpacing: -0.6,
    textAlign: "center",
    marginBottom: 2,
  },
  dialogueBubbleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  dialogueBubble: {
    borderRadius: 22,
    borderCurve: "continuous",
    overflow: "hidden",
    minHeight: 140,
  },
  dialogueStripe: {
    position: "absolute",
    top: 14,
    bottom: 14,
    left: 0,
    width: 4,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  dialogueBubbleInner: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingLeft: 22,
    gap: 8,
  },
  dialogueSpeaker: {
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  dialogueBody: {
    lineHeight: 26,
    letterSpacing: -0.1,
  },
  dialogueNarrator: {
    fontStyle: "italic",
  },
  dialogueFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  dialogueDots: { flexDirection: "row", gap: 5 },
  dialogueDot: {
    width: 6,
    height: 6,
    borderRadius: 2,
    borderCurve: "continuous",
    transform: [{ rotate: "45deg" }],
  },
  dialogueHint: {
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
});
