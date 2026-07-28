/**
 * MenuSheet — action sheet bottom-up com múltiplas seções
 * ============================================================
 * Substitui `ContextMenu` + `Picker` de `@expo/ui/swift-ui`,
 * que exige Fabric/New Architecture. Este componente usa
 * `Modal` do RN — funciona em old + new arch, iOS + Android.
 *
 * Uso:
 *
 *   <MenuSheet
 *     visible={open}
 *     onClose={() => setOpen(false)}
 *     sections={[
 *       {
 *         title: "Translate",
 *         options: ["English", "Español"],
 *         selectedIndex: 0,
 *         onSelect: (i) => handleTranslate(langs[i]),
 *       },
 *       {
 *         title: "Ambient Sound",
 *         options: ["Fantasy", "Rain"],
 *         selectedIndex: 0,
 *         onSelect: (i) => setMusic(i),
 *       },
 *     ]}
 *   />
 */

import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import Text from "@/components/ui/Text";
import { useThemedTokens } from "@/hooks/use-tokens";

export type MenuSection = {
  title: string;
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

type MenuSheetProps = {
  visible: boolean;
  onClose: () => void;
  sections: MenuSection[];
};

export default function MenuSheet({
  visible,
  onClose,
  sections,
}: MenuSheetProps) {
  const t = useThemedTokens();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Sheet — Pressable pra "engolir" o toque e não fechar */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: t.color.surface,
              borderRadius: t.radius.xxl,
              padding: t.spacing.md,
            },
          ]}
        >
          {/* Grip visual (padrão iOS) */}
          <View style={[styles.grip, { backgroundColor: t.color.textMuted }]} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 480 }}
          >
            {sections.map((section, sIdx) => (
              <View
                key={section.title}
                style={{
                  marginTop: sIdx === 0 ? t.spacing.sm : t.spacing.lg,
                }}
              >
                <Text
                  variant="label"
                  size="sm"
                  color={t.color.textSecondary}
                  style={{
                    paddingHorizontal: t.spacing.sm,
                    marginBottom: t.spacing.xs,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {section.title}
                </Text>

                {section.options.map((opt, oIdx) => {
                  const isSelected = oIdx === section.selectedIndex;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => {
                        section.onSelect(oIdx);
                        onClose();
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        {
                          paddingVertical: t.spacing.sm,
                          paddingHorizontal: t.spacing.sm,
                          borderRadius: t.radius.md,
                          backgroundColor: pressed
                            ? t.color.surfaceAlt
                            : "transparent",
                        },
                      ]}
                    >
                      <Text
                        variant="body"
                        size="md"
                        color={isSelected ? t.color.brand : t.color.textPrimary}
                        weight={isSelected ? "bold" : "regular"}
                        style={{ flex: 1 }}
                      >
                        {opt}
                      </Text>

                      {isSelected && (
                        <FontAwesome6
                          name="check"
                          size={16}
                          color={t.color.brand}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    marginHorizontal: 8,
    marginBottom: 24,
    paddingBottom: 24,
  },
  grip: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
    opacity: 0.5,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
