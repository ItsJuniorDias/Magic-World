import Card from "@/components/card";
import Text from "@/components/text";
import { StatusBar } from "expo-status-bar";
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  FlatList,
  Animated,
} from "react-native";

import { db } from "../../firebaseConfig";
import React, { useEffect, useMemo, useRef } from "react";
import { useRouter } from "expo-router";
import { doc, increment, updateDoc } from "firebase/firestore";

import { useStoriesStore } from "@/store/useStoriesStore";
import { useLikedStore } from "@/store/useLikedStore";
import { useQuery } from "@tanstack/react-query";
import { getStories } from "@/services/getStories";
import CardSkeleton from "@/components/card-skeleton";
import { useAppReview } from "@/hooks/useAppReview";

/* -------------------------------------------------------------------------- */
/*                                   CONSTS                                   */
/* -------------------------------------------------------------------------- */

const CARD_WIDTH = 220;
const SPACING = 16;
const FULL_SIZE = CARD_WIDTH + SPACING;

/* -------------------------------------------------------------------------- */
/*                              PARALLAX CARD                                 */
/* -------------------------------------------------------------------------- */

const AnimatedCard = ({
  item,
  index,
  variant,
  scrollX,
  onPress,
  onToggleFavorite,
  isFavorite,
}: any) => {
  const inputRange = [
    (index - 1) * FULL_SIZE,
    index * FULL_SIZE,
    (index + 1) * FULL_SIZE,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.98, 1, 0.98],
    extrapolate: "clamp",
  });

  const imageTranslateX = scrollX.interpolate({
    inputRange,
    outputRange: [-24, 0, 24],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        marginRight: SPACING,
      }}
    >
      <Card
        variant={variant}
        title={item.title}
        views={item.views}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        onPress={onPress}
        thumbnail={item.thumbnail}
        thumbnailComponent={
          <Animated.Image
            source={{ uri: item.thumbnail }}
            resizeMode="cover"
            style={{
              width: "110%",
              height: "100%",
              transform: [{ translateX: imageTranslateX }],
            }}
          />
        }
      />
    </Animated.View>
  );
};

/* -------------------------------------------------------------------------- */
/*                                HOME SCREEN                                 */
/* -------------------------------------------------------------------------- */

export default function HomeScreen() {
  const router = useRouter();
  const { requestReviewOnce } = useAppReview();

  const likedIds = useLikedStore((s) => s.likedIds);
  const toggleLike = useLikedStore((s) => s.toggleLike);
  const loadLikedStories = useLikedStore((s) => s.loadLikedStories);

  const query = useQuery({ queryKey: ["stories"], queryFn: getStories });

  const incrementStoryViews = async (storyId: string) => {
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
  };

  useEffect(() => {
    setTimeout(() => {
      requestReviewOnce();
    }, 30000);
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                                DATA                                      */
  /* ------------------------------------------------------------------------ */

  const mostWatched = useMemo(() => {
    return [...(query.data ?? [])].sort(
      (a, b) => (b.views ?? 0) - (a.views ?? 0),
    );
  }, [query.data]);

  const recentlyPublished = useMemo(() => {
    return [...(query.data ?? [])].sort(
      (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
    );
  }, [query.data]);

  const categoryStories = [
    {
      id: "fantasy",
      title: "Fantasy",
      chapter: [{ navigate: "/(categories-detail)" }],
      thumbnail:
        "https://res.cloudinary.com/dqvujibkn/image/upload/v1769205788/pfwo9imq95av3qlnlqf3.png",
    },
    {
      id: "adventure",
      title: "Adventure",
      chapter: [{ navigate: "/(categories-detail)" }],
      thumbnail:
        "https://res.cloudinary.com/dqvujibkn/image/upload/v1769205676/fqgbiicg2oacp9jfo8ah.png",
    },
    {
      id: "mystery",
      title: "Mystery",
      chapter: [{ navigate: "/(categories-detail)" }],
      thumbnail:
        "https://res.cloudinary.com/dqvujibkn/image/upload/v1769205719/agbq553klppl3upwl3s9.png",
    },
    {
      id: "future",
      title: "Future",
      chapter: [{ navigate: "/(categories-detail)" }],
      thumbnail:
        "https://res.cloudinary.com/dqvujibkn/image/upload/v1769205882/hnv00nh6zqskkjn2saqw.png",
    },
    {
      id: "all",
      title: "All Categories",
      chapter: [{ navigate: "/(categories)" }],
      thumbnail:
        "https://res.cloudinary.com/dqvujibkn/image/upload/v1767753186/Gemini_Generated_Image_mijilhmijilhmiji_1_frh7nh.png",
    },
  ];

  /* ------------------------------------------------------------------------ */
  /*                                SECTION                                   */
  /* ------------------------------------------------------------------------ */

  const Section = ({
    title,
    data,
    variant,
    loading,
  }: {
    title: string;
    data: any[];
    variant: "default" | "category" | "recent";
    loading: boolean;
  }) => {
    const scrollX = useRef(new Animated.Value(0)).current;

    return (
      <View style={styles.section}>
        <Text
          title={title}
          fontFamily="bold"
          fontSize={24}
          color="#FFFFFF"
          style={{ marginBottom: 12, marginLeft: 24 }}
        />

        {loading ? (
          <FlatList
            data={[1, 2, 3, 4]}
            renderItem={() => <CardSkeleton variant={variant} />}
            horizontal
            keyExtractor={(item) => item.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 24 }}
          />
        ) : (
          <Animated.FlatList
            data={data}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 24 }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true },
            )}
            scrollEventThrottle={16}
            renderItem={({ item, index }) => (
              <AnimatedCard
                item={item}
                index={index}
                variant={variant}
                scrollX={scrollX}
                isFavorite={likedIds.includes(item.id)}
                onToggleFavorite={() => {
                  toggleLike({
                    storyId: item.id,
                    title: item.title,
                    thumbnail: item.thumbnail,
                    chapter: item.chapter,
                  });
                  loadLikedStories();
                }}
                onPress={async () => {
                  if (variant !== "category") {
                    await incrementStoryViews(item.id);
                  }

                  router.push({
                    pathname: item.chapter[0].navigate,
                    params: {
                      storie: item.chapter[0].storie,
                      title: item.chapter[0].title,
                      thumbnail: item.chapter[0].thumbnail,
                      storyId: item.id,
                      currentIndex: 0,
                    },
                  });
                }}
              />
            )}
          />
        )}
      </View>
    );
  };

  /* ------------------------------------------------------------------------ */
  /*                                 RENDER                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      <StatusBar style="light" translucent />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
        <Section
          title="Most Watched Stories"
          data={mostWatched}
          variant="default"
          loading={query.isLoading}
        />

        <Section
          title="Categories"
          data={categoryStories}
          variant="category"
          loading={false}
        />

        <Section
          title="Recently Published"
          data={recentlyPublished}
          variant="recent"
          loading={query.isLoading}
        />
      </ScrollView>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#15141A",
    paddingTop: Platform.OS === "ios" ? 8 : 24,
  },
  section: {
    marginBottom: 16,
  },
});
