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
import { useT } from "@/i18n";
import { useProStatus } from "@/hooks/useProStatus";

export default function AdventureProfileIntro() {
  const router = useRouter();
  const { t } = useT();

  // Pro status é lido aqui pra decidir o destino do CTA. Não bloqueia
  // o render: se `loading === true` quando o usuário toca, tratamos
  // como "not pro" — vale mais mostrar paywall pra um pagante em race
  // condition (que pode fazer restore em 1 clique) do que deixar um
  // não-pagante furar o gate.
  const { isPro } = useProStatus();

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

  /**
   * Post-onboarding gate:
   *   - Assinante ativo → vai direto pras tabs (sem paywall na cara).
   *   - Não-assinante   → paywall obrigatória. `router.replace` (não
   *     push) pra impedir swipe-back voltando pro intro do perfil.
   *
   * O paywall usa `source: "post_onboarding"` no analytics, o que
   * separa esse funil do paywall abertoManualmente por locked story
   * ou botão de upgrade na home.
   */
  const handleContinue = () => {
    if (isPro) {
      router.replace("/(tabs)");
    } else {
      router.replace({
        pathname: "/(paywall-onboarding)",
        params: { source: "post_onboarding" },
      });
    }
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
            title={t("adventureIntro.title")}
            fontFamily="bold"
            fontSize={28}
            color={Colors.dark.text}
            style={{ letterSpacing: -0.5 }}
          />

          <Text
            title={t("adventureIntro.subtitle1")}
            fontFamily="regular"
            fontSize={18}
            color={Colors.dark.text}
          />

          <Text
            title={t("adventureIntro.subtitle2")}
            fontFamily="regular"
            fontSize={16}
            color={Colors.dark.text}
          />

          <Text
            title={t("adventureIntro.tip")}
            fontFamily="regular"
            fontSize={16}
            color={Colors.dark.text}
          />

          <Text
            title={t("adventureIntro.goal")}
            fontFamily="regular"
            fontSize={16}
            color={Colors.dark.text}
          />

          <Text
            title={t("adventureIntro.hint")}
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
              title={t("adventureIntro.cta")}
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
