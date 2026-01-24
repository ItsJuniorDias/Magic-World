import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Animated,
  TouchableOpacity,
  Easing,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";

import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { useMagicProgressStore } from "@/store/useMagicProgressStore";
import { AchievementModal } from "@/components/(achievements)";

const { width } = Dimensions.get("window");

// ================= Fade-In Animation for Achievements =================
const FadeInItem = ({ children, delay, isFocused }: any) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFocused) {
      animatedValue.setValue(0);
      Animated.spring(animatedValue, {
        toValue: 1,
        friction: 9,
        tension: 40,
        delay,
        useNativeDriver: true,
      }).start();
    }
  }, [isFocused, delay]);

  return (
    <Animated.View
      style={{
        opacity: animatedValue,
        transform: [
          {
            scale: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0.85, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

// ================= LEVEL META =================
const LEVEL_META = {
  Apprentice: {
    icon: "✨",
    color: "#9CA3AF",
    title: "Apprentice",
    nextThreshold: 10,
  },
  Sorcerer: {
    icon: "🔮",
    color: "#8B5CF6",
    title: "Sorcerer",
    nextThreshold: 50,
  },
  Archmage: {
    icon: "👑",
    color: "#FACC15",
    title: "Archmage",
    nextThreshold: Infinity,
  },
};

// ================= ACHIEVEMENTS =================
const ACHIEVEMENTS = [
  { id: 1, title: "Initiate", req: 1, icon: "🌱" },
  { id: 2, title: "Bookworm", req: 5, icon: "📖" },
  { id: 3, title: "Relentless", req: 15, icon: "🔥" },
  { id: 4, title: "Spellbinder", req: 30, icon: "⚡" },
  { id: 5, title: "Sage", req: 50, icon: "📚" },
  { id: 6, title: "Legendary", req: 100, icon: "🏆" },
];

// ================= LOADING SPINNER =================
// ================= LOADING SPINNER (APPLE STYLE) =================
const LoadingSpinner = () => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear, // Essencial para movimento fluido
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.loadingContainer}>
      <Animated.View
        style={[
          styles.appleSpinner,
          { transform: [{ rotate: rotateInterpolate }] },
        ]}
      />
      <Text
        fontSize={20}
        color={Colors.dark.text} // Cinza suave típico da Apple
        fontFamily="regular"
        title="Loading..."
        style={{ marginTop: 20, letterSpacing: 0.5 }}
      />
    </View>
  );
};

// ================= PROFILE SCREEN =================
export default function ProfileScreen() {
  const isFocused = useIsFocused();
  const { chaptersRead, level, initProgress } = useMagicProgressStore();

  const [loading, setLoading] = useState(true);
  const [activeAchievement, setActiveAchievement] = useState<any | null>(null);
  const shownRef = useRef<Record<number, boolean>>({});
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isFocused) return;
    initProgress().then(() => setLoading(false));
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused || loading) return;

    const potentialUnlockeds = ACHIEVEMENTS.filter(
      (a) => chaptersRead >= a.req && !shownRef.current[a.id],
    );
    if (potentialUnlockeds.length > 0) {
      const latest = potentialUnlockeds.reduce((prev, curr) =>
        prev.req > curr.req ? prev : curr,
      );
      potentialUnlockeds.forEach((a) => (shownRef.current[a.id] = true));
      setActiveAchievement(latest);
    }
  }, [chaptersRead, isFocused, loading]);

  const meta = LEVEL_META[level];
  const targetThreshold = meta.nextThreshold;
  const currentThreshold =
    level === "Apprentice" ? 0 : level === "Sorcerer" ? 10 : 50;
  const progressPercent = Math.min(
    ((chaptersRead - currentThreshold) / (targetThreshold - currentThreshold)) *
      100,
    100,
  );

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.avatarWrapper}>
            <Text title="👤" fontSize={42} />
          </View>

          <Text
            fontFamily="bold"
            fontSize={24}
            color="#FFF"
            title="Magic Reader"
            style={{ letterSpacing: -0.5 }}
          />

          <View style={[styles.levelBadge, { borderColor: meta.color + "40" }]}>
            <Text fontSize={14} fontFamily="regular" title={meta.icon} />
            <Text
              fontFamily="bold"
              fontSize={12}
              color={meta.color}
              title={meta.title.toUpperCase()}
            />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text
                fontFamily="bold"
                fontSize={28}
                color="#FFF"
                title={String(chaptersRead)}
              />
              <Text
                fontSize={14}
                fontFamily="regular"
                color="#8E8E93"
                title="Chapters"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text
                fontFamily="bold"
                fontSize={28}
                color="#FFF"
                title={String(
                  ACHIEVEMENTS.filter((a) => chaptersRead >= a.req).length,
                )}
              />
              <Text
                fontSize={14}
                fontFamily="regular"
                color="#8E8E93"
                title="Badges"
              />
            </View>
          </View>

          {level !== "Archmage" && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text
                  fontSize={14}
                  fontFamily="regular"
                  color="#8E8E93"
                  title="Level Progress"
                />
                <Text
                  fontFamily="bold"
                  fontSize={14}
                  color={meta.color}
                  title={`${chaptersRead}/${targetThreshold}`}
                />
              </View>
              <View style={styles.progressBarContainer}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ["0%", "100%"],
                      }),
                      backgroundColor: meta.color,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        {/* Achievements */}
        <View style={styles.sectionHeader}>
          <Text
            fontFamily="bold"
            fontSize={20}
            color="#FFF"
            title="My Achievements"
            style={{ letterSpacing: -0.5 }}
          />
        </View>

        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.map((item, index) => {
            const isUnlocked = chaptersRead >= item.req;
            return (
              <FadeInItem
                key={`${item.id}-${isFocused}`}
                delay={index * 60}
                isFocused={isFocused}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    if (isUnlocked) setActiveAchievement(item);
                  }}
                  style={styles.achievementWrapper}
                >
                  <View
                    style={[
                      styles.achievementIcon,
                      !isUnlocked && styles.lockedIcon,
                    ]}
                  >
                    <Text
                      fontSize={30}
                      fontFamily="bold"
                      title={isUnlocked ? item.icon : "🔒"}
                    />
                  </View>
                  <Text
                    fontFamily="regular"
                    fontSize={14}
                    color={isUnlocked ? "#FFF" : "#48484A"}
                    title={item.title}
                    style={{ marginTop: 8 }}
                  />
                </TouchableOpacity>
              </FadeInItem>
            );
          })}
        </View>
      </ScrollView>

      {activeAchievement && (
        <AchievementModal
          achievement={activeAchievement}
          onClose={() => setActiveAchievement(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  scrollContent: { alignItems: "center", paddingTop: 30, paddingBottom: 50 },
  card: {
    width: width * 0.9,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 12,
    gap: 6,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 30,
    width: "100%",
  },
  statItem: { flex: 1, alignItems: "center" },
  divider: { width: 1, height: 35, backgroundColor: "#38383A" },
  progressSection: { width: "100%", marginTop: 30 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#38383A",
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 3 },
  sectionHeader: { width: width * 0.9, marginTop: 40, marginBottom: 20 },
  achievementsGrid: {
    width: width * 0.9,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  achievementWrapper: {
    width: (width * 0.9 - 30) / 3,
    alignItems: "center",
    marginBottom: 25,
  },
  achievementIcon: {
    width: width * 0.22,
    height: width * 0.22,
    borderRadius: 22,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  lockedIcon: { backgroundColor: "#000", opacity: 0.4 },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.background,
  },
  appleSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.1)", // Cor do fundo do anel
    borderTopColor: "#8B5CF6", // Cor do "rastro" (seu roxo Sorcerer)
    // Se quiser o rastro branco clássico, use #FFF
  },
});
