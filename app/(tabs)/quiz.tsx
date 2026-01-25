import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  ScrollView,
  TouchableWithoutFeedback,
} from "react-native";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { AchievementModal } from "@/components/(achievements)";
import { useAdventureProfileStore } from "@/store/useAdventureProfileStore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import QuizSkeleton from "@/components/(quiz-skeleton)";
import { StatusBar } from "expo-status-bar";

const genAI = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY || "",
);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

const { width } = Dimensions.get("window");

// ================= QUIZ SCREEN =================
export default function QuizScreen() {
  const { profile } = useAdventureProfileStore();

  const [questions, setQuestions] = useState<any[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizResults, setQuizResults] = useState<
    { questionId: number; correct: boolean }[]
  >([]);
  const [showFinalModal, setShowFinalModal] = useState(false);

  const avatarAnim = useRef(new Animated.Value(1)).current;
  const optionAnimValues = useRef<Animated.Value[]>([]).current;

  // ================= GEMINI GENERATION =================
  useEffect(() => {
    async function fetchQuestions() {
      const prompt = `
      Generate 5 fantasy/magic themed quiz questions.
      Each question should have:
      - question text
      - 4 options
      - correct answer
      - rewardChapters (number)
      - badgeId (number)
      Format as JSON array:
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
        const result = await geminiModel.generateContent(prompt);

        const parsed = JSON.parse(
          result.response
            .text()
            .replace(/```json|```/g, "")
            .trim(),
        );

        setQuestions(parsed);

        // Inicializa animações
        parsed[0].options.forEach(() => {
          optionAnimValues.push(new Animated.Value(0));
        });
      } catch (err) {
        console.error("Error generating quiz:", err);
      }
    }

    fetchQuestions();
  }, []);

  const question = questions ? questions[currentIndex] : null;

  // ================= ANIMATE CARDS ENTRANCE =================
  useEffect(() => {
    if (!question) return;
    question.options.forEach((_: any, i: number) => {
      Animated.timing(optionAnimValues[i], {
        toValue: 1,
        duration: 500,
        delay: i * 100,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }).start();
    });
  }, [currentIndex, question]);

  // ================= AVATAR POP =================
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

    // Animate other cards away
    question.options.forEach((_: any, i: number) => {
      if (i !== index) {
        Animated.timing(optionAnimValues[i], {
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
        optionAnimValues.forEach((v) => v.setValue(0));
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
    optionAnimValues.forEach((v) => v.setValue(0));
  };

  // ================= RENDER =================
  if (!questions) {
    // Skeleton while loading
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <QuizSkeleton />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar animated style="light" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
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

        {/* Question */}
        <Text
          fontSize={22}
          fontFamily="bold"
          color="#FFF"
          title={question.question}
          style={{ textAlign: "center", marginBottom: 24 }}
        />

        {/* Options */}
        {question.options.map((option: string, i: number) => {
          const isSelected = selectedOption === option;
          const correct = option === question.answer;

          const borderColor =
            isSelected && correct
              ? "#22C55E"
              : isSelected && !correct
                ? "#EF4444"
                : "#303033";

          const shadowOpacity = isSelected ? 0.35 : 0.15;

          const translateY = optionAnimValues[i].interpolate({
            inputRange: [0, 1],
            outputRange: [50, 0],
          });

          const opacity = optionAnimValues[i];

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

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground} />
          <Animated.View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>
      </ScrollView>

      {/* Final Quiz Modal */}
      {showFinalModal && (
        <AchievementModal
          achievement={{
            id: 999,
            title: "Quiz Completed!",
            correctCount: quizResults.filter((r) => r.correct).length,
            totalQuestions: questions.length,
            icon: (() => {
              const correctCount = quizResults.filter((r) => r.correct).length;
              const total = questions.length;
              const percent = (correctCount / total) * 100;

              if (percent === 100) return "🏆"; // Perfeito!
              if (percent >= 80) return "🙂"; // Quase lá
              if (percent >= 50) return "⚠️"; // Precisa melhorar
              if (percent >= 25) return "😟"; // Ruim

              return "😢"; // Ruim
            })(),
            description: `You answered ${quizResults.filter((r) => r.correct).length} out of ${questions.length} correctly!`,
          }}
          onClose={handleCloseFinalModal}
        />
      )}
    </View>
  );
}

// ================= STYLES =================
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

  // ================= SKELETON =================
  skeletonAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2C2C2E",
    marginBottom: 20,
  },
  skeletonQuestion: {
    width: width * 0.8,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#2C2C2E",
    marginBottom: 24,
  },
  skeletonOption: {
    width: width * 0.8,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#2C2C2E",
    marginBottom: 16,
  },
});
