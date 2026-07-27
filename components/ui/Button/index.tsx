/**
 * Button — botão do design system
 * ============================================================
 * Substitui os `TouchableOpacity + StyleSheet` inline que
 * cada tela redefinia.
 *
 * Variants:
 *   - primary   → brand fill, texto branco, sombra brand
 *   - secondary → surface, texto brand, borda brand
 *   - ghost     → transparente, texto secundário
 *   - danger    → red fill, texto branco
 *
 * Sizes:
 *   - sm  → altura 40, pad h16
 *   - md  → altura 48, pad h20  (default)
 *   - lg  → altura 58, pad h24
 *
 * Props extras:
 *   - loading      → mostra spinner e desabilita toque
 *   - leftIcon     → node à esquerda do label
 *   - rightIcon    → node à direita do label
 *   - fullWidth    → largura 100%
 *   - disabled     → visual apagado, ignora toque
 */

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Text from "@/components/ui/Text";
import { useThemedTokens } from "@/hooks/use-tokens";
import type { FontSizeToken } from "@/constants/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
};

const SIZE_CONFIG: Record<
  ButtonSize,
  { height: number; paddingH: number; fontSize: FontSizeToken; gap: number }
> = {
  sm: { height: 40, paddingH: 16, fontSize: "sm", gap: 6 },
  md: { height: 48, paddingH: 20, fontSize: "md", gap: 8 },
  lg: { height: 58, paddingH: 24, fontSize: "lg", gap: 10 },
};

export default function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const t = useThemedTokens();
  const cfg = SIZE_CONFIG[size];
  const isDisabled = disabled || loading;

  const containerStyles = getContainerStyles(variant, t, isDisabled);
  const textColor = getTextColor(variant, t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: cfg.height,
          paddingHorizontal: cfg.paddingH,
          borderRadius: t.radius.lg,
          backgroundColor: containerStyles.backgroundColor,
          borderColor: containerStyles.borderColor,
          borderWidth: containerStyles.borderWidth,
        },
        fullWidth && styles.fullWidth,
        variant === "primary" && !isDisabled && t.shadow.brand,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={[styles.content, { gap: cfg.gap }]}>
          {leftIcon}
          <Text
            variant="button"
            size={cfg.fontSize}
            color={textColor}
            weight="bold"
          >
            {label}
          </Text>
          {rightIcon}
        </View>
      )}
    </Pressable>
  );
}

// ============================================================
// Style helpers
// ============================================================

function getContainerStyles(
  variant: ButtonVariant,
  t: ReturnType<typeof useThemedTokens>,
  disabled: boolean,
) {
  const alpha = disabled ? 0.4 : 1;

  switch (variant) {
    case "primary":
      return {
        backgroundColor: withAlpha(t.color.brand, alpha),
        borderColor: "transparent",
        borderWidth: 0,
      };
    case "secondary":
      return {
        backgroundColor: t.color.surface,
        borderColor: withAlpha(t.color.brand, alpha),
        borderWidth: 1.5,
      };
    case "ghost":
      return {
        backgroundColor: "transparent",
        borderColor: "transparent",
        borderWidth: 0,
      };
    case "danger":
      return {
        backgroundColor: withAlpha(t.color.danger, alpha),
        borderColor: "transparent",
        borderWidth: 0,
      };
  }
}

function getTextColor(
  variant: ButtonVariant,
  t: ReturnType<typeof useThemedTokens>,
): string {
  switch (variant) {
    case "primary":
    case "danger":
      return t.color.textOnBrand;
    case "secondary":
      return t.color.brand;
    case "ghost":
      return t.color.textSecondary;
  }
}

/** Aplica alpha em cor hex 6 dígitos. Se não for hex, retorna original. */
function withAlpha(hex: string, alpha: number): string {
  if (alpha >= 1) return hex;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    width: "100%",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
