import Card from "@/components/card";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { db } from "@/firebaseConfig";
import { useLikedStore } from "@/store/useLikedStore";
import { useStoriesStore } from "@/store/useStoriesStore";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { doc, increment, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useCallback } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";

export default function FavoriteScreen() {
  const router = useRouter();

  const { likedIds, likedStories, loadLikedStories, toggleLike } =
    useLikedStore();

  const stories = useStoriesStore((s) => s.stories);

  useEffect(() => {
    loadLikedStories();
  }, []);

  /* ---------------------------------------------------
   * Helpers
   * -------------------------------------------------- */

  const incrementStoryViews = async (storyId: string) => {
    try {
      const storyRef = doc(db, "stories", storyId);

      await updateDoc(storyRef, {
        views: increment(1),
      });

      useStoriesStore.setState((state) => ({
        stories: state.stories.map((story) =>
          story.storyId === storyId
            ? { ...story, views: (story.views ?? 0) + 1 }
            : story
        ),
      }));
    } catch (err) {
      console.warn("Erro ao incrementar views", err);
    }
  };

  const navigateToStory = useCallback(
    async (storyId: string) => {
      console.log("Navegando para a história:", storyId);

      const fullStory = stories.find((s) => s.id === storyId);

      if (!fullStory?.chapter?.length) {
        console.warn("Story sem capítulos:", fullStory);
        return;
      }

      const firstChapter = fullStory.chapter[0];

      await incrementStoryViews(storyId);

      router.push({
        pathname: firstChapter.navigate,
        params: {
          storie: firstChapter.storie,
          title: firstChapter.title,
          thumbnail: firstChapter.thumbnail,
          storyId: fullStory.id,
          currentIndex: 0,
        },
      });
    },
    [stories]
  );

  /* ---------------------------------------------------
   * Derived Data
   * -------------------------------------------------- */

  const recommendedStories = useMemo(() => {
    return stories.filter((story) => !likedIds.includes(story.id));
  }, [stories, likedIds]);

  const popularStories = useMemo(() => {
    return [...stories]
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 10);
  }, [stories]);

  /* ---------------------------------------------------
   * Render
   * -------------------------------------------------- */

  const renderItem = ({ item }: any) => {
    const isFavorite = likedIds.includes(item.storyId);

    return (
      <Card
        thumbnail={item.thumbnail}
        title={item.title}
        views={item.views}
        isFavorite={isFavorite}
        onToggleFavorite={() => {
          toggleLike({
            storyId: item.storyId,
            title: item.title,
            thumbnail: item.thumbnail,
            chapter: item.chapter ?? [],
          });

          loadLikedStories();
        }}
        onPress={() => navigateToStory(item.storyId ?? item.id)}
      />
    );
  };

  const Section = ({ title, data }: { title: string; data: any[] }) => {
    if (!data?.length) return null;

    return (
      <View style={styles.section}>
        <Text title={title} fontFamily="bold" fontSize={22} color="#FFFFFF" />

        <FlatList
          data={data}
          keyExtractor={(item) => item.storyId}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 16 }}
        />
      </View>
    );
  };

  return (
    <>
      <StatusBar style="light" translucent />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
        <Section title="My Favorites" data={likedStories} />

        <Section title="Recommended for You" data={recommendedStories} />
        <Section title="Trending" data={popularStories} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 64,
    paddingLeft: 24,
  },
  section: {
    marginBottom: 32,
  },
});
