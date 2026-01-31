import React from "react";
import { Modal, View, StyleSheet, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { Colors } from "@/constants/theme";
import Text from "@/components/text";
import { FontAwesome6 } from "@expo/vector-icons";
import { GlassView } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";

import {
  AdventureProfileType,
  useAdventureProfileStore,
} from "@/store/useAdventureProfileStore";

interface Choice {
  title: string;
  targetIndex: number;
  profile?: AdventureProfileType;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  choices?: Choice[] | null;
  onChoiceSelected?: (choice: Choice) => void;
}

export const ChapterCompletedModal = ({
  visible,
  onClose,
  choices,
  onChoiceSelected,
}: Props) => {
  const addPoint = useAdventureProfileStore((s) => s.addPoint);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView intensity={30} tint="dark" style={styles.container}>
        <View style={styles.card}>
          {/* Icon Header */}
          <View style={styles.headerIcon}>
            <FontAwesome6
              name={choices ? "wand-magic-sparkles" : "star"}
              size={32}
              color={choices ? "#A855F7" : "#FACC15"}
            />
          </View>

          <Text
            fontFamily="bold"
            fontSize={24}
            color="#FFF"
            title={choices ? "The Choice is Yours" : "Story Completed"}
            style={styles.mainTitle}
          />

          <Text
            fontFamily="regular"
            fontSize={16}
            color="rgba(255,255,255,0.6)"
            title={
              choices
                ? "Your journey has reached a pivotal moment. Which path will you take?"
                : "You’ve turned the final page of this chapter. Ready for the next adventure?"
            }
            style={styles.subtitle}
          />

          <View style={styles.buttonContainer}>
            {choices ? (
              // AI CHOICES (Apple List Style)
              choices.map((choice, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    if (choice.profile) {
                      addPoint(choice.profile); // 👈 AQUI A MÁGICA
                    }

                    onChoiceSelected?.(choice);
                  }}
                  style={({ pressed }) => [
                    styles.choiceButton,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <GlassView style={styles.glassChoice} intensity={20}>
                    <Text
                      fontFamily="regular"
                      fontSize={16}
                      color="#FFF"
                      title={choice.title}
                    />
                    <FontAwesome6
                      name="chevron-right"
                      size={12}
                      color="rgba(255,255,255,0.3)"
                    />
                  </GlassView>
                </Pressable>
              ))
            ) : (
              // PRIMARY CTA
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.mainButton,
                  { transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <LinearGradient
                  colors={["#FFF", "#F1F5F9"]}
                  style={styles.gradientButton}
                >
                  <Text
                    fontFamily="bold"
                    fontSize={18}
                    color="#000"
                    title="Continue"
                  />
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(28, 28, 30, 0.8)", // Dark Secondary System Background
    borderRadius: 36,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
  },
  headerIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  mainTitle: {
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 10,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    width: "100%",
    marginTop: 30,
    gap: 12,
  },
  choiceButton: {
    width: "100%",
  },
  glassChoice: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 22,
    width: "100%",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  mainButton: {
    width: "100%",
    height: 62,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  gradientButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
