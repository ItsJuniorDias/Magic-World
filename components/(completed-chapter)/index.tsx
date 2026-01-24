import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Animated,
  Pressable,
  Dimensions,
} from "react-native";
import { GlassView } from "expo-glass-effect";
import Text from "../text";
import { Colors } from "@/constants/theme";
import { saveStoryProgress } from "@/services/saveStoryProgress";
import { getUserKey } from "@/services/getUserKey";

const { width } = Dimensions.get("window");

export function ChapterCompletedModal({
  visible,
  onClose,
  storyId,
  chapterIndex,
  currentPage = 0,
}: {
  visible: boolean;
  onClose: () => void;
  storyId: string;
  chapterIndex: number;
  currentPage?: number;
}) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // ==== Animation ====
  useEffect(() => {
    if (visible) {
      scale.setValue(0.9);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 10,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleContinue = async () => {
    // Salvar progresso no Firestore usando userKey
    const userKey = await getUserKey();
    await saveStoryProgress(userKey, storyId, chapterIndex, currentPage);

    // Fechar modal
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[styles.modalContainer, { opacity, transform: [{ scale }] }]}
      >
        <GlassView intensity={90} style={styles.glassCard}>
          <View style={styles.iconContainer}>
            <Text title="✨" fontSize={56} />
          </View>

          <Text
            fontFamily="bold"
            fontSize={24}
            color={Colors.light.text}
            title="Great Reading!"
            style={styles.title}
          />

          <Text
            fontSize={16}
            color={Colors.light.text}
            fontFamily="regular"
            title={`You've successfully finished chapter ${chapterIndex + 1}. Your progress has been saved!`}
            style={styles.description}
          />

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: pressed ? "rgba(255,255,255,0.8)" : "#FFF" },
            ]}
            onPress={handleContinue}
          >
            <Text
              fontFamily="bold"
              fontSize={18}
              color={Colors.light.text}
              title="Continue Journey"
            />
          </Pressable>
        </GlassView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modalContainer: {
    width: width * 0.86,
    borderRadius: 38,
    overflow: "hidden",
  },
  glassCard: {
    padding: 32,
    alignItems: "center",
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    color: Colors.dark.background,
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    textAlign: "center",
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  button: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});
