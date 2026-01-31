import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { useAdventureProfileStore } from "@/store/useAdventureProfileStore";

export default function AdventureProfileResult() {
  const router = useRouter();

  const calculateProfile = useAdventureProfileStore(
    (state) => state.calculateProfile,
  );

  const loadProfile = useAdventureProfileStore((state) => state.loadProfile);

  const [profileType, setProfileType] = useState<
    "brave" | "clever" | "wild" | "wise" | null
  >(null);

  useEffect(() => {
    loadProfile(); // carrega do Firebase ao iniciar
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      const result = await calculateProfile();
      console.log(result, "RESULT");
      setProfileType(result);
    };

    fetchProfile();
  }, [calculateProfile]);

  if (!profileType) return null;

  const content = PROFILE_CONTENT[profileType];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text
            title="Your Adventure Profile"
            fontFamily="regular"
            fontSize={18}
            color="rgba(255,255,255,0.6)"
          />

          {content?.icon}

          <Text
            title={content?.title}
            fontFamily="bold"
            fontSize={32}
            color="#FFF"
            style={{ letterSpacing: -0.5 }}
          />

          <Text
            title={content?.description}
            fontFamily="regular"
            fontSize={16}
            color="rgba(255,255,255,0.8)"
            style={{ textAlign: "center" }}
          />

          {/* NOVO CONTEÚDO */}
          {content?.extra?.map((item, index) => (
            <View key={index} style={styles.extraBlock}>
              <Text
                title={item.title}
                fontFamily="bold"
                fontSize={20}
                color="#FFF"
              />
              <Text
                title={item.description}
                fontFamily="regular"
                fontSize={16}
                color="rgba(255,255,255,0.8)"
              />
            </View>
          ))}
        </View>

        <Pressable
          style={styles.button}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text
            title="Begin Your Adventure"
            fontFamily="bold"
            fontSize={18}
            color="#000"
          />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const PROFILE_CONTENT = {
  brave: {
    title: "Brave Adventurer",
    description:
      "You face challenges head-on and never back down from the unknown.",
    icon: <Text fontSize={64} title="🛡️" />,
    extra: [
      {
        title: "💪 Strengths",
        description:
          "Courage, boldness, decisiveness. You inspire others by action.",
      },
      {
        title: "⚔️ Challenges",
        description:
          "Sometimes you rush into danger without a plan. Patience is key.",
      },
      {
        title: "🌟 Advice",
        description:
          "Trust your instincts, but also observe your surroundings carefully.",
      },
    ],
  },
  clever: {
    title: "Clever Explorer",
    description: "You solve problems with wit, strategy, and a sharp mind.",
    icon: <Text fontSize={64} title="💡" />,
    extra: [
      {
        title: "🧩 Strengths",
        description: "Problem-solving, strategy, adaptability.",
      },
      {
        title: "⚖️ Challenges",
        description:
          "Overthinking can slow down decisions. Balance analysis with action.",
      },
      {
        title: "🌟 Advice",
        description:
          "Use your intellect to guide the journey, but remember to enjoy it.",
      },
    ],
  },
  wild: {
    title: "Wild Spirit",
    description: "You follow your instincts and embrace unpredictable paths.",
    icon: <Text fontSize={64} title="🪶" />,
    extra: [
      {
        title: "🌪️ Strengths",
        description: "Flexibility, spontaneity, creative problem-solving.",
      },
      {
        title: "⚠️ Challenges",
        description: "Impulsiveness can bring unexpected consequences.",
      },
      {
        title: "🌟 Advice",
        description: "Trust your gut, but occasionally pause to plan ahead.",
      },
    ],
  },
  wise: {
    title: "Wise Guardian",
    description: "You observe, reflect, and choose carefully before acting.",
    icon: <Text fontSize={64} title="📖" />,
    extra: [
      {
        title: "🦉 Strengths",
        description: "Patience, foresight, thoughtful decision-making.",
      },
      {
        title: "⚖️ Challenges",
        description: "Sometimes indecision or over-caution can slow progress.",
      },
      {
        title: "🌟 Advice",
        description:
          "Combine wisdom with action, and mentor others along the way.",
      },
    ],
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  content: {
    marginTop: 80,
    gap: 16,
    alignItems: "center",
  },
  extraBlock: {
    marginTop: 16,
    paddingHorizontal: 8,
    gap: 4,
    alignItems: "center",
  },
  button: {
    backgroundColor: "#FFF",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 24,
    marginTop: 24,
  },
});
