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

const { width } = Dimensions.get("window");

export function ChapterCompletedModal({
  visible,
  onClose,
  chapterNumber,
}: {
  visible: boolean;
  onClose: () => void;
  chapterNumber: number;
}) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

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

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[styles.modalContainer, { opacity, transform: [{ scale }] }]}
      >
        {/* O GlassView precisa envolver o conteúdo para o efeito de vidro */}
        <GlassView intensity={90} style={styles.glassCard}>
          <View style={styles.iconContainer}>
            <Text title="✨" fontSize={56} />
          </View>

          <Text
            fontFamily="bold"
            fontSize={28}
            color={Colors.light.text}
            title="Great Reading!"
            style={styles.title}
          />

          <Text
            fontSize={16}
            color={Colors.light.text}
            fontFamily="regular"
            title={`You've successfully finished chapter ${chapterNumber}. Your magic level has increased!`}
            style={styles.description}
          />

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: pressed ? "rgba(255,255,255,0.8)" : "#FFF" },
            ]}
            onPress={onClose}
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
    backgroundColor: "rgba(0,0,0,0.5)", // Fundo levemente escuro para o vidro destacar
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modalContainer: {
    width: width * 0.86,
    borderRadius: 38,
    overflow: "hidden", // Importante para o GlassView respeitar o radius
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
    // Sombra sutil no botão para destacar do vidro
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});
