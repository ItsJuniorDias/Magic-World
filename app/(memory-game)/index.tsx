import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  ScrollView,
  Pressable,
} from "react-native";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { GlassView } from "expo-glass-effect";
import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

const icons = ["🍎", "🍌", "🍇", "🍉", "🍓", "🍍"];
const shuffleArray = (array: any[]) => array.sort(() => Math.random() - 0.5);

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - 64) / 3;

const MemoryGame = () => {
  const [cards, setCards] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  const router = useRouter();

  useEffect(() => {
    const paired = shuffleArray([...icons, ...icons]).map((icon, index) => ({
      id: index,
      icon,
      flipped: false,
    }));
    setCards(paired);
  }, []);

  const handleCardPress = (index: number) => {
    if (selected.includes(index) || matched.includes(index)) return;

    const newSelected = [...selected, index];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setMoves(moves + 1);
      const [first, second] = newSelected;
      if (cards[first].icon === cards[second].icon) {
        setMatched([...matched, first, second]);
        setSelected([]);
        if (matched.length + 2 === cards.length) {
          Alert.alert(
            "🎉 Congratulations!",
            `You completed the memory challenge in ${moves + 1} moves!`,
          );
        }
      } else {
        setTimeout(() => setSelected([]), 800);
      }
    }
  };

  const renderCard = (card: any, index: number) => {
    const isFlipped = selected.includes(index) || matched.includes(index);
    return (
      <TouchableOpacity
        key={card.id}
        style={[styles.card, isFlipped && styles.cardFlipped]}
        onPress={() => handleCardPress(index)}
        activeOpacity={0.8}
      >
        <Text
          fontSize={32}
          fontFamily="bold"
          color={Colors.light.text}
          title={isFlipped ? card.icon : "❓"}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar animated style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* BACK BUTTON */}
        <Pressable
          style={styles.backButtonWrapper}
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

        {/* TITLE */}
        <Text
          fontSize={28}
          fontFamily="bold"
          color={Colors.dark.text}
          title="🧠 Memory Challenge"
          style={{ marginBottom: 12, marginTop: 16 }}
        />

        {/* INSTRUCTIONS */}
        <Text
          fontSize={16}
          fontFamily="regular"
          color={Colors.dark.text}
          title="Try to match all pairs as quickly as possible!"
          style={{ textAlign: "center", marginBottom: 16 }}
        />

        {/* SCORE / MOVES */}
        <Text
          fontSize={16}
          fontFamily="regular"
          color={Colors.dark.text}
          title={`Moves: ${moves}`}
          style={{ marginBottom: 24 }}
        />

        {/* MOTIVATIONAL TEXT */}
        <Text
          fontSize={14}
          fontFamily="regular"
          color={Colors.dark.text}
          title="Tip: Remember where the cards are to improve your memory!"
          style={{ textAlign: "center", marginBottom: 24 }}
        />

        {/* CARD GRID */}
        <View style={styles.grid}>{cards.map(renderCard)}</View>

        {/* EXTRA SPACE AT BOTTOM */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

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
  backButtonWrapper: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  glassButton: {
    height: 48,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 48,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardFlipped: {
    backgroundColor: "#8B5CF6",
  },
});

export default MemoryGame;
