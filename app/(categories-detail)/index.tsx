import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { GlassView } from "expo-glass-effect";
import { FontAwesome6 } from "@expo/vector-icons";

import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import {
  Container,
  Gradient,
  ImageCard,
  ModernCategoryCard,
  Overlay,
} from "./styles";
import { useStoriesStore } from "@/store/useStoriesStore";

// Exemplo de dados de stories por categoria

export default function CategoryDetailsScreen() {
  const params = useLocalSearchParams<{ category: string }>();
  const categoryName = params.category;

  console.log("Categoria selecionada:", categoryName);

  const [stories, setStories] = useState<typeof allStories>([]);

  const allStories = useStoriesStore((state) => state.stories);

  console.log(allStories, "ALL STORIES");

  useEffect(() => {
    // Filtra os stories da categoria selecionada
    const filtered = allStories.filter((s) => s.category === categoryName);
    setStories(filtered);
  }, [categoryName]);

  console.log(stories, "STORIES");

  const renderStory = ({ item }: { item: (typeof allStories)[0] }) => (
    <ModernCategoryCard
      onPress={() =>
        router.push({
          pathname: `/(storie)`,
          params: {
            title: item.title,
            storie: item.chapter[0].storie,
            thumbnail: item.chapter[0].thumbnail,
            storyId: item.id,
            currentIndex: 0,
          },
        })
      }
    >
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
        </Gradient>
      </ImageCard>
    </ModernCategoryCard>
  );

  return (
    <Container>
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
          title={categoryName || "Category"}
        />

        <View style={{ width: 48 }} />
      </View>

      {/* LISTA DE STORIES */}
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
});
