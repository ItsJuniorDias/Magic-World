/**
 * helpers/textDirection.ts — utilitários para texto multi-script
 * ============================================================
 * Um único ponto de decisão pra tudo que depende do script/idioma
 * do texto na hora de renderizar. Usado pela tela `(storie)` e
 * pelo componente `Text` do design system.
 *
 * O que resolve:
 *   1. Detecção de direção (LTR/RTL) por conteúdo do texto
 *   2. Split de sentenças respeitando terminadores multi-idioma
 *   3. Escolha de fonte quando a fonte custom (ComicRelief) não
 *      suporta o script (árabe, hebraico, devanagari, CJK)
 *   4. Normalização do código ISO 639-3 do `franc-min` pro código
 *      BCP-47 usado pelo `expo-speech`
 *
 * Filosofia:
 *   - Determinístico (nunca chama IA nem serviço externo)
 *   - Barato (regex compilados uma vez)
 *   - Fallback conservador (na dúvida, LTR + fonte custom)
 */

// ============================================================
// 1. Detecção de direção do texto
// ============================================================

/**
 * Ranges Unicode dos scripts RTL que a gente suporta.
 * Referências:
 *   - Arabic base:              U+0600–U+06FF
 *   - Arabic Supplement:        U+0750–U+077F
 *   - Arabic Extended-A:        U+08A0–U+08FF
 *   - Arabic Presentation-A:    U+FB50–U+FDFF
 *   - Arabic Presentation-B:    U+FE70–U+FEFF
 *   - Hebrew:                   U+0590–U+05FF
 *   - Syriac:                   U+0700–U+074F
 *   - Thaana (Dhivehi):         U+0780–U+07BF
 *
 * Se ANY caractere do texto cair num desses ranges, tratamos
 * como RTL. Isso é o mesmo critério que o `I18nManager` do RN
 * usa internamente pra `writingDirection: 'auto'`.
 */
const RTL_CHARS =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** True se o texto contém algum caractere de script RTL. */
export function isRTLText(text: string | null | undefined): boolean {
  if (!text) return false;
  return RTL_CHARS.test(text);
}

/**
 * Devolve `'rtl'` ou `'ltr'` pra usar direto em `writingDirection`
 * ou `textAlign` (invertendo pra `'right'` quando RTL).
 */
export function getWritingDirection(
  text: string | null | undefined,
): "ltr" | "rtl" {
  return isRTLText(text) ? "rtl" : "ltr";
}

// ============================================================
// 2. Escolha de fonte por script
// ============================================================

/**
 * Scripts que a fonte custom `ComicRelief` NÃO suporta.
 * Detectamos pelo primeiro range Unicode encontrado e devolvemos
 * `undefined` — o `<Text>` do RN cai no system font, que em iOS
 * e Android tem cobertura ampla:
 *   - iOS árabe: Geeza Pro / .Arabic
 *   - Android árabe: Noto Sans Arabic
 *   - iOS devanagari: Kohinoor Devanagari
 *   - Android devanagari: Noto Sans Devanagari
 *   - iOS CJK: PingFang / Hiragino
 *   - Android CJK: Noto Sans CJK
 *
 * Motivo: se você forçar `fontFamily: 'ComicRelief'` num glifo
 * fora do subset (0x0020–0x00FF basicamente), o RN renderiza um
 * "tofu" (□) ou aplica fallback silencioso que quebra o baseline
 * e o line-height. Melhor ceder o controle pro sistema.
 *
 * Nota: latin estendido (ä, ö, ü, ß, á, é, ñ, ç, etc.) fica dentro
 * do subset que a ComicRelief cobre — inglês, alemão, espanhol,
 * português e francês renderizam com a fonte custom sem problema.
 *
 * CJK e hangul ficam aqui como safety net: mesmo que o app não
 * ofereça esses idiomas na UI, texto externo (colado, traduzido
 * fora do fluxo esperado) renderiza corretamente sem tofu.
 */
const NON_LATIN_SCRIPTS = [
  // Árabe + hebraico + siriaco + thaana (todos os RTL)
  RTL_CHARS,
  // Devanagari (hindi)
  /[\u0900-\u097F]/,
  // CJK Unified Ideographs — safety net
  /[\u4E00-\u9FFF\u3400-\u4DBF]/,
  // Hangul (coreano) — safety net
  /[\uAC00-\uD7AF]/,
  // Hiragana + Katakana (japonês) — safety net
  /[\u3040-\u30FF]/,
];

/**
 * Devolve `undefined` se o texto tem script não-latino (=> usar
 * system font). Senão devolve a fonte custom que o chamador passou.
 *
 * @param text     — string a inspecionar
 * @param custom   — fonte custom a preservar (ex: "ComicReliefBold")
 *
 * @example
 *   const family = getFontFamilyForText("مرحبا", "ComicReliefBold");
 *   // family === undefined   → cai no system font
 *
 *   const family = getFontFamilyForText("Hello", "ComicReliefBold");
 *   // family === "ComicReliefBold"
 */
export function getFontFamilyForText(
  text: string | null | undefined,
  custom: string,
): string | undefined {
  if (!text) return custom;
  for (const re of NON_LATIN_SCRIPTS) {
    if (re.test(text)) return undefined;
  }
  return custom;
}

// ============================================================
// 3. Split de sentenças multi-idioma
// ============================================================

/**
 * Terminadores de sentença por script:
 *   - Latino/Cirílico:  `.` `!` `?`
 *   - Árabe:            `؟` (U+061F) `؛` (U+061B ponto-e-vírgula)
 *                       `.` e `!` também são usados em textos modernos
 *   - Devanagari:       `।` (U+0964) `॥` (U+0965)
 *   - CJK:              `。` (U+3002) `！` (U+FF01) `？` (U+FF1F)
 *
 * Regex usa lookbehind (`(?<=...)`) pra manter o terminador
 * anexado à sentença, e faz split no whitespace seguinte.
 * O array final é filtrado pra remover strings vazias.
 *
 * Edge cases tratados:
 *   - Reticências (`...`) não são split (o lookbehind bate no
 *     último ponto, mas como não tem espaço logo depois, junta)
 *   - Acrônimos em inglês (`e.g.`) podem quebrar se seguidos de
 *     letra maiúscula — trade-off aceito porque não vale a pena
 *     escrever um tokenizer só pra edge case raro em livro infantil
 */
const SENTENCE_TERMINATORS_LOOKBEHIND =
  /(?<=[.!?؟؛।॥。！？])\s+/;

/**
 * Split de texto em sentenças respeitando pontuação de árabe,
 * hindi e CJK além do latino. Sempre devolve pelo menos um
 * elemento (o texto todo) se não houver terminador.
 *
 * Pontuação CJK fica coberta como safety net — mesmo sem CJK na
 * UI, texto colado ou traduzido externamente é tokenizado bem.
 *
 * @example
 *   splitIntoSentences("Hello. How are you?")
 *   // ["Hello.", "How are you?"]
 *
 *   splitIntoSentences("Hallo. Wie geht es dir?")
 *   // ["Hallo.", "Wie geht es dir?"]
 *
 *   splitIntoSentences("مرحبا. كيف حالك؟")
 *   // ["مرحبا.", "كيف حالك؟"]
 */
export function splitIntoSentences(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(SENTENCE_TERMINATORS_LOOKBEHIND)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ============================================================
// 4. franc-min ISO 639-3 → BCP-47 pro expo-speech
// ============================================================

/**
 * Mapa dos códigos que o `franc-min` devolve pros BCP-47 que o
 * `expo-speech` aceita. Mantido junto com as outras utils porque
 * a decisão é sempre "detectou → fala" no mesmo fluxo.
 *
 * Cobertura: os 7 idiomas do i18n do app.
 *
 * Fontes:
 *   - franc-min devolve códigos ISO 639-3
 *   - iOS aceita códigos BCP-47 (`ar-SA`, `pt-BR`, etc)
 *   - Android é mais tolerante (aceita `ar` puro), mas o BCP-47
 *     canônico funciona nos dois
 */
const FRANC_TO_BCP47: Record<string, string> = {
  eng: "en-US",
  spa: "es-ES",
  por: "pt-BR",
  fra: "fr-FR",
  deu: "de-DE",
  hin: "hi-IN",
  // Árabe: `franc-min` usa `arb` (Modern Standard Arabic) como
  // default, mas alguns modelos devolvem `ara` (macrolang).
  // Cobrimos ambos pra ser resiliente.
  arb: "ar-SA",
  ara: "ar-SA",
};

/**
 * Mapa direto de código curto (BCP-47 primary subtag) pro
 * language completo. Usado quando a gente sabe o alvo da tradução
 * (o usuário escolheu "Arabic" no menu) e quer o TTS já certo,
 * sem precisar redetectar via franc.
 */
const SHORT_TO_BCP47: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  hi: "hi-IN",
  ar: "ar-SA",
};

/**
 * Resolve o BCP-47 usado pelo TTS a partir de qualquer código
 * conhecido (ISO 639-3 do franc ou código curto do i18n).
 *
 * Fallback é `en-US` — a voz em inglês existe em todos os
 * devices e evita crash silencioso quando o texto é ambíguo.
 */
export function resolveSpeechLanguage(code: string | null | undefined): string {
  if (!code) return "en-US";
  return FRANC_TO_BCP47[code] ?? SHORT_TO_BCP47[code] ?? "en-US";
}
