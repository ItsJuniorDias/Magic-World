import { TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/theme";
import { useStoriesStore } from "@/store/useStoriesStore";

export function NextChapterButton({
  storyId,
  currentIndex = 0,
}: {
  storyId: string;
  currentIndex: number;
}) {
  console.log("NextChapterButton props:", { storyId, currentIndex });
  const router = useRouter();

  const story = useStoriesStore((state) =>
    state.stories.find((item) => item.id === storyId)
  );

  console.log(story, "STORY");

  if (!story) return null;

  const nextChapter = story.chapter[currentIndex + 1];

  if (!nextChapter) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={() =>
        router.push({
          pathname: "/(storie)",
          params: {
            storie: nextChapter.storie,
            title: nextChapter.title,
            thumbnail: nextChapter.thumbnail,
            storyId: storyId,
            currentIndex: currentIndex + 1,
          },
        })
      }
    >
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
