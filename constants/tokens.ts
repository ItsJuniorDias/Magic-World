/**
 * Magic World — design tokens
 * ============================================================
 * Fonte única de verdade pra cor, espaçamento, raio, tipografia
 * e sombra. Ninguém no app deveria escrever `#5C81F5` ou
 * `padding: 24` na mão — sempre via token.
 *
 * Organização em 3 camadas:
 *   1. `palette` — cores brutas (nunca use direto na UI)
 *   2. `color`   — cores semânticas (use estas)
 *   3. `light` / `dark` — schemes (via useThemedTokens)
 *
 * Regra geral: se você tá pensando "essa cor não tem nome
 * semântico ainda", cria um. Não vaza `palette.blue600` na tela.
 */

// ============================================================
// 1. Palette — cores brutas
// ============================================================

const palette = {
  // Neutros (base do dark mode)
  black: "#000000",
  ink900: "#0B0A10",
  ink800: "#15141A", // background principal (era hardcoded em toda tela)
  ink700: "#1C1C1E",
  ink600: "#222129",
  ink500: "#2C2C2E",
  ink400: "#38383A",
  ink300: "#48484A",
  ink200: "#8E8E93",
  ink100: "#C7C7CC",
  ink50: "#F2F2F7",
  white: "#FFFFFF",

  // Brand (azul mágico — antes era `#5C81F5` repetido em 7 lugares)
  brand600: "#4A6DE0",
  brand500: "#5C81F5",
  brand400: "#7B9DFF",
  brand300: "#A5BEFF",
  brand50: "#F8F9FF",

  // Feedback
  red500: "#EC5353",
  red600: "#DC2626",
  amber400: "#FACC15",
  amber500: "#FF9F0A",
  green500: "#30D158",
  green600: "#22C55E",

  // Acentos (categorias de jogos, achievements, etc)
  purple500: "#BF5AF2",
  purple600: "#8B5CF6",
  blue500: "#0A84FF",
  blue600: "#3B82F6",
} as const;

// ============================================================
// 2. Espaçamento — múltiplos de 4
// ============================================================

export const spacing = {
  xxxs: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 64,
} as const;

// ============================================================
// 3. Raio de borda
// ============================================================

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999, // pra badges e chips totalmente arredondados
  circle: 9999,
} as const;

// ============================================================
// 4. Tipografia
// ============================================================

export const typography = {
  family: {
    regular: "ComicReliefRegular",
    bold: "ComicReliefBold",
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    display: 32,
    hero: 40,
  },
  lineHeight: {
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
} as const;

// ============================================================
// 5. Sombra (elevação)
// ============================================================

export const shadow = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  brand: {
    shadowColor: palette.brand500,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// ============================================================
// 6. Duração de animação
// ============================================================

export const motion = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
    slower: 800,
  },
} as const;

// ============================================================
// 7. Semantic colors — use estes na UI, não palette
// ============================================================

const colorDark = {
  // Superfícies
  bg: palette.ink800,           // fundo principal do app
  surface: palette.ink700,      // cards elevados sobre o bg
  surfaceAlt: palette.ink600,   // segundo nível de elevação
  surfaceInverse: palette.white,

  // Texto
  textPrimary: palette.white,
  textSecondary: palette.ink200,
  textMuted: palette.ink300,
  textInverse: palette.ink800,
  textOnBrand: palette.white,

  // Borda / separador
  border: palette.ink500,
  borderStrong: palette.ink400,

  // Brand
  brand: palette.brand500,
  brandHover: palette.brand400,
  brandActive: palette.brand600,
  brandSubtle: palette.brand50,

  // Feedback
  danger: palette.red500,
  success: palette.green500,
  warning: palette.amber500,

  // Acentos temáticos
  levelApprentice: palette.ink200,
  levelSorcerer: palette.purple600,
  levelWizard: palette.blue600,
  levelArchmage: palette.amber400,

  // Legado — mantém compatibilidade enquanto o refactor não termina
  overlay: "rgba(0, 0, 0, 0.55)",
  overlayStrong: "rgba(0, 0, 0, 0.9)",
} as const;

const colorLight = {
  bg: palette.ink50,
  surface: palette.white,
  surfaceAlt: palette.ink50,
  surfaceInverse: palette.ink800,

  textPrimary: palette.ink800,
  textSecondary: palette.ink200,
  textMuted: palette.ink300,
  textInverse: palette.white,
  textOnBrand: palette.white,

  border: palette.ink100,
  borderStrong: palette.ink200,

  brand: palette.brand500,
  brandHover: palette.brand600,
  brandActive: palette.brand600,
  brandSubtle: palette.brand50,

  danger: palette.red500,
  success: palette.green500,
  warning: palette.amber500,

  levelApprentice: palette.ink200,
  levelSorcerer: palette.purple600,
  levelWizard: palette.blue600,
  levelArchmage: palette.amber400,

  overlay: "rgba(0, 0, 0, 0.55)",
  overlayStrong: "rgba(0, 0, 0, 0.9)",
} as const;

// ============================================================
// 8. Export
// ============================================================

export const tokens = {
  color: {
    dark: colorDark,
    light: colorLight,
  },
  palette, // exposto pra casos específicos (badges de categoria)
  spacing,
  radius,
  typography,
  shadow,
  motion,
} as const;

export type ColorScheme = "light" | "dark";
export type ColorToken = keyof typeof colorDark;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type FontSizeToken = keyof typeof typography.size;
export type ShadowToken = keyof typeof shadow;
