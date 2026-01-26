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

import * as Application from "expo-application";

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
  Capability,
  Event,
  State,
  useTrackPlayerEvents,
  RepeatMode,
} from "react-native-track-player";

import { useLockScreenPlayer } from "@/hooks/LockScreenPlayer";

import * as Notifications from "expo-notifications";
import { BACKGROUND_TRACKS } from "@/constants/backgroundTracks";
import { useStoriesStore } from "@/store/useStoriesStore";

import { useMagicProgressStore } from "@/store/useMagicProgressStore";
import { ChapterCompletedModal } from "@/components/(completed-chapter)";
import { getUserKey } from "@/services/getUserKey";

import { useIsFocused } from "@react-navigation/native";
import {
  AdventureProfileType,
  useAdventureProfileStore,
} from "@/store/useAdventureProfileStore";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
  const isFocused = useIsFocused();

  const { storie, title, thumbnail, currentIndex, storyId, autoPlay } =
    useLocalSearchParams();

  const { addChapter, initProgress, deviceId } = useMagicProgressStore();

  const { calculateProfile } = useAdventureProfileStore();

  const router = useRouter();

  const story = useStoriesStore((state) =>
    state.stories.find((item) => item.id === storyId),
  );

  const nextIndex = Number(currentIndex) + 1;

  const nextChapter = (story as any)?.chapter?.[nextIndex];

  /* =========================
     REFS
  ========================== */
  const scrollY = useRef(new Animated.Value(0)).current;
  const currentScrollY = useRef(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const sentencePositions = useRef<number[]>([]);
  const speakSessionRef = useRef(0);

  const lastSentenceIndexRef = useRef(0);

  /* =========================
     STATE
  ========================== */
  const [isTranslating, setIsTranslating] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [showGuidedModal, setShowGuidedModal] = useState(false);
  const [isPlay, setIsPlay] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(-1);

  const [translatedText, setTranslatedText] = useState({
    title,
    storie,
  });

  const [musicIndex, setMusicIndex] = useState(0);

  const [showFinishModal, setShowFinishModal] = useState(false);

  const [isLoadingNextChapter, setIsLoadingNextChapter] = useState(false);

  const [branchOptions, setBranchOptions] = useState<
    | { title: string; targetIndex: number; profile: AdventureProfileType }[]
    | null
  >(null);

  const [isSavingProgress, setIsSavingProgress] = useState(false);

  useEffect(() => {
    if (!isFocused) return;
    if (deviceId) return;
    initProgress().then(() => {});
  }, [isFocused, deviceId, initProgress]);

  // Hook do player
  const { pause, play, stop } = useLockScreenPlayer({
    title: String(title),
    artist: "Magic World",
    artwork: String(thumbnail),
    url: BACKGROUND_TRACKS[musicIndex].uri,
    volume: 0.15,
    currentIndex: Number(currentIndex),
  });

  // Garante o Loop da música ao iniciar
  useEffect(() => {
    const setupLoop = async () => {
      // Define modo de repetição para a música tocar em loop sem parar a leitura
      await TrackPlayer.setRepeatMode(RepeatMode.Track);
    };
    setupLoop();
  }, [musicIndex]);

  // --- SALVA E RECUPERA PROGRESSO ---

  const saveReadingProgress = async (
    chapterIndex: number,
    sentenceIndex: number,
    scrollYPos: number,
  ) => {
    try {
      await AsyncStorage.setItem(
        `@reading_progress_${storyId}_${chapterIndex}`,
        JSON.stringify({ sentenceIndex, scrollYPos }),
      );
    } catch (e) {
      console.error("Erro ao salvar progresso:", e);
    }
  };

  const getReadingProgress = async (chapterIndex: number) => {
    try {
      const value = await AsyncStorage.getItem(
        `@reading_progress_${storyId}_${chapterIndex}`,
      );
      if (!value) return null;
      return JSON.parse(value) as { sentenceIndex: number; scrollYPos: number };
    } catch (e) {
      console.error("Erro ao recuperar progresso:", e);
      return null;
    }
  };

  // ----------------------------------

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

  const handleNextChapter = async (forcedIndex?: number) => {
    // 🔥 VERIFICAÇÃO DE SEGURANÇA
    const isPro = await AsyncStorage.getItem("@user_is_pro");

    if (isPro !== "true") {
      await pauseAllAudio();
      await notifyPaywall();
      return;
    } else {
      const targetIndex = forcedIndex ?? nextIndex;
      const targetChapter = (story as any)?.chapter?.[targetIndex];

      if (!targetChapter) return;

      speakSessionRef.current += 1;
      lastSentenceIndexRef.current = 0;

      Speech.stop();
      await TrackPlayer.pause();

      setIsPlay(false);
      setActiveSentenceIndex(-1);

      router.replace({
        pathname: "/(storie)",
        params: {
          storie: targetChapter.storie,
          title: targetChapter.title,
          thumbnail: targetChapter.thumbnail,
          storyId: storyId,
          currentIndex: targetIndex,
          autoPlay: "true",
        },
      });

      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: targetIndex.toString(),
        url: BACKGROUND_TRACKS[musicIndex].uri,
        title: String(targetChapter.title),
        artist: "Magic World",
        artwork: targetChapter.thumbnail,
      });
      // Garante loop na próxima música também
      await TrackPlayer.setRepeatMode(RepeatMode.Track);
      await TrackPlayer.play();
    }
  };

  /* =========================
     TRACKPLAYER EVENTS
  ========================== */

  const pauseAllAudio = useCallback(async () => {
    speakSessionRef.current += 1;
    Speech.stop();
    await pause();
    setIsPlay(false);
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
      // Com RepeatMode.Track, este evento raramente dispara, mas deixamos como fallback
      if (event.type === Event.PlaybackQueueEnded) {
        await TrackPlayer.seekTo(0);
        await play();
      }

      if (event.type === Event.RemotePlay) {
        await play();
        handleSpeak(true); // Resume reading
      }

      if (event.type === Event.RemotePause) {
        await pauseAllAudio();
      }

      if (event.type === Event.RemotePrevious) {
        const isPlaying = (await TrackPlayer.getState()) === State.Playing;
        await TrackPlayer.seekTo(0);
        if (isPlaying) {
          await TrackPlayer.play();
        }
        // Reseta o progresso para o início
        lastSentenceIndexRef.current = 0;
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        handleSpeak(false); // Reinicia a fala do zero
      }

      if (event.type === Event.RemoteNext) {
        await handleNextChapter();
      }
    },
  );

  /* =========================
     SKELETON ANIMATION
  ========================== */
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
  }, [isTranslating, skeletonAnim]);

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

  // Recupera progresso ao montar ou iniciar autoplay
  useEffect(() => {
    const initReading = async () => {
      // Tenta recuperar progresso
      const progress = await getReadingProgress(Number(currentIndex));

      if (progress) {
        // Se houver progresso, configura os refs para continuar de onde parou
        lastSentenceIndexRef.current = progress.sentenceIndex;

        // Pequeno delay para garantir que o layout carregou antes de rolar
        setTimeout(() => {
          scrollRef.current?.scrollTo({
            y: progress.scrollYPos,
            animated: false,
          });
        }, 500);

        if (autoPlay === "true") {
          setTimeout(() => {
            handleSpeak(true); // Passa true para retomar
          }, 800);
        }
      } else {
        // Se não houver progresso, começa do início
        if (autoPlay === "true") {
          setTimeout(() => {
            handleSpeak();
          }, 800);
        }
      }
    };

    initReading();
  }, [autoPlay, currentIndex]);

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
    const musicOptions = BACKGROUND_TRACKS.map((t) => t.title);

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
            <Picker
              label="Ambient Sound"
              options={musicOptions}
              variant="menu"
              selectedIndex={musicIndex}
              onOptionSelected={async ({ nativeEvent: { index } }) => {
                setMusicIndex(index);
                await TrackPlayer.stop();
                // A música será reiniciada pelo hook ou lógica externa, mas importante garantir loop
              }}
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

    if (!sentences.length) return;

    speakSessionRef.current += 1;
    const sessionId = speakSessionRef.current;

    setIsPlay(true);

    // Garante que o TrackPlayer toque em Loop
    await TrackPlayer.setRepeatMode(RepeatMode.Track);
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

    // Determina o índice inicial: se resume é true, usa o último salvo/ref
    let index = resume ? lastSentenceIndexRef.current : 0;

    // Proteção caso o index salvo seja maior que o tamanho do texto (ex: tradução mudou tamanho)
    if (index >= sentences.length) index = 0;

    setActiveSentenceIndex(index);

    const speakNext = () => {
      if (speakSessionRef.current !== sessionId) return;

      if (index >= sentences.length) {
        // Fim da história
        // Não pausamos a música imediatamente se o user quiser ficar ouvindo,
        // mas o comportamento padrão é finalizar a leitura.
        TrackPlayer.pause();
        setIsPlay(false);
        handleFinishReading();
        AsyncStorage.removeItem(`@reading_progress_${storyId}_${currentIndex}`);
        return;
      }

      setActiveSentenceIndex(index);
      lastSentenceIndexRef.current = index;

      // 🔹 Salva progresso a cada sentença iniciada
      saveReadingProgress(Number(currentIndex), index, currentScrollY.current);

      Speech.speak(sentences[index], {
        volume: 1.0,
        language,
        rate: 0.9,
        pitch: 1.0,
        onDone: () => {
          if (speakSessionRef.current !== sessionId) return;

          index += 1;

          if (index >= sentences.length) {
            handleFinishReading(true);
            AsyncStorage.removeItem(
              `@reading_progress_${storyId}_${currentIndex}`,
            );
          } else {
            speakNext();
          }
        },
        onStopped: () => {
          // Callback disparado quando Speech.stop() é chamado manualmente.
          if (speakSessionRef.current !== sessionId) return;

          TrackPlayer.pause();
          setIsPlay(false);
          setActiveSentenceIndex(-1);

          // Salva onde parou
          saveReadingProgress(
            Number(currentIndex),
            index,
            currentScrollY.current,
          );
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
    // Verifica se já existe progresso para retomar ou começa do zero
    const hasSeen = await AsyncStorage.getItem("@guided_reading_seen");

    if (!hasSeen) {
      await AsyncStorage.setItem("@guided_reading_seen", "true");
      setShowGuidedModal(true);
      return;
    }

    // Se estiver pausado e tivermos um indice salvo > 0, retomamos (resume=true)
    if (!isPlay && lastSentenceIndexRef.current > 0) {
      handleSpeak(true);
    } else {
      handleSpeak(false);
    }
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
        stop();
      };
    }, [stop]),
  );

  const handleFinishReading = useCallback(
    async (force = false) => {
      if (showFinishModal || isSavingProgress) return;

      if (force) {
        if (!deviceId) return;

        try {
          setIsSavingProgress(true);

          await addChapter(deviceId, String(storyId), Number(currentIndex));

          const profileArray = [
            "brave",
            "clever",
            "wild",
            "wise",
          ] as AdventureProfileType[];

          const randomProfileOne =
            profileArray[Math.floor(Math.random() * profileArray.length)];
          const randomProfileTwo =
            profileArray[Math.floor(Math.random() * profileArray.length)];

          const AdventureProfileTypeOne = `"${randomProfileOne}"`;
          const AdventureProfileTypeTwo = `"${randomProfileTwo}"`;

          if (Number(currentIndex) === 1) {
            setIsLoadingNextChapter(true);
            const prompt = `
            Based on the ending of this story: "${sentences.slice(-3).join(" ")}", 
            generate two distinct emotional or action-driven choices for the final chapter with.
            Return ONLY a JSON array with this exact structure:
            [
              {"title": "Short action title", "description": "Briefly what happens", "targetIndex": 1, profile: ${AdventureProfileTypeOne}},
              {"title": "Short emotional title", "description": "Briefly what happens", "targetIndex": 2, profile: ${AdventureProfileTypeTwo}}
            ]
          `;

            const result = await geminiModel.generateContent(prompt);
            const responseText = result.response.text();

            const cleanJson = responseText.replace(/```json|```/g, "").trim();
            const parsedChoices = JSON.parse(cleanJson);

            setBranchOptions(parsedChoices);
            setIsLoadingNextChapter(false);
          } else {
            setBranchOptions(null);
          }

          setShowFinishModal(true);

          if (Number(currentIndex) === 2) {
            const finalProfile = await calculateProfile();
            const isViewed = await AsyncStorage.getItem(
              "@adventure_profile_viewed",
            );

            if (isViewed === "true") {
              router.replace({
                pathname: "/(profile-result-adventure)",
                params: {
                  profile: finalProfile,
                },
              });
              await AsyncStorage.setItem("@adventure_profile_viewed", "false");
            } else {
              router.replace({
                pathname: "/(tabs)",
              });
            }
          }
        } catch (error) {
          console.error("Erro ao finalizar capítulo:", error);
          setBranchOptions(null);
          setShowFinishModal(true);
        } finally {
          setIsSavingProgress(false);
        }
      }
    },
    [
      currentIndex,
      deviceId,
      storyId,
      sentences,
      showFinishModal,
      isSavingProgress,
      addChapter,
      calculateProfile,
      router,
    ],
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
            await pause();

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
                const { layoutMeasurement, contentOffset, contentSize } =
                  e.nativeEvent;
                currentScrollY.current = contentOffset.y;
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
              </>
            ) : (
              <>
                {sentences.map((sentence, index) => {
                  const isActive = index === activeSentenceIndex;

                  return (
                    <View
                      key={index}
                      onLayout={(e) => {
                        sentencePositions.current[index] =
                          e.nativeEvent.layout.y + HEADER_HEIGHT;
                      }}
                      style={styles.sentence}
                    >
                      {isActive ? (
                        <LinearGradient
                          colors={[
                            "rgba(255,215,120,0.28)",
                            "rgba(255,215,120,0.19)",
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
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
                  );
                })}
              </>
            )}
          </ContainerStorie>
        </Animated.ScrollView>
      </Container>

      <ChapterCompletedModal
        visible={showFinishModal}
        storyId={String(storyId)}
        chapterIndex={Number(currentIndex)}
        choices={branchOptions}
        onChoiceSelected={async (choice: any) => {
          // 🔥 CORREÇÃO: VERIFICA SE É PRO ANTES DE GERAR CAPÍTULO COM IA
          const isPro = await AsyncStorage.getItem("@user_is_pro");

          if (isPro !== "true") {
            setShowFinishModal(false);
            await pauseAllAudio();
            await notifyPaywall();
            return;
          }

          setShowFinishModal(false);

          if (Number(currentIndex) === 1) {
            setIsTranslating(true);

            const finalePrompt = `
                Write the FINAL chapter (Chapter 3) of this story.
                Previous context: "${sentences.join(" ")}"
                The reader chose the path: "${choice.title}".
                Provide a satisfying and immersive conclusion in English.
                with approximately 300 words storie.
                Return ONLY a JSON object: 
                {"title": "The Final Destiny", "storie": "Your short story here..."}
            `;

            try {
              const result = await geminiModel.generateContent(finalePrompt);
              const data = JSON.parse(
                result.response.text().replace(/```json|```/g, ""),
              );

              router.replace({
                pathname: "/(storie)",
                params: {
                  storie: data.storie,
                  title: data.title,
                  thumbnail: story?.chapter[2].thumbnail,
                  storyId: storyId,
                  currentIndex: 2,
                  autoPlay: "true",
                },
              });
            } catch (e) {
              Alert.alert(
                "Oops!",
                "Não foi possível gerar o capítulo final. Tente novamente.",
              );
            } finally {
              setIsTranslating(false);
            }
          } else {
            handleNextChapter(choice.targetIndex);
          }
        }}
        onClose={async () => {
          setShowFinishModal(false);
          if (!branchOptions) await handleNextChapter();
        }}
      />

      <NextChapterButton
        disable={isLoadingNextChapter}
        storyId={String(storyId)}
        currentIndex={Number(currentIndex)}
        onPress={() => handleNextChapter()} // Garante que o clique manual também passe pela verificação
      />

      <GuidedReadingModal
        visible={showGuidedModal}
        onClose={async () => {
          setShowGuidedModal(false);
          await TrackPlayer.pause();
          handleSpeak(true); // Retoma se tiver salvo
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
  activeHighlight: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
