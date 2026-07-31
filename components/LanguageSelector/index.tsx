/**
 * LanguageSelector — modal para trocar o idioma do app
 * ============================================================
 * Aparece a partir do Profile. Lista as 7 línguas suportadas
 * com bandeira, nome nativo e nome em inglês (fallback visual).
 * Idioma ativo aparece com check azul + destacado.
 *
 * A troca é instantânea: `setLocale()` persiste no AsyncStorage
 * e o Zustand notifica todos os consumidores de `useT()`.
 *
 * RTL — só troca o `direction` no store. Não força
 * `I18nManager.forceRTL(true)` porque isso exige reload do JS
 * bundle (quebra qualquer navegação em andamento) e nosso layout
 * ainda não foi 100% validado em espelho. Deixa como flag pra
 * expansão futura.
 */

import React from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useThemedTokens } from "@/hooks/use-tokens";
import { LOCALES, useT } from "@/i18n";
import type { LocaleCode, LocaleMeta } from "@/i18n";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function LanguageSelector({ visible, onClose }: Props) {
  const t = useThemedTokens();
  const { t: tr, locale, setLocale } = useT();

  const handleSelect = async (code: LocaleCode) => {
    if (code === locale) {
      onClose();
      return;
    }
    await setLocale(code);
    onClose();
  };

  const renderItem = ({ item }: { item: LocaleMeta }) => {
    const isSelected = item.code === locale;
    return (
      <Pressable
        onPress={() => handleSelect(item.code)}
        style={({ pressed }) => [
          styles.option,
          {
            paddingVertical: t.spacing.md,
            paddingHorizontal: t.spacing.lg,
            borderRadius: t.radius.lg,
            backgroundColor: isSelected
              ? t.color.brandSubtle
              : pressed
                ? t.color.surfaceAlt
                : "transparent",
            borderWidth: isSelected ? 1 : 0,
            borderColor: t.color.brand,
          },
        ]}
      >
        <Text variant="heading" size="xl" style={{ marginRight: t.spacing.md }}>
          {item.flag}
        </Text>
        <View style={{ flex: 1 }}>
          <Text
            variant="body"
            size="md"
            color={isSelected ? t.color.brand : t.color.textPrimary}
            weight={isSelected ? "bold" : "regular"}
          >
            {item.nativeName}
          </Text>
          <Text
            variant="caption"
            color={t.color.textSecondary}
            style={{ marginTop: 2 }}
          >
            {item.englishName}
          </Text>
        </View>
        {isSelected && (
          <FontAwesome6 name="check" size={18} color={t.color.brand} />
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: t.color.surface,
              borderTopLeftRadius: t.radius.xxl,
              borderTopRightRadius: t.radius.xxl,
              paddingHorizontal: t.spacing.md,
              paddingTop: t.spacing.md,
              paddingBottom: t.spacing.xl,
            },
          ]}
        >
          {/* Grip */}
          <View style={[styles.grip, { backgroundColor: t.color.textMuted }]} />

          {/* Header */}
          <View style={{ paddingHorizontal: t.spacing.sm, marginBottom: t.spacing.md }}>
            <Text
              variant="heading"
              size="xl"
              color={t.color.textPrimary}
              style={{ marginTop: t.spacing.sm }}
            >
              {tr("languageSelector.title")}
            </Text>
            <Text
              variant="body"
              size="sm"
              color={t.color.textSecondary}
              style={{ marginTop: t.spacing.xxs }}
            >
              {tr("languageSelector.subtitle")}
            </Text>
          </View>

          <FlatList
            data={LOCALES}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 480 }}
          />
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
    // Sombra sutil pra separar do backdrop
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
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
  },
});
