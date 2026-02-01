// import { UnityView } from "unity";
import { requireNativeViewManager } from "expo-modules-core";
import { View, Text, Dimensions } from "react-native";

const NativeView: React.ComponentType = requireNativeViewManager("Unity");

export function UnityView(props: React.ComponentProps<typeof NativeView>) {
  return <NativeView {...props} />;
}

// import { UnityView } from "../../unity";

export default function RunnerKartScreen() {
  return (
    <View style={{ flex: 1 }}>
      <UnityView
        style={{
          flex: 1,
          width: Dimensions.get("screen").width,
          height: Dimensions.get("screen").height,
        }}
      />
    </View>
  );
}
