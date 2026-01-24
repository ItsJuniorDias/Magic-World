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

// ================= Fade-In Animation =================
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
    min: 0,
    nextThreshold: 10,
  },
  Sorcerer: {
    icon: "🔮",
    color: "#8B5CF6",
    title: "Sorcerer",
    min: 25,
    nextThreshold: 50,
  },
  Wizard: {
    icon: "🪄",
    color: "#3B82F6",
    title: "Wizard",
    min: 50,
    nextThreshold: 100,
  },
  Archmage: {
    icon: "👑",
    color: "#FACC15",
    title: "Archmage",
    min: 100,
    nextThreshold: 200,
  },
};

// ================= ACHIEVEMENTS =================
const ACHIEVEMENTS = [
  { id: 1, title: "Initiate", req: 1, icon: "🌱", secret: false },
  { id: 2, title: "Bookworm", req: 5, icon: "📖", secret: false },
  { id: 3, title: "Relentless", req: 15, icon: "🔥", secret: false },
  { id: 4, title: "Spellbinder", req: 30, icon: "⚡", secret: false },
  { id: 5, title: "Sage", req: 50, icon: "📚", secret: false },
  { id: 6, title: "Legendary", req: 100, icon: "🏆", secret: false },

  // Secret Achievements
  {
    id: 7,
    title: "Hidden Apprentice",
    icon: "🗝️",
    secret: true,
    req: 120,
    condition: (c: number) => c >= 120,
  },
  {
    id: 8,
    title: "Lucky Reader",
    icon: "🍀",
    secret: true,
    req: 140,
    condition: (c: number) => c >= 140,
  },
  {
    id: 9,
    title: "Magic Milestone",
    icon: "💫",
    secret: true,
    req: 160,
    condition: (c: number) => c >= 160,
  },
  {
    id: 10,
    title: "Centurion",
    icon: "🎖️",
    secret: true,
    req: 200,
    condition: (c: number) => c >= 200,
  },
];

// ================= LOADING SPINNER =================
const LoadingSpinner = () => {
  const scaleAnims = [
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
  ];

  useEffect(() => {
    const animate = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1.6,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };

    scaleAnims.forEach((anim, index) => animate(anim, index * 150));
  }, []);

  return (
    <View style={styles.loadingContainer}>
      <View style={{ flexDirection: "row", gap: 15, marginBottom: 25 }}>
        {scaleAnims.map((anim, idx) => (
          <Animated.View
            key={idx}
            style={[
              styles.loadingCircle,
              {
                transform: [{ scale: anim }],
                opacity: anim.interpolate({
                  inputRange: [1, 1.6],
                  outputRange: [0.6, 1],
                }),
              },
            ]}
          />
        ))}
      </View>
      <Text
        fontSize={18}
        color={Colors.dark.text}
        fontFamily="bold"
        title="Loading..."
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
  const [unlockedIds, setUnlockedIds] = useState<Record<number, boolean>>({});

  const shownAchievementIds = useRef<Set<number>>(new Set());
  const progressAnim = useRef(new Animated.Value(0)).current;
  const MAX_CHAPTERS = 200;

  const progressPercent = Math.min((chaptersRead / MAX_CHAPTERS) * 100, 100);

  // 1. Carregar dados
  useEffect(() => {
    if (!isFocused) return;

    initProgress().then(() => setLoading(false));
  }, [isFocused]);

  // 2. Desbloqueio e modal automático
  useEffect(() => {
    if (loading || !isFocused) return;

    let tempUnlocked: Record<number, boolean> = {};
    let latestNewAchievement: any = null;

    ACHIEVEMENTS.forEach((ach) => {
      const unlocked =
        ach.secret && ach.condition
          ? ach.condition(chaptersRead)
          : chaptersRead >= (ach.req || 0);

      if (unlocked) {
        tempUnlocked[ach.id] = true;
        if (!shownAchievementIds.current.has(ach.id)) {
          latestNewAchievement = ach;
        }
      }
    });

    setUnlockedIds(tempUnlocked);

    if (latestNewAchievement) {
      setActiveAchievement(latestNewAchievement);
      shownAchievementIds.current.add(latestNewAchievement.id);
    }
  }, [chaptersRead, loading, isFocused]);

  // 3. Animação da barra
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: isNaN(progressPercent) ? 0 : progressPercent,
      duration: 1000,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  const meta =
    LEVEL_META[level as keyof typeof LEVEL_META] || LEVEL_META.Apprentice;

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.container}
      >
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.avatarWrapper}>
            <Text title="👤" fontSize={40} />
          </View>

          <Text
            fontFamily="bold"
            fontSize={24}
            color="#FFF"
            title="Magic Reader"
            style={{ letterSpacing: -0.5 }}
          />

          <View style={[styles.levelBadge, { borderColor: meta.color + "40" }]}>
            <Text fontSize={18} fontFamily="regular" title={meta.icon} />
            <Text
              fontFamily="bold"
              fontSize={14}
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
                color="#8E8E93"
                fontFamily="regular"
                title="Chapters"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.statItem}>
              <Text
                fontFamily="bold"
                fontSize={28}
                color="#FFF"
                title={String(Object.keys(unlockedIds).length)}
              />
              <Text
                fontFamily="regular"
                fontSize={14}
                color="#8E8E93"
                title="Badges"
              />
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text
                fontSize={14}
                color="#8E8E93"
                title="Journey Progress"
                fontFamily="regular"
              />
              <Text
                fontFamily="bold"
                fontSize={14}
                color={meta.color}
                title={`${chaptersRead}/${MAX_CHAPTERS}`}
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
        </View>

        {/* Achievements Section */}
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
          {ACHIEVEMENTS.filter(
            (item) => !item.secret || !!unlockedIds[item.id],
          ).map((item, index) => {
            const isUnlocked = !!unlockedIds[item.id];
            return (
              <FadeInItem
                key={`${item.id}-${isFocused}`}
                delay={index * 50}
                isFocused={isFocused}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => isUnlocked && setActiveAchievement(item)}
                  style={styles.achievementWrapper}
                >
                  <View
                    style={[
                      styles.achievementIcon,
                      !isUnlocked && styles.lockedIcon,
                    ]}
                  >
                    <Text fontSize={28} title={isUnlocked ? item.icon : "🔒"} />
                  </View>
                  <Text
                    fontFamily="regular"
                    fontSize={14}
                    color={isUnlocked ? "#FFF" : "#48484A"}
                    title={item.title}
                    style={{ marginTop: 8, textAlign: "center" }}
                    numberOfLines={1}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 64,
  },
  scrollContent: { alignItems: "center", paddingTop: 30, paddingBottom: 60 },
  card: {
    width: width * 0.9,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    height: 8,
    borderRadius: 4,
    backgroundColor: "#38383A",
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 4 },
  sectionHeader: { width: width * 0.9, marginTop: 40, marginBottom: 20 },
  achievementsGrid: {
    width: width * 0.9,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 12,
  },
  achievementWrapper: {
    width: (width * 0.9 - 24) / 3,
    alignItems: "center",
    marginBottom: 20,
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
  loadingCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#8B5CF6",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
});
