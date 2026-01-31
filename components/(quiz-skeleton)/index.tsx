import React, { useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
} from "react-native";
import { Colors } from "@/constants/theme";

const { width } = Dimensions.get("window");

export default function QuizSkeleton() {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-width, width],
  });

  const shimmerStyle = {
    transform: [{ translateX }],
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.skeletonAvatar} />

          <Animated.View style={[styles.shimmer, shimmerStyle]} />
        </View>

        {/* Question */}
        <View style={styles.skeletonQuestionContainer}>
          <View style={styles.skeletonQuestion} />
          <Animated.View style={[styles.shimmer, shimmerStyle]} />
        </View>

        {/* Options */}
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonOptionContainer}>
            <View style={styles.skeletonOption} />
            <Animated.View style={[styles.shimmer, shimmerStyle]} />
          </View>
        ))}

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground} />
          <Animated.View
            style={[styles.shimmer, { ...StyleSheet.absoluteFillObject }]}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 64,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
    gap: 8,
  },

  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    width: "100%",
    backgroundColor: "#3a3a3c",
    opacity: 0.3,
    borderRadius: 16,
  },

  avatarContainer: {
    width: 90,
    height: 90,
    marginBottom: 20,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "#2C2C2E",
  },
  skeletonAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    backgroundColor: "#2C2C2E",
  },

  skeletonQuestionContainer: {
    width: width * 0.8,
    height: 60,
    borderRadius: 20,
    marginBottom: 24,
    overflow: "hidden",
    backgroundColor: "#2C2C2E",
  },
  skeletonQuestion: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2C2C2E",
  },

  skeletonOptionContainer: {
    width: width * 0.8,
    height: 50,
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: "#2C2C2E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  skeletonOption: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    backgroundColor: "#2C2C2E",
  },

  progressContainer: {
    width: width * 0.8,
    height: 20,
    borderRadius: 50,
    backgroundColor: "#38383A",
    marginTop: 24,
    overflow: "hidden",
  },
  progressBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#38383A",
  },
});
