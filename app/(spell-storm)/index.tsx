import AsyncStorage from "@react-native-async-storage/async-storage";
import { GLView } from "expo-gl";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import Text from "@/components/ui/Text";
import { useProStatus } from "@/hooks/useProStatus";
import {
  createSpellStorm,
  INPUT,
  PALETTE,
  PLAYER,
  STORAGE_KEYS,
  WAVES,
  WEAPONS,
  type HudSnapshot,
  type SoundId,
  type SpellStorm,
} from "@/game/spell-storm";
import { applyStick } from "@/game/spell-storm/engine/input";
import { useGLGame, type ExpoGLContext } from "@/game/spell-storm/engine/useGLGame";
import type { GameContext } from "@/game/spell-storm/types";

/**
 * Spell Storm — screen shell.
 *
 * The React layer owns three things and nothing else: the HUD, the touch
 * controls, and the overlays. It never touches the scene graph.
 *
 * The HUD is polled on a 10Hz interval rather than driven by React state
 * from inside the game loop. Calling setState sixty times a second would
 * re-render this tree sixty times a second on the JS thread — the same
 * thread the game loop runs on — and the frame rate would collapse. Ten
 * updates a second is imperceptible for a score counter and costs nothing.
 */

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export default function SpellStormScreen() {
  const { width, height } = useWindowDimensions();
  const { isPro, loading: proLoading } = useProStatus();

  const gameRef = useRef<SpellStorm | null>(null);
  const [hud, setHud] = useState<HudSnapshot>({
    phase: "loading",
    hearts: PLAYER.startHearts,
    score: 0,
    wave: 0,
    combo: 1,
    weapon: "bolt",
    weaponTimer: 0,
    bossHp: 0,
    bossMaxHp: 1,
    bossActive: false,
  });
  const [highScore, setHighScore] = useState(0);
  const [bestWave, setBestWave] = useState(0);
  const [ready, setReady] = useState(false);

  // ---- Persistence -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.highScore),
      AsyncStorage.getItem(STORAGE_KEYS.bestWave),
    ]).then(([score, wave]) => {
      if (cancelled) return;
      if (score) setHighScore(Number(score) || 0);
      if (wave) setBestWave(Number(wave) || 0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRunEnd = useCallback(
    ({ score, wave }: { score: number; wave: number; victory: boolean }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setHighScore((previous) => {
        if (score > previous) {
          AsyncStorage.setItem(STORAGE_KEYS.highScore, String(score)).catch(() => {});
          return score;
        }
        return previous;
      });
      setBestWave((previous) => {
        if (wave > previous) {
          AsyncStorage.setItem(STORAGE_KEYS.bestWave, String(wave)).catch(() => {});
          return wave;
        }
        return previous;
      });
    },
    [],
  );

  const handleSound = useCallback((id: SoundId) => {
    // Haptics stand in for audio. Only the events that matter get one —
    // buzzing on every shot would be exhausting and would drain battery.
    switch (id) {
      case "hurt":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        break;
      case "pickup":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        break;
      case "bossRoar":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
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
        onRunEnd: handleRunEnd,
        onSound: handleSound,
      });
      gameRef.current = game;
      return game;
    },
    [isPro, handleRunEnd, handleSound],
  );

  const { onContextCreate } = useGLGame({
    factory,
    onReady: () => setReady(true),
  });

  // Poll the HUD.
  useEffect(() => {
    const id = setInterval(() => {
      const game = gameRef.current;
      if (game) setHud({ ...game.hud });
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ---- Touch controls ----------------------------------------------------
  const [stickOrigin, setStickOrigin] = useState<{ x: number; y: number } | null>(null);
  const [stickKnob, setStickKnob] = useState({ x: 0, y: 0 });

  const stickResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // The stick appears wherever the thumb lands rather than living at a
        // fixed spot. On a phone the player cannot see their own thumb, and a
        // fixed stick means constantly hunting for it mid-fight.
        onPanResponderGrant: (evt) => {
          setStickOrigin({ x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY });
          setStickKnob({ x: 0, y: 0 });
        },
        onPanResponderMove: (_evt, gesture) => {
          const game = gameRef.current;
          if (game) applyStick(game.input, gesture.dx, gesture.dy);
          const len = Math.hypot(gesture.dx, gesture.dy);
          const clamp = Math.min(len, INPUT.stickRadius);
          const scale = len > 0 ? clamp / len : 0;
          setStickKnob({ x: gesture.dx * scale, y: gesture.dy * scale });
        },
        onPanResponderRelease: () => {
          const game = gameRef.current;
          if (game) applyStick(game.input, 0, 0);
          setStickOrigin(null);
          setStickKnob({ x: 0, y: 0 });
        },
        onPanResponderTerminate: () => {
          const game = gameRef.current;
          if (game) applyStick(game.input, 0, 0);
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
    if (game) game.input.fireHeld = down;
  }, []);

  const startRun = useCallback(() => {
    gameRef.current?.start();
    setHud((h) => ({ ...h, phase: "playing" }));
  }, []);

  // ---- Render ------------------------------------------------------------
  const playing = hud.phase === "playing" || hud.phase === "intermission";
  const weaponSpec = WEAPONS[hud.weapon];

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate as (gl: ExpoGLContext) => void} />

      {/* ---------------- HUD ---------------- */}
      {playing && (
        <View pointerEvents="none" style={styles.hud}>
          <View style={styles.hudRow}>
            <View style={styles.hearts}>
              {Array.from({ length: PLAYER.maxHearts }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.heart,
                    { backgroundColor: i < hud.hearts ? hex(PALETTE.heart) : "rgba(255,255,255,0.18)" },
                  ]}
                />
              ))}
            </View>

            <View style={styles.scoreBlock}>
              <Text variant="heading" size="lg" color="#FFFFFF" style={styles.score}>
                {hud.score.toLocaleString()}
              </Text>
              {hud.combo > 1 && (
                <Text variant="body" size="sm" color={hex(PALETTE.gold)}>
                  {hud.combo.toFixed(1)}x chain
                </Text>
              )}
            </View>
          </View>

          <View style={styles.hudRow}>
            <Text variant="body" size="sm" color="rgba(255,255,255,0.75)">
              Wave {hud.wave}
            </Text>
            {hud.weapon !== "bolt" && (
              <Text variant="body" size="sm" color={hex(PALETTE.arcane)}>
                {weaponSpec.label} · {Math.ceil(hud.weaponTimer)}s
              </Text>
            )}
          </View>

          {hud.bossActive && (
            <View style={styles.bossBar}>
              <View
                style={[
                  styles.bossFill,
                  { width: `${Math.max(0, (hud.bossHp / hud.bossMaxHp) * 100)}%` },
                ]}
              />
            </View>
          )}
        </View>
      )}

      {/* ---------------- Controls ---------------- */}
      {playing && (
        <>
          <View style={[styles.stickZone, { width: width * 0.45 }]} {...stickResponder.panHandlers}>
            {stickOrigin && (
              <>
                <View
                  pointerEvents="none"
                  style={[
                    styles.stickBase,
                    { left: stickOrigin.x - INPUT.stickRadius, top: stickOrigin.y - INPUT.stickRadius },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.stickKnob,
                    {
                      left: stickOrigin.x + stickKnob.x - 26,
                      top: stickOrigin.y + stickKnob.y - 26,
                    },
                  ]}
                />
              </>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPressIn={() => pressFire(true)}
              onPressOut={() => pressFire(false)}
              style={({ pressed }) => [
                styles.actionButton,
                styles.fireButton,
                pressed && styles.actionPressed,
              ]}
            >
              <Text variant="heading" size="md" color="#04121A">
                CAST
              </Text>
            </Pressable>

            <Pressable
              onPressIn={() => pressJump(true)}
              onPressOut={() => pressJump(false)}
              style={({ pressed }) => [
                styles.actionButton,
                styles.jumpButton,
                pressed && styles.actionPressed,
              ]}
            >
              <Text variant="heading" size="md" color="#1A1206">
                JUMP
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ---------------- Overlays ---------------- */}
      {(!ready || proLoading) && (
        <View style={styles.overlay}>
          <ActivityIndicator color={hex(PALETTE.arcane)} size="large" />
        </View>
      )}

      {ready && !proLoading && hud.phase === "ready" && (
        <Overlay
          title="Spell Storm"
          subtitle="Drag to move and aim. Cast to fight. Survive the waves."
          primaryLabel="Begin"
          onPrimary={startRun}
          onSecondary={() => router.back()}
          secondaryLabel="Back to Arcade"
          stats={highScore > 0 ? `Best ${highScore.toLocaleString()} · Wave ${bestWave}` : undefined}
        />
      )}

      {hud.phase === "gameover" && (
        <Overlay
          title="Defeated"
          subtitle={`You reached wave ${hud.wave}.`}
          primaryLabel="Try again"
          onPrimary={startRun}
          onSecondary={() => router.back()}
          secondaryLabel="Back to Arcade"
          stats={`Score ${hud.score.toLocaleString()} · Best ${highScore.toLocaleString()}`}
        />
      )}

      {hud.phase === "locked" && (
        <Overlay
          title="The storm goes deeper"
          subtitle={`You cleared all ${WAVES.freeWaves} waves and beat the dragon. Members keep going — endless waves, tougher dragons, every spell scroll.`}
          primaryLabel="See membership"
          onPrimary={() => router.push("/(subscribe)")}
          secondaryLabel="Play again"
          onSecondary={startRun}
          stats={`Score ${hud.score.toLocaleString()}`}
        />
      )}
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
      <View style={styles.panel}>
        <Text variant="display" size="display" color="#FFFFFF" style={styles.overlayTitle}>
          {title}
        </Text>
        <Text variant="body" size="md" color="rgba(255,255,255,0.78)" style={styles.overlayBody}>
          {subtitle}
        </Text>
        {stats && (
          <Text variant="body" size="sm" color={hex(PALETTE.gold)} style={styles.overlayStats}>
            {stats}
          </Text>
        )}

        <Pressable onPress={onPrimary} style={({ pressed }) => [styles.primary, pressed && styles.actionPressed]}>
          <Text variant="heading" size="md" color="#04121A">
            {primaryLabel}
          </Text>
        </Pressable>

        <Pressable onPress={onSecondary} style={styles.secondary}>
          <Text variant="body" size="sm" color="rgba(255,255,255,0.62)">
            {secondaryLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: hex(PALETTE.skyZenith) },

  hud: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 54,
    paddingHorizontal: 20,
    gap: 6,
  },
  hudRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hearts: { flexDirection: "row", gap: 7 },
  heart: { width: 20, height: 20, borderRadius: 6, borderCurve: "continuous" },
  scoreBlock: { alignItems: "flex-end" },
  score: { letterSpacing: -0.5 },

  bossBar: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.42)",
    overflow: "hidden",
    marginTop: 4,
  },
  bossFill: { height: "100%", backgroundColor: hex(PALETTE.dragonFace) },

  stickZone: { position: "absolute", left: 0, bottom: 0, top: "38%" },
  stickBase: {
    position: "absolute",
    width: INPUT.stickRadius * 2,
    height: INPUT.stickRadius * 2,
    borderRadius: INPUT.stickRadius,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  stickKnob: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  actions: {
    position: "absolute",
    right: 24,
    bottom: 38,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
  },
  actionButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fireButton: { backgroundColor: hex(PALETTE.arcane) },
  jumpButton: { backgroundColor: hex(PALETTE.gold), width: 76, height: 76, borderRadius: 38 },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.95 }] },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,5,24,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  panel: { alignItems: "center", maxWidth: 420 },
  overlayTitle: { textAlign: "center", marginBottom: 10 },
  overlayBody: { textAlign: "center", lineHeight: 22, marginBottom: 10 },
  overlayStats: { marginBottom: 26 },
  primary: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: hex(PALETTE.arcane),
    borderCurve: "continuous",
  },
  secondary: { marginTop: 18, padding: 10 },
});
