import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
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
import {
  useAdventureProfileStore,
  AdventureProfileType,
} from "@/store/useAdventureProfileStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SecretLevelBadge } from "@/components/(secret-level-badge)";

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
  {
    id: 1,
    title: "Initiate",
    req: 1,
    icon: "🌱",
    secret: false,
    description: "Every journey begins with a single step.",
  },
  {
    id: 2,
    title: "Bookworm",
    req: 5,
    icon: "📖",
    secret: false,
    description: "Curiosity grows with every page you turn.",
  },
  {
    id: 3,
    title: "Relentless",
    req: 15,
    icon: "🔥",
    secret: false,
    description: "You kept going when stopping was easier.",
  },
  {
    id: 4,
    title: "Spellbinder",
    req: 30,
    icon: "⚡",
    secret: false,
    description: "Words have power, and you have learned to wield them.",
  },
  {
    id: 5,
    title: "Sage",
    req: 50,
    icon: "📚",
    secret: false,
    description: "Knowledge accumulates, wisdom emerges.",
  },
  {
    id: 6,
    title: "Legendary",
    req: 100,
    icon: "🏆",
    secret: false,
    description: "Your dedication has become the stuff of legends.",
  },
  {
    id: 7,
    title: "Hidden Apprentice",
    icon: "🗝️",
    secret: true,
    req: 120,
    description: "You noticed what others overlooked.",
    condition: (c: number) => c >= 120,
  },
  {
    id: 8,
    title: "Lucky Reader",
    icon: "🍀",
    secret: true,
    req: 140,
    description: "Chance favors those who keep reading.",
    condition: (c: number) => c >= 140,
  },
  {
    id: 9,
    title: "Magic Milestone",
    icon: "💫",
    secret: true,
    req: 160,
    description: "A quiet moment where progress becomes magic.",
    condition: (c: number) => c >= 160,
  },
  {
    id: 10,
    title: "Centurion",
    icon: "🎖️",
    secret: true,
    req: 200,
    description: "Few reach this far. You did.",
    condition: (c: number) => c >= 200,
  },
  {
    id: 11,
    title: "Birthday Magic",
    icon: "🎂",
    secret: true,
    req: 0,
    description: "Some days carry a little extra magic.",
    condition: () => {
      const today = new Date();
      return today.getDate() === 20 && today.getMonth() === 7; // August 20
    },
  },
  {
    id: 12,
    title: "Early Bird",
    icon: "🌅",
    secret: true,
    req: 0,
    description: "You were awake before the world noticed.",
    condition: () => {
      const hour = new Date().getHours();
      return hour >= 5 && hour < 7;
    },
  },
  {
    id: 13,
    title: "Night Owl",
    icon: "🌙",
    secret: true,
    req: 0,
    description: "You kept reading while others slept.",
    condition: () => {
      const hour = new Date().getHours();
      return hour >= 0 && hour < 3;
    },
  },
  {
    id: 14,
    title: "Carnaval Reader",
    icon: "🎭",
    secret: true,
    req: 0,
    description: "Even festivities could not pull you away.",
    condition: () => {
      const today = new Date();
      return today.getDate() === 13 && today.getMonth() === 1; // February 13
    },
  },
  {
    id: 15,
    title: "Festive Spirit",
    icon: "🎄",
    secret: true,
    req: 0,
    description: "Stories found their place among the celebrations.",
    condition: () => {
      const today = new Date();
      return today.getDate() === 25 && today.getMonth() === 11; // December 25
    },
  },
  {
    id: 16,
    title: "The One Who Persisted",
    icon: "🕯️",
    secret: true,
    req: 0,
    description:
      "Some paths reveal themselves only to those who do not give up.",
    condition: () => {
      return false; // unlocked manually via SecretLevelBadge
    },
  },
];

// ================= PROFILE CONTENT =================
const PROFILE_CONTENT: Record<
  AdventureProfileType,
  { title: string; description: string; emoji: string }
> = {
  brave: {
    title: "Brave Adventurer",
    description: "You face challenges head-on and never back down.",
    emoji: "🛡️",
  },
  clever: {
    title: "Clever Explorer",
    description: "You solve problems with wit, strategy, and a sharp mind.",
    emoji: "💡",
  },
  wild: {
    title: "Wild Spirit",
    description: "You follow your instincts and embrace unpredictable paths.",
    emoji: "🪶",
  },
  wise: {
    title: "Wise Guardian",
    description: "You observe, reflect, and choose carefully before acting.",
    emoji: "📖",
  },
};

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

  const { profile } = useAdventureProfileStore();

  console.log(profile, "PROFILE");

  const [loading, setLoading] = useState(true);
  const [activeAchievement, setActiveAchievement] = useState<any | null>(null);

  const [unlockedIds, setUnlockedIds] = useState<Record<number, boolean>>({});
  const [profileData, setProfileData] = useState<typeof PROFILE_CONTENT | null>(
    null,
  );

  const shownAchievementIds = useRef<Set<number>>(new Set());
  const progressAnim = useRef(new Animated.Value(0)).current;
  const MAX_CHAPTERS = 200;

  const progressPercent = Math.min((chaptersRead / MAX_CHAPTERS) * 100, 100);

  // ================= Load Unlocked Achievements from AsyncStorage =================
  const loadUnlockedAchievements = async () => {
    try {
      const stored = await AsyncStorage.getItem("@unlocked_achievements");
      if (stored) {
        setUnlockedIds(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load achievements:", err);
    }
  };

  const saveUnlockedAchievements = async (data: Record<number, boolean>) => {
    try {
      await AsyncStorage.setItem(
        "@unlocked_achievements",
        JSON.stringify(data),
      );
    } catch (err) {
      console.error("Failed to save achievements:", err);
    }
  };

  // ================= Load Progress & Profile =================
  useEffect(() => {
    if (!isFocused) return;

    const loadData = async () => {
      setLoading(true);

      // Inicializa progresso
      await initProgress();

      // Carrega achievements salvos
      await loadUnlockedAchievements();

      // Profile
      if (profile) setProfileData(PROFILE_CONTENT[profile]);
      else setProfileData(null);

      setLoading(false);
    };

    loadData();
  }, [isFocused, profile]);

  // ================= Unlock Achievements =================

  useEffect(() => {
    if (loading || !isFocused) return;

    let tempUnlocked: Record<number, boolean> = { ...unlockedIds };
    let latestNewAchievement: any = null;

    ACHIEVEMENTS.forEach((achievement) => {
      const isUnlocked = achievement.condition
        ? achievement.condition(chaptersRead)
        : chaptersRead >= achievement.req;

      if (isUnlocked) {
        // Marca como desbloqueado
        tempUnlocked[achievement.id] = true;

        // Se ainda não mostramos modal
        if (!shownAchievementIds.current.has(achievement.id)) {
          latestNewAchievement = achievement;
          shownAchievementIds.current.add(achievement.id);
        }
      }
    });

    // Atualiza estado e salva no AsyncStorage
    setUnlockedIds(tempUnlocked);
    saveUnlockedAchievements(tempUnlocked);

    // Mostra modal do último achievement recém desbloqueado
    if (latestNewAchievement) {
      setTimeout(() => {
        setActiveAchievement(latestNewAchievement);
      }, 500);
    }
  }, [chaptersRead, loading, isFocused]);

  // ================= Progress Bar Animation =================
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

  const unlockAchievementById = (id: number) => {
    if (unlockedIds[id]) return;

    const updated = {
      ...unlockedIds,
      [id]: true,
    };

    setUnlockedIds(updated);
    saveUnlockedAchievements(updated);

    const achievement = ACHIEVEMENTS.find((a) => a.id === id);
    if (achievement) {
      setTimeout(() => {
        setActiveAchievement(achievement);
      }, 300);
    }
  };

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.container}
      >
        {/* Profile Card */}
        <View style={styles.card}>
          {/* Avatar */}

          {/* Adventure Profile */}
          {profileData && !loading ? (
            <View style={{ marginTop: 24, alignItems: "center" }}>
              <Text fontSize={48} title={profileData.emoji} />

              <Text
                fontFamily="bold"
                fontSize={22}
                color="#FFF"
                title={profileData.title}
                style={{ marginTop: 8 }}
              />
              <Text
                fontFamily="regular"
                fontSize={14}
                color="rgba(255,255,255,0.7)"
                title={profileData.description}
                style={{
                  marginTop: 4,
                  textAlign: "center",
                  maxWidth: width * 0.8,
                }}
              />
            </View>
          ) : (
            <>
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
            </>
          )}

          {/* Level Badge */}
          <SecretLevelBadge
            onSecretUnlocked={() => {
              console.log("🕯️ SECRET PATH UNLOCKED");
              // aqui depois ligamos store / modal / lore

              unlockAchievementById(16);
            }}
          >
            <View
              style={[styles.levelBadge, { borderColor: meta.color + "40" }]}
            >
              <Text fontSize={18} fontFamily="regular" title={meta.icon} />
              <Text
                fontFamily="bold"
                fontSize={14}
                color={meta.color}
                title={meta.title.toUpperCase()}
              />
            </View>
          </SecretLevelBadge>

          {/* Stats Row */}
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

          {/* Progress Section */}
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

      {!!activeAchievement && (
        <AchievementModal
          achievement={{
            id: activeAchievement.id,
            title: activeAchievement.title,
            subtitle: activeAchievement.description,
            icon: activeAchievement.icon,
            description: activeAchievement.secret
              ? "Secret Achievement Unlocked!"
              : `Unlocked by reading ${activeAchievement.req} chapters!`,
          }}
          onClose={() => setActiveAchievement(null)}
        />
      )}
    </>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 64,
  },
  scrollContent: { alignItems: "center", paddingTop: 30, paddingBottom: 90 },
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
    gap: 8,
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
