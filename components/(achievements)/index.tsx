import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Animated,
  Pressable,
  Dimensions,
} from "react-native";
import Text from "../text";
import { useT } from "@/i18n";

const { width } = Dimensions.get("window");

export function AchievementModal({
  achievement,
  onClose,
}: {
  achievement: {
    id: number;
    title: string;
    subtitle?: string;
    description?: string;
    icon?: string;
    correctCount?: number;
    totalQuestions?: number;
    [key: string]: any;
  };
  onClose: () => void;
}) {
  const { t: tr } = useT();
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
  // Quiz results override the achievement title/description dynamically
  // based on % correct. Templates come from i18n (`quiz.*Title/Description`).
  // If the parent passed explicit `title`/`description`, honor those and
  // skip the templated version — used for real achievements from profile.
  const correctCount = achievement?.correctCount ?? 0;
  const totalQuestions = achievement?.totalQuestions ?? 1;
  const isQuizResult = achievement?.correctCount !== undefined;
  const percent = (correctCount / totalQuestions) * 100;

  let icon = achievement?.icon || "😢";
  let mainTitle = achievement?.title || "";
  let subtitle = achievement?.subtitle || "";
  let description = achievement?.description || "";

  if (isQuizResult) {
    if (percent === 100) {
      icon = achievement?.icon || "🏆";
      mainTitle = achievement?.title || tr("quiz.perfectTitle");
      description =
        achievement?.description ||
        tr("quiz.perfectScore", { total: totalQuestions });
    } else if (percent >= 80) {
      icon = achievement?.icon || "🎉";
      mainTitle = achievement?.title || tr("quiz.greatTitle");
      description =
        achievement?.description ||
        tr("quiz.greatDescription", {
          correct: correctCount,
          total: totalQuestions,
        });
    } else if (percent >= 50) {
      icon = achievement?.icon || "🙂";
      mainTitle = achievement?.title || tr("quiz.notBadTitle");
      description =
        achievement?.description ||
        tr("quiz.notBadDescription", {
          correct: correctCount,
          total: totalQuestions,
        });
    } else {
      icon = achievement?.icon || "😢";
      mainTitle = achievement?.title || tr("quiz.betterLuckTitle");
      description =
        achievement?.description ||
        tr("quiz.betterLuckDescription", {
          correct: correctCount,
          total: totalQuestions,
        });
    }
  }

  // ================= EXTRA FIELDS =================
  const extraFields = Object.entries(achievement).filter(
    ([key]) =>
      ![
        "id",
        "title",
        "subtitle",
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
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text fontSize={64} title={icon} />
        </View>

        {/* Title */}
        <Text
          fontFamily="bold"
          fontSize={24}
          color="#FFF"
          title={mainTitle}
          style={styles.mainTitle}
        />

        {/* Subtitle */}
        {!!subtitle && (
          <Text
            fontFamily="regular"
            fontSize={16}
            color="#A1A1AA"
            title={subtitle}
            style={styles.subtitle}
          />
        )}

        {/* Description */}
        {!!description && !extraFields.length && (
          <Text
            fontFamily="regular"
            fontSize={16}
            color="#D1D1D6"
            title={description}
            style={styles.subTitle}
          />
        )}

        {/* Extra fields (dynamic) */}
        {extraFields.map(([key, value]) => (
          <Text
            key={key}
            fontSize={14}
            fontFamily="regular"
            color="#D1D1D6"
            title={`${value}`}
            style={{ marginBottom: 6 }}
          />
        ))}

        {/* Button */}
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
          <Text
            fontFamily="bold"
            fontSize={20}
            color="#000"
            title={tr("common.awesome")}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ================= STYLES =================
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
    marginBottom: 6,
  },

  subtitle: {
    textAlign: "center",
    marginBottom: 14,
    color: "#A1A1AA",
    letterSpacing: -0.3,
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
