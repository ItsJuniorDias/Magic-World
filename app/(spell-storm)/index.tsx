import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { GLView } from "expo-gl";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
    <View style={[{ borderRadius: radius, borderCurve: "continuous", overflow: "hidden" }, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS_TINT }]} />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, borderCurve: "continuous", borderWidth: 1, borderColor: HAIRLINE },
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
          <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
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
          <Text variant="heading" size="md" color="#FFFFFF" style={styles.actionLabel}>
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
  const [ready, setReady] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

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
            // Defensive: a save written by an older build may be missing
            // fields, and a crash on launch is a far worse outcome than a
            // reset save.
            progressRef.current = {
              bosses: Array.isArray(parsed.bosses) ? parsed.bosses : [],
              discovered: Array.isArray(parsed.discovered) ? parsed.discovered : [],
              bench: typeof parsed.bench === "string" && ROOMS[parsed.bench] ? parsed.bench : "crossroads",
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

  const handleProgress = useCallback((p: Progress) => {
    progressRef.current = p;
    AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(p)).catch(() => {});
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        break;
      case "bossRoar":
      case "sealed":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        break;
      case "bossDown":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        break;
      case "gameover":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
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
    paused: mapOpen,
    onReady: () => setReady(true),
  });

  // Rotation. The old build never called resize at all, so turning the phone
  // left the frustum on the previous aspect ratio and stretched everything.
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      handleRef.current?.resize(width, height);
    },
    [handleRef],
  );

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
  const playing =
    hud.phase === "playing" ||
    hud.phase === "transition" ||
    hud.phase === "bossIntro" ||
    hud.phase === "bossDefeated" ||
    hud.phase === "dead";

  const weaponSpec = WEAPONS[hud.weapon];
  const bossPct = Math.max(0, Math.min(1, hud.bossHp / Math.max(1, hud.bossMaxHp)));

  if (!progressLoaded || proLoading) {
    return (
      <View style={styles.root}>
        <StatusBar hidden />
        <View style={styles.overlay}>
          <ActivityIndicator color={hex(PALETTE.arcane)} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar hidden />

      <GLView
        style={StyleSheet.absoluteFill}
        onContextCreate={onContextCreate as (gl: ExpoGLContext) => void}
      />

      {/* ---------------- HUD ---------------- */}
      {playing && (
        <View
          pointerEvents="box-none"
          style={[styles.hudLayer, { paddingTop: insets.top + 10, paddingHorizontal: insets.left + 18 }]}
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
                            i < hud.hearts ? hex(PALETTE.heart) : "rgba(255,255,255,0.14)",
                        },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.divider} />
                <Text variant="heading" size="md" color="#FFFFFF" style={styles.essence}>
                  {hud.score.toLocaleString()}
                </Text>
                {hud.combo > 1 && (
                  <Text variant="body" size="sm" color={hex(PALETTE.gold)} style={styles.combo}>
                    {hud.combo.toFixed(1)}×
                  </Text>
                )}
              </View>
            </Glass>

            {/* Sigils + map */}
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
                            i < hud.bossesDefeated ? hex(PALETTE.gold) : "rgba(255,255,255,0.14)",
                        },
                      ]}
                    />
                  ))}
                </View>
              </Glass>

              <Pressable onPress={() => setMapOpen(true)} hitSlop={10}>
                <Glass style={styles.iconButton} radius={17}>
                  <View style={styles.iconInner}>
                    <View style={styles.mapGlyphRow}>
                      <View style={styles.mapGlyphCell} />
                      <View style={[styles.mapGlyphCell, styles.mapGlyphCellDim]} />
                    </View>
                    <View style={styles.mapGlyphRow}>
                      <View style={[styles.mapGlyphCell, styles.mapGlyphCellDim]} />
                      <View style={styles.mapGlyphCell} />
                    </View>
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
      {playing && hud.roomTitle > 0 && (
        <View pointerEvents="none" style={[styles.roomCard, { top: insets.top + 84 }]}>
          <Text variant="heading" size="lg" color="#FFFFFF" style={styles.roomName}>
            {hud.roomName}
          </Text>
          <View style={styles.roomRule} />
        </View>
      )}

      {/* ---------------- Boss bar ---------------- */}
      {playing && hud.bossActive && (
        <View pointerEvents="none" style={[styles.bossWrap, { bottom: insets.bottom + 20 }]}>
          <Text variant="heading" size="md" color="#FFFFFF" style={styles.bossName}>
            {hud.bossName}
          </Text>
          {!!hud.bossTitle && (
            <Text variant="body" size="sm" color="rgba(255,255,255,0.5)" style={styles.bossTitle}>
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
      {playing && hud.atBench && (
        <View pointerEvents="none" style={[styles.benchWrap, { bottom: insets.bottom + 118 }]}>
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
      {playing && hud.sealed && (
        <View style={[styles.sealedWrap, { bottom: insets.bottom + 118 }]} pointerEvents="box-none">
          <Glass style={styles.sealedCard} radius={20}>
            <View style={styles.sealedInner}>
              <Text variant="label" size="sm" color={hex(PALETTE.gold)}>
                {hud.sealed.label}
              </Text>
              {hud.sealed.pro && (
                <Pressable onPress={() => router.push("/(subscribe)")} style={styles.sealedCta}>
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
      {playing && !mapOpen && (
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
                    { left: stickOrigin.x + stickKnob.x - 27, top: stickOrigin.y + stickKnob.y - 27 },
                  ]}
                />
              </>
            )}
          </View>

          <View
            style={[styles.actions, { right: insets.right + 26, bottom: insets.bottom + 30 }]}
            pointerEvents="box-none"
          >
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

      {/* ---------------- Overlays ---------------- */}
      {!ready && (
        <View style={styles.overlay}>
          <ActivityIndicator color={hex(PALETTE.arcane)} size="large" />
        </View>
      )}

      {ready && hud.phase === "ready" && (
        <Overlay
          title="Spell Storm"
          subtitle="Twenty rooms. Seven sigils. Drag to move and aim, cast to fight, rest at a bench to save."
          primaryLabel={
            (progressRef.current?.bosses.length ?? 0) > 0 || (progressRef.current?.discovered.length ?? 0) > 1
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
      {mapOpen && (
        <View style={styles.mapOverlay}>
          <BlurView intensity={44} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,4,18,0.62)" }]} />
          <View style={[styles.mapHeader, { paddingTop: insets.top + 16, paddingHorizontal: insets.left + 24 }]}>
            <View>
              <Text variant="heading" size="lg" color="#FFFFFF">
                Hollowroot
              </Text>
              <Text variant="body" size="sm" color="rgba(255,255,255,0.5)">
                {hud.discovered.length} of {ROOM_IDS.length} rooms · {hud.bossesDefeated} of{" "}
                {hud.totalBosses} sigils
              </Text>
            </View>
            <Pressable onPress={() => setMapOpen(false)} hitSlop={14}>
              <Glass style={styles.iconButton} radius={17}>
                <View style={styles.iconInner}>
                  <View style={styles.closeBarA} />
                  <View style={styles.closeBarB} />
                </View>
              </Glass>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={styles.mapScroll}
            showsHorizontalScrollIndicator={false}
          >
            <WorldMap hud={hud} />
          </ScrollView>
        </View>
      )}
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

const CELL = 78;
const GAP = 26;

function WorldMap({ hud }: { hud: HudSnapshot }) {
  const width = MAP_EXTENT.cols * CELL + (MAP_EXTENT.cols - 1) * GAP;
  const height = MAP_EXTENT.rows * CELL + (MAP_EXTENT.rows - 1) * GAP;

  const connectors = useMemo(() => {
    const out: { key: string; left: number; top: number; w: number; h: number }[] = [];
    const seen = new Set<string>();
    for (const id of ROOM_IDS) {
      const room = ROOMS[id];
      for (const gate of room.gates) {
        const other = ROOMS[gate.to];
        if (!other) continue;
        const key = [id, gate.to].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        if (!hud.discovered.includes(id) || !hud.discovered.includes(gate.to)) continue;

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
          });
        } else if (room.map.col === other.map.col) {
          out.push({
            key,
            left: ax + CELL / 2 - 2,
            top: Math.min(ay, by) + CELL,
            w: 4,
            h: Math.abs(by - ay) - CELL,
          });
        }
      }
    }
    return out;
  }, [hud.discovered]);

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
            backgroundColor: "rgba(255,255,255,0.18)",
            borderRadius: 2,
          }}
        />
      ))}

      {ROOM_IDS.map((id) => {
        const room = ROOMS[id];
        const found = hud.discovered.includes(id);
        const here = hud.roomId === id;
        const cleared = hud.defeatedRooms.includes(id);
        const tint = BIOMES[room.biome].mapTint;

        return (
          <View
            key={id}
            style={{
              position: "absolute",
              left: room.map.col * (CELL + GAP),
              top: room.map.row * (CELL + GAP),
              width: CELL,
              height: CELL,
              borderRadius: 18,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              padding: 6,
              backgroundColor: found ? `${tint}22` : "rgba(255,255,255,0.04)",
              borderWidth: here ? 2 : 1,
              borderColor: here ? "#FFFFFF" : found ? `${tint}66` : "rgba(255,255,255,0.08)",
            }}
          >
            {found ? (
              <>
                {!!room.boss && (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      borderCurve: "continuous",
                      marginBottom: 5,
                      transform: [{ rotate: "45deg" }],
                      backgroundColor: cleared ? hex(PALETTE.gold) : hex(PALETTE.heart),
                    }}
                  />
                )}
                <Text
                  variant="label"
                  size="xs"
                  color={here ? "#FFFFFF" : "rgba(255,255,255,0.66)"}
                  numberOfLines={2}
                  style={styles.mapLabel}
                >
                  {room.name}
                </Text>
                {!!room.bench && (
                  <View
                    style={{
                      marginTop: 4,
                      width: 14,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: hex(PALETTE.gold),
                    }}
                  />
                )}
              </>
            ) : (
              <Text variant="body" size="md" color="rgba(255,255,255,0.18)">
                ?
              </Text>
            )}
          </View>
        );
      })}
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
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,5,24,0.6)" }]} />
      <View style={styles.panel}>
        <Text variant="display" size="display" color="#FFFFFF" style={styles.overlayTitle}>
          {title}
        </Text>
        <Text variant="body" size="md" color="rgba(255,255,255,0.72)" style={styles.overlayBody}>
          {subtitle}
        </Text>
        {stats && (
          <Text variant="label" size="sm" color={hex(PALETTE.gold)} style={styles.overlayStats}>
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
  hudRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
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
  sigilInner: { flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 11 },
  sigil: { width: 7, height: 7, borderRadius: 2, borderCurve: "continuous", transform: [{ rotate: "45deg" }] },

  iconButton: { width: 40, height: 40 },
  iconInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
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

  bossWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 40 },
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

  stickZone: { position: "absolute", left: 0, bottom: 0, top: "34%", width: "46%" },
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

  actions: { position: "absolute", flexDirection: "row", alignItems: "flex-end", gap: 16 },
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
  },
  mapScroll: { paddingHorizontal: 32, paddingVertical: 16, alignItems: "center" },
  mapLabel: { textAlign: "center", lineHeight: 12 },
});
