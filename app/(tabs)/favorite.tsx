import Card from "@/components/card";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { db } from "@/firebaseConfig";
import { getStories } from "@/services/getStories";
import { useLikedStore } from "@/store/useLikedStore";
import { useStoriesStore } from "@/store/useStoriesStore";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { doc, increment, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useCallback, useRef } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

type SectionType = "favorites" | "recommended" | "trending";

export default function FavoriteScreen() {
  const router = useRouter();

  const { likedIds = [], loadLikedStories, toggleLike } = useLikedStore();

  const stories = useStoriesStore((s) => s.stories);

  /** refs por seção */
  const favoritesRef = useRef<FlatList>(null);
  const recommendedRef = useRef<FlatList>(null);
  const trendingRef = useRef<FlatList>(null);

  const favoritesOffset = useRef(0);
  const recommendedOffset = useRef(0);
  const trendingOffset = useRef(0);

  useEffect(() => {
    loadLikedStories();
  }, [loadLikedStories]);

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

  const recommendedStories = useMemo(() => stories.slice(0, 10), [stories]);

  const popularStories = useMemo(
    () =>
      [...stories].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 10),
    [stories],
  );

  /* ---------------------------------------------------
   * Scroll restore helper
   * -------------------------------------------------- */

  const restoreScroll = (section: SectionType) => {
    requestAnimationFrame(() => {
      if (section === "favorites") {
        favoritesRef.current?.scrollToOffset({
          offset: favoritesOffset.current,
          animated: false,
        });
      }

      if (section === "recommended") {
        recommendedRef.current?.scrollToOffset({
          offset: recommendedOffset.current,
          animated: false,
        });
      }

      if (section === "trending") {
        trendingRef.current?.scrollToOffset({
          offset: trendingOffset.current,
          animated: false,
        });
      }
    });
  };

  /* ---------------------------------------------------
   * Render Item
   * -------------------------------------------------- */

  const renderItem = useCallback(
    (section: SectionType) =>
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

              restoreScroll(section);
            }}
            onPress={() => navigateToStory(item.id)}
          />
        );
      },
    [likedIds, navigateToStory, toggleLike],
  );

  /* ---------------------------------------------------
   * Section
   * -------------------------------------------------- */

  const Section = ({
    title,
    data,
    section,
    listRef,
    offsetRef,
  }: {
    title: string;
    data: any[];
    section: SectionType;
    listRef: React.RefObject<FlatList>;
    offsetRef: React.MutableRefObject<number>;
  }) => {
    if (!data?.length) return null;

    return (
      <View>
        <View style={styles.section}>
          <Text title={title} fontFamily="bold" fontSize={22} color="#FFFFFF" />
        </View>

        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem(section)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 16, paddingLeft: 24 }}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            offsetRef.current = e.nativeEvent.contentOffset.x;
          }}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
          scrollEventThrottle={16}
        />
      </View>
    );
  };

  return (
    <>
      <StatusBar style="light" translucent />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
        <Section
          title="My Favorites"
          data={favoriteStories}
          section="favorites"
          listRef={favoritesRef}
          offsetRef={favoritesOffset}
        />

        <Section
          title="Recommended for You"
          data={recommendedStories}
          section="recommended"
          listRef={recommendedRef}
          offsetRef={recommendedOffset}
        />

        <Section
          title="Trending"
          data={popularStories}
          section="trending"
          listRef={trendingRef}
          offsetRef={trendingOffset}
        />
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
