/**
 * Magic World — theme (compat layer)
 * ============================================================
 * Este arquivo existe pra dar compat pro código antigo que usa
 * `Colors.dark.background`, `Colors.light.text`, etc. As telas
 * novas devem usar `tokens` de `constants/tokens.ts` ou o hook
 * `useThemedTokens` de `hooks/use-tokens.ts`.
 *
 * NÃO adicione novas cores aqui. Adicione em `tokens.ts` como
 * cor semântica.
 */

import { Platform } from "react-native";
import { tokens } from "./tokens";

// ============================================================
// Compat: Colors — API antiga preservada
// ============================================================

export const Colors = {
  light: {
    text: tokens.color.light.textPrimary,
    background: tokens.color.light.bg,
    tint: tokens.color.light.brand,
    icon: tokens.color.light.textSecondary,
    tabIconDefault: tokens.color.light.textSecondary,
    tabIconSelected: tokens.color.light.brand,
    red: tokens.color.light.danger,
  },
  dark: {
    text: tokens.color.dark.textPrimary,
    background: tokens.color.dark.bg,
    tint: tokens.color.dark.brand,
    icon: tokens.color.dark.textSecondary,
    tabIconDefault: tokens.color.dark.textSecondary,
    tabIconSelected: tokens.color.dark.brand,
    // adicionado pra compat com telas que puxam Colors.dark.red
    red: tokens.color.dark.danger,
  },
} as const;

// ============================================================
// Fonts — mantém API antiga
// ============================================================

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ============================================================
// Re-exports pra facilitar imports
// ============================================================

export { tokens } from "./tokens";
export type {
  ColorScheme,
  ColorToken,
  SpacingToken,
  RadiusToken,
  FontSizeToken,
  ShadowToken,
} from "./tokens";
