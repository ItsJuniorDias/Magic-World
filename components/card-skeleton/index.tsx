import { View, StyleSheet, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { border } from "@expo/ui/swift-ui/modifiers";

const { width } = Dimensions.get("window");

type CardSkeletonProps = {
  variant?: "default" | "category" | "recent";
};

export default function CardSkeleton({
  variant = "default",
}: CardSkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={[styles.card, variantStyles[variant]]}>
      {/* IMAGE PLACEHOLDER */}
      <View style={styles.image} />

      {/* GRADIENT OVERLAY */}
      <View style={styles.overlay}>
        {variant !== "category" && <View style={styles.title} />}

        {variant !== "category" && <View style={styles.subtitle} />}
      </View>

      {/* SHIMMER */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.15)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 214,
    height: 220,
    marginRight: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1e1e1e",
  },
  image: {
    flex: 1,
    backgroundColor: "#2a2a2a",
  },
  overlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
  },
  title: {
    height: 18,
    width: "70%",
    backgroundColor: "#3a3a3a",
    borderRadius: 6,
    marginBottom: 8,
  },
  subtitle: {
    height: 14,
    width: "40%",
    backgroundColor: "#333",
    borderRadius: 6,
  },
});

const variantStyles = {
  default: {
    height: 295,
  },
  recent: {
    height: 295,
  },
  category: {
    width: 140,
    height: 140,
    borderRadius: 100,
  },
};
