/**
 * Text — componente tipográfico do design system
 * ============================================================
 * Substitui `components/text` mantendo compat com a API antiga
 * (que usa props `title`, `fontFamily`, `fontSize` numérico).
 *
 * Nova API preferida:
 *   <Text variant="heading" size="xxl">Meu título</Text>
 *   <Text variant="body">Corpo do texto</Text>
 *   <Text variant="caption" color={t.color.textSecondary}>Legenda</Text>
 *
 * API antiga (ainda funciona pra não quebrar telas):
 *   <Text title="Meu título" fontFamily="bold" fontSize={24} color="#fff" />
 *
 * Preserva também o parser de **bold** inline por
 * compatibilidade com strings salvas no Firestore.
 */

import React from "react";
import { Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native";
import { tokens } from "@/constants/tokens";
import type { FontSizeToken } from "@/constants/tokens";

export type TextVariant = "display" | "heading" | "body" | "caption" | "button" | "label";
export type TextWeight = "regular" | "bold";

// Números aceitos pela API antiga
type LegacyFontSize =
  | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 28 | 32 | 40 | 48 | 56 | 64;

type TextPropsNew = {
  children?: React.ReactNode;
  variant?: TextVariant;
  size?: FontSizeToken;
  weight?: TextWeight;
  color?: string;
  numberOfLines?: number;
  style?: TextStyle;
};

// Props antigas (mantém compat) — se `title` estiver setado,
// entra no caminho legado com parser de **bold**.
type TextPropsLegacy = Omit<RNTextProps, "children"> & {
  title?: string | number | null | undefined;
  fontFamily?: TextWeight;
  fontSize?: LegacyFontSize;
  lineHeight?: LegacyFontSize;
  color?: string;
  numberOfLines?: number;
};

type TextProps = TextPropsNew & TextPropsLegacy;

// ============================================================
// Variant defaults
// ============================================================

const VARIANT_CONFIG: Record<
  TextVariant,
  { size: FontSizeToken; weight: TextWeight; letterSpacing?: number }
> = {
  display: { size: "display", weight: "bold", letterSpacing: tokens.typography.letterSpacing.tight },
  heading: { size: "xxl", weight: "bold" },
  body: { size: "md", weight: "regular" },
  caption: { size: "sm", weight: "regular" },
  label: { size: "sm", weight: "bold" },
  button: { size: "md", weight: "bold" },
};

// ============================================================
// Implementação
// ============================================================

export default function Text(props: TextProps) {
  // Caminho legado: se veio `title`, comporta como antes
  if (props.title != null) {
    return renderLegacy(props);
  }

  // Caminho novo
  const {
    children,
    variant = "body",
    size,
    weight,
    color,
    numberOfLines,
    style,
  } = props;

  const cfg = VARIANT_CONFIG[variant];
  const finalSize = tokens.typography.size[size ?? cfg.size];
  const finalWeight = weight ?? cfg.weight;

  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: tokens.typography.family[finalWeight],
          fontSize: finalSize,
          color: color ?? tokens.color.dark.textPrimary,
          letterSpacing: cfg.letterSpacing,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

// ============================================================
// Legado — API antiga (title, fontFamily, fontSize numérico)
// ============================================================

function renderLegacy(props: TextPropsLegacy) {
  const {
    title,
    color,
    numberOfLines,
    fontFamily = "regular",
    fontSize = 16,
    lineHeight,
    style,
    ...rest
  } = props;

  const family = tokens.typography.family[fontFamily];
  const safeTitle = title == null ? "" : String(title);

  // Parser de **bold** inline (comportamento antigo)
  const parts = safeTitle.split(/\*\*(.*?)\*\*/g);
  const hasBoldMarkers = parts.length > 1;

  const baseStyle: TextStyle = {
    fontFamily: family,
    fontSize,
    color: color ?? tokens.color.dark.textPrimary,
    ...(lineHeight ? { lineHeight } : {}),
  };

  if (!hasBoldMarkers) {
    return (
      <RNText
        {...rest}
        numberOfLines={numberOfLines}
        style={[baseStyle, style]}
      >
        {safeTitle}
      </RNText>
    );
  }

  return (
    <RNText
      {...rest}
      numberOfLines={numberOfLines}
      style={[baseStyle, style]}
    >
      {parts.map((part, i) => {
        const isBold = i % 2 === 1;
        return (
          <RNText
            key={i}
            style={{
              fontFamily: isBold
                ? tokens.typography.family.bold
                : family,
            }}
          >
            {part}
          </RNText>
        );
      })}
    </RNText>
  );
}
