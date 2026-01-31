import React from "react";
import { View, Modal, StyleSheet, TouchableOpacity } from "react-native";
import Text from "../text";
import { Colors } from "@/constants/theme";
import { FontAwesome6 } from "@expo/vector-icons";

type AchievementDetailModalProps = {
  visible: boolean;
  achievement: { title: string; icon: string; req: number };
  nextThreshold: number;
  onClose: () => void;
};

export default function AchievementDetailModal({
  visible,
  achievement,
  nextThreshold,
  onClose,
}: AchievementDetailModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text
            fontFamily="bold"
            fontSize={24}
            title={achievement.icon}
            style={{ textAlign: "center" }}
          />
          <Text
            fontFamily="bold"
            fontSize={20}
            title={achievement.title}
            style={{ marginTop: 12, textAlign: "center" }}
          />
          <Text
            fontFamily="regular"
            fontSize={16}
            color="#ccc"
            style={{ marginTop: 8, textAlign: "center" }}
            title={`You need ${nextThreshold} more chapters to unlock the next achievement`}
          />

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <FontAwesome6 name="xmark" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "80%",
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
  },
});
