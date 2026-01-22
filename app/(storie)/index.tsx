import {
  Pressable,
  StyleSheet,
  Animated,
  Alert,
  Dimensions,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";

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

import AsyncStorage from "@react-native-async-storage/async-storage";
import GuidedReadingModal from "@/components/guided-reading-modal";

import TrackPlayer, {
  Capability,
  Event,
  State,
  useTrackPlayerEvents,
} from "react-native-track-player";

import { useLockScreenPlayer } from "@/hooks/LockScreenPlayer";
/* =========================
   CONSTANTS
========================= */
const HEADER_HEIGHT = 420;
const MIN_HEADER_HEIGHT = 160;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SAFE_MARGIN = 140;

/* =========================
   GEMINI
========================= */
const genAI = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY || "",
);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export default function StorieScreen() {
  const { storie, title, thumbnail, currentIndex, storyId } =
    useLocalSearchParams();

  const [showGuidedModal, setShowGuidedModal] = useState(false);

  const router = useRouter();

  /* =========================
     REFS
  ========================== */
  const scrollY = useRef(new Animated.Value(0)).current;
  const currentScrollY = useRef(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const sentencePositions = useRef<number[]>([]);
  const speakSessionRef = useRef(0);

  /* =========================
     STATE
  ========================== */
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlay, setIsPlay] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(-1);
  const [translatedText, setTranslatedText] = useState({
    title,
    storie,
  });

  const lockScreen = useLockScreenPlayer({
    title: translatedText.title,
    artist: "Magic World",
    artwork: thumbnail,
    url: require("@/assets/sounds/background.mp3"),
    volume: 0.09,
  });

  /* =========================
     TRACKPLAYER INIT
  ========================== */
  useEffect(() => {
    (async () => {
      await TrackPlayer.setupPlayer();

      await TrackPlayer.updateOptions({
        stopWithApp: true,
        alwaysPauseOnInterruption: true,
        capabilities: [
          TrackPlayer.CAPABILITY_PLAY,
          TrackPlayer.CAPABILITY_PAUSE,
          TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
          TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
          TrackPlayer.CAPABILITY_STOP,
        ],
        compactCapabilities: [
          TrackPlayer.CAPABILITY_PLAY,
          TrackPlayer.CAPABILITY_PAUSE,
        ],
        notificationCapabilities: [
          TrackPlayer.CAPABILITY_PLAY,
          TrackPlayer.CAPABILITY_PAUSE,
          TrackPlayer.CAPABILITY_STOP,
        ],
      });

      await TrackPlayer.add([
        {
          id: "bg-music",
          url: require("@/assets/sounds/background.mp3"),
          title: title,
          artist: "Magic World",
          artwork: thumbnail,
        },
      ]);

      await TrackPlayer.setVolume(0.15);
    })();
  }, []);

  /* =========================
     TRACKPLAYER EVENTS
  ========================== */

  const pauseAllAudio = useCallback(async () => {
    speakSessionRef.current += 1; // interrompe sessão atual do speech
    Speech.stop(); // pausa a fala
    await TrackPlayer.pause(); // pausa a música

    setIsPlay(false);
    setActiveSentenceIndex(-1);
  }, []);

  useTrackPlayerEvents(
    [Event.PlaybackQueueEnded, Event.RemotePlay, Event.RemotePause],
    async (event) => {
      if (event.type === Event.PlaybackQueueEnded) {
        await TrackPlayer.seekTo(0);
        await TrackPlayer.play();
      }

      if (event.type === Event.RemotePlay) {
        await TrackPlayer.play();
        handleSpeak(true); // resume speech
      }

      if (event.type === Event.RemotePause) {
        await pauseAllAudio(); // chama a função unificada
      }
    },
  );

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
        ]),
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
     SENTENCES
  ========================== */
  const sentences = useMemo(() => {
    if (!translatedText.storie) return [];
    return translatedText.storie.split(/(?<=[.!?])\s+/).filter(Boolean);
  }, [translatedText.storie]);

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
      "The translation service is overloaded. Please try again later.",
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
     SPEECH + TRACKPLAYER
  ========================== */
  const handleSpeak = async (resume = false) => {
    // Se já está tocando, pausa tudo
    if (isPlay && !resume) {
      speakSessionRef.current += 1;
      Speech.stop();

      await TrackPlayer.pause();
      setIsPlay(false);
      setActiveSentenceIndex(-1);
      return;
    }

    // Inicia do zero
    if (!sentences.length) return;

    speakSessionRef.current += 1;
    const sessionId = speakSessionRef.current;

    setIsPlay(true);
    setActiveSentenceIndex(0);

    await TrackPlayer.play();

    const langCode = franc(translatedText.storie as string);
    const language =
      {
        eng: "en-US",
        spa: "es-ES",
        por: "pt-BR",
        fra: "fr-FR",
        cmn: "zh-CN",
        hin: "hi-IN",
      }[langCode] ?? "en-US";

    let index = resume ? activeSentenceIndex : 0;

    const speakNext = () => {
      if (speakSessionRef.current !== sessionId) return;
      if (index >= sentences.length) {
        TrackPlayer.pause();
        setIsPlay(false);
        setActiveSentenceIndex(-1);
        return;
      }

      setActiveSentenceIndex(index);

      Speech.speak(sentences[index], {
        volume: 1.0,
        language,
        rate: 0.9,
        pitch: 1.0,
        onDone: () => {
          if (speakSessionRef.current !== sessionId) return;
          index += 1;
          speakNext();
        },
        onStopped: () => {
          if (speakSessionRef.current !== sessionId) return;
          TrackPlayer.pause();
          setIsPlay(false);
          setActiveSentenceIndex(-1);
        },
      });
    };

    speakNext();
  };

  /* =========================
     SCROLL INTELIGENTE
  ========================== */
  useEffect(() => {
    if (!isPlay || activeSentenceIndex < 0) return;
    if (activeSentenceIndex % 3 !== 0) return;

    const sentenceY = sentencePositions.current[activeSentenceIndex];
    if (sentenceY == null) return;

    scrollRef.current?.scrollTo({
      y: Math.max(sentenceY - SCREEN_HEIGHT / 2, 0),
      animated: true,
    });
  }, [activeSentenceIndex, isPlay]);

  const handlePlayPress = async () => {
    const hasSeen = await AsyncStorage.getItem("@guided_reading_seen");

    await lockScreen.play();

    if (!hasSeen) {
      await AsyncStorage.setItem("@guided_reading_seen", "true");
      setShowGuidedModal(true);
      return;
    }

    handleSpeak();
  };

  const stopAllAudio = async () => {
    speakSessionRef.current += 1;

    Speech.stop();
    await TrackPlayer.pause();

    setIsPlay(false);
    setActiveSentenceIndex(-1);
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopAllAudio();
        lockScreen.stop();
      };
    }, [lockScreen]),
  );

  /* =========================
     UI
  ========================== */
  return (
    <>
      <Container>
        {/* BACK */}
        <Pressable
          style={styles.backButtonWrapper}
          onPress={async () => {
            speakSessionRef.current += 1;
            Speech.stop();
            await TrackPlayer.pause();

            setIsPlay(false);
            setActiveSentenceIndex(-1);

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
        <Pressable style={styles.playButtonWrapper} onPress={handlePlayPress}>
          <GlassView style={styles.glassButton} isInteractive>
            <FontAwesome6
              name={isPlay ? "stop" : "play"}
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
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: HEADER_HEIGHT,
            paddingBottom: 32,
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: false,
              listener: (e) => {
                currentScrollY.current = e.nativeEvent.contentOffset.y;
              },
            },
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
                <SkeletonBlock height={24} />
                <SkeletonBlock height={24} />
                <SkeletonBlock height={24} />
                <SkeletonBlock height={24} />
                <SkeletonBlock height={24} />
              </>
            ) : (
              <>
                {sentences.map((sentence, index) => (
                  <View
                    key={index}
                    onLayout={(e) => {
                      sentencePositions.current[index] =
                        e.nativeEvent.layout.y + HEADER_HEIGHT;
                    }}
                    style={[
                      styles.sentence,
                      index === activeSentenceIndex && styles.activeSentence,
                    ]}
                  >
                    <Text
                      fontFamily="regular"
                      fontSize={16}
                      color={Colors.dark.text}
                      title={sentence}
                    />
                  </View>
                ))}
              </>
            )}
          </ContainerStorie>
        </Animated.ScrollView>
      </Container>

      <NextChapterButton
        storyId={String(storyId)}
        currentIndex={Number(currentIndex)}
      />

      <GuidedReadingModal
        visible={showGuidedModal}
        onClose={() => {
          setShowGuidedModal(false);
          handleSpeak();
        }}
      />
    </>
  );
}

/* =========================
   STYLES
========================= */
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
    width: "100%",
    zIndex: 1,
  },
  gradient: {
    position: "absolute",
    top: 0,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 2,
  },
  skeleton: {
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginBottom: 8,
  },
  sentence: {
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  activeSentence: {
    backgroundColor: "rgba(255,215,120,0.35)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: 6,
  },
});
