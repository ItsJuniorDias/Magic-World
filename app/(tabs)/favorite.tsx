import Card from "@/components/card";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { db } from "@/firebaseConfig";
import { useLikedStore } from "@/store/useLikedStore";
import { useStoriesStore } from "@/store/useStoriesStore";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { doc, increment, updateDoc } from "firebase/firestore";
import { useEffect, useMemo } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";

export default function FavoriteScreen() {
  const router = useRouter();

  const likedIds = useLikedStore((s) => s.likedIds);
  const likedStories = useLikedStore((s) => s.likedStories);
  const loadLikedStories = useLikedStore((s) => s.loadLikedStories);
  const toggleLike = useLikedStore((s) => s.toggleLike);

  const stories = useStoriesStore((s) => s.stories);

  useEffect(() => {
    loadLikedStories();
  }, []);

  const incrementStoryViews = async (storyId: string) => {
    const storyRef = doc(db, "stories", storyId);

    await updateDoc(storyRef, {
      views: increment(1),
    });

    useStoriesStore.setState((state) => ({
      stories: state.stories.map((story) =>
        story.id === storyId
          ? { ...story, views: (story.views ?? 0) + 1 }
          : story
      ),
    }));
  };

  const recommendedStories = useMemo(() => {
    return stories.filter((story) => !likedIds.includes(story.storyId));
  }, [stories, likedIds]);

  const popularStories = useMemo(() => {
    return [...stories]
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 10);
  }, [stories]);

  const renderItem = ({ item }: any) => (
    <Card
      thumbnail={item.thumbnail}
      title={item.title}
      views={item.views}
      isFavorite={likedIds.includes(item.storyId)}
      onToggleFavorite={() => {
        toggleLike({
          storyId: item.storyId,
          title: item.title,
          thumbnail: item.thumbnail,
        });

        loadLikedStories();
      }}
      onPress={async () => {
        await incrementStoryViews(item.storyId);

        router.push({
          pathname: item.chapter[0].navigate,
          params: {
            storie: item.chapter[0].storie,
            title: item.chapter[0].title,
            thumbnail: item.chapter[0].thumbnail,
            storyId: item.storyId,
            currentIndex: 0,
          },
        });
      }}
    />
  );

  const Section = ({ title, data }: { title: string; data: any[] }) => {
    if (!data.length) return null;

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
