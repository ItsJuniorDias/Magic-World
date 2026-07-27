import React from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useThemedTokens } from "@/hooks/use-tokens";
import { tokens } from "@/constants/tokens";

type Game = {
  id: string;
  title: string;
  emoji: string;
  accent: string; // cor de acento — puxada da palette pra manter identidade
  route: string;
  description: string;
};

const GAMES: Game[] = [
  {
    id: "endless-runner",
    title: "Space Runner",
    emoji: "🚀",
    accent: tokens.palette.amber500,
    route: "/(endless-runner)",
    description: "Navigate through asteroids.",
  },
  {
    id: "quiz",
    title: "Quiz Master",
    emoji: "❓",
    accent: tokens.palette.green500,
    route: "/(quiz)",
    description: "Test your knowledge.",
  },
  {
    id: "memory-game",
    title: "Memory Match",
    emoji: "🧠",
    accent: tokens.palette.blue500,
    route: "/(memory-game)",
    description: "Train your brain.",
  },
  {
    id: "platformer-adventure",
    title: "Knight's Quest",
    emoji: "🗡️",
    accent: tokens.palette.purple500,
    route: "/(platformer-adventure)",
    description: "Magical platforming adventure.",
  },
];

export default function GamesHub() {
  const router = useRouter();
  const t = useThemedTokens();
  const isDark = t.scheme === "dark";

  const handleGamePress = (game: Game) => {
    if (game.id === "platformer-adventure") {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
      ).catch(() => {});
    }
    router.push(game.route as any);
  };

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[styles.mainContainer, { backgroundColor: t.color.bg }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: t.spacing.xxxl + 16, paddingHorizontal: t.spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View
            style={[
              styles.headerContainer,
              { marginBottom: t.spacing.lg, paddingHorizontal: t.spacing.xxs },
            ]}
          >
            <Text
              variant="display"
              size="display"
              color={t.color.textPrimary}
              style={{ letterSpacing: t.typography.letterSpacing.tight }}
            >
              Arcade
            </Text>
            <Text
              variant="body"
              size="md"
              color={t.color.textSecondary}
              style={{ marginTop: t.spacing.xxs }}
            >
              Premium Games Collection
            </Text>
          </View>

          {GAMES.map((game) => (
            <TouchableOpacity
              key={game.id}
              style={[
                styles.card,
                {
                  backgroundColor: t.color.surface,
                  borderRadius: t.radius.lg,
                  marginBottom: t.spacing.md,
                  padding: t.spacing.md,
                  ...(isDark ? {} : t.shadow.sm),
                },
              ]}
              onPress={() => handleGamePress(game)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    width: 56,
                    height: 56,
                    borderRadius: t.radius.md,
                    marginRight: t.spacing.md,
                    backgroundColor: withAlpha(game.accent, isDark ? 0.19 : 0.13),
                  },
                ]}
              >
                <Text variant="heading" size="display">
                  {game.emoji}
                </Text>
              </View>

              <View style={styles.info}>
                <Text
                  variant="heading"
                  size="lg"
                  color={t.color.textPrimary}
                  style={{ marginBottom: 2 }}
                >
                  {game.title}
                </Text>
                <Text
                  variant="body"
                  size="sm"
                  color={t.color.textSecondary}
                  numberOfLines={2}
                  style={{ lineHeight: 20 }}
                >
                  {game.description}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={t.color.textMuted}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  );
}

function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  headerContainer: {},
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderCurve: "continuous",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
});
