import { Modal, Pressable, StyleSheet, View } from "react-native";

import Text from "../text";

export default function GuidedReadingModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <Text
            title="A new way to experience the story"
            fontFamily="bold"
            fontSize={22}
            color="#000"
            style={{ textAlign: "center", marginBottom: 12 }}
          />

          <Text
            title="Relax and let the reading guide you."
            fontFamily="regular"
            fontSize={16}
            color="#555"
            style={{ textAlign: "center", marginBottom: 24 }}
          />

          <Pressable style={modalStyles.button} onPress={onClose}>
            <Text
              title="Start Listening"
              fontSize={16}
              fontFamily="bold"
              color="#fff"
            />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  container: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,

    // Apple-like shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },

  button: {
    backgroundColor: "#000000",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
