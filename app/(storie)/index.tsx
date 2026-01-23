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

import { LinearGradient } from "expo-linear-gradient";
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
  Event,
  State,
  useTrackPlayerEvents,
} from "react-native-track-player";

import { useLockScreenPlayer } from "@/hooks/LockScreenPlayer";
import * as Notifications from "expo-notifications";
import { BACKGROUND_TRACKS } from "@/constants/backgroundTracks";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/firebaseConfig";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const HEADER_HEIGHT = 420;
const MIN_HEADER_HEIGHT = 160;
const SCREEN_HEIGHT = Dimensions.get("window").height;

const genAI = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY || "",
);
export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export default function StorieScreen() {
  const { storie, title, thumbnail, currentIndex, storyId } =
    useLocalSearchParams();
  const router = useRouter();

  // --- REFS ---
  const scrollY = useRef(new Animated.Value(0)).current;
  const currentScrollY = useRef(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const sentencePositions = useRef<number[]>([]);
  const speakSessionRef = useRef(0);
  const lastSentenceIndexRef = useRef(0);

  // --- STATE ---
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showGuidedModal, setShowGuidedModal] = useState(false);
  const [isPlay, setIsPlay] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(-1);
  const [translatedText, setTranslatedText] = useState({
    title: String(title),
    storie: String(storie),
  });
  const [musicIndex, setMusicIndex] = useState(0);

  // Novos estados para otimização
  const [chapters, setChapters] = useState<any[]>([]);
  const [hasAccess, setHasAccess] = useState(false);

  const { pause, play, stop } = useLockScreenPlayer({
    title: translatedText.title,
    artist: "Magic World",
    artwork: String(thumbnail),
    url: BACKGROUND_TRACKS[musicIndex].uri,
    volume: 0.15,
  });

  // --- EFEITOS DE CARREGAMENTO ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const [storiesData, accessStatus] = await Promise.all([
          AsyncStorage.getItem("@user_stories_data"),
          AsyncStorage.getItem("@user_has_access"),
        ]);

        if (storiesData && storyId) {
          const parsed = JSON.parse(storiesData);
          if (parsed[storyId as string]) {
            setChapters(parsed[storyId as string].chapter || []);
          }
        }
        setHasAccess(accessStatus === "true");
      } catch (e) {
        console.warn("Error loading context data", e);
      }
    };
    loadData();
  }, [storyId]);

  useEffect(() => {
    const changeBackgroundMusic = async () => {
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: `bg-${musicIndex}`,
        url: BACKGROUND_TRACKS[musicIndex].uri,
        title: "Ambient Sound",
        artist: "Magic World",
      });
      const state = await TrackPlayer.getState();
      if (state === State.Playing) await TrackPlayer.play();
    };
    changeBackgroundMusic();
  }, [musicIndex]);

  // --- LOGICA DE NOTIFICAÇÃO E PAYWALL ---
  const notifyPaywall = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== "granted") {
      const permission = await Notifications.requestPermissionsAsync();
      finalStatus = permission.status;
    }
    if (finalStatus !== "granted") return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Next Chapter Locked 🔒",
        body: "Subscribe to access the next chapter.",
        sound: true,
      },
      trigger: null,
    });
  };

  const handleNextChapter = useCallback(async () => {
    const nextIdx = Number(currentIndex) + 1;

    // Fim da história
    if (nextIdx >= chapters.length) {
      Alert.alert("The End", "You've reached the last chapter of this story!");
      return;
    }

    // Bloqueio de plano
    if (!hasAccess) {
      await pauseAllAudio();
      await notifyPaywall();
      return;
    }

    // Sucesso -> Navega
    await stopAllAudio();
    const nextChapter = chapters[nextIdx];

    router.push({
      pathname: "/(storie)",
      params: {
        storie: nextChapter.storie,
        title: nextChapter.title,
        thumbnail: nextChapter.thumbnail,
        storyId: storyId,
        currentIndex: nextIdx,
      },
    });
  }, [currentIndex, chapters, hasAccess, storyId]);

  // --- CONTROLES DE ÁUDIO ---
  const pauseAllAudio = useCallback(async () => {
    speakSessionRef.current += 1;
    Speech.stop();
    await pause();
    setIsPlay(false);
  }, [pause]);

  const stopAllAudio = useCallback(async () => {
    speakSessionRef.current += 1;
    Speech.stop();
    await TrackPlayer.pause();
    setIsPlay(false);
    setActiveSentenceIndex(-1);
  }, []);

  useTrackPlayerEvents(
    [
      Event.PlaybackQueueEnded,
      Event.RemotePlay,
      Event.RemotePause,
      Event.RemoteNext,
      Event.RemotePrevious,
    ],
    async (event) => {
      if (event.type === Event.PlaybackQueueEnded) {
        await TrackPlayer.seekTo(0);
        await play();
      }
      if (event.type === Event.RemotePlay) {
        await play();
        handleSpeak();
      }
      if (event.type === Event.RemotePause) {
        await pauseAllAudio();
      }
      if (event.type === Event.RemoteNext) {
        handleNextChapter();
      }
      if (event.type === Event.RemotePrevious) {
        const isPlaying = (await TrackPlayer.getState()) === State.Playing;
        await TrackPlayer.seekTo(0);
        if (isPlaying) await TrackPlayer.play();
        handleSpeak(true);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    },
  );

  // --- SKELETON ANIMATION ---
  const skeletonAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isTranslating) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: false,
        }),
        Animated.timing(skeletonAnim, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [isTranslating]);

  const SkeletonBlock = ({
    height,
    width = "100%",
  }: {
    height: number;
    width?: any;
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

  // --- SENTENCES & SPEECH ---
  const sentences = useMemo(() => {
    if (!translatedText.storie) return [];
    return translatedText.storie.split(/(?<=[.!?])\s+/).filter(Boolean);
  }, [translatedText.storie]);

  const handleSpeak = async (resume = false) => {
    if (isPlay && !resume) {
      await pauseAllAudio();
      setActiveSentenceIndex(-1);
      return;
    }
    if (!sentences.length) return;

    speakSessionRef.current += 1;
    const sessionId = speakSessionRef.current;
    setIsPlay(true);
    await TrackPlayer.play();

    const langCode = franc(translatedText.storie);
    const language =
      {
        eng: "en-US",
        spa: "es-ES",
        por: "pt-BR",
        fra: "fr-FR",
        cmn: "zh-CN",
        hin: "hi-IN",
      }[langCode] ?? "en-US";

    let index = resume ? lastSentenceIndexRef.current : 0;

    const speakNext = () => {
      if (speakSessionRef.current !== sessionId) return;
      if (index >= sentences.length) {
        TrackPlayer.pause();
        setIsPlay(false);
        return;
      }
      setActiveSentenceIndex(index);
      lastSentenceIndexRef.current = index;

      Speech.speak(sentences[index], {
        volume: 1.0,
        language,
        rate: 0.9,
        pitch: 1.0,
        onDone: () => {
          index += 1;
          speakNext();
        },
        onStopped: () => {
          if (speakSessionRef.current === sessionId) {
            setIsPlay(false);
            setActiveSentenceIndex(-1);
          }
        },
      });
    };
    speakNext();
  };

  // --- HEADER ANIMATIONS ---
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

  // --- TRANSLATION ---
  async function handleTranslateAll(lang: string) {
    setIsTranslating(true);
    try {
      const prompt = (t: string) =>
        `Translate to ${lang}. Return only text: "${t}"`;
      const [newTitleRes, newStorieRes] = await Promise.all([
        geminiModel.generateContent(prompt(String(title))),
        geminiModel.generateContent(prompt(String(storie))),
      ]);
      setTranslatedText({
        title: newTitleRes.response.text(),
        storie: newStorieRes.response.text(),
      });
    } catch (e) {
      Alert.alert("Error", "Translation service busy.");
    } finally {
      setIsTranslating(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopAllAudio();
        stop();
      };
    }, [stop]),
  );

  return (
    <>
      <Container>
        <Pressable
          style={styles.backButtonWrapper}
          onPress={() => {
            stopAllAudio();
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

        <View style={styles.translateButtonWrapper}>
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
                  selectedIndex={selectedIndex}
                  onOptionSelected={({ nativeEvent: { index } }) => {
                    setSelectedIndex(index);
                    const map = ["en", "es", "pt", "fr", "zh", "hi"];
                    handleTranslateAll(map[index]);
                  }}
                />
                <Picker
                  label="Ambient Sound"
                  options={BACKGROUND_TRACKS.map((t) => t.title)}
                  selectedIndex={musicIndex}
                  onOptionSelected={({ nativeEvent: { index } }) =>
                    setMusicIndex(index)
                  }
                />
              </ContextMenu.Items>
              <ContextMenu.Trigger>
                <GlassView style={styles.glassButton} isInteractive>
                  <FontAwesome6
                    name={isTranslating ? "spinner" : "ellipsis-vertical"}
                    size={20}
                    color={Colors.dark.text}
                  />
                </GlassView>
              </ContextMenu.Trigger>
            </ContextMenu>
          </Host>
        </View>

        <Pressable style={styles.playButtonWrapper} onPress={handleSpeak}>
          <GlassView style={styles.glassButton} isInteractive>
            <FontAwesome6
              name={isPlay ? "stop" : "play"}
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

        <Animated.Image
          source={{ uri: String(thumbnail) }}
          style={[styles.headerImage, { height: headerHeight }]}
        />
        <Animated.View style={[styles.gradient, { height: headerHeight }]} />

        <Animated.ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: HEADER_HEIGHT,
            paddingBottom: 100,
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        >
          <ContainerStorie>
            {isTranslating
              ? Array(8)
                  .fill(0)
                  .map((_, i) => <SkeletonBlock key={i} height={24} />)
              : sentences.map((sentence, index) => (
                  <View
                    key={index}
                    style={styles.sentence}
                    onLayout={(e) => {
                      sentencePositions.current[index] =
                        e.nativeEvent.layout.y + HEADER_HEIGHT;
                    }}
                  >
                    {index === activeSentenceIndex ? (
                      <LinearGradient
                        colors={[
                          "rgba(255,215,120,0.28)",
                          "rgba(255,215,120,0.19)",
                        ]}
                        style={styles.activeHighlight}
                      >
                        <Text
                          fontFamily="regular"
                          fontSize={16}
                          color={Colors.dark.text}
                          title={sentence}
                        />
                      </LinearGradient>
                    ) : (
                      <Text
                        fontFamily="regular"
                        fontSize={16}
                        color={Colors.dark.text}
                        title={sentence}
                      />
                    )}
                  </View>
                ))}
          </ContainerStorie>
        </Animated.ScrollView>
      </Container>

      <NextChapterButton
        storyId={String(storyId)}
        currentIndex={Number(currentIndex)}
        onPress={handleNextChapter} // Integrado com a lógica de acesso
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

const styles = StyleSheet.create({
  backButtonWrapper: { position: "absolute", top: 64, left: 24, zIndex: 40 },
  translateButtonWrapper: {
    position: "absolute",
    top: 64,
    right: 88,
    zIndex: 40,
  },
  playButtonWrapper: { position: "absolute", top: 64, right: 24, zIndex: 40 },
  glassButton: {
    height: 48,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 48,
  },
  animatedTitle: { position: "absolute", zIndex: 30, paddingRight: 32 },
  headerImage: { position: "absolute", top: 0, width: "100%", zIndex: 1 },
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
  sentence: { marginBottom: 12, paddingHorizontal: 2 },
  activeHighlight: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
