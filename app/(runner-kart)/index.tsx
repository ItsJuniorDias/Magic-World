import { requireNativeComponent, View, ViewProps } from "react-native";

// import UnityViewGame from "../../modules/unity/index";
import UnityViewGame from "meu-modulo-unity";

// O nome 'UnityView' aqui DEVE bater com o nome da classe exportada no Obj-C/Swift
// menos a palavra 'Manager'.

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <UnityViewGame style={{ flex: 1 }} />
    </View>
  );
}
