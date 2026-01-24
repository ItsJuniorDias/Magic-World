import {
  Pressable,
  StyleSheet,
  Animated,
  Alert,
  Dimensions,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useRef, useState, useEffect, useMemo, useCallback, use } from "react";

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
} from "react-native-track-player";

import { useLockScreenPlayer } from "@/hooks/LockScreenPlayer";

import * as Notifications from "expo-notifications";
import { BACKGROUND_TRACKS } from "@/constants/backgroundTracks";
import { useStoriesStore } from "@/store/useStoriesStore";

import { useMagicProgressStore } from "@/store/useMagicProgressStore";
import { ChapterCompletedModal } from "@/components/(completed-chapter)";
import { getUserKey } from "@/services/getUserKey";

import { useIsFocused } from "@react-navigation/native";

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

  const [branchOptions, setBranchOptions] = useState<
    { title: string; targetIndex: number }[] | null
  >(null);

  const [isSavingProgress, setIsSavingProgress] = useState(false);

  console.log(deviceId, "DEVICE ID");

  useEffect(() => {
    if (!isFocused) return;

    if (deviceId) return;

    initProgress().then(() => {});
  }, [isFocused, deviceId, initProgress]);

  // useEffect(() => {
  //   getUserKey().then((key) => setUserKey(key));
  // }, []);

  //adicionar imagem de cada capitulo e o t
  const { pause, play, stop } = useLockScreenPlayer({
    title: String(title),
    artist: "Magic World",
    artwork: String(thumbnail),
    url: BACKGROUND_TRACKS[musicIndex].uri,
    volume: 0.15,
    currentIndex: Number(currentIndex),
  });

  const notifyPaywall = async () => {
    // 1. pedir permissão
    const { status } = await Notifications.getPermissionsAsync();

    let finalStatus = status;

    if (status !== "granted") {
      const permission = await Notifications.requestPermissionsAsync();
      finalStatus = permission.status;
    }

    if (finalStatus !== "granted") {
      console.log("Notification permission not granted");
      return;
    }

    // 2. disparar notificação
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Next Chapter Locked 🔒",
        body: "Subscribe to access the next chapter.",
        sound: true,
      },
      trigger: null, // imediato
    });
  };

  const handleNextChapter = async (forcedIndex?: number) => {
    // 1. Checar paywall
    const isPro = await AsyncStorage.getItem("@user_is_pro");

    // Consideramos Pro se o valor for "true" (ajuste conforme seu salvamento)
    if (isPro !== "true") {
      // sem acesso → pausa tudo
      await pauseAllAudio();

      // dispara notificação local
      await notifyPaywall();

      // Opcional: Redirecionar para tela de assinatura
      // router.push("/(subscribe)");
      return;
    } else {
      // 2. Determinar qual capítulo carregar
      // Se forcedIndex existir (escolha do usuário), usa ele. Senão, usa o nextIndex padrão.
      const targetIndex = forcedIndex ?? nextIndex;
      const targetChapter = (story as any)?.chapter?.[targetIndex];

      if (!targetChapter) {
        console.log("Próximo capítulo não encontrado");
        return;
      }

      // 3. Limpar estados de áudio e fala atuais
      speakSessionRef.current += 1;
      lastSentenceIndexRef.current = 0;

      Speech.stop();
      await TrackPlayer.pause();

      setIsPlay(false);
      setActiveSentenceIndex(-1);

      // 4. Navegar para o novo capítulo
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

      // 5. Configurar TrackPlayer para a nova trilha
      await TrackPlayer.reset();

      await TrackPlayer.add({
        id: targetIndex.toString(),
        url: BACKGROUND_TRACKS[musicIndex].uri,
        title: String(targetChapter.title), // Título do novo capítulo
        artist: "Magic World",
        artwork: targetChapter.thumbnail,
      });

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

      if (event.type === Event.RemotePrevious) {
        // quando clico no botão e voltar quero a começe do zero tanto a musica quando a voz
        const isPlaying = (await TrackPlayer.getState()) === State.Playing;

        await TrackPlayer.seekTo(0);

        if (isPlaying) {
          await TrackPlayer.play();
        }

        handleSpeak(true); // resume speech from beginning

        // scroll to top

        scrollRef.current?.scrollTo({ y: 0, animated: true });
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

  useEffect(() => {
    if (autoPlay === "true") {
      setTimeout(() => {
        handleSpeak();
      }, 800);
    }
  }, [autoPlay]);

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
            {/* 🌍 TRANSLATE */}
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

            {/* 🎵 AMBIENT MUSIC */}
            <Picker
              label="Ambient Sound"
              options={musicOptions}
              variant="menu"
              selectedIndex={musicIndex}
              onOptionSelected={async ({ nativeEvent: { index } }) => {
                setMusicIndex(index);

                await TrackPlayer.stop();
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

    let index = resume ? lastSentenceIndexRef.current : 0;

    setActiveSentenceIndex(index);

    const speakNext = () => {
      if (speakSessionRef.current !== sessionId) return;

      if (index >= sentences.length) {
        TrackPlayer.pause();
        setIsPlay(false);
        // mantém última frase destacada

        handleFinishReading();
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
          if (speakSessionRef.current !== sessionId) return;

          index += 1;

          if (index >= sentences.length) {
            handleFinishReading(true); // Fim da leitura por voz
          } else {
            speakNext();
          }
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

          console.log(Number(currentIndex), "CURRENT INDEX");

          // 2. Lógica de Ramificação - SOMENTE NO CAPÍTULO 2 (Index 1)
          if (Number(currentIndex) === 1) {
            const prompt = `
            Based on the ending of this story: "${sentences.slice(-3).join(" ")}", 
            generate two distinct emotional or action-driven choices for the final chapter.
            Return ONLY a JSON array with this exact structure:
            [
              {"title": "Short action title", "description": "Briefly what happens", "targetIndex": 2},
              {"title": "Short emotional title", "description": "Briefly what happens", "targetIndex": 2}
            ]
          `;

            const result = await geminiModel.generateContent(prompt);
            const responseText = result.response.text();

            // Limpeza de Markdown do JSON
            const cleanJson = responseText.replace(/```json|```/g, "").trim();
            const parsedChoices = JSON.parse(cleanJson);

            console.log(parsedChoices, "PARSED CHOICES");

            setBranchOptions(parsedChoices);
          } else {
            setBranchOptions(null);
          }

          // 3. Abre o modal (que agora terá as escolhas se for Cap 2)
          setShowFinishModal(true);
        } catch (error) {
          console.error("Erro ao finalizar capítulo ou gerar caminhos:", error);
          // Fallback: se a IA falhar, não trava o app, apenas mostra o modal sem escolhas
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
    ],
  );

  // useEffect(() => {
  //   handleFinishReading(true);
  // }, []);

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
          setShowFinishModal(false);

          // Se estamos no Capítulo 2 e o usuário escolheu o caminho
          if (Number(currentIndex) === 1) {
            setIsTranslating(true);

            const finalePrompt = `
                Write the FINAL chapter (Chapter 3) of this story.
                Previous context: "${sentences.join(" ")}"
                The reader chose the path: "${choice.title}".
                Provide a satisfying and immersive conclusion in English.
                Return ONLY a JSON object: 
                {"title": "The Final Destiny", "storie": "Your long story here..."}
            `;

            try {
              const result = await geminiModel.generateContent(finalePrompt);

              // Remove possíveis blocos de código e parse para JSON
              const data = JSON.parse(
                result.response.text().replace(/```json|```/g, ""),
              );

              // Navega para a terceira tela com o texto gerado
              router.replace({
                pathname: "/(storie)",
                params: {
                  storie: data.storie,
                  title: data.title,
                  thumbnail: story?.chapter[2].thumbnail, // você pode substituir por nova imagem se quiser
                  storyId: storyId,
                  currentIndex: 2, // Capítulo 3
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
            // Para outros capítulos, apenas avança normalmente
            handleNextChapter(choice.targetIndex);
          }
        }}
        onClose={async () => {
          setShowFinishModal(false);

          // Se não houver opções de branching, apenas vai para o próximo capítulo
          if (!branchOptions) await handleNextChapter();
        }}
      />

      <NextChapterButton
        storyId={String(storyId)}
        currentIndex={Number(currentIndex)}
      />

      <GuidedReadingModal
        visible={showGuidedModal}
        onClose={async () => {
          setShowGuidedModal(false);
          await TrackPlayer.pause();
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
  activeHighlight: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
