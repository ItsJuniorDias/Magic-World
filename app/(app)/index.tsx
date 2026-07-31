import React, { useEffect, useRef } from "react";
import { Animated, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Purchases from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import { useThemedTokens } from "@/hooks/use-tokens";
import { useLikedStore } from "@/store/useLikedStore";
import { useAdventureProfileStore } from "@/store/useAdventureProfileStore";
import { useT } from "@/i18n";

import background_header from "../../assets/images/background-header.png";
import { Container, Content, Gradient, GradientImage } from "./styles";

const { height } = Dimensions.get("window");

export default function OnboardingScreen() {
  const t = useThemedTokens();
  const { t: tr } = useT();
  const router = useRouter();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  const { loadProfile, profile } = useAdventureProfileStore();
  const init = useLikedStore((s) => s.init);

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        // Zoom sutil
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.08,
            duration: 9000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 9000,
            useNativeDriver: true,
          }),
        ]),
        // Parallax vertical
        Animated.sequence([
          Animated.timing(translateYAnim, {
            toValue: -height * 0.04,
            duration: 9000,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 0,
            duration: 9000,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    init();

    const load = async () => {
      await loadProfile();

      if (!profile) {
        await AsyncStorage.setItem("@adventure_profile_viewed", "true");
      }
    };
    load();

    // Nota: chave RevenueCat pública por design, ok manter hardcoded
    Purchases.configure({ apiKey: "appl_UcIhNLORZZgNuPFDjVUoqawwHfK" });
  }, []);

  return (
    <>
      <StatusBar style="light" translucent />

      <Container>
        <Animated.Image
          source={background_header}
          resizeMode="cover"
          style={{
            width: "100%",
            height: "80%",
            transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
          }}
        />

        <GradientImage
          start={{ x: 0.3, y: 0.3 }}
          colors={["rgba(0,0,0,0.4)", "transparent"]}
        />
      </Container>

      <Gradient
        colors={[
          "transparent",
          t.color.overlayStrong,
          t.color.overlayStrong,
          t.color.overlayStrong,
          t.color.overlayStrong,
        ]}
      >
        <Content>
          <Text
            variant="display"
            size="xxxl"
            color={t.color.textPrimary}
          >
            {`${tr("onboarding.welcomeLine1")}\n${tr("onboarding.welcomeLine2")}`}
          </Text>

          <Text variant="body" color={t.color.textPrimary}>
            {tr("onboarding.tagline")}
          </Text>

          <Button
            label={tr("onboarding.getStarted")}
            size="lg"
            fullWidth
            onPress={() => router.push("/(profile-adventure)")}
            style={{ marginTop: t.spacing.lg }}
          />
        </Content>
      </Gradient>
    </>
  );
}
