import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Platform } from "react-native";

import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { StatusBar } from "expo-status-bar";

import background_header from "../../assets/images/background-header.png";

import { Button, Container, Content, Gradient, GradientImage } from "./styles";
import { useRouter } from "expo-router";

import Purchases from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLikedStore } from "@/store/useLikedStore";

const { height } = Dimensions.get("window");

export default function OnboardingScreen() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  const router = useRouter();

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        // 🔍 Zoom
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

        // 🧭 Parallax vertical
        Animated.sequence([
          Animated.timing(translateYAnim, {
            toValue: -height * 0.04, // sobe levemente
            duration: 9000,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 0,
            duration: 9000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  const saveProStatus = async (status: boolean) => {
    try {
      await AsyncStorage.setItem("@user_is_pro", JSON.stringify(status));
    } catch (e) {
      console.error("Erro ao salvar status Pro", e);
    }
  };

  const init = useLikedStore((s) => s.init);

  useEffect(() => {
    init();
    // saveProStatus(true);

    // Platform-specific API keys
    const iosApiKey = "appl_UcIhNLORZZgNuPFDjVUoqawwHfK";

    Purchases.configure({ apiKey: iosApiKey });
  }, []);

  return (
    <>
      <StatusBar style="light" translucent />

      <Container>
        {/* Imagem com PARALLAX + ZOOM */}
        <Animated.Image
          source={background_header}
          resizeMode="cover"
          style={{
            width: "100%",
            height: "80%", // evita borda branca ao mover
            transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
          }}
        />

        {/* Gradient no topo */}
        <GradientImage
          start={{ x: 0.3, y: 0.3 }}
          colors={["rgba(0,0,0,0.4)", "transparent"]}
        />
      </Container>

      <Gradient
        colors={[
          "transparent",
          "rgba(0,0,0,0.9)",
          "rgba(0,0,0,0.9)",
          "rgba(0,0,0,0.9)",
          "rgba(0,0,0,0.9)",
        ]}
      >
        <Content>
          <Text
            fontFamily="bold"
            fontSize={28}
            color={Colors.dark.text}
            title={`Welcome to Our\nAudiobook Journey`}
          />

          <Text
            fontFamily="regular"
            fontSize={16}
            color={Colors.dark.text}
            title={`Turn the page, or rather, press play, and let the adventure begin.`}
          />

          <Button onPress={() => router.push("/(tabs)")} activeOpacity={0.85}>
            <Text
              fontFamily="bold"
              fontSize={18}
              color={Colors.dark.background}
              title="Get Started"
            />
          </Button>
        </Content>
      </Gradient>
    </>
  );
}
