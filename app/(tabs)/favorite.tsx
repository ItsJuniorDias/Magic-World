import Card from "@/components/card";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { db } from "@/firebaseConfig";
import { useLikedStore } from "@/store/useLikedStore";
import { useStoriesStore } from "@/store/useStoriesStore";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  increment,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useCallback, useRef } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  View,
  LayoutAnimation,
  Animated,
  Easing,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { getLikedStories } from "@/services/liked";

type SectionType = "favorites" | "recommended" | "trending";

const FAVORITE_KEY = "anonymous_user_key";

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

  /** chave anônima */
  const userKeyRef = useRef<string | null>(null);

  useEffect(() => {
    loadLikedStories();
    // carrega ou gera a chave anônima
    const loadUserKey = async () => {
      let key = await AsyncStorage.getItem(FAVORITE_KEY);
      if (!key) {
        key = Math.random().toString(36).substring(2, 12);
        await AsyncStorage.setItem(FAVORITE_KEY, key);
      }
      userKeyRef.current = key;
    };

    loadUserKey();
  }, [loadLikedStories]);

  /** Derived Data */
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
      [...stories]
        .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
        .filter((story) => !likedIds.includes(story.id))
        .slice(0, 10),
    [stories, likedIds],
  );

  /** Helpers */
  const incrementStoryViews = async (storyId: string) => {
    try {
      const storyRef = doc(db, "stories", storyId);
      await updateDoc(storyRef, { views: increment(1) as any });
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

  /** Animated Card */
  const CARD_WIDTH = 220;

  const AnimatedCard = ({ item, onRemove, onPress, isFavorite }: any) => {
    const opacity = useRef(new Animated.Value(1)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    const animateOut = (cb?: () => void) => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.96,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 6,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => cb?.());
    };

    const handleToggleFavorite = async () => {
      const newIsFavorite = !isFavorite;

      // Atualiza store local imediatamente
      toggleLike({
        chapter: item.chapter,
        storyId: item.id,
        thumbnail: item.thumbnail,
        title: item.title,
      });

      // Animação
      animateOut();

      // Atualiza Firestore de forma anônima
      await getLikedStories(userKeyRef.current!);
    };

    return (
      <Animated.View
        style={{
          opacity,
          transform: [{ scale }, { translateY }],
          width: CARD_WIDTH,
          marginRight: 12,
        }}
      >
        <Card
          thumbnail={item.thumbnail}
          title={item.title}
          views={item.views}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          onPress={() => onPress(item.id)}
        />
      </Animated.View>
    );
  };

  /** Render Item */
  const renderItem = useCallback(
    () =>
      ({ item }: any) => {
        const isFavorite = likedIds.includes(item.id);
        return (
          <AnimatedCard
            item={item}
            isFavorite={isFavorite}
            onPress={navigateToStory}
          />
        );
      },
    [likedIds, navigateToStory, toggleLike],
  );

  /** Section */
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
          renderItem={renderItem()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 16, paddingLeft: 24 }}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            offsetRef.current = e.nativeEvent.contentOffset.x;
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
