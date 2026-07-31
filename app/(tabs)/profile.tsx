import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  TouchableOpacity,
  Easing,
  Switch,
  Alert,
  Linking,
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
import LanguageSelector from "@/components/LanguageSelector";
import { useT, useLocaleStore } from "@/i18n";
import { useNotificationsStore } from "@/store/useNotificationsStore";
import { registerForPushNotificationsAsync } from "@/services/notifications";

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
// Estrutura estável (ícone, cor, thresholds). Título vai por
// i18n via `profile.levels.<key>` na hora de renderizar.
type LevelKey = "Apprentice" | "Sorcerer" | "Wizard" | "Archmage";
const LEVEL_META: Record<
  LevelKey,
  {
    icon: string;
    color: string;
    /** Chave em `profile.levels` do i18n. */
    i18nKey: "apprentice" | "sorcerer" | "wizard" | "archmage";
    min: number;
    nextThreshold: number;
  }
> = {
  Apprentice: {
    icon: "✨",
    color: "#9CA3AF",
    i18nKey: "apprentice",
    min: 0,
    nextThreshold: 10,
  },
  Sorcerer: {
    icon: "🔮",
    color: "#8B5CF6",
    i18nKey: "sorcerer",
    min: 25,
    nextThreshold: 50,
  },
  Wizard: {
    icon: "🪄",
    color: "#3B82F6",
    i18nKey: "wizard",
    min: 50,
    nextThreshold: 100,
  },
  Archmage: {
    icon: "👑",
    color: "#FACC15",
    i18nKey: "archmage",
    min: 100,
    nextThreshold: 200,
  },
};

// ================= ACHIEVEMENTS =================
// Estrutura estável: id numérico persistido, icon, req, condition
// e chave i18n. Título e descrição vêm de `profile.achievements.items.<key>`
// na hora de renderizar. Nunca renomear `i18nKey` sem atualizar os locales.
type Achievement = {
  id: number;
  i18nKey: string;
  icon: string;
  secret: boolean;
  req: number;
  condition?: (c: number) => boolean;
};

const ACHIEVEMENTS: Achievement[] = [
  { id: 1, i18nKey: "initiate", req: 1, icon: "🌱", secret: false },
  { id: 2, i18nKey: "bookworm", req: 5, icon: "📖", secret: false },
  { id: 3, i18nKey: "relentless", req: 15, icon: "🔥", secret: false },
  { id: 4, i18nKey: "spellbinder", req: 30, icon: "⚡", secret: false },
  { id: 5, i18nKey: "sage", req: 50, icon: "📚", secret: false },
  { id: 6, i18nKey: "legendary", req: 100, icon: "🏆", secret: false },
  {
    id: 7,
    i18nKey: "hiddenApprentice",
    icon: "🗝️",
    secret: true,
    req: 120,
    condition: (c: number) => c >= 120,
  },
  {
    id: 8,
    i18nKey: "luckyReader",
    icon: "🍀",
    secret: true,
    req: 140,
    condition: (c: number) => c >= 140,
  },
  {
    id: 9,
    i18nKey: "magicMilestone",
    icon: "💫",
    secret: true,
    req: 160,
    condition: (c: number) => c >= 160,
  },
  {
    id: 10,
    i18nKey: "centurion",
    icon: "🎖️",
    secret: true,
    req: 200,
    condition: (c: number) => c >= 200,
  },
  {
    id: 11,
    i18nKey: "birthdayMagic",
    icon: "🎂",
    secret: true,
    req: 0,
    condition: () => {
      const today = new Date();
      return today.getDate() === 20 && today.getMonth() === 7; // August 20
    },
  },
  {
    id: 12,
    i18nKey: "earlyBird",
    icon: "🌅",
    secret: true,
    req: 0,
    condition: () => {
      const hour = new Date().getHours();
      return hour >= 5 && hour < 7;
    },
  },
  {
    id: 13,
    i18nKey: "nightOwl",
    icon: "🌙",
    secret: true,
    req: 0,
    condition: () => {
      const hour = new Date().getHours();
      return hour >= 0 && hour < 3;
    },
  },
  {
    id: 14,
    i18nKey: "carnavalReader",
    icon: "🎭",
    secret: true,
    req: 0,
    condition: () => {
      const today = new Date();
      return today.getDate() === 13 && today.getMonth() === 1; // February 13
    },
  },
  {
    id: 15,
    i18nKey: "festiveSpirit",
    icon: "🎄",
    secret: true,
    req: 0,
    condition: () => {
      const today = new Date();
      return today.getDate() === 25 && today.getMonth() === 11; // December 25
    },
  },
  {
    id: 16,
    i18nKey: "theOneWhoPersisted",
    icon: "🕯️",
    secret: true,
    req: 0,
    condition: () => false, // unlocked manually via SecretLevelBadge
  },
];

// ================= PROFILE CONTENT =================
// Só emoji fica hardcoded — título e descrição vêm por i18n
// via `profile.profileTypes.<type>`.
const PROFILE_EMOJIS: Record<AdventureProfileType, string> = {
  brave: "🛡️",
  clever: "💡",
  wild: "🪶",
  wise: "📖",
};

// ================= LOADING SPINNER =================
const LoadingSpinner = () => {
  const { t } = useT();
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
        title={t("common.loading")}
      />
    </View>
  );
};

// ================= PROFILE SCREEN =================
export default function ProfileScreen() {
  const isFocused = useIsFocused();
  const { t } = useT();
  const localeMeta = useLocaleStore((s) => s.meta);
  const { chaptersRead, level, initProgress } = useMagicProgressStore();

  const { profile } = useAdventureProfileStore();

  console.log(profile, "PROFILE");

  const [loading, setLoading] = useState(true);
  const [activeAchievement, setActiveAchievement] =
    useState<Achievement | null>(null);
  const [languageOpen, setLanguageOpen] = useState(false);

  // Notifications — as prefs vêm do store (persistidas em AsyncStorage).
  // Não usamos os individual setters direto pra podermos interceptar o
  // toggle e disparar o fluxo de permissão na primeira ativação.
  const bedtimeEnabled = useNotificationsStore((s) => s.bedtimeEnabled);
  const streakEnabled = useNotificationsStore((s) => s.streakEnabled);
  const notifRegistered = useNotificationsStore((s) => s.registered);
  const setBedtimeEnabled = useNotificationsStore((s) => s.setBedtimeEnabled);
  const setStreakEnabled = useNotificationsStore((s) => s.setStreakEnabled);
  const setNotifRegistered = useNotificationsStore((s) => s.setRegistered);
  const setPermissionStatus = useNotificationsStore(
    (s) => s.setPermissionStatus,
  );

  const [unlockedIds, setUnlockedIds] = useState<Record<number, boolean>>({});

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

  /**
   * Wrapper unificado pros dois toggles de notificação.
   * Fluxo:
   *  1. Se está DESligando → só grava a pref (o store cancela o
   *     agendamento internamente).
   *  2. Se está LIGando pela 1ª vez (sem registro) → pede permissão
   *     via `registerForPushNotificationsAsync`. Se o usuário nega,
   *     abre um Alert oferecendo levá-lo pros Ajustes.
   *  3. Se já registrou antes → só grava, o schedule é imediato.
   *
   * Toda a lógica de agendamento fica no store (`setBedtimeEnabled`
   * já dispara `scheduleBedtimeReminder(v)`) — aqui só orquestramos
   * a permissão.
   */
  const handleToggleNotification = async (
    kind: "bedtime" | "streak",
    value: boolean,
  ) => {
    // Turn off: caminho simples.
    if (!value) {
      if (kind === "bedtime") await setBedtimeEnabled(false);
      else await setStreakEnabled(false);
      return;
    }

    // Turn on: pede permissão se ainda não pediu.
    if (!notifRegistered) {
      const result = await registerForPushNotificationsAsync();
      setPermissionStatus(result.permissionStatus);

      if (result.permissionStatus !== "granted") {
        // Usuário negou (ou é simulator sem push). Mostra caminho
        // pra reabrir permissões no OS. Não muda o toggle — o
        // Switch volta pro estado anterior por si só, já que não
        // chamamos setBedtimeEnabled(true).
        Alert.alert(
          t("notifications.permissionDeniedTitle"),
          t("notifications.permissionDeniedBody"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("notifications.permissionOpenSettings"),
              onPress: () => Linking.openSettings(),
            },
          ],
        );
        return;
      }

      await setNotifRegistered(true);
    }

    if (kind === "bedtime") await setBedtimeEnabled(true);
    else await setStreakEnabled(true);
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
          {profile && !loading ? (
            <View style={{ marginTop: 24, alignItems: "center" }}>
              <Text fontSize={48} title={PROFILE_EMOJIS[profile]} />

              <Text
                fontFamily="bold"
                fontSize={22}
                color="#FFF"
                title={t(`profile.profileTypes.${profile}.title`)}
                style={{ marginTop: 8 }}
              />
              <Text
                fontFamily="regular"
                fontSize={14}
                color="rgba(255,255,255,0.7)"
                title={t(`profile.profileTypes.${profile}.description`)}
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
                title={t("profile.defaultName")}
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
                title={t(`profile.levels.${meta.i18nKey}`)}
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
                title={t("profile.chapters")}
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
                title={t("profile.badges")}
              />
            </View>
          </View>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text
                fontSize={14}
                color="#8E8E93"
                title={t("profile.journeyProgress")}
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

        {/* Language Section */}
        <View style={styles.sectionHeader}>
          <Text
            fontFamily="bold"
            fontSize={20}
            color="#FFF"
            title={t("profile.languageSection")}
            style={{ letterSpacing: -0.5 }}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setLanguageOpen(true)}
          style={styles.languageRow}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text fontSize={22} title={localeMeta.flag} />
            <View style={{ marginLeft: 12 }}>
              <Text
                fontFamily="bold"
                fontSize={16}
                color="#FFF"
                title={localeMeta.nativeName}
              />
              <Text
                fontFamily="regular"
                fontSize={12}
                color="#8E8E93"
                title={t("profile.changeLanguage")}
                style={{ marginTop: 2 }}
              />
            </View>
          </View>
          <Text fontSize={20} color="#8E8E93" title="›" />
        </TouchableOpacity>

        {/* Notifications Section */}
        <View style={styles.sectionHeader}>
          <Text
            fontFamily="bold"
            fontSize={20}
            color="#FFF"
            title={t("notifications.sectionTitle")}
            style={{ letterSpacing: -0.5 }}
          />
        </View>

        <View style={styles.notifCard}>
          <View style={styles.notifRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text
                fontFamily="bold"
                fontSize={16}
                color="#FFF"
                title={t("notifications.bedtimeLabel")}
              />
              <Text
                fontFamily="regular"
                fontSize={12}
                color="#8E8E93"
                title={t("notifications.bedtimeDescription")}
                style={{ marginTop: 2 }}
              />
            </View>
            <Switch
              value={bedtimeEnabled}
              onValueChange={(v) => handleToggleNotification("bedtime", v)}
              trackColor={{ false: "#3A3A3C", true: "#8B5CF6" }}
              thumbColor="#FFF"
              ios_backgroundColor="#3A3A3C"
            />
          </View>

          <View style={styles.notifDivider} />

          <View style={styles.notifRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text
                fontFamily="bold"
                fontSize={16}
                color="#FFF"
                title={t("notifications.streakLabel")}
              />
              <Text
                fontFamily="regular"
                fontSize={12}
                color="#8E8E93"
                title={t("notifications.streakDescription")}
                style={{ marginTop: 2 }}
              />
            </View>
            <Switch
              value={streakEnabled}
              onValueChange={(v) => handleToggleNotification("streak", v)}
              trackColor={{ false: "#3A3A3C", true: "#8B5CF6" }}
              thumbColor="#FFF"
              ios_backgroundColor="#3A3A3C"
            />
          </View>
        </View>

        {/* Achievements Section */}
        <View style={styles.sectionHeader}>
          <Text
            fontFamily="bold"
            fontSize={20}
            color="#FFF"
            title={t("profile.achievementsSection")}
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
                    title={t(
                      `profile.achievements.items.${item.i18nKey}.title`,
                    )}
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
            title: t(
              `profile.achievements.items.${activeAchievement.i18nKey}.title`,
            ),
            subtitle: t(
              `profile.achievements.items.${activeAchievement.i18nKey}.description`,
            ),
            icon: activeAchievement.icon,
            description: activeAchievement.secret
              ? t("profile.achievements.secretUnlocked")
              : t("profile.achievements.unlockedByChapters", {
                  count: activeAchievement.req,
                }),
          }}
          onClose={() => setActiveAchievement(null)}
        />
      )}

      <LanguageSelector
        visible={languageOpen}
        onClose={() => setLanguageOpen(false)}
      />
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
  languageRow: {
    width: width * 0.9,
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  notifCard: {
    width: width * 0.9,
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  notifDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginLeft: 0,
  },
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
