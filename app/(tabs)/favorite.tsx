import React, { useEffect, useMemo, useCallback, useRef } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  View,
  LayoutAnimation,
  Animated,
  Platform,
  UIManager,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc, increment } from "firebase/firestore";

import Card from "@/components/card";
import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { db } from "@/firebaseConfig";
import { useLikedStore } from "@/store/useLikedStore";
import { useStoriesStore } from "@/store/useStoriesStore";
import { getLikedStories } from "@/services/liked";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAVORITE_KEY = "anonymous_user_key";
const CARD_WIDTH = 220;

// --- COMPONENTE DE CARD COM FADE-IN E FADE-OUT ---
const AnimatedCard = React.memo(
  ({ item, onToggle, onPress, isFavorite }: any) => {
    // Começa com 0 para o Fade-in inicial
    const opacity = useRef(new Animated.Value(0)).current;

    // Efeito de Fade-in ao montar
    useEffect(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, []);

    const handleToggle = () => {
      // Efeito de Fade-out antes de remover
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onToggle(item);
      });
    };

    return (
      <Animated.View style={{ opacity, width: CARD_WIDTH, marginRight: 12 }}>
        <Card
          thumbnail={item.thumbnail}
          title={item.title}
          views={item.views}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggle}
          onPress={() => onPress(item.id)}
        />
      </Animated.View>
    );
  },
);

export default function FavoriteScreen() {
  const router = useRouter();
  const { likedIds = [], loadLikedStories, toggleLike } = useLikedStore();
  const stories = useStoriesStore((s) => s.stories);
  const userKeyRef = useRef<string | null>(null);

  useEffect(() => {
    loadLikedStories();
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

  const handleToggleLike = useCallback(
    (item: any) => {
      // LayoutAnimation suave para os outros cards deslizarem lateralmente
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      toggleLike({
        chapter: item.chapter,
        storyId: item.id,
        thumbnail: item.thumbnail,
        title: item.title,
      });

      if (userKeyRef.current) {
        getLikedStories(userKeyRef.current);
      }
    },
    [toggleLike],
  );

  const navigateToStory = useCallback(
    async (storyId: string) => {
      const fullStory = stories.find((s) => s.id === storyId);
      if (!fullStory?.chapter?.length) return;

      try {
        await updateDoc(doc(db, "stories", storyId), {
          views: increment(1) as any,
        });
      } catch (e) {}

      const firstChapter = fullStory.chapter[0];
      router.push({
        pathname: firstChapter.navigate as any,
        params: { ...firstChapter, storyId: fullStory.id, currentIndex: 0 },
      });
    },
    [stories, router],
  );

  const favoriteStories = useMemo(
    () => stories.filter((s) => likedIds.includes(s.id)),
    [stories, likedIds],
  );

  const recommendedStories = useMemo(
    () => stories.filter((s) => !likedIds.includes(s.id)).slice(0, 10),
    [stories, likedIds],
  );

  const popularStories = useMemo(
    () =>
      [...stories]
        .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
        .filter((s) => !likedIds.includes(s.id))
        .slice(0, 10),
    [stories, likedIds],
  );

  const renderStoryItem = useCallback(
    ({ item }: any) => (
      <AnimatedCard
        item={item}
        isFavorite={likedIds.includes(item.id)}
        onToggle={handleToggleLike}
        onPress={navigateToStory}
      />
    ),
    [likedIds, handleToggleLike, navigateToStory],
  );

  return (
    <>
      <StatusBar style="light" translucent />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
        <Section
          title="My Favorites"
          data={favoriteStories}
          renderItem={renderStoryItem}
        />
        <Section
          title="Recommended"
          data={recommendedStories}
          renderItem={renderStoryItem}
        />
        <Section
          title="Trending"
          data={popularStories}
          renderItem={renderStoryItem}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const Section = ({ title, data, renderItem }: any) => {
  if (!data?.length) return null;
  return (
    <View style={styles.sectionWrapper}>
      <View style={styles.sectionHeader}>
        <Text title={title} fontFamily="bold" fontSize={22} color="#FFFFFF" />
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.flatListContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 64,
  },
  sectionWrapper: { marginBottom: 24 },
  sectionHeader: { paddingLeft: 24 },
  flatListContent: { paddingTop: 16, paddingLeft: 24, paddingRight: 12 },
});
