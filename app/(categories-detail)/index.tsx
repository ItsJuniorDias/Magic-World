import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { GlassView } from "expo-glass-effect";
import { FontAwesome6 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { Container, Gradient, ImageCard, ModernCategoryCard } from "./styles";
import { useStoriesStore } from "@/store/useStoriesStore";
import { doc, increment, updateDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";

export default function CategoryDetailsScreen() {
  const params = useLocalSearchParams<{
    category: string;
    storyId: string;
    currentIndex: string;
  }>();

  const categoryName = params.category;
  const allStories = useStoriesStore((state) => state.stories);

  const [stories, setStories] = useState<typeof allStories>([]);
  const [isPro, setIsPro] = useState(false);

  /* =========================
     VERIFICA SE USUÁRIO É PRO
  ========================== */
  useEffect(() => {
    AsyncStorage.getItem("@user_is_pro").then((value) => {
      setIsPro(value === "true");
    });
  }, []);

  useEffect(() => {
    const targetCategory = categoryName ?? params.storyId;
    const filtered = allStories.filter(
      (s) => (s as any).category === targetCategory,
    );

    setStories(filtered);
  }, [categoryName, params.storyId, allStories]);

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

  /* =========================
     RENDER DO CARD
  ========================== */
  const renderStory = ({ item }: { item: (typeof allStories)[0] }) => {
    const isPremium = item.isPro === true;
    const isLocked = isPremium && !isPro;

    return (
      <ModernCategoryCard
        onPress={async () => {
          if (isLocked) {
            router.push("/(subscribe)");
            return;
          }

          await incrementStoryViews(item.id);

          router.push({
            pathname: `/(storie)`,
            params: {
              title: item.title,
              storie: item.chapter[0].storie,
              thumbnail: item.chapter[0].thumbnail,
              storyId: item.id,
              currentIndex: 0,
            },
          });
        }}
      >
        {/* BADGE PREMIUM */}
        {isPremium && (
          <View style={styles.premiumBadge}>
            <FontAwesome6 name="crown" size={10} color="#fff" />

            <Text
              title="PREMIUM"
              fontFamily="bold"
              fontSize={12}
              color="#fff"
              style={{ marginLeft: 4 }}
            />
          </View>
        )}

        <ImageCard source={{ uri: item.thumbnail }}>
          <Gradient
            colors={["transparent", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.9)"]}
          >
            <Text
              title={item.title}
              fontFamily="bold"
              fontSize={16}
              color="#fff"
              style={{ textAlign: "center", marginTop: 8 }}
            />

            {isLocked && (
              <Text
                title="Exclusivo para membros"
                fontFamily="regular"
                fontSize={12}
                color="#FFD700"
                style={{ textAlign: "center", marginTop: 4 }}
              />
            )}
          </Gradient>
        </ImageCard>
      </ModernCategoryCard>
    );
  };

  return (
    <Container>
      {/* HEADER */}
      <View style={styles.contentHeader}>
        <Pressable
          style={styles.backButtonWrapper}
          onPress={() => router.back()}
        >
          <GlassView
            style={styles.buttonBack}
            isInteractive
            glassEffectStyle="clear"
          >
            <FontAwesome6
              name="chevron-left"
              size={22}
              color={Colors.dark.text}
            />
          </GlassView>
        </Pressable>

        <Text
          fontFamily="bold"
          fontSize={24}
          color="#FFFFFF"
          title={categoryName || params.storyId}
        />

        <View style={{ width: 48 }} />
      </View>

      {/* LISTA */}
      <FlatList
        data={stories}
        renderItem={renderStory}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{
          justifyContent: "space-between",
          marginBottom: 16,
          marginHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  backButtonWrapper: {},
  contentHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  buttonBack: {
    height: 48,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 48,
  },

  /* =========================
     BADGE PREMIUM
  ========================== */
  premiumBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#000",
  },
});
