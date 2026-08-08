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

import GlassView from "@/components/ui/Glass";
import MenuSheet from "@/components/ui/MenuSheet";
import { FontAwesome6 } from "@expo/vector-icons";

import { franc } from "franc-min";

import {
  getFontFamilyForText,
  getWritingDirection,
  isRTLText,
  resolveSpeechLanguage,
  splitIntoSentences,
} from "@/helpers/textDirection";

import { Container, ContainerStorie } from "./styles";
import { useLocalSearchParams } from "expo-router/build/hooks";
import { NextChapterButton } from "@/components/(next-chapter-button)";

import * as Speech from "expo-speech";
import { generateJSON, translateText as aiTranslate } from "@/services/ai";

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
import { useAppReview } from "@/hooks/useAppReview";

import { BACKGROUND_TRACKS } from "@/constants/backgroundTracks";
import { useStoriesStore } from "@/store/useStoriesStore";

import { useMagicProgressStore } from "@/store/useMagicProgressStore";
import { ChapterCompletedModal } from "@/components/(completed-chapter)";
import { useT } from "@/i18n";

import { useIsFocused } from "@react-navigation/native";
import {
  AdventureProfileType,
  useAdventureProfileStore,
} from "@/store/useAdventureProfileStore";

/* =========================
   CONSTANTS
========================= */
const HEADER_HEIGHT = 420;
const MIN_HEADER_HEIGHT = 160;
const SCREEN_HEIGHT = Dimensions.get("window").height;

// [MW-DEBUG] build tag — se este log NÃO aparecer no console ao
// carregar o app, o bundle antigo ainda está em cache. Rode
// `bun run start --clear` e recarregue.
console.log("[MW-DEBUG-BUILD-TAG] storie-index r5 loaded");

export default function StorieScreen() {
  const isFocused = useIsFocused();
  const { t: tr } = useT();

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
  const [showMenuSheet, setShowMenuSheet] = useState(false);

  // Review prompt gate — noteEngagement é o único caminho legítimo
  // pra disparar o prompt (Apple Guideline 5.6.3). Chamamos abaixo
  // no momento em que o capítulo terminou — evento de sucesso claro.
  const { noteEngagement } = useAppReview();

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

  const handleNextChapter = async (forcedIndex?: number) => {
    // 🔥 VERIFICAÇÃO DE SEGURANÇA
    const isPro = await AsyncStorage.getItem("@user_is_pro");

    if (isPro !== "true") {
      await pauseAllAudio();
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
    console.log("[MW-DEBUG] pauseAllAudio:called (incrementa speakSessionRef)");
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
      // [MW-DEBUG] Rastreia qual evento do TrackPlayer disparou —
      // suspeita: RemotePlay/RemotePause dispara quando o app chama
      // play() local, causando session_mismatch em speakNext.
      console.log("[MW-DEBUG] TrackPlayerEvent", { type: event.type });

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
     SENTENCES + DIRECTION
  ========================== */
  // Split multi-idioma: respeita `.!?` (latino), `؟؛` (árabe),
  // `।॥` (hindi) e `。！？` (CJK). Ver `helpers/textDirection`.
  const sentences = useMemo(
    () => splitIntoSentences(translatedText.storie as string | undefined),
    [translatedText.storie],
  );

  // Direção do texto derivada do conteúdo, não do locale da UI.
  // Isso importa porque o app UI pode estar em inglês enquanto o
  // usuário traduziu a história pro árabe — o corpo da história
  // precisa ser RTL mesmo assim.
  const storyDirection = useMemo(
    () => getWritingDirection(translatedText.storie as string | undefined),
    [translatedText.storie],
  );
  const isRTLStory = storyDirection === "rtl";

  // Fonte: `ComicRelief` não tem glifos árabes/CJK/devanagari.
  // Passamos `undefined` pra cair no system font quando o
  // conteúdo é não-latino. iOS/Android já têm cobertura Unicode
  // ampla no system font.
  const storyFontFamily = useMemo(
    () =>
      getFontFamilyForText(
        translatedText.storie as string | undefined,
        "ComicReliefRegular",
      ),
    [translatedText.storie],
  );

  const titleFontFamily = useMemo(
    () =>
      getFontFamilyForText(
        translatedText.title as string | undefined,
        "ComicReliefBold",
      ),
    [translatedText.title],
  );

  // Recupera progresso ao montar ou iniciar autoplay
  useEffect(() => {
    console.log("[MW-DEBUG] useEffect[autoPlay,currentIndex] fired", {
      autoPlay,
      currentIndex,
    });
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
          console.log("[MW-DEBUG] initReading:autoplay resume=true in 800ms");
          setTimeout(() => {
            handleSpeak(true); // Passa true para retomar
          }, 800);
        }
      } else {
        // Se não houver progresso, começa do início
        if (autoPlay === "true") {
          console.log("[MW-DEBUG] initReading:autoplay resume=false in 800ms");
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
  // Wrapper local: mantém a UI (Alert de fallback) e delega
  // retry/timeout pro services/ai.
  async function translateText(text: string, target = "en") {
    try {
      return await aiTranslate(text, target);
    } catch (err) {
      Alert.alert(
        tr("storieMenu.translationUnavailableTitle"),
        tr("storieMenu.translationUnavailableBody"),
      );
      return text;
    }
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
  // Labels ficam em inglês por convenção — o menu é "traduzir a
  // história PARA outro idioma", então o usuário lê o alvo em EN
  // independente do idioma da UI (padrão Netflix, Duolingo, etc).
  // Arabic incluído aqui pra destravar o mercado MENA (Iraque,
  // Egito, Arábia Saudita, Marrocos, UAE, etc).
  const languageLabels = [
    "English",
    "Arabic",
    "Spanish",
    "Portuguese",
    "French",
    "German",
    "Hindi",
  ];
  const languageCodes = ["en", "ar", "es", "pt", "fr", "de", "hi"];

  const renderContextMenuTrigger = () => {
    return (
      <Pressable onPress={() => setShowMenuSheet(true)}>
        <GlassView style={styles.glassButton} isInteractive>
          <FontAwesome6
            name={isTranslating ? "spinner" : "ellipsis-vertical"}
            size={20}
            color={Colors.dark.text}
          />
        </GlassView>
      </Pressable>
    );
  };

  /* =========================
     SPEECH + TRACKPLAYER
  ========================== */
  const handleSpeak = async (resume = false) => {
    // [MW-DEBUG] Entrada — REMOVE BEFORE RELEASE
    console.log("[MW-DEBUG] handleSpeak:enter", {
      resume,
      isPlay,
      sentencesLength: sentences.length,
    });

    // Se já está tocando, pausa tudo
    if (isPlay && !resume) {
      console.log("[MW-DEBUG] handleSpeak:early_return isPlay=true, no resume");
      speakSessionRef.current += 1;
      Speech.stop();
      await TrackPlayer.pause();
      setIsPlay(false);
      setActiveSentenceIndex(-1);
      return;
    }

    if (!sentences.length) {
      console.log(
        "[MW-DEBUG] handleSpeak:early_return sentences.length=0 — texto vazio ou não split",
      );
      return;
    }

    const beforeInc = speakSessionRef.current;
    speakSessionRef.current += 1;
    const sessionId = speakSessionRef.current;
    console.log("[MW-DEBUG] handleSpeak:session_bumped", {
      from: beforeInc,
      to: sessionId,
    });

    setIsPlay(true);

    // Garante que o TrackPlayer toque em Loop
    try {
      console.log("[MW-DEBUG] handleSpeak:calling TrackPlayer.setRepeatMode");
      await TrackPlayer.setRepeatMode(RepeatMode.Track);
      console.log("[MW-DEBUG] handleSpeak:calling TrackPlayer.play()");
      await TrackPlayer.play();
      const state = await TrackPlayer.getState();
      const queue = await TrackPlayer.getQueue();
      console.log("[MW-DEBUG] handleSpeak:TrackPlayer.play OK", {
        state,
        queueLen: queue.length,
      });
    } catch (e: any) {
      console.log("[MW-DEBUG] handleSpeak:TrackPlayer.play THREW", {
        msg: e?.message ?? String(e),
        code: e?.code,
      });
    }

    // `franc` devolve ISO 639-3 (eng, spa, arb, hin…). O helper
    // cobre todos os 7 idiomas do i18n + fallback pra en-US quando
    // a detecção falha (texto muito curto, misto de idiomas, etc).
    const langCode = franc(translatedText.storie as string);
    const language = resolveSpeechLanguage(langCode);
    console.log("[MW-DEBUG] handleSpeak:language_resolved", {
      langCode,
      language,
    });

    // Determina o índice inicial: se resume é true, usa o último salvo/ref
    let index = resume ? lastSentenceIndexRef.current : 0;

    // Proteção caso o index salvo seja maior que o tamanho do texto (ex: tradução mudou tamanho)
    if (index >= sentences.length) index = 0;

    setActiveSentenceIndex(index);

    const speakNext = () => {
      if (speakSessionRef.current !== sessionId) {
        console.log(
          "[MW-DEBUG] speakNext:session_mismatch — outra sessão tomou o turno",
          { current: speakSessionRef.current, sessionId },
        );
        return;
      }

      if (index >= sentences.length) {
        console.log("[MW-DEBUG] speakNext:end_of_story");
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

      console.log("[MW-DEBUG] speakNext:calling Speech.speak", {
        index,
        preview: sentences[index]?.slice(0, 40),
      });

      Speech.speak(sentences[index], {
        volume: 1.0,
        language,
        rate: 0.9,
        pitch: 1.0,
        onStart: () => {
          console.log("[MW-DEBUG] Speech.onStart", { index });
        },
        onDone: () => {
          console.log("[MW-DEBUG] Speech.onDone", { index });
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
          console.log("[MW-DEBUG] Speech.onStopped", { index });
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
        onError: (err: any) => {
          console.log("[MW-DEBUG] Speech.onError", {
            index,
            err: err?.message ?? String(err),
          });
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
    // [MW-DEBUG] Entrada — REMOVE BEFORE RELEASE
    console.log("[MW-DEBUG] handlePlayPress:enter", {
      isPlay,
      lastSentenceIndex: lastSentenceIndexRef.current,
      sentencesLength: sentences.length,
      storieLength: (translatedText.storie as string | undefined)?.length ?? 0,
    });

    // Verifica se já existe progresso para retomar ou começa do zero
    const hasSeen = await AsyncStorage.getItem("@guided_reading_seen");

    if (!hasSeen) {
      console.log(
        "[MW-DEBUG] handlePlayPress:showing_guided_modal (first tap)",
      );
      await AsyncStorage.setItem("@guided_reading_seen", "true");
      setShowGuidedModal(true);
      return;
    }

    // Se estiver pausado e tivermos um indice salvo > 0, retomamos (resume=true)
    if (!isPlay && lastSentenceIndexRef.current > 0) {
      console.log("[MW-DEBUG] handlePlayPress:calling_handleSpeak resume=true");
      handleSpeak(true);
    } else {
      console.log(
        "[MW-DEBUG] handlePlayPress:calling_handleSpeak resume=false",
      );
      handleSpeak(false);
    }
  };

  const stopAllAudio = async () => {
    console.log("[MW-DEBUG] stopAllAudio:called (incrementa speakSessionRef)");
    speakSessionRef.current += 1;
    Speech.stop();
    await TrackPlayer.pause();
    setIsPlay(false);
    setActiveSentenceIndex(-1);
  };

  useFocusEffect(
    // Dep vazia é INTENCIONAL. O cleanup só deve rodar quando a tela
    // realmente perde foco (navegação pra fora), não a cada re-render.
    // Antes esta dep era `[stop]` — e como `stop` vinha de useLockScreenPlayer
    // sem useCallback, mudava a referência a cada render, fazendo o
    // useFocusEffect disparar cleanup+mount entre cada await do handleSpeak.
    // Cada cleanup chamava stopAllAudio, que incrementava speakSessionRef,
    // que derrubava a sessão em curso via session_mismatch — Play parava
    // silenciosamente. Fix: (1) estabilizar stop com useCallback (já feito
    // em hooks/LockScreenPlayer.ts) + (2) dep [] aqui.

    useCallback(() => {
      console.log("[MW-DEBUG] useFocusEffect:mount (tela ganhou foco)");
      return () => {
        console.log(
          "[MW-DEBUG] useFocusEffect:cleanup (tela perdeu foco) — chamando stopAllAudio",
        );
        stopAllAudio();
        stop();
      };
    }, []),
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
Based on the ending of this story: "${sentences.slice(-3).join(" ")}"

Generate two distinct emotional or action-driven choices for the final chapter.
Return ONLY a JSON array with this exact shape (all keys quoted):
[
  {"title": "Short action title", "description": "Briefly what happens", "targetIndex": 1, "profile": ${AdventureProfileTypeOne}},
  {"title": "Short emotional title", "description": "Briefly what happens", "targetIndex": 2, "profile": ${AdventureProfileTypeTwo}}
]
`;

            try {
              const parsedChoices = await generateJSON<
                {
                  title: string;
                  description: string;
                  targetIndex: number;
                  profile: string;
                }[]
              >(prompt, { model: "fast", temperature: 0.85 });
              setBranchOptions(parsedChoices);
            } catch (e) {
              console.error("branch options generation failed:", e);
              setBranchOptions(null);
            } finally {
              setIsLoadingNextChapter(false);
            }
          } else {
            setBranchOptions(null);
          }

          setShowFinishModal(true);

          // Marca engagement — o hook decide se dispara o prompt
          // ou não com base em thresholds de tempo + eventos.
          noteEngagement();

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

        {/* TRANSLATE / MENU */}
        <View style={styles.translateButtonWrapper}>
          {renderContextMenuTrigger()}
        </View>

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
              style={{
                writingDirection: isRTLStory ? "rtl" : "ltr",
                textAlign: isRTLStory ? "right" : "left",
                fontFamily: titleFontFamily,
              }}
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

                  // Direção pode variar por sentença — a IA de
                  // tradução geralmente devolve tudo num idioma só,
                  // mas o helper cobre o caso de mistura (ex: nome
                  // próprio em latino no meio de texto árabe).
                  const rtl = isRTLText(sentence);

                  const textStyle = {
                    writingDirection: rtl ? ("rtl" as const) : ("ltr" as const),
                    textAlign: rtl ? ("right" as const) : ("left" as const),
                    // System font quando o script não é latino
                    // (`getFontFamilyForText` devolve undefined).
                    fontFamily: getFontFamilyForText(
                      sentence,
                      "ComicReliefRegular",
                    ),
                  };

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
                            style={textStyle}
                          />
                        </LinearGradient>
                      ) : (
                        <Text
                          fontFamily="regular"
                          fontSize={16}
                          color={Colors.dark.text}
                          title={sentence}
                          style={textStyle}
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

            return;
          }

          setShowFinishModal(false);

          if (Number(currentIndex) === 1) {
            setIsTranslating(true);

            const finalePrompt = `
Write the FINAL chapter (Chapter 3) of this story.
Previous context: "${sentences.join(" ")}"
The reader chose the path: "${choice.title}".

Provide a satisfying and immersive conclusion in English,
approximately 300 words.

Return ONLY a JSON object with this exact shape:
{"title": "The Final Destiny", "storie": "Your short story here..."}
`;

            try {
              const data = await generateJSON<{
                title: string;
                storie: string;
              }>(finalePrompt, {
                model: "smart",
                temperature: 0.8,
                maxTokens: 1200,
              });

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

      <MenuSheet
        visible={showMenuSheet}
        onClose={() => setShowMenuSheet(false)}
        sections={[
          {
            title: tr("storieMenu.translate"),
            options: languageLabels,
            selectedIndex: selectedIndex,
            onSelect: (index) => {
              setSelectedIndex(index);
              handleTranslateAll(languageCodes[index]);
            },
          },
          {
            title: tr("storieMenu.ambientSound"),
            options: BACKGROUND_TRACKS.map((track) => track.title),
            selectedIndex: musicIndex,
            onSelect: async (index) => {
              setMusicIndex(index);
              await TrackPlayer.stop();
            },
          },
        ]}
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
