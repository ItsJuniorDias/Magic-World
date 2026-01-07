import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

export default function FavoriteScreen() {
  return (
    <>
      <StatusBar style="light" translucent />
      <View style={styles.container}>
        <Text
          title={"🚧 Under construction"}
          fontFamily="bold"
          fontSize={24}
          color={Colors.dark.text}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 64,
    alignItems: "center",
    justifyContent: "center",
  },
});
