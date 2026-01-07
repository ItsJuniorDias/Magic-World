import { Pressable, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useRef, useState } from "react"; // Adicionado useState

import { Colors } from "@/constants/theme";
import Text from "@/components/text";

import { GlassView } from "expo-glass-effect";
import { FontAwesome6 } from "@expo/vector-icons";

import { Container, ContainerStorie } from "./styles";
import { useLocalSearchParams } from "expo-router/build/hooks";
import { NextChapterButton } from "@/components/(next-chapter-button)";

import * as Speech from "expo-speech";

const HEADER_HEIGHT = 420;
const MIN_HEADER_HEIGHT = 160;

export default function StorieScreen() {
  const { storie, title, thumbnail, currentIndex, storyId } =
    useLocalSearchParams();
  const [isSpeaking, setIsSpeaking] = useState(false); // Estado para o ícone

  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;

  /* HEADER IMAGE ANIMATIONS */
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
    outputRange: [HEADER_HEIGHT, MIN_HEADER_HEIGHT],
    extrapolate: "clamp",
  });

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

  // Função de áudio
  const toggleSpeak = async () => {
    const speaking = await Speech.isSpeakingAsync();

    if (speaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);

      Speech.speak(String(storie), {
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
        language: "en-US",
      });
    }
  };

  return (
    <>
      <Container>
        {/* BOTÃO VOLTAR */}
        <Pressable
          style={styles.backButtonWrapper}
          onPress={() => {
            Speech.stop();

            router.back();
          }}
        >
          <GlassView
            style={styles.glassButton}
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

        {/* BOTÃO PLAY (MESMO ESTILO) */}
        <Pressable style={styles.playButtonWrapper} onPress={toggleSpeak}>
          <GlassView
            style={styles.glassButton}
            isInteractive
            glassEffectStyle="clear"
          >
            <FontAwesome6
              name={isSpeaking ? "stop" : "play"}
              size={20}
              color={Colors.dark.text}
            />
          </GlassView>
        </Pressable>

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

        <Animated.Image
          source={{ uri: String(thumbnail) }}
          style={[styles.headerImage, { height: headerHeight }]}
        />

        <Animated.View style={[styles.gradient, { height: headerHeight }]} />

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
              fontSize={16}
              color={Colors.dark.text}
              title={storie}
            />
          </ContainerStorie>
        </Animated.ScrollView>
      </Container>

      <NextChapterButton
        storyId={String(storyId)}
        currentIndex={Number(currentIndex)}
        onNextChapter={(nextIndex: number, hasAccess: boolean) => {
          if (!hasAccess) {
            router.push("/(subscribe)");
          } else {
            router.push(`/storie?storyId=${storyId}&currentIndex=${nextIndex}`);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backButtonWrapper: {
    position: "absolute",
    top: 64,
    left: 24,
    zIndex: 40,
  },
  playButtonWrapper: {
    position: "absolute",
    top: 64,
    right: 24, // Posicionado na direita
    zIndex: 40,
  },
  glassButton: {
    height: 48,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 48,
  },
  animatedTitle: {
    position: "absolute",
    zIndex: 30,
    paddingRight: 32,
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
