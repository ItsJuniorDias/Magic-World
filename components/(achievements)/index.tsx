import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Animated,
  Pressable,
  Dimensions,
} from "react-native";
import Text from "../text";

const { width } = Dimensions.get("window");

export function AchievementModal({
  achievement,
  onClose,
}: {
  achievement: {
    id: number;
    title: string;
    description?: string;
    icon?: string;
    correctCount?: number;
    totalQuestions?: number;
    [key: string]: any; // para aceitar campos extras
  };
  onClose: () => void;
}) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ================= PERFORMANCE DYNAMICS =================
  const correctCount = achievement?.correctCount ?? 0;
  const totalQuestions = achievement?.totalQuestions ?? 1;
  const percent = (correctCount / totalQuestions) * 100;

  let icon = achievement?.icon || "😢";
  let mainTitle = achievement?.title || "New Achievement!";
  let description = achievement?.description || "";

  if (percent === 100) {
    icon = "🏆";
    mainTitle = achievement?.title || "Perfect Score!";
    description =
      achievement?.description ||
      `You answered all ${totalQuestions} correctly! Amazing!`;
  } else if (percent >= 80) {
    icon = achievement?.icon || "🎉";
    mainTitle = achievement?.title || "Great Job!";
    description =
      achievement?.description ||
      `You got ${correctCount} out of ${totalQuestions} right!`;
  } else if (percent >= 50) {
    icon = achievement?.icon || "🙂";
    mainTitle = achievement?.title || "Not Bad!";
    description =
      achievement?.description ||
      `You answered ${correctCount} out of ${totalQuestions} correctly. Keep practicing!`;
  } else {
    icon = achievement?.icon || "😢";
    mainTitle = achievement?.title || "Better Luck Next Time!";
    description =
      achievement?.description ||
      `You answered ${correctCount} out of ${totalQuestions} correctly. Try again!`;
  }

  // ================= RENDER EXTRA FIELDS =================
  const extraFields = Object.entries(achievement).filter(
    ([key]) =>
      ![
        "id",
        "title",
        "description",
        "icon",
        "correctCount",
        "totalQuestions",
      ].includes(key),
  );

  return (
    <View style={styles.modalOverlay}>
      <Animated.View
        style={[
          styles.modalCard,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Ícone com leve glow */}
        <View style={styles.iconContainer}>
          <Text fontSize={64} title={icon} />
        </View>

        <Text
          fontFamily="bold"
          fontSize={24}
          color="#FFF"
          title={mainTitle}
          style={styles.mainTitle}
        />

        {!extraFields.length ? (
          <Text
            fontFamily="regular"
            fontSize={16}
            color="#D1D1D6"
            title={description}
            style={styles.subTitle}
          />
        ) : null}

        {/* Renderizando campos extras dinamicamente */}
        {extraFields.map(([key, value]) => (
          <Text
            key={key}
            fontSize={14}
            fontFamily="regular"
            color="#D1D1D6"
            title={`${key}: ${value}`}
            style={{ marginBottom: 6 }}
          />
        ))}

        <Pressable
          style={({ pressed }) => [
            styles.modalButton,
            {
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
          onPress={onClose}
        >
          <Text fontFamily="bold" fontSize={20} color="#000" title="Awesome" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modalCard: {
    width: width * 0.82,
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },

  iconContainer: {
    marginBottom: 24,
    shadowColor: "#FFF",
    shadowOpacity: 0.15,
    shadowRadius: 18,
  },

  mainTitle: {
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
  },

  subTitle: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    color: "#D1D1D6",
  },

  modalButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
