import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { useAdventureProfileStore } from "@/store/useAdventureProfileStore";
import { useT } from "@/i18n";

type ProfileType = "brave" | "clever" | "wild" | "wise";

// Ícones ficam fora do i18n — são emojis independentes de idioma.
const PROFILE_ICONS: Record<ProfileType, string> = {
  brave: "🛡️",
  clever: "💡",
  wild: "🪶",
  wise: "📖",
};

export default function AdventureProfileResult() {
  const router = useRouter();
  const { t } = useT();

  const calculateProfile = useAdventureProfileStore(
    (state) => state.calculateProfile,
  );

  const loadProfile = useAdventureProfileStore((state) => state.loadProfile);

  const [profileType, setProfileType] = useState<ProfileType | null>(null);

  useEffect(() => {
    loadProfile(); // carrega do Firebase ao iniciar
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      const result = await calculateProfile();
      console.log(result, "RESULT");
      setProfileType(result);
    };

    fetchProfile();
  }, [calculateProfile]);

  if (!profileType) return null;

  // Monta o content dinâmico a partir das traduções + ícone estático.
  const base = `adventureResult.profiles.${profileType}`;
  const content = {
    title: t(`${base}.title`),
    description: t(`${base}.description`),
    icon: <Text fontSize={64} title={PROFILE_ICONS[profileType]} />,
    extra: [
      {
        title: t("adventureResult.strengths"),
        description: t(`${base}.strengths`),
      },
      {
        title: t("adventureResult.challenges"),
        description: t(`${base}.challenges`),
      },
      {
        title: t("adventureResult.advice"),
        description: t(`${base}.advice`),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text
            title={t("adventureResult.kicker")}
            fontFamily="regular"
            fontSize={18}
            color="rgba(255,255,255,0.6)"
          />

          {content?.icon}

          <Text
            title={content?.title}
            fontFamily="bold"
            fontSize={32}
            color="#FFF"
            style={{ letterSpacing: -0.5 }}
          />

          <Text
            title={content?.description}
            fontFamily="regular"
            fontSize={16}
            color="rgba(255,255,255,0.8)"
            style={{ textAlign: "center" }}
          />

          {/* NOVO CONTEÚDO */}
          {content?.extra?.map((item, index) => (
            <View key={index} style={styles.extraBlock}>
              <Text
                title={item.title}
                fontFamily="bold"
                fontSize={20}
                color="#FFF"
              />
              <Text
                title={item.description}
                fontFamily="regular"
                fontSize={16}
                color="rgba(255,255,255,0.8)"
              />
            </View>
          ))}
        </View>

        <Pressable
          style={styles.button}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text
            title={t("adventureResult.cta")}
            fontFamily="bold"
            fontSize={18}
            color="#000"
          />
        </Pressable>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  content: {
    marginTop: 80,
    gap: 16,
    alignItems: "center",
  },
  extraBlock: {
    marginTop: 16,
    paddingHorizontal: 8,
    gap: 4,
    alignItems: "center",
  },
  button: {
    backgroundColor: "#FFF",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 24,
    marginTop: 24,
  },
});
