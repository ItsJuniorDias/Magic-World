import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { MaterialIcons, FontAwesome6 } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import GlassView from "@/components/ui/Glass";
import { useThemedTokens } from "@/hooks/use-tokens";
import { ModernCategoryCard } from "./styles";
import { useT } from "@/i18n";

type CategoryKey = "adventure" | "romance" | "fantasy" | "mystery" | "future";
type Category = {
  id: string;
  /**
   * Slug canônico usado como filtro no Firestore. Precisa bater
   * com o `category` gravado em `stories/*` — NÃO traduzir isso.
   */
  slug: CategoryKey;
  icon: string;
};

// Slugs em EN batem com o campo `category` dos docs em Firestore.
// O label mostrado ao usuário vem por i18n em `categories.items.<slug>`.
const CATEGORIES: Category[] = [
  { id: "1", slug: "adventure", icon: "map" },
  { id: "2", slug: "romance", icon: "heart-broken" },
  { id: "3", slug: "fantasy", icon: "star" },
  { id: "4", slug: "mystery", icon: "search" },
  { id: "5", slug: "future", icon: "rocket" },
];

export default function CategoriesScreen() {
  const t = useThemedTokens();
  const { t: tr } = useT();

  const renderCategory = ({ item }: { item: Category }) => (
    <ModernCategoryCard
      key={item.id}
      onPress={() =>
        router.push(`/(categories-detail)?category=${item.slug}` as any)
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
        {tr(`categories.items.${item.slug}`)}
      </Text>
    </ModernCategoryCard>
  );

  const Header = (
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

      <Text variant="heading" size="xxl" color={t.color.textPrimary}>
        {tr("categories.title")}
      </Text>

      <View style={{ width: 48 }} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: t.color.bg }]}>
      <FlatList
        data={CATEGORIES}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={Header}
        columnWrapperStyle={{
          justifyContent: "space-between",
          marginBottom: t.spacing.md,
          marginHorizontal: t.spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: t.spacing.xxxl,
          paddingBottom: t.spacing.lg,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
