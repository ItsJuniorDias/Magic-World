import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
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
    const result = calculateProfile();

    setProfileType(result);
  }, []);

  if (!profileType) return null;

  const content = PROFILE_CONTENT[profileType];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        <Text
          title="Your Adventure Profile"
          fontFamily="regular"
          fontSize={18}
          color="rgba(255,255,255,0.6)"
        />

        {content.icon}

        <Text
          title={content.title}
          fontFamily="bold"
          fontSize={32}
          color="#FFF"
          style={{ letterSpacing: -0.5 }}
        />

        <Text
          title={content.description}
          fontFamily="regular"
          fontSize={16}
          color="rgba(255,255,255,0.8)"
        />
      </View>

      <Pressable
        style={styles.button}
        onPress={() => router.replace("/(tabs)")}
      >
        <Text
          title="Begin Your Adventure"
          fontFamily="bold"
          fontSize={16}
          color="#000"
        />
      </Pressable>
    </View>
  );
}

const PROFILE_CONTENT = {
  brave: {
    title: "Brave Adventurer",
    description:
      "You face challenges head-on and never back down from the unknown.",
    icon: <Text fontSize={64} title="🛡️" />,
  },
  clever: {
    title: "Clever Explorer",
    description: "You solve problems with wit, strategy, and a sharp mind.",
    icon: <Text fontSize={64} title="💡" />,
  },
  wild: {
    title: "Wild Spirit",
    description: "You follow your instincts and embrace unpredictable paths.",
    icon: <Text fontSize={64} title="🪶" />,
  },
  wise: {
    title: "Wise Guardian",
    description: "You observe, reflect, and choose carefully before acting.",
    icon: <Text fontSize={64} title="📖" />,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: "space-between",
    padding: 24,
  },
  content: {
    marginTop: 120,
    gap: 16,
    alignItems: "center",
  },
  button: {
    backgroundColor: "#FFF",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 24,
  },
});
