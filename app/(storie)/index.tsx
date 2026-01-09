import { Pressable, StyleSheet, Animated, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useRef, useState, useEffect } from "react";

import { Colors } from "@/constants/theme";
import Text from "@/components/text";

import { GlassView } from "expo-glass-effect";
import { FontAwesome6 } from "@expo/vector-icons";

import { franc } from "franc-min";

import { ContextMenu, Host, Picker } from "@expo/ui/swift-ui";

import { Container, ContainerStorie } from "./styles";
import { useLocalSearchParams } from "expo-router/build/hooks";
import { NextChapterButton } from "@/components/(next-chapter-button)";

import * as Speech from "expo-speech";
import { GoogleGenerativeAI } from "@google/generative-ai";

const HEADER_HEIGHT = 420;
const MIN_HEADER_HEIGHT = 160;

/* GEMINI */
const genAI = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY || ""
);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export default function StorieScreen() {
  const { storie, title, thumbnail, currentIndex, storyId } =
    useLocalSearchParams();

  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [isPlay, setIsPlay] = useState(false);

  const [translatedText, setTranslatedText] = useState({
    title,
    storie,
  });

  /* =========================
     SKELETON ANIMATION
  ========================== */
  const skeletonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isTranslating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      skeletonAnim.stopAnimation();
    }
  }, [isTranslating]);

  const SkeletonBlock = ({
    height,
    width = "100%",
  }: {
    height: number;
    width?: number | string;
  }) => (
    <Animated.View
      style={[
        styles.skeleton,
        {
          height,
          width,
          opacity: skeletonAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.35, 0.75],
          }),
        },
      ]}
    />
  );

  /* =========================
     HEADER ANIMATIONS
  ========================== */
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

  /* =========================
     TRANSLATION
  ========================== */
  async function translateText(text: string, target = "en") {
    const prompt = `
      Translate the following text to ${target}.
      Return only the translated text.
      Text: "${text}"
    `;

    let attempts = 3;

    while (attempts > 0) {
      try {
        const result = await geminiModel.generateContent(prompt);
        return result.response.text();
      } catch (error: any) {
        if (error.toString().includes("503")) {
          attempts--;
          await new Promise((r) => setTimeout(r, 1200));
        } else {
          throw error;
        }
      }
    }

    Alert.alert(
      "Translation unavailable",
      "The translation service is overloaded. Please try again later."
    );

    return text;
  }

  async function handleTranslateAll(lang: string) {
    setIsTranslating(true);

    try {
      const newTitle = await translateText(String(title), lang);
      const newStorie = await translateText(String(storie), lang);

      setTranslatedText({
        title: newTitle,
        storie: newStorie,
      });
    } finally {
      setIsTranslating(false);
    }
  }

  /* =========================
     CONTEXT MENU
  ========================== */
  const renderContextMenu = () => {
    const map = ["en", "es", "pt", "fr", "zh", "hi"];

    return (
      <Host style={{ width: 48, height: 48 }}>
        <ContextMenu>
          <ContextMenu.Items>
            <Picker
              label="Translate"
              options={[
                "English",
                "Spanish",
                "Portuguese",
                "French",
                "Chinese",
                "Hindi",
              ]}
              variant="menu"
              selectedIndex={selectedIndex}
              onOptionSelected={({ nativeEvent: { index } }) => {
                setSelectedIndex(index);
                handleTranslateAll(map[index]);
              }}
            />
          </ContextMenu.Items>

          <ContextMenu.Trigger>
            <GlassView style={styles.glassButton} isInteractive>
              <FontAwesome6
                name={isTranslating ? "spinner" : "language"}
                size={20}
                color={Colors.dark.text}
              />
            </GlassView>
          </ContextMenu.Trigger>
        </ContextMenu>
      </Host>
    );
  };

  /* =========================
     SPEECH
  ========================== */
  const handleSpeak = () => {
    const text = translatedText.storie;

    if (!text) return;

    if (!isPlay) {
      setIsPlay(true);

      const langCode = franc(text);

      const langMap = {
        eng: "en-US",
        spa: "es-ES",
        por: "pt-BR",
        fra: "fr-FR",
        cmn: "zh-CN",
        hin: "hi-IN",
      };

      const language = langMap[langCode as keyof typeof langMap] ?? "en-US"; // fallback padrão

      Speech.speak(text, {
        language,
        pitch: 1.0,
        rate: 1.0,
        onDone: () => setIsPlay(false),
        onStopped: () => setIsPlay(false),
        onError: () => setIsPlay(false),
      });
    } else {
      Speech.stop();
      setIsPlay(false);
    }
  };

  return (
    <>
      <Container>
        {/* BACK */}
        <Pressable
          style={styles.backButtonWrapper}
          onPress={() => {
            Speech.stop();
            router.back();
          }}
        >
          <GlassView style={styles.glassButton} isInteractive>
            <FontAwesome6
              name="chevron-left"
              size={22}
              color={Colors.dark.text}
            />
          </GlassView>
        </Pressable>

        {/* TRANSLATE */}
        <Pressable style={styles.translateButtonWrapper}>
          {renderContextMenu()}
        </Pressable>

        {/* PLAY */}
        <Pressable style={styles.playButtonWrapper} onPress={handleSpeak}>
          <GlassView style={styles.glassButton} isInteractive>
            <FontAwesome6
              name={isSpeaking ? "stop" : "play"}
              size={20}
              color={Colors.dark.text}
            />
          </GlassView>
        </Pressable>

        {/* TITLE */}
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
          {isTranslating ? (
            <SkeletonBlock height={32} width={220} />
          ) : (
            <Text
              fontFamily="bold"
              fontSize={28}
              color={Colors.dark.text}
              title={translatedText.title}
              numberOfLines={2}
            />
          )}
        </Animated.View>

        {/* HEADER IMAGE */}
        <Animated.Image
          source={{ uri: String(thumbnail) }}
          style={[styles.headerImage, { height: headerHeight }]}
        />

        <Animated.View style={[styles.gradient, { height: headerHeight }]} />

        {/* CONTENT */}
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
            {isTranslating ? (
              <>
                <SkeletonBlock height={24} />
                <SkeletonBlock height={24} />
                <SkeletonBlock height={24} />
                <SkeletonBlock height={24} />
                <SkeletonBlock height={24} />
              </>
            ) : (
              <Text
                fontFamily="regular"
                fontSize={16}
                color={Colors.dark.text}
                title={translatedText.storie}
              />
            )}
          </ContainerStorie>
        </Animated.ScrollView>
      </Container>

      <NextChapterButton
        storyId={String(storyId)}
        currentIndex={Number(currentIndex)}
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
  translateButtonWrapper: {
    position: "absolute",
    top: 64,
    right: 88,
    zIndex: 40,
  },
  playButtonWrapper: {
    position: "absolute",
    top: 64,
    right: 24,
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
  skeleton: {
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.35)", // mais visível no header
    marginBottom: 8,
  },
});
