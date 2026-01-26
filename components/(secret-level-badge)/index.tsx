import React, { useRef, useState } from "react";
import { Animated, Pressable, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

type Props = {
  children: React.ReactNode;
  onSecretUnlocked: () => void;
  style?: ViewStyle;
};

export function SecretLevelBadge({ children, onSecretUnlocked, style }: Props) {
  const holdTimer = useRef<NodeJS.Timeout | null>(null);

  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const pressDepth = useRef(new Animated.Value(0)).current;

  const [ready, setReady] = useState(false);

  /* ===================== PULSE ===================== */
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const stopPulse = () => {
    pulse.stopAnimation();
    pulse.setValue(0);
  };

  /* ===================== RESET ===================== */
  const reset = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);

    setReady(false);
    stopPulse();

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(opacity, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(pressDepth, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /* ===================== PRESS ===================== */
  const onPressIn = () => {
    // resposta imediata
    Animated.spring(pressDepth, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    holdTimer.current = setTimeout(() => {
      setReady(true);
      startPulse();

      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.93,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.88,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      Haptics.selectionAsync();
    }, 2800);
  };

  const onPressOut = () => {
    if (ready) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSecretUnlocked();
    }
    reset();
  };

  /* ===================== INTERPOLATIONS ===================== */
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });

  const pressTranslate = pressDepth.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  /* ===================== RENDER ===================== */
  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[
          style,
          {
            opacity,
            transform: [
              { scale: Animated.multiply(scale, pulseScale) },
              { translateY: pressTranslate },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
