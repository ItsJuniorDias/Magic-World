/**
 * useThemedTokens — retorna os tokens já resolvidos pro
 * color scheme atual do sistema.
 *
 * Uso:
 *   const t = useThemedTokens();
 *   <View style={{ backgroundColor: t.color.bg, padding: t.spacing.lg }} />
 *
 * O `t.color` já é `color.dark` ou `color.light` (sem precisar
 * escolher). Os outros tokens (spacing, radius, etc) são iguais
 * nos dois schemes.
 */

import { tokens } from "@/constants/tokens";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useThemedTokens() {
  const scheme = useColorScheme() ?? "dark";

  return {
    scheme,
    color: tokens.color[scheme],
    palette: tokens.palette,
    spacing: tokens.spacing,
    radius: tokens.radius,
    typography: tokens.typography,
    shadow: tokens.shadow,
    motion: tokens.motion,
  };
}

export type ThemedTokens = ReturnType<typeof useThemedTokens>;
