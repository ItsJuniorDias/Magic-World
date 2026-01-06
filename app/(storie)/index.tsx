import { Pressable, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useRef } from "react";

import { Colors } from "@/constants/theme";
import Text from "@/components/text";

import { GlassView } from "expo-glass-effect";
import { FontAwesome6 } from "@expo/vector-icons";

import { Container, ContainerStorie } from "./styles";
import { useLocalSearchParams } from "expo-router/build/hooks";

const HEADER_HEIGHT = 420;
const MIN_HEADER_HEIGHT = 160;

export default function StorieScreen() {
  const { storie, title, thumbnail } = useLocalSearchParams();

  const router = useRouter();

  const scrollY = useRef(new Animated.Value(0)).current;

  /* HEADER IMAGE */
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
    outputRange: [HEADER_HEIGHT, MIN_HEADER_HEIGHT],
    extrapolate: "clamp",
  });

  /* GRADIENT */
  const gradientOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [1, 0.85],
    extrapolate: "clamp",
  });

  /* TITLE ANIMATION */
  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [320, 72],
    extrapolate: "clamp",
  });

  const titleTranslateX = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [24, 96],
    extrapolate: "clamp",
  });

  const titleScale = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [1, 0.8],
    extrapolate: "clamp",
  });

  return (
    <Container>
      {/* BOTÃO VOLTAR */}
      <Pressable style={styles.backButtonWrapper} onPress={() => router.back()}>
        <GlassView
          style={styles.buttonBack}
          isInteractive
          glassEffectStyle="clear"
        >
          <FontAwesome6
            name="chevron-left"
            size={22}
            color={Colors.dark.text}
          />
        </GlassView>
      </Pressable>

      {/* TÍTULO ANIMADO */}
      <Animated.View
        style={[
          styles.animatedTitle,
          {
            transform: [
              { translateY: titleTranslateY },
              { translateX: titleTranslateX },
              { scale: titleScale },
            ],
          },
        ]}
      >
        <Text
          fontFamily="bold"
          fontSize={28}
          color={Colors.dark.text}
          title={title}
          numberOfLines={2}
        />
      </Animated.View>

      {/* IMAGEM DE FUNDO */}
      <Animated.Image
        source={{
          uri: thumbnail,
        }}
        style={[styles.headerImage, { height: headerHeight }]}
      />

      {/* GRADIENT */}
      <Animated.View
        style={[
          styles.gradient,
          { height: headerHeight, opacity: gradientOpacity },
        ]}
      />

      {/* SCROLL */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: HEADER_HEIGHT,
          paddingBottom: 32,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <ContainerStorie>
          <Text
            fontFamily="regular"
            fontSize={14}
            color={Colors.dark.text}
            title={storie}
          />
        </ContainerStorie>
      </Animated.ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  backButtonWrapper: {
    position: "absolute",
    top: 64,
    left: 24,
    zIndex: 30,
  },
  buttonBack: {
    height: 48,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 48,
  },
  animatedTitle: {
    position: "absolute",
    zIndex: 30,
    paddingRight: 24,
  },
  headerImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    zIndex: 1,
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 2,
  },
});
