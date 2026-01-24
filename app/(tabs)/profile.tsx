import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Animated,
} from "react-native";
import { useIsFocused } from "@react-navigation/native"; // Importado
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { useMagicProgressStore } from "@/store/useMagicProgressStore";

// Componente de Animação com suporte a Reset no Focus
const FadeInItem = ({
  children,
  delay,
  isFocused, // Recebe o estado de foco
}: {
  children: React.ReactNode;
  delay: number;
  isFocused: boolean;
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFocused) {
      // Se a tela ganhou foco, reseta e inicia a animação
      animatedValue.setValue(0);
      Animated.parallel([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 500,
          delay: delay,
          useNativeDriver: true,
        }),
        Animated.spring(animatedValue, {
          toValue: 1,
          friction: 8,
          tension: 40,
          delay: delay,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Se saiu da tela, volta para 0 para estar pronto para a próxima entrada
      animatedValue.setValue(0);
    }
  }, [isFocused, delay]);

  const animatedStyle = {
    opacity: animatedValue,
    transform: [
      {
        scale: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.7, 1],
        }),
      },
    ],
  };

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

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

const ACHIEVEMENTS = [
  { id: 1, title: "Initiate", req: 1, icon: "🌱" },
  { id: 2, title: "Bookworm", req: 5, icon: "📖" },
  { id: 3, title: "Relentless", req: 15, icon: "🔥" },
  { id: 4, title: "Spellbinder", req: 30, icon: "⚡" },
  { id: 5, title: "Sage", req: 50, icon: "📚" },
  { id: 6, title: "Legendary", req: 100, icon: "🏆" },
];

export default function ProfileScreen() {
  const isFocused = useIsFocused(); // Hook para detectar foco
  const { chaptersRead, level, initProgress } = useMagicProgressStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setup = async () => {
      await initProgress();
      setLoading(false);
    };
    setup();
  }, []);

  const meta = LEVEL_META[level];
  const currentThreshold =
    level === "Apprentice" ? 0 : level === "Sorcerer" ? 10 : 50;
  const targetThreshold = meta.nextThreshold;
  const progressPercent = Math.min(
    ((chaptersRead - currentThreshold) / (targetThreshold - currentThreshold)) *
      100,
    100,
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <Text title="Loading Magic..." color="#FFF" fontFamily="regular" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Main Profile Card */}
        <View style={[styles.card, { shadowColor: meta.color }]}>
          <View style={styles.avatarContainer}>
            <Text title="👤" fontFamily="regular" fontSize={40} />
          </View>

          <Text
            fontFamily="bold"
            fontSize={22}
            color={Colors.dark.text}
            title="Magic Reader"
          />

          <View
            style={[styles.levelBadge, { backgroundColor: meta.color + "20" }]}
          >
            <Text fontSize={16} fontFamily="regular" title={meta.icon} />
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
                fontSize={22}
                color="#FFF"
                title={String(chaptersRead)}
              />
              <Text
                fontSize={12}
                color="#9CA3AF"
                title="CHAPTERS"
                fontFamily="regular"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text
                fontFamily="bold"
                fontSize={22}
                color="#FFF"
                title={String(
                  ACHIEVEMENTS.filter((a) => chaptersRead >= a.req).length,
                )}
              />
              <Text
                fontSize={12}
                color="#9CA3AF"
                title="BADGES"
                fontFamily="regular"
              />
            </View>
          </View>

          {level !== "Archmage" && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text
                  fontFamily="regular"
                  fontSize={12}
                  color="#9CA3AF"
                  title="Level Progress"
                />
                <Text
                  fontFamily="regular"
                  fontSize={12}
                  color={meta.color}
                  title={`${chaptersRead}/${targetThreshold}`}
                />
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: meta.color,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text
            fontFamily="bold"
            fontSize={22}
            color="#FFF"
            title="My Achievements"
          />
        </View>

        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.map((item, index) => {
            const isUnlocked = chaptersRead >= item.req;
            return (
              <FadeInItem
                key={`${item.id}-${isFocused}`} // A key muda com o foco, reforçando a atualização
                delay={index * 80}
                isFocused={isFocused}
              >
                <View style={styles.achievementWrapper}>
                  <View
                    style={[
                      styles.achievementIcon,
                      !isUnlocked && styles.lockedIcon,
                    ]}
                  >
                    <Text
                      fontSize={28}
                      fontFamily="bold"
                      title={isUnlocked ? item.icon : "🔒"}
                    />
                  </View>
                  <Text
                    fontFamily="regular"
                    fontSize={14}
                    color={isUnlocked ? "#FFF" : "#666"}
                    title={item.title}
                    style={{ marginTop: 6, textAlign: "center" }}
                  />
                </View>
              </FadeInItem>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { alignItems: "center", paddingTop: 40, paddingBottom: 40 },
  card: {
    width: "90%",
    borderRadius: 32,
    padding: 24,
    alignItems: "center",
    backgroundColor: "#171717",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
    backgroundColor: "#262626",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.05)",
    marginBottom: 16,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    gap: 8,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    width: "100%",
  },
  statItem: { alignItems: "center", flex: 1 },
  divider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.1)" },
  progressContainer: { width: "100%", marginTop: 24 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 4 },
  sectionHeader: { width: "90%", marginTop: 32, marginBottom: 16 },
  achievementsGrid: {
    width: "90%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 15,
  },
  achievementWrapper: {
    width: (Dimensions.get("window").width * 0.9 - 45) / 4,
    alignItems: "center",
    marginBottom: 10,
  },
  achievementIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#262626",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  lockedIcon: { opacity: 0.3, backgroundColor: "#121212" },
});
