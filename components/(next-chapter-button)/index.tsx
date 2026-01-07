import { TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/theme";
import { useStoriesStore } from "@/store/useStoriesStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function NextChapterButton({
  storyId,
  currentIndex = 0,
}: {
  storyId: string;
  currentIndex: number;
}) {
  const router = useRouter();

  const story = useStoriesStore((state) =>
    state.stories.find((item) => item.id === storyId)
  );

  if (!story) return null;

  const nextChapter = story?.chapter[currentIndex + 1];

  // Se não houver próximo capítulo, não mostra o botão
  if (!nextChapter) return null;

  // Verifica se o capítulo está bloqueado (exemplo: locked = true)
  const isLocked = nextChapter?.locked ?? false;

  const checkProStatus = async () => {
    const value = await AsyncStorage.getItem("@user_is_pro");
    return value != null ? JSON.parse(value) : false;
  };

  const handlePress = async () => {
    if (isLocked && !(await checkProStatus())) {
      // Redireciona para tela de assinatura
      router.push("/(subscribe)");
    } else {
      // Vai para o próximo capítulo
      router.push({
        pathname: "/(storie)",
        params: {
          storie: nextChapter.storie,
          title: nextChapter.title,
          thumbnail: nextChapter.thumbnail,
          storyId: storyId,
          currentIndex: currentIndex + 1,
        },
      });
    }
  };

  return (
    <TouchableOpacity style={styles.fab} onPress={handlePress}>
      <FontAwesome6 name="arrow-right" size={20} color="#FFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 1000,
  },
});
