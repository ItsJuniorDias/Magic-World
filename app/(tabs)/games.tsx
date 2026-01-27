import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/theme";
import Text from "@/components/text";
import { StatusBar } from "expo-status-bar";

const games = [
  {
    id: "quiz",
    title: "Quiz Challenge",
    emoji: "❓",
    route: "/(quiz)",
    description: "Test your knowledge with quick and fun questions!",
  },
  {
    id: "memory",
    title: "Memory Challenge",
    emoji: "🧠",
    route: "/(memory-game)",
    description: "Match the pairs and train your memory in a fun way!",
  },
  {
    id: "endless-runner",
    title: "Endless Runner",
    emoji: "🏃‍♂️",
    route: "/(endless-runner)",
    description: "Run as far as you can and avoid obstacles!",
  },
];

export default function GamesHub() {
  const router = useRouter();

  return (
    <>
      <StatusBar animated style="light" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text
          fontFamily="bold"
          fontSize={32}
          color={Colors.dark.text}
          title="🎮 Premium Games"
          style={{ marginBottom: 32 }}
        />

        {games.map((game) => (
          <TouchableOpacity
            key={game.id}
            style={styles.card}
            onPress={() => router.push(game.route)}
            activeOpacity={0.85}
          >
            {/* Emoji */}
            <Text
              fontFamily="bold"
              fontSize={42}
              color={Colors.light.text}
              title={game.emoji}
            />
            {/* Info */}
            <View style={styles.info}>
              <Text
                fontFamily="bold"
                fontSize={20}
                color={Colors.light.text}
                title={game.title}
                style={{ marginBottom: 6 }}
              />
              <Text
                fontFamily="regular"
                fontSize={16}
                color={Colors.light.text}
                title={game.description}
              />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF", // branco clean
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 28, // cantos arredondados
    marginBottom: 24, // espaço generoso entre cards
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, // sombra suave
    shadowRadius: 12,
    elevation: 4,
  },
  info: {
    flex: 1,
    marginLeft: 20,
  },
});
