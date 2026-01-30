import { requireNativeComponent } from "react-native";

const UnityView = requireNativeComponent("UnityView");

export default function App() {
  return (
    <UnityView
      style={{ flex: 1 }}
      onMessage={(e) => console.log(e.nativeEvent.message)}
    />
  );
}
