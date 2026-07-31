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
import Text from "@/components/ui/Text";
import { tokens } from "@/constants/tokens";
import { db } from "@/firebaseConfig";
import { useLikedStore } from "@/store/useLikedStore";
import { useStoriesStore } from "@/store/useStoriesStore";
import { getLikedStories } from "@/services/liked";
import { useT } from "@/i18n";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAVORITE_KEY = "anonymous_user_key";
const CARD_WIDTH = 220;
const CARD_SPACING = 12;
const CARD_SIZE = CARD_WIDTH + CARD_SPACING;

// ================= CARD ANIMADO COM PARALLAX =================
const AnimatedCard = React.memo(
  ({ item, index, scrollX, onToggle, onPress, isFavorite }: any) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, []);

    const handleToggle = () => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onToggle(item);
      });
    };

    // ===== PARALLAX =====
    const inputRange = [
      (index - 1) * CARD_SIZE,
      index * CARD_SIZE,
      (index + 1) * CARD_SIZE,
    ];

    const imageTranslateX = scrollX.interpolate({
      inputRange,
      outputRange: [-20, 0, 20],
      extrapolate: "clamp",
    });

    const imageScale = scrollX.interpolate({
      inputRange,
      outputRange: [0.95, 1, 0.95],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={{
          opacity,
          width: CARD_WIDTH,
          marginRight: CARD_SPACING,
        }}
      >
        <Card
          thumbnail={item.thumbnail}
          title={item.title}
          views={item.views}
          isFavorite={isFavorite}
          isPro={item.isPro}
          onToggleFavorite={handleToggle}
          onPress={() => onPress(item.id)}
          imageStyle={{
            transform: [{ translateX: imageTranslateX }, { scale: imageScale }],
          }}
        />
      </Animated.View>
    );
  },
);

// ================= SCREEN =================
export default function FavoriteScreen() {
  const router = useRouter();
  const { t } = useT();
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
      if (!stories.length) return;

      const isPro = stories.find((s) => s.id === storyId)?.isPro;

      if (isPro) {
        const isUserPro = await AsyncStorage.getItem("@user_is_pro");

        if (isUserPro !== "true") {
          router.push("/(subscribe)");
          return;
        }
      }

      const fullStory = stories.find((s) => s.id === storyId);
      if (!fullStory?.chapter?.length) return;

      try {
        await updateDoc(doc(db, "stories", storyId), {
          views: increment(1) as any,
        });
      } catch {}

      const firstChapter = fullStory.chapter[0];
      router.push({
        pathname: firstChapter.navigate as any,
        params: { ...firstChapter, storyId, currentIndex: 0 },
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
    ({ item, index, scrollX }: any) => (
      <AnimatedCard
        item={item}
        index={index}
        scrollX={scrollX}
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
          title={t("favorites.myFavorites")}
          data={favoriteStories}
          renderItem={renderStoryItem}
        />
        <Section
          title={t("favorites.recommended")}
          data={recommendedStories}
          renderItem={renderStoryItem}
        />
        <Section
          title={t("favorites.trending")}
          data={popularStories}
          renderItem={renderStoryItem}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

// ================= SECTION =================
const Section = ({ title, data, renderItem }: any) => {
  if (!data?.length) return null;

  const scrollX = useRef(new Animated.Value(0)).current;

  return (
    <View style={styles.sectionWrapper}>
      <View style={styles.sectionHeader}>
        <Text
          title={title}
          fontFamily="bold"
          fontSize={22}
          color={tokens.color.dark.textPrimary}
        />
      </View>

      <Animated.FlatList
        data={data}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.flatListContent}
        renderItem={({ item, index }) => renderItem({ item, index, scrollX })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.dark.bg,
    paddingTop: tokens.spacing.xxxl,
  },
  sectionWrapper: { marginBottom: tokens.spacing.lg },
  sectionHeader: { paddingLeft: tokens.spacing.lg },
  flatListContent: {
    paddingTop: tokens.spacing.md,
    paddingLeft: tokens.spacing.lg,
    paddingRight: tokens.spacing.sm,
  },
});
