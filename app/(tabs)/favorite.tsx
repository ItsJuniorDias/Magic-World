import Card from "@/components/card";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { db } from "@/firebaseConfig";
import { useLikedStore } from "@/store/useLikedStore";
import { useStoriesStore } from "@/store/useStoriesStore";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { doc, increment, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useCallback } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";

export default function FavoriteScreen() {
  const router = useRouter();

  const { likedIds = [], loadLikedStories, toggleLike } = useLikedStore();
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
          story.id === storyId
            ? { ...story, views: (story.views ?? 0) + 1 }
            : story,
        ),
      }));
    } catch (err) {
      console.warn("Erro ao incrementar views", err);
    }
  };

  const navigateToStory = useCallback(
    async (storyId: string) => {
      const fullStory = stories.find((s) => s.id === storyId);
      if (!fullStory?.chapter?.length) return;

      await incrementStoryViews(storyId);

      const firstChapter = fullStory.chapter[0];

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
    [stories],
  );

  /* ---------------------------------------------------
   * Derived Data
   * -------------------------------------------------- */

  const favoriteStories = useMemo(
    () => stories.filter((story) => likedIds.includes(story.id)),
    [stories, likedIds],
  );

  const recommendedStories = useMemo(
    () => stories.filter((story) => !likedIds.includes(story.id)).slice(0, 10),
    [stories, likedIds],
  );

  const popularStories = useMemo(
    () =>
      [...stories].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 10),
    [stories],
  );

  /* ---------------------------------------------------
   * Render
   * -------------------------------------------------- */

  const renderItem = useCallback(
    ({ item }: any) => {
      const isFavorite = likedIds.includes(item.id);

      return (
        <Card
          thumbnail={item.thumbnail}
          title={item.title}
          views={item.views}
          isFavorite={isFavorite}
          onToggleFavorite={() => {
            toggleLike({
              storyId: item.id,
              title: item.title,
              thumbnail: item.thumbnail,
              chapter: item.chapter,
            });
            // ❌ NÃO recarrega a store aqui
          }}
          onPress={() => navigateToStory(item.id)}
        />
      );
    },
    [likedIds, navigateToStory, toggleLike],
  );

  const SectionComponent = ({
    title,
    data,
  }: {
    title: string;
    data: any[];
  }) => {
    if (!data?.length) return null;

    return (
      <View>
        <View style={styles.section}>
          <Text title={title} fontFamily="bold" fontSize={22} color="#FFFFFF" />
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 16, paddingLeft: 24 }}
          extraData={likedIds} // 🔒 garante update sem reset
        />
      </View>
    );
  };

  const Section = React.memo(SectionComponent);
  Section.displayName = "Section";

  return (
    <>
      <StatusBar style="light" translucent />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
        <Section title="My Favorites" data={favoriteStories} />
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
  },
  section: {
    paddingLeft: 24,
  },
});
