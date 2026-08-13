import React, { useEffect } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useThemedTokens } from "@/hooks/use-tokens";
import { tokens } from "@/constants/tokens";
import { useT } from "@/i18n";
import { track } from "@/services/analytics";

type Game = {
  id: string;
  /** Chave i18n do título dentro de `games.items` — ex.: "spellStorm" */
  i18nKey: "spellStorm" | "spaceRunner" | "quizMaster" | "memoryMatch" | "knightQuest";
  emoji: string;
  accent: string;
  route: string;
  /** Featured entries get a taller card and a badge. */
  featured?: boolean;
  /** Chave i18n do badge dentro de `games.badges` — ex.: "new" */
  badgeKey?: "new" | "hot";
};

// Meta estática dos jogos. Texto puro (título, descrição, badge)
// vem de i18n via `useT()` — não é hardcoded aqui.
const GAMES_META: Game[] = [
  {
    id: "knight-quest",
    i18nKey: "knightQuest",
    emoji: "⚔️",
    accent: tokens.palette.amber500,
    route: "/(knight-quest)",
    featured: true,
    badgeKey: "new",
  },
  {
    id: "spell-storm",
    i18nKey: "spellStorm",
    emoji: "🪄",
    accent: tokens.palette.blue500,
    route: "/(spell-storm)",
    featured: true,
    badgeKey: "new",
  },
  {
    id: "endless-runner",
    i18nKey: "spaceRunner",
    emoji: "🚀",
    accent: tokens.palette.amber500,
    route: "/(endless-runner)",
    featured: true,
    badgeKey: "hot",
  },
  {
    id: "quiz",
    i18nKey: "quizMaster",
    emoji: "❓",
    accent: tokens.palette.green500,
    route: "/(quiz)",
  },
  {
    id: "memory-game",
    i18nKey: "memoryMatch",
    emoji: "🧠",
    accent: tokens.palette.blue500,
    route: "/(memory-game)",
  },
];

export default function GamesHub() {
  const router = useRouter();
  const t = useThemedTokens();
  const { t: tr } = useT();
  const isDark = t.scheme === "dark";

  // Analytics: fire once per mount. React Native's NativeTabs re-mounts
  // the tab content on switch so this doubles as a "tab switched to
  // games" signal for retention analysis.
  useEffect(() => {
    track("games_hub_view");
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[styles.mainContainer, { backgroundColor: t.color.bg }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: t.spacing.xxxl + 16,
              paddingHorizontal: t.spacing.md,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
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
              {tr("games.title")}
            </Text>
            <Text
              variant="body"
              size="md"
              color={t.color.textSecondary}
              style={{ marginTop: t.spacing.xxs }}
            >
              {tr("games.subtitle")}
            </Text>
          </View>

          {GAMES_META.map((game) => (
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
                game.featured && {
                  borderWidth: 1.5,
                  borderColor: withAlpha(game.accent, 0.45),
                },
              ]}
              onPress={() => {
                track("game_open", {
                  game_id: game.id,
                  featured: !!game.featured,
                });
                router.push(game.route as any);
              }}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    width: game.featured ? 64 : 56,
                    height: game.featured ? 64 : 56,
                    borderRadius: t.radius.md,
                    marginRight: t.spacing.md,
                    backgroundColor: withAlpha(
                      game.accent,
                      isDark ? 0.19 : 0.13,
                    ),
                  },
                ]}
              >
                <Text variant="heading" size="display">
                  {game.emoji}
                </Text>
              </View>

              <View style={styles.info}>
                <View style={styles.titleRow}>
                  <Text
                    variant="heading"
                    size="lg"
                    color={t.color.textPrimary}
                    style={{ marginBottom: 2 }}
                  >
                    {tr(`games.items.${game.i18nKey}.title`)}
                  </Text>
                  {game.badgeKey && (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: withAlpha(game.accent, 0.18) },
                      ]}
                    >
                      <Text variant="body" size="xs" color={game.accent}>
                        {tr(`games.badges.${game.badgeKey}`)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  variant="body"
                  size="sm"
                  color={t.color.textSecondary}
                  numberOfLines={2}
                  style={{ lineHeight: 20 }}
                >
                  {tr(`games.items.${game.i18nKey}.description`)}
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 2,
  },
});
