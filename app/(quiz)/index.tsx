import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  ScrollView,
  TouchableWithoutFeedback,
  Pressable,
} from "react-native";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { AchievementModal } from "@/components/(achievements)";
import { useAdventureProfileStore } from "@/store/useAdventureProfileStore";
import { generateJSON } from "@/services/ai";
import QuizSkeleton from "@/components/(quiz-skeleton)";
import { StatusBar } from "expo-status-bar";
import GlassView from "@/components/ui/Glass";
import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  answer: string;
  rewardChapters: number;
  badgeId: number;
};

export default function QuizScreen() {
  const { profile } = useAdventureProfileStore();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizResults, setQuizResults] = useState<
    { questionId: number; correct: boolean }[]
  >([]);

  const [showFinalModal, setShowFinalModal] = useState(false);

  const avatarAnim = useRef(new Animated.Value(1)).current;

  const question = questions ? questions[currentIndex] : null;

  // Fresh anim values a cada troca de pergunta. Mantém o array sempre
  // do mesmo tamanho que as opções que serão renderizadas — fonte do
  // "cannot read property interpolate of undefined" anterior.
  const optionAnims = useMemo(
    () => (question ? question.options.map(() => new Animated.Value(0)) : []),
    [question],
  );

  // ================= FETCH QUIZ QUESTIONS =================
  const fetchQuestions = useCallback(async () => {
    setFetchError(null);
    setQuestions(null);
    setCurrentIndex(0);
    setQuizResults([]);

    const prompt = `
Generate 5 fantasy/magic themed quiz questions.
Each question must have:
- question text
- exactly 4 options
- one correct answer (must match one of the options exactly)
- rewardChapters (number, 1-3)
- badgeId (number)

Return a JSON array with this exact shape:
[
  {
    "id": 1,
    "question": "...",
    "options": ["..","..","..",".."],
    "answer": "...",
    "rewardChapters": 2,
    "badgeId": 1
  }
]
`;

    try {
      const parsed = await generateJSON<QuizQuestion[]>(prompt, {
        model: "fast",
        temperature: 0.8,
        validate: (v): v is QuizQuestion[] =>
          Array.isArray(v) &&
          v.length > 0 &&
          v.every(
            (q) =>
              q != null &&
              typeof q.question === "string" &&
              Array.isArray(q.options) &&
              q.options.length === 4 &&
              typeof q.answer === "string" &&
              q.options.includes(q.answer),
          ),
      });

      setQuestions(parsed);
    } catch (err) {
      console.error("Error generating quiz:", err);
      setFetchError("Couldn't load the quiz. Tap Retry to try again.");
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // ================= ANIMATE OPTIONS ENTRANCE =================
  useEffect(() => {
    if (!question) return;
    optionAnims.forEach((anim, i) => {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 500,
        delay: i * 100,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }).start();
    });
  }, [question, optionAnims]);

  // ================= AVATAR POP ANIMATION =================
  const triggerAvatarPop = () => {
    avatarAnim.setValue(0.8);
    Animated.spring(avatarAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // ================= HANDLE OPTION PRESS =================
  const handleOptionPress = (option: string, index: number) => {
    if (!question || selectedOption) return;

    const correct = option === question.answer;
    setSelectedOption(option);

    if (correct) triggerAvatarPop();

    setQuizResults((prev) => [...prev, { questionId: question.id, correct }]);

    // Animate other options away
    optionAnims.forEach((anim, i) => {
      if (i !== index) {
        Animated.timing(anim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }).start();
      }
    });

    setTimeout(() => {
      setSelectedOption(null);

      if (currentIndex < (questions?.length || 0) - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setShowFinalModal(true);
      }
    }, 800);
  };

  const progressPercent = ((currentIndex + 1) / (questions?.length || 1)) * 100;

  const handleCloseFinalModal = () => {
    setShowFinalModal(false);
    setCurrentIndex(0);
    setQuizResults([]);
  };

  // ================= RENDER — ERROR =================
  if (fetchError) {
    return (
      <View style={styles.container}>
        <StatusBar animated style="light" />
        <View style={styles.centerFill}>
          <Text
            fontSize={16}
            fontFamily="bold"
            color="#FFF"
            title={fetchError}
            style={{ textAlign: "center", marginBottom: 20 }}
          />
          <Pressable onPress={fetchQuestions}>
            <GlassView style={styles.retryButton} isInteractive>
              <Text
                fontSize={14}
                fontFamily="bold"
                color={Colors.dark.text}
                title="Retry"
              />
            </GlassView>
          </Pressable>
        </View>
      </View>
    );
  }

  // ================= RENDER — LOADING =================
  if (!questions || !question) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <QuizSkeleton />
        </ScrollView>
      </View>
    );
  }

  // ================= RENDER — QUIZ =================
  return (
    <View style={styles.container}>
      <StatusBar animated style="light" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* BACK BUTTON INSIDE SCROLL */}
        <Pressable
          style={styles.backButtonWrapperScroll}
          onPress={() => router.back()}
        >
          <GlassView style={styles.glassButton} isInteractive>
            <FontAwesome6
              name="chevron-left"
              size={22}
              color={Colors.dark.text}
            />
          </GlassView>
        </Pressable>

        {/* AVATAR */}
        <Animated.Text
          style={{
            fontSize: 60,
            textAlign: "center",
            marginBottom: 20,
            transform: [{ scale: avatarAnim }],
          }}
        >
          {profile ? "🧙‍♂️" : "👤"}
        </Animated.Text>

        {/* QUESTION */}
        <Text
          fontSize={22}
          fontFamily="bold"
          color="#FFF"
          title={question.question}
          style={{ textAlign: "center", marginBottom: 24 }}
        />

        {/* OPTIONS */}
        {question.options.map((option: string, i: number) => {
          const isSelected = selectedOption === option;
          const correct = option === question.answer;

          const borderColor = isSelected
            ? correct
              ? "#22C55E"
              : "#EF4444"
            : "#303033";

          const shadowOpacity = isSelected ? 0.35 : 0.15;

          const translateY = optionAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [50, 0],
          });

          const opacity = optionAnims[i];

          return (
            <TouchableWithoutFeedback
              key={option}
              onPress={() => handleOptionPress(option, i)}
            >
              <Animated.View
                style={[
                  styles.optionCard,
                  {
                    transform: [
                      { translateY },
                      { scale: isSelected ? 1.05 : 1 },
                    ],
                    opacity,
                    borderColor,
                    shadowOpacity,
                  },
                ]}
              >
                <Text
                  fontSize={16}
                  fontFamily="bold"
                  color="#FFF"
                  title={option}
                  style={{ textAlign: "center" }}
                />
              </Animated.View>
            </TouchableWithoutFeedback>
          );
        })}

        {/* PROGRESS BAR */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground} />
          <Animated.View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>
      </ScrollView>

      {/* FINAL MODAL */}
      {showFinalModal && (
        <AchievementModal
          achievement={{
            id: 999,
            title: "Quiz Completed!",
            correctCount: quizResults.filter((r) => r.correct).length,
            totalQuestions: questions.length,
            icon: (() => {
              const percent =
                (quizResults.filter((r) => r.correct).length /
                  questions.length) *
                100;
              if (percent === 100) return "🏆";
              if (percent >= 80) return "🙂";
              if (percent >= 50) return "⚠️";
              if (percent >= 25) return "😟";
              return "😢";
            })(),
            description: `You answered ${quizResults.filter((r) => r.correct).length} out of ${questions.length} correctly!`,
          }}
          onClose={handleCloseFinalModal}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 64,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  centerFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  retryButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonWrapperScroll: {
    alignSelf: "flex-start",
    marginBottom: 24,
  },
  glassButton: {
    height: 48,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 48,
  },
  optionCard: {
    width: width * 0.8,
    paddingVertical: 16,
    borderRadius: 20,
    marginBottom: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 8,
    elevation: 5,
  },
  progressContainer: {
    width: width * 0.8,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#38383A",
    marginTop: 24,
    overflow: "hidden",
  },
  progressBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#38383A",
  },
  progressFill: { height: "100%", backgroundColor: "#8B5CF6", borderRadius: 5 },
});
