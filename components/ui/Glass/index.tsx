/**
 * Glass — wrapper sobre BlurView com API compat de GlassView
 * ============================================================
 * Substitui `GlassView` de `expo-glass-effect` mantendo a mesma
 * API. Usa `BlurView` de `expo-blur` internamente, que:
 *   - Funciona em old + new architecture do React Native
 *   - Suporta iOS 15+ (não precisa iOS 26 como expo-glass-effect)
 *   - Já estava instalado no projeto (expo-blur ^15.0.8)
 *
 * Por que trocar:
 * ---------------
 * `expo-glass-effect@0.1.8` foi atualizado em set/2025 (PR
 * expo/expo#39595) pra usar overrides de Fabric
 * (`mountChildComponentView`) que só existem quando
 * `newArchEnabled: true`. O projeto está em old arch, então o
 * build quebra com "method does not override any method from
 * its superclass".
 *
 * Diferença visual:
 * ----------------
 * - `expo-glass-effect` = liquid glass do iOS 26 (efeito novo,
 *   com highlights dinâmicos e refração)
 * - `expo-blur` = blur clássico do iOS (UIVisualEffectView com
 *   material padrão)
 *
 * Pra 90% dos usos (chips, botões circulares, modais) a
 * diferença visual é sutil. Se você quiser voltar pro liquid
 * glass no futuro, migre o app pra new arch e troque só o
 * interior deste componente.
 *
 * API compatibility:
 * ------------------
 *   <GlassView                          →  <Glass
 *     style={...}                             style={...}
 *     isInteractive                           isInteractive
 *     glassEffectStyle="clear"                glassEffectStyle="clear"
 *     intensity={20}                          intensity={20}
 *   />                                   />
 */

import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useThemedTokens } from "@/hooks/use-tokens";

export type GlassEffectStyle = "regular" | "clear" | "tinted";

type GlassProps = {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /**
   * Ignorado — BlurView não tem estado interativo separado.
   * Mantido pra compat de API.
   */
  isInteractive?: boolean;
  /**
   * Mapeamento pro `intensity` do BlurView.
   * - `clear`   → intensity 15 (bem sutil)
   * - `regular` → intensity 35 (default)
   * - `tinted`  → intensity 55 (mais opaco)
   */
  glassEffectStyle?: GlassEffectStyle;
  /**
   * Sobrescreve o intensity mapeado por `glassEffectStyle`.
   * Vai direto pra BlurView.
   */
  intensity?: number;
  /**
   * Tint do BlurView. Default: 'default' (segue system).
   */
  tint?: "light" | "dark" | "default" | "systemThinMaterial" | "systemChromeMaterial";
};

const STYLE_TO_INTENSITY: Record<GlassEffectStyle, number> = {
  clear: 15,
  regular: 35,
  tinted: 55,
};

export default function Glass({
  children,
  style,
  glassEffectStyle = "regular",
  intensity,
  tint = "default",
  isInteractive: _isInteractive, // eslint-disable-line @typescript-eslint/no-unused-vars
}: GlassProps) {
  const t = useThemedTokens();
  const finalIntensity =
    intensity ?? STYLE_TO_INTENSITY[glassEffectStyle] ?? 35;

  return (
    <View style={[styles.wrapper, style]}>
      <BlurView
        intensity={finalIntensity}
        tint={tint === "default" && t.scheme === "dark" ? "dark" : tint}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
    // Deixa o overflow herdar borderRadius do style externo
    // (se o consumidor passar borderRadius, o BlurView é
    // cortado corretamente).
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
