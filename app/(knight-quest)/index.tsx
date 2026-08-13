import { BlurView } from "expo-blur";
import { GLView } from "expo-gl";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  applyStick,
  BOSS_ROOM_KEY,
  pressAttack,
  ROOMS,
  useKnightQuestGame,
  type ExpoGLContext,
  type HudSnapshot,
  type KnightQuestGame,
} from "@/game/knight-quest";

// ---------------------------------------------------------------------------
// Knight Quest — screen shell.
//
// The React layer owns:
//   1. HUD (hearts, coins, key, boss bar, room label, minimap, toast)
//   2. Touch controls (virtual joystick + attack / roll / block / interact)
//   3. Overlays (loading, game over, victory)
//
// It never touches the scene graph. Same 10Hz HUD polling pattern as Spell
// Storm: an interval reads the game's `hud` snapshot into React state, so
// the game loop is never blocked by React re-renders.
// ---------------------------------------------------------------------------

const HAIRLINE = "rgba(255,255,255,0.16)";
const GLASS_TINT = "rgba(12,8,24,0.42)";
const GOLD = "#ffd166";
const HEART_RED = "#ff3b5c";
const DANGER = "#dd4422";
const HUD_POLL_MS = 200; // 5Hz — halves React re-render pressure vs 10Hz

// ============================ Glass helpers =================================

function Glass({
  children,
  style,
  radius = 14,
}: {
  children?: React.ReactNode;
  style?: any;
  radius?: number;
}) {
  return (
    <View
      style={[
        { borderRadius: radius, borderCurve: "continuous", overflow: "hidden" },
        style,
      ]}
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS_TINT }]} />
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

// ============================ Heart (Views only) ==========================
//
// Same trick as Spell Storm — no react-native-svg dependency. The heart is
// built from a rotated square + two circles. `fill` decides how much of the
// red overlay shows through: full / half (left side only) / empty.

function Heart({ fill }: { fill: "full" | "half" | "empty" }) {
  const size = 20;
  const empty = fill === "empty";
  const half = fill === "half";
  const overlay = empty ? "transparent" : HEART_RED;

  const HeartShape = ({ color, halfClip }: { color: string; halfClip?: boolean }) => (
    <View
      style={{
        width: size,
        height: size,
        overflow: halfClip ? "hidden" : "visible",
      }}
    >
      {halfClip && (
        <View
          style={{ position: "absolute", left: 0, top: 0, width: size / 2, height: size, overflow: "hidden" }}
        >
          <HeartInner size={size} color={color} />
        </View>
      )}
      {!halfClip && <HeartInner size={size} color={color} />}
    </View>
  );

  return (
    <View style={{ width: size, height: size, marginHorizontal: 1 }}>
      <HeartShape color="#3a2540" />
      {!empty && (
        <View style={{ position: "absolute", left: 0, top: 0 }}>
          <HeartShape color={overlay} halfClip={half} />
        </View>
      )}
    </View>
  );
}

function HeartInner({ size, color }: { size: number; color: string }) {
  const lobe = size * 0.55;
  return (
    <View style={{ width: size, height: size }}>
      {/* rotated diamond body */}
      <View
        style={{
          position: "absolute",
          left: size * 0.15,
          top: size * 0.35,
          width: size * 0.7,
          height: size * 0.7,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
      {/* left lobe */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: size * 0.05,
          width: lobe,
          height: lobe,
          borderRadius: lobe / 2,
          backgroundColor: color,
        }}
      />
      {/* right lobe */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: size * 0.05,
          width: lobe,
          height: lobe,
          borderRadius: lobe / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// ============================ HUD strip =====================================

function HeartsRow({ halfHearts, max }: { halfHearts: number; max: number }) {
  const total = max / 2;
  const hearts: ("full" | "half" | "empty")[] = [];
  for (let i = 0; i < total; i++) {
    const remaining = halfHearts - i * 2;
    hearts.push(remaining >= 2 ? "full" : remaining === 1 ? "half" : "empty");
  }
  return (
    <Glass style={{ paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", gap: 2 }}>
      {hearts.map((h, i) => (
        <Heart key={i} fill={h} />
      ))}
    </Glass>
  );
}

function CoinsPill({ coins }: { coins: number }) {
  return (
    <Glass style={{ paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Text style={{ fontSize: 16 }}>💰</Text>
      <Text style={{ color: GOLD, fontWeight: "700", fontSize: 14 }}>{coins}</Text>
    </Glass>
  );
}

function KeyPill() {
  return (
    <Glass
      radius={14}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderColor: GOLD,
      }}
    >
      <Text style={{ fontSize: 18 }}>🔑</Text>
    </Glass>
  );
}

function BossBar({ frac }: { frac: number }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 5 }}>
      <View
        style={{
          height: 12,
          backgroundColor: "rgba(0,0,0,0.4)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${Math.max(0, Math.min(1, frac)) * 100}%`,
            backgroundColor: DANGER,
          }}
        />
      </View>
      <Text
        style={{
          textAlign: "center",
          color: DANGER,
          fontSize: 10,
          letterSpacing: 2,
          marginTop: 2,
        }}
      >
        SKELETON WARRIOR
      </Text>
    </View>
  );
}

function RoomLabel({ name }: { name: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [name, opacity]);
  return (
    <Animated.View style={{ opacity, alignItems: "center" }}>
      <Glass style={{ paddingHorizontal: 18, paddingVertical: 6 }}>
        <Text style={{ color: "white", letterSpacing: 2, fontSize: 12 }}>
          {name.toUpperCase()}
        </Text>
      </Glass>
    </Animated.View>
  );
}

function Toast({ text, id }: { text: string; id: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!text) return;
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [id, text, opacity]);
  if (!text) return null;
  return (
    <Animated.View style={{ opacity, alignItems: "center" }}>
      <Glass
        style={{
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderColor: GOLD,
        }}
      >
        <Text style={{ color: "white", fontSize: 14 }}>{text}</Text>
      </Glass>
    </Animated.View>
  );
}

// ============================ Minimap =======================================

const MINI_CELL = 16;
const MINI_GAP = 2;

function Minimap({ visited, current }: { visited: string[]; current: string }) {
  let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
  for (const r of ROOMS) {
    minGx = Math.min(minGx, r.gx); maxGx = Math.max(maxGx, r.gx);
    minGy = Math.min(minGy, r.gy); maxGy = Math.max(maxGy, r.gy);
  }
  const cols = maxGx - minGx + 1;
  const rows = maxGy - minGy + 1;
  return (
    <Glass
      style={{
        padding: MINI_GAP + 2,
        width: cols * (MINI_CELL + MINI_GAP) + MINI_GAP + 4,
        height: rows * (MINI_CELL + MINI_GAP) + MINI_GAP + 4,
      }}
    >
      {ROOMS.map((r) => {
        const isVisited = visited.includes(r.key);
        const isCurrent = r.key === current;
        let bg = "rgba(255,255,255,0.05)";
        if (isVisited) {
          if (r.biome === "village") bg = "#5a8a48";
          else if (r.key === BOSS_ROOM_KEY) bg = "#8a3a4c";
          else bg = "#5a4880";
        }
        return (
          <View
            key={r.key}
            style={{
              position: "absolute",
              left: MINI_GAP + 2 + (r.gx - minGx) * (MINI_CELL + MINI_GAP),
              top: MINI_GAP + 2 + (r.gy - minGy) * (MINI_CELL + MINI_GAP),
              width: MINI_CELL,
              height: MINI_CELL,
              backgroundColor: bg,
              borderRadius: 2,
              borderWidth: isCurrent ? 1.5 : 0,
              borderColor: "white",
            }}
          />
        );
      })}
    </Glass>
  );
}

// ============================ Joystick ======================================

const STICK_R = 56;
const HAT_R = 24;

function Joystick({
  onMove,
  onEnd,
}: {
  onMove: (dx: number, dy: number) => void;
  onEnd: () => void;
}) {
  const [hat, setHat] = useState({ x: 0, y: 0 });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setHat({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, g) => {
        const len = Math.hypot(g.dx, g.dy);
        const nx = len > STICK_R ? (g.dx / len) * STICK_R : g.dx;
        const ny = len > STICK_R ? (g.dy / len) * STICK_R : g.dy;
        setHat({ x: nx, y: ny });
        onMove(g.dx / STICK_R, g.dy / STICK_R);
      },
      onPanResponderRelease: () => {
        setHat({ x: 0, y: 0 });
        onEnd();
      },
      onPanResponderTerminate: () => {
        setHat({ x: 0, y: 0 });
        onEnd();
      },
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      style={{
        width: STICK_R * 2 + 20,
        height: STICK_R * 2 + 20,
        borderRadius: STICK_R + 10,
        backgroundColor: "rgba(0,0,0,0.3)",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.25)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: HAT_R * 2,
          height: HAT_R * 2,
          borderRadius: HAT_R,
          backgroundColor: "rgba(255,255,255,0.55)",
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.9)",
          transform: [{ translateX: hat.x }, { translateY: hat.y }],
        }}
      />
    </View>
  );
}

// ============================ Action buttons ================================

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
  onUp?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => {
          Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onDown();
        }}
        onPressOut={() => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
          onUp?.();
        }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint,
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.6)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: size * 0.44, fontWeight: "700" }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ============================ Overlays ======================================

function LoadingOverlay({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Text style={styles.title}>KNIGHT QUEST</Text>
      <Text style={styles.subtitle}>A Magic World Adventure</Text>
      <Text style={styles.h2}>Preparing the dungeon...</Text>
      <View style={styles.loadingOuter}>
        <View style={[styles.loadingInner, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.dim}>{label} ({done}/{total})</Text>
    </View>
  );
}

function GameOverOverlay({ coins, onRestart, onExit }: { coins: number; onRestart: () => void; onExit: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Text style={styles.title}>You have fallen</Text>
      <Text style={styles.body}>The undead claim another soul...</Text>
      <Text style={styles.stat}>💰 Coins collected: {coins}</Text>
      <Pressable onPress={onRestart} style={styles.menuBtn}>
        <Text style={styles.menuBtnText}>↻  TRY AGAIN</Text>
      </Pressable>
      <Pressable onPress={onExit} style={styles.menuBtnGhost}>
        <Text style={styles.menuBtnGhostText}>← Leave the dungeon</Text>
      </Pressable>
    </View>
  );
}

function VictoryOverlay({ coins, onRestart, onExit }: { coins: number; onRestart: () => void; onExit: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Text style={{ fontSize: 60, marginBottom: 8 }}>💎</Text>
      <Text style={styles.title}>You saved Willowvale!</Text>
      <Text style={styles.body}>
        The Skeleton Warrior has fallen. The crystal of the ancients returns to the light,
        and peace is restored to the valley.
      </Text>
      <Text style={styles.stat}>💰 Coins collected: {coins}</Text>
      <Pressable onPress={onRestart} style={styles.menuBtn}>
        <Text style={styles.menuBtnText}>▶  PLAY AGAIN</Text>
      </Pressable>
      <Pressable onPress={onExit} style={styles.menuBtnGhost}>
        <Text style={styles.menuBtnGhostText}>← Return to Magic World</Text>
      </Pressable>
    </View>
  );
}

// ============================ Root screen ===================================

export default function KnightQuestScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [progress, setProgress] = useState<{ done: number; total: number; label: string }>({
    done: 0, total: 1, label: "starting…",
  });

  // 10Hz HUD polling — same pattern as Spell Storm.
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const gameRefLocal = useRef<KnightQuestGame | null>(null);

  const { onContextCreate, gameRef, ready } = useKnightQuestGame({
    onReady: (g) => {
      gameRefLocal.current = g;
    },
    onLoadProgress: (done, total, label) => setProgress({ done, total, label }),
  });

  useEffect(() => {
    const id = setInterval(() => {
      const g = gameRef.current;
      if (!g) return;
      // Take a shallow snapshot so React notices the identity change.
      setHud({ ...g.hud });
    }, HUD_POLL_MS);
    return () => clearInterval(id);
  }, [gameRef]);

  const onStickMove = useCallback((dx: number, dy: number) => {
    const g = gameRef.current;
    if (!g) return;
    applyStick(g.input, dx, dy);
  }, [gameRef]);

  const onStickEnd = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    applyStick(g.input, 0, 0);
  }, [gameRef]);

  const onAttack = useCallback(() => {
    const g = gameRef.current;
    if (g) pressAttack(g.input);
  }, [gameRef]);

  const onRoll = useCallback(() => {
    const g = gameRef.current;
    if (g) g.input.rollPressed = true;
  }, [gameRef]);

  const onBlockDown = useCallback(() => {
    const g = gameRef.current;
    if (g) g.input.blockHeld = true;
  }, [gameRef]);

  const onBlockUp = useCallback(() => {
    const g = gameRef.current;
    if (g) g.input.blockHeld = false;
  }, [gameRef]);

  const onInteract = useCallback(() => {
    const g = gameRef.current;
    if (g) g.requestInteract();
  }, [gameRef]);

  const restart = useCallback(() => {
    gameRef.current?.restart();
  }, [gameRef]);

  const exit = useCallback(() => {
    router.back();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#151024" }}>
      <StatusBar hidden />
      <GLView
        style={{ flex: 1 }}
        onContextCreate={onContextCreate as (gl: any) => void}
      />

      {/* ---- HUD ---- */}
      {ready && hud && !hud.isDead && !hud.isVictory && (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {/* Top row: hearts (left), key + coins (right) */}
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 12,
              right: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <HeartsRow halfHearts={hud.halfHearts} max={hud.maxHalfHearts} />
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              {hud.hasBossKey && <KeyPill />}
              <CoinsPill coins={hud.coins} />
            </View>
          </View>

          {/* Room label under hearts */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: insets.top + 60,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <RoomLabel name={hud.roomName} />
          </View>

          {/* Minimap top-right corner (below the coins pill) */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: insets.top + 60,
              right: 12,
            }}
          >
            <Minimap visited={hud.visitedRooms} current={hud.roomKey} />
          </View>

          {/* Boss bar bottom-center */}
          {hud.bossHpFrac !== null && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: insets.bottom + 180,
                left: "10%",
                right: "10%",
              }}
            >
              <Glass style={{ borderColor: DANGER }}>
                <BossBar frac={hud.bossHpFrac} />
              </Glass>
            </View>
          )}

          {/* Toast above buttons */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: insets.bottom + 230,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            {hud.toast && <Toast text={hud.toast} id={hud.toastId} />}
          </View>

          {/* Left: joystick */}
          <View
            style={{
              position: "absolute",
              left: 20,
              bottom: insets.bottom + 30,
            }}
          >
            <Joystick onMove={onStickMove} onEnd={onStickEnd} />
          </View>

          {/* Right: action buttons */}
          <View
            style={{
              position: "absolute",
              right: 20,
              bottom: insets.bottom + 30,
              width: 170,
              height: 150,
            }}
          >
            <View style={{ position: "absolute", right: 0, bottom: 0 }}>
              <ActionButton label="⚔" tint="rgba(220,80,80,0.5)" size={78} onDown={onAttack} />
            </View>
            <View style={{ position: "absolute", left: 0, bottom: 0 }}>
              <ActionButton label="↷" tint="rgba(80,120,220,0.5)" size={60} onDown={onRoll} />
            </View>
            <View style={{ position: "absolute", left: 0, top: 0 }}>
              <ActionButton
                label="🛡"
                tint="rgba(120,120,180,0.5)"
                size={56}
                onDown={onBlockDown}
                onUp={onBlockUp}
              />
            </View>
            <View style={{ position: "absolute", right: 0, top: 0 }}>
              <ActionButton label="✋" tint="rgba(220,180,80,0.5)" size={56} onDown={onInteract} />
            </View>
          </View>

          {/* Back button top-right corner */}
          <View style={{ position: "absolute", top: insets.top + 8, right: 12, zIndex: 10 }}>
            {/* rendered separately so it doesn't fight the coins pill */}
          </View>
        </View>
      )}

      {/* ---- Overlays ---- */}
      {!ready && (
        <LoadingOverlay
          done={progress.done}
          total={progress.total}
          label={progress.label}
        />
      )}
      {ready && hud?.isDead && (
        <GameOverOverlay coins={hud.coins} onRestart={restart} onExit={exit} />
      )}
      {ready && hud?.isVictory && (
        <VictoryOverlay coins={hud.coins} onRestart={restart} onExit={exit} />
      )}
    </View>
  );
}

// ============================ Styles ========================================

const styles = StyleSheet.create({
  overlay: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15,10,30,0.94)",
    padding: 30,
  },
  title: {
    fontSize: 34,
    color: GOLD,
    letterSpacing: 4,
    fontWeight: "800",
    marginVertical: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#7de3ff",
    letterSpacing: 3,
    marginBottom: 30,
  },
  h2: {
    fontSize: 18,
    color: "white",
    marginBottom: 20,
  },
  body: {
    color: "#b7a8c8",
    textAlign: "center",
    lineHeight: 22,
    marginVertical: 10,
    maxWidth: 340,
  },
  stat: {
    fontSize: 16,
    color: "white",
    marginVertical: 12,
  },
  dim: {
    fontSize: 12,
    color: "#b7a8c8",
    marginTop: 10,
  },
  loadingOuter: {
    width: 260,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 16,
  },
  loadingInner: {
    height: "100%",
    backgroundColor: GOLD,
  },
  menuBtn: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: GOLD,
    borderRadius: 8,
  },
  menuBtnText: {
    color: "#151024",
    fontWeight: "700",
    letterSpacing: 2,
    fontSize: 16,
  },
  menuBtnGhost: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  menuBtnGhostText: {
    color: "#b7a8c8",
    fontSize: 14,
  },
});
