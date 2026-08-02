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
import {
  getFontFamilyForText,
  isRTLText,
} from "@/helpers/textDirection";

export type TextVariant = "display" | "heading" | "body" | "caption" | "button" | "label";
export type TextWeight = "regular" | "bold";

// Números aceitos pela API antiga
type LegacyFontSize =
  | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 28 | 32 | 40 | 48 | 56 | 64;

/**
 * Prop compartilhada pelos dois caminhos (novo + legado).
 *
 * `autoDirection` (opt-in) faz duas coisas:
 *   1. Detecta se o texto é RTL (árabe, hebraico, etc) e aplica
 *      `writingDirection: 'rtl'` + `textAlign: 'right'` no style.
 *   2. Se o texto tem script não suportado por `ComicRelief`
 *      (árabe/CJK/devanagari), troca a `fontFamily` pra
 *      `undefined` — o RN cai no system font, que tem cobertura
 *      Unicode ampla.
 *
 * DEFAULT `false` porque:
 *   - O legado assume LTR + ComicRelief em todo lugar
 *   - Rodar regex em cada render de texto tem custo (~microssegundos
 *     por render, mas soma em ScrollViews com dezenas de items)
 *
 * Recomendação de uso:
 *   - `true` sempre em conteúdo dinâmico do Firestore ou IA
 *     (histórias, títulos, capítulos, comentários futuros)
 *   - `false` (omit) em labels estáticos vindos do i18n
 *     (esses já são consumidos com a fonte correta pelo locale)
 */
type AutoDirectionProps = {
  autoDirection?: boolean;
};

type TextPropsNew = AutoDirectionProps & {
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
type TextPropsLegacy = AutoDirectionProps &
  Omit<RNTextProps, "children"> & {
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
    autoDirection = false,
  } = props;

  const cfg = VARIANT_CONFIG[variant];
  const finalSize = tokens.typography.size[size ?? cfg.size];
  const finalWeight = weight ?? cfg.weight;

  // `autoDirection`: só varre a string quando o consumidor pediu.
  // Aceita string ou number como children (o restante — element,
  // fragment — não é RTL-testável e simplesmente ignora).
  const stringChild =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : null;

  const autoStyle: TextStyle =
    autoDirection && stringChild
      ? {
          writingDirection: isRTLText(stringChild) ? "rtl" : "ltr",
          textAlign: isRTLText(stringChild) ? "right" : "left",
          fontFamily: getFontFamilyForText(
            stringChild,
            tokens.typography.family[finalWeight],
          ),
        }
      : {};

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
        autoStyle,
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
    autoDirection = false,
    ...rest
  } = props;

  const family = tokens.typography.family[fontFamily];
  const safeTitle = title == null ? "" : String(title);

  // Parser de **bold** inline (comportamento antigo)
  const parts = safeTitle.split(/\*\*(.*?)\*\*/g);
  const hasBoldMarkers = parts.length > 1;

  // `autoDirection` no legado: mesma lógica do caminho novo,
  // aplicada sobre `title`. Se o title for RTL (árabe/hebraico),
  // adiciona writingDirection + textAlign + troca fontFamily
  // pra system font quando o script é não-latino.
  const rtl = autoDirection && isRTLText(safeTitle);
  const resolvedFamily =
    autoDirection && safeTitle
      ? getFontFamilyForText(safeTitle, family)
      : family;

  const baseStyle: TextStyle = {
    fontFamily: resolvedFamily,
    fontSize,
    color: color ?? tokens.color.dark.textPrimary,
    ...(lineHeight ? { lineHeight } : {}),
    ...(autoDirection
      ? {
          writingDirection: rtl ? "rtl" : "ltr",
          textAlign: rtl ? "right" : "left",
        }
      : {}),
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

  // Quando `autoDirection` está ativo e o texto é não-latino,
  // `resolvedFamily` é `undefined` (system font). Aí o **bold**
  // inline também precisa ser undefined pra manter a família
  // consistente — senão os spans em bold voltariam pra ComicRelief
  // e renderiziam tofu.
  const boldFamily =
    autoDirection && resolvedFamily === undefined
      ? undefined
      : tokens.typography.family.bold;

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
              fontFamily: isBold ? boldFamily : resolvedFamily,
            }}
          >
            {part}
          </RNText>
        );
      })}
    </RNText>
  );
}
