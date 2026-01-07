import Text from "@/components/text";
import { Container, CategoryCard } from "./styles";
import { Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { GlassView } from "expo-glass-effect";
import { FontAwesome6 } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";

export default function CategoriesScreen() {
  return (
    <>
      <Container>
        {/* BOTÃO VOLTAR */}
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
          title="Categories"
          style={{ marginBottom: 24, marginLeft: 24, marginTop: 16 }}
        />
        <CategoryCard />
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  backButtonWrapper: {
    left: 24,
  },
  buttonBack: {
    height: 48,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 48,
  },
});
