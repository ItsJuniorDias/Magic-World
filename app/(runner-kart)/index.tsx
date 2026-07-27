import { requireNativeViewManager } from "expo-modules-core";
import { View, useWindowDimensions, StyleSheet } from "react-native";

const NativeView: React.ComponentType<any> = requireNativeViewManager("Unity");

export function UnityView(props: any) {
  return <NativeView {...props} />;
}

export default function RunnerKartScreen() {
  // Esse hook escuta mudanças de orientação automaticamente
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <UnityView
        style={{
          width: width,
          height: height,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000", // Fundo preto evita flashes brancos na rotação
  },
});
