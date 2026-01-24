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
  achievement: any;
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
        {/* Ícone com leve fundo para destaque */}
        <View style={styles.iconContainer}>
          <Text fontSize={64} title={achievement.icon} />
        </View>

        <Text
          fontFamily="bold"
          fontSize={22}
          color="#FFF"
          title="New Achievement!"
          style={styles.mainTitle}
        />

        <Text
          fontSize={16}
          color="#8E8E93" // Cinza padrão iOS
          title={`You unlocked: ${achievement.title}`}
          style={styles.subTitle}
        />

        <Pressable
          style={({ pressed }) => [
            styles.modalButton,
            {
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
          onPress={onClose}
        >
          <Text
            fontFamily="bold"
            fontSize={20}
            color="#000" // Texto preto no botão branco
            title="Awesome"
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)", // Escurece mais o fundo para foco total
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modalCard: {
    width: width * 0.82,
    borderRadius: 34, // Bordas bem arredondadas (estilo iOS 17)
    padding: 32,
    alignItems: "center",
    backgroundColor: "#1C1C1E", // Cor padrão "Elevated Dark" do iOS
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)", // Borda sutil para brilho
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },

  iconContainer: {
    marginBottom: 20,
    // Efeito de brilho suave atrás do ícone
    shadowColor: "#FFF",
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },

  mainTitle: {
    marginTop: 8,
    textAlign: "center",
    letterSpacing: -0.5,
  },

  subTitle: {
    marginTop: 8,
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 22,
  },

  modalButton: {
    marginTop: 30,
    width: "100%", // Botão largo estilo Apple
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF", // Botão branco para contraste premium
    alignItems: "center",
    justifyContent: "center",
  },
});
