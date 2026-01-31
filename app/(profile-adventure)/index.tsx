import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";

export default function AdventureProfileIntro() {
  const router = useRouter();

  // Texto
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;

  // Botão
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(20)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 1000,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buttonTranslateY, {
        toValue: 0,
        duration: 1000,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleContinue = () => {
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
      >
        {/* Texto animado */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text
            title="Your adventure is about to begin ✨"
            fontFamily="bold"
            fontSize={28}
            color={Colors.dark.text}
            style={{ letterSpacing: -0.5 }}
          />

          <Text
            title="Every choice you make will shape your adventure style."
            fontFamily="regular"
            fontSize={18}
            color={Colors.dark.text}
          />

          <Text
            title="There are no right or wrong choices — only different paths."
            fontFamily="regular"
            fontSize={16}
            color={Colors.dark.text}
          />

          {/* Novo conteúdo */}
          <Text
            title="💡 Tip: Take your time to explore each option. Some paths may surprise you!"
            fontFamily="regular"
            fontSize={16}
            color={Colors.dark.text}
          />

          <Text
            title="🎯 Goal: Collect experiences, not points. Your journey is unique."
            fontFamily="regular"
            fontSize={16}
            color={Colors.dark.text}
          />

          <Text
            title="🌟 Hint: Look for hidden details along the way. They can unlock secrets."
            fontFamily="regular"
            fontSize={16}
            color={Colors.dark.text}
          />
        </Animated.View>

        {/* Botão animado */}
        <Animated.View
          style={{
            opacity: buttonOpacity,
            transform: [
              { translateY: buttonTranslateY },
              { scale: buttonScale },
            ],
          }}
        >
          <Pressable
            style={styles.button}
            onPress={handleContinue}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <Text
              title="Start the adventure"
              fontFamily="bold"
              fontSize={18}
              color="#FFF"
            />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 24,
  },
  content: {
    marginTop: 80,
    gap: 16,
  },
  button: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 24,
  },
});
