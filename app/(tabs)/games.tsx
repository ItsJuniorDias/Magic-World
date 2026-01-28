import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme, // 1. Import hook
} from "react-native";
import { useRouter } from "expo-router";
// import { Colors } from "@/constants/theme"; // Optional: You can remove this if relying on local theme logic below
import Text from "@/components/text";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

const games = [
  {
    id: "endless-runner",
    title: "Space Runner",
    emoji: "🚀",
    color: "#FF9F0A",
    route: "/(endless-runner)",
    description: "Navigate through asteroids.",
  },
  {
    id: "quiz",
    title: "Quiz Master",
    emoji: "❓",
    color: "#30D158",
    route: "/(quiz)",
    description: "Test your knowledge.",
  },
  {
    id: "memory-game",
    title: "Memory Match",
    emoji: "🧠",
    color: "#0A84FF",
    route: "/(memory-game)",
    description: "Train your brain.",
  },
  {
    id: "platformer-adventure",
    title: "Knight's Quest",
    emoji: "🗡️",
    color: "#BF5AF2",
    route: "/(platformer-adventure)",
    description: "Magical platforming adventure.",
  },
];

export default function GamesHub() {
  const router = useRouter();
  const colorScheme = useColorScheme(); // 2. Detect System Theme
  const isDark = colorScheme === "dark";

  // 3. Define Dynamic Colors
  const theme = {
    background: isDark ? "#000000" : "#F2F2F7", // Pure Black vs Grouped Gray
    card: isDark ? "#1C1C1E" : "#FFFFFF", // Dark Gray vs White
    textPrimary: isDark ? "#FFFFFF" : "#000000",
    textSecondary: "#8E8E93", // System Gray works on both
    iconBgOpacity: isDark ? "30" : "20", // Slightly stronger opacity on dark
    chevron: isDark ? "#545458" : "#C7C7CC",
  };

  const handleGamePress = (game) => {
    if (game.id === "platformer-adventure") {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
      ).then(() => {
        console.log("Screen locked to landscape left");
      });
    }
    router.push(game.route);
  };

  return (
    <>
      {/* 4. Update Status Bar */}
      <StatusBar style={isDark ? "light" : "dark"} />

      <View
        style={[styles.mainContainer, { backgroundColor: theme.background }]}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text
              fontFamily="bold"
              fontSize={34}
              color={theme.textPrimary}
              title="Arcade"
              style={{ letterSpacing: -0.5 }}
            />
            <Text
              fontFamily="regular"
              fontSize={17}
              color={theme.textSecondary}
              title="Premium Games Collection"
              style={{ marginTop: 4 }}
            />
          </View>

          {games.map((game) => (
            <TouchableOpacity
              key={game.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.card,
                  // Hide shadow in dark mode (iOS style preference)
                  shadowOpacity: isDark ? 0 : 0.05,
                },
              ]}
              onPress={() => handleGamePress(game)}
              activeOpacity={0.7}
            >
              {/* Icon Container */}
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: game.color + theme.iconBgOpacity },
                ]}
              >
                <Text fontFamily="bold" fontSize={32} title={game.emoji} />
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text
                  fontFamily="bold"
                  fontSize={17}
                  color={theme.textPrimary}
                  title={game.title}
                  style={{ marginBottom: 2 }}
                />
                <Text
                  fontFamily="regular"
                  fontSize={15}
                  color={theme.textSecondary}
                  title={game.description}
                  numberOfLines={2}
                  style={{ lineHeight: 20 }}
                />
              </View>

              {/* Chevron */}
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.chevron}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    // Background color is now handled inline via theme object
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 80,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },

    shadowRadius: 8,
    elevation: 2,
    borderCurve: "continuous",
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderCurve: "continuous",
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
});
