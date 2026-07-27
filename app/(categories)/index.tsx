import React from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import GlassView from "@/components/ui/Glass";
import { MaterialIcons, FontAwesome6 } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useThemedTokens } from "@/hooks/use-tokens";
import { Container, ModernCategoryCard } from "./styles";

type Category = {
  id: string;
  title: string;
  icon: string;
};

const CATEGORIES: Category[] = [
  { id: "1", title: "adventure", icon: "map" },
  { id: "2", title: "romance", icon: "heart-broken" },
  { id: "3", title: "fantasy", icon: "star" },
  { id: "4", title: "mystery", icon: "search" },
  { id: "5", title: "future", icon: "rocket" },
];

export default function CategoriesScreen() {
  const t = useThemedTokens();

  const renderCategory = ({ item }: { item: Category }) => (
    <ModernCategoryCard
      key={item.id}
      onPress={() =>
        router.push(`/(categories-detail)?category=${item.title}` as any)
      }
    >
      <MaterialIcons
        name={item.icon as any}
        size={36}
        color={t.color.textPrimary}
      />
      <Text
        variant="heading"
        size="md"
        color={t.color.textPrimary}
        style={{ marginTop: t.spacing.sm, textAlign: "center" }}
      >
        {item.title}
      </Text>
    </ModernCategoryCard>
  );

  return (
    <Container showsVerticalScrollIndicator={false}>
      <View
        style={[
          styles.contentHeader,
          {
            paddingHorizontal: t.spacing.lg,
            marginBottom: t.spacing.lg,
          },
        ]}
      >
        <Pressable onPress={() => router.back()}>
          <GlassView
            style={styles.buttonBack}
            isInteractive
            glassEffectStyle="clear"
          >
            <FontAwesome6
              name="chevron-left"
              size={22}
              color={t.color.textPrimary}
            />
          </GlassView>
        </Pressable>

        <Text
          variant="heading"
          size="xxl"
          color={t.color.textPrimary}
        >
          Categories
        </Text>

        <View style={{ width: 48 }} />
      </View>

      <FlatList
        data={CATEGORIES}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{
          justifyContent: "space-between",
          marginBottom: t.spacing.md,
          marginHorizontal: t.spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: t.spacing.lg }}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  contentHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
  },
  buttonBack: {
    height: 48,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 48,
  },
});
