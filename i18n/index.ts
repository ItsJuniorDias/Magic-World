/**
 * i18n — core do sistema de idiomas
 * ============================================================
 * Sistema leve, sem `i18next`. O overhead do i18next não paga
 * pra 7 idiomas com strings estáticas. Aqui a gente tem:
 *
 *   - `useLocaleStore` — Zustand com persistência (AsyncStorage)
 *   - `useT()`         — hook que retorna `t(key, params?)`
 *   - `t()` cru        — para uso fora de React (services, Alert)
 *   - Detecção        — via `expo-localization` no primeiro boot
 *   - Fallback        — sempre cai em `en` se a chave sumir
 *   - RTL             — flag `direction`, sem `forceRTL` automático
 *
 * Uso típico:
 *
 *   const { t } = useT();
 *   <Text>{t("home.mostWatched")}</Text>
 *   <Text>{t("quiz.scoreLine", { correct: 3, total: 5 })}</Text>
 *
 * IMPORTANTE:
 *   - Nunca importar diretamente `en.ts` etc. Usar sempre `t()`.
 *   - Chaves faltando em runtime devolvem a própria key + warn
 *     em dev, o que ajuda a caçar tradução esquecida no QA.
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

import en from "./locales/en";
import es from "./locales/es";
import pt from "./locales/pt";
import fr from "./locales/fr";
import de from "./locales/de";
import hi from "./locales/hi";
import ar from "./locales/ar";
import type { LocaleCode, LocaleMeta, TranslationTree } from "./types";

// ============================================================
// Catálogo
// ============================================================

/**
 * Todas as traduções, indexadas por código de idioma.
 * `en` é a fonte da verdade — sempre completa.
 */
const CATALOG: Record<LocaleCode, TranslationTree> = {
  en,
  es,
  pt,
  fr,
  de,
  hi,
  ar,
};

/**
 * Metadados exibíveis pro selector de idioma.
 * Ordem = ordem de exibição. Inglês primeiro (fallback), depois
 * as demais em ordem alfabética do código.
 */
export const LOCALES: LocaleMeta[] = [
  {
    code: "en",
    nativeName: "English",
    englishName: "English",
    flag: "🇬🇧",
    direction: "ltr",
  },
  {
    code: "ar",
    nativeName: "العربية",
    englishName: "Arabic",
    flag: "🇸🇦",
    direction: "rtl",
  },
  {
    code: "de",
    nativeName: "Deutsch",
    englishName: "German",
    flag: "🇩🇪",
    direction: "ltr",
  },
  {
    code: "es",
    nativeName: "Español",
    englishName: "Spanish",
    flag: "🇪🇸",
    direction: "ltr",
  },
  {
    code: "fr",
    nativeName: "Français",
    englishName: "French",
    flag: "🇫🇷",
    direction: "ltr",
  },
  {
    code: "hi",
    nativeName: "हिन्दी",
    englishName: "Hindi",
    flag: "🇮🇳",
    direction: "ltr",
  },
  {
    code: "pt",
    nativeName: "Português",
    englishName: "Portuguese",
    flag: "🇧🇷",
    direction: "ltr",
  },
];

const SUPPORTED: LocaleCode[] = LOCALES.map((l) => l.code);
const FALLBACK: LocaleCode = "en";

const STORAGE_KEY = "@magic_world_locale";

// ============================================================
// Detecção do idioma do dispositivo
// ============================================================

/**
 * Mapa de fallback pra variantes regionais que a gente não
 * suporta explicitamente. Ex.: `pt-BR`, `pt-PT` → `pt`.
 *
 * `expo-localization` devolve tags BCP-47 tipo "pt-BR", "de-AT",
 * "es-419". A gente pega só o prefixo primário.
 */
function normalizeToSupported(tag: string | null | undefined): LocaleCode {
  if (!tag) return FALLBACK;
  const primary = tag.toLowerCase().split(/[-_]/)[0] as LocaleCode;
  return SUPPORTED.includes(primary) ? primary : FALLBACK;
}

/**
 * Descobre o idioma do dispositivo, priorizando o primeiro
 * suportado na lista `getLocales()`. Se o usuário tem
 * "fr-CA" como primeira preferência mas o app suporta francês,
 * a gente escolhe `fr`.
 */
export function detectDeviceLocale(): LocaleCode {
  try {
    const locales = Localization.getLocales();
    for (const l of locales) {
      const tag = l.languageTag ?? l.languageCode;
      const mapped = normalizeToSupported(tag);
      if (mapped !== FALLBACK || tag?.toLowerCase().startsWith("en")) {
        return mapped;
      }
    }
  } catch {
    // getLocales pode falhar em ambientes headless
  }
  return FALLBACK;
}

// ============================================================
// Interpolação
// ============================================================

/** Resolve `{{param}}` em uma string. */
function interpolate(
  template: string,
  params: Record<string, string | number> | undefined,
): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = params[key];
    return value === undefined || value === null ? `{{${key}}}` : String(value);
  });
}

// ============================================================
// Resolução de chaves aninhadas ("profile.achievements.items.sage.title")
// ============================================================

function resolveKey(tree: TranslationTree, key: string): string | undefined {
  const parts = key.split(".");
  let node: any = tree;
  for (const part of parts) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

// ============================================================
// Função `t` crua — para uso fora de componentes React
// ============================================================

/**
 * `t()` puro, sem hook. Útil dentro de services, Alert.alert,
 * TrackPlayer metadata, etc. Usa o locale atualmente selecionado
 * no store.
 *
 * @example
 * import { t } from "@/i18n";
 * Alert.alert(t("paywall.welcomeTitle"), t("paywall.welcomeBody"));
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  const locale = useLocaleStore.getState().locale;
  const tree = CATALOG[locale] ?? CATALOG[FALLBACK];

  let value = resolveKey(tree, key);
  if (value === undefined && locale !== FALLBACK) {
    // Fallback: se a chave sumiu no locale ativo, tenta EN.
    value = resolveKey(CATALOG[FALLBACK], key);
  }

  if (value === undefined) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] chave ausente: ${key}`);
    }
    return key;
  }

  return interpolate(value, params);
}

// ============================================================
// Store — Zustand + persistência
// ============================================================

type LocaleState = {
  /** Código do idioma ativo. */
  locale: LocaleCode;
  /** Se o locale já foi hidratado do AsyncStorage. */
  ready: boolean;
  /** Metadados do locale ativo (nativeName, direção, etc). */
  meta: LocaleMeta;
  /** Direção de texto derivada do locale ativo. */
  direction: "ltr" | "rtl";

  /** Troca o idioma e persiste. */
  setLocale: (code: LocaleCode) => Promise<void>;
  /** Hidrata do AsyncStorage. Chamado uma vez no boot. */
  hydrate: () => Promise<void>;
};

function metaFor(code: LocaleCode): LocaleMeta {
  return (
    LOCALES.find((l) => l.code === code) ??
    LOCALES.find((l) => l.code === FALLBACK)!
  );
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: FALLBACK,
  ready: false,
  meta: metaFor(FALLBACK),
  direction: "ltr",

  async setLocale(code) {
    const meta = metaFor(code);
    set({
      locale: code,
      meta,
      direction: meta.direction,
    });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Se o AsyncStorage falhar, a escolha é volátil. Aceitável
      // porque o próximo boot re-detecta o idioma do device.
    }
  },

  async hydrate() {
    if (get().ready) return;

    let selected: LocaleCode | null = null;
    try {
      const stored = (await AsyncStorage.getItem(
        STORAGE_KEY,
      )) as LocaleCode | null;
      if (stored && SUPPORTED.includes(stored)) {
        selected = stored;
      }
    } catch {
      // Sem storage disponível — cai pra detecção.
    }

    if (!selected) {
      selected = detectDeviceLocale();
    }

    const meta = metaFor(selected);
    set({
      locale: selected,
      meta,
      direction: meta.direction,
      ready: true,
    });
  },
}));

// ============================================================
// Hook `useT` — assinatura mais React-friendly
// ============================================================

/**
 * Hook para uso dentro de componentes. Re-renderiza quando
 * o locale muda, coisa que o `t()` cru não faz sozinho.
 *
 * Retorna `{ t, locale, meta, direction, setLocale }`.
 */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  const meta = useLocaleStore((s) => s.meta);
  const direction = useLocaleStore((s) => s.direction);
  const setLocale = useLocaleStore((s) => s.setLocale);

  // Captura a versão do locale ativo pra fechar sobre ela — se o
  // locale mudar, o hook re-renderiza e a função é recriada com
  // o tree atualizado. Sem isso, componentes memoizados podiam
  // ficar segurando t() apontando pro locale antigo.
  const tree = CATALOG[locale] ?? CATALOG[FALLBACK];

  const localT = (
    key: string,
    params?: Record<string, string | number>,
  ): string => {
    let value = resolveKey(tree, key);
    if (value === undefined && locale !== FALLBACK) {
      value = resolveKey(CATALOG[FALLBACK], key);
    }
    if (value === undefined) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] chave ausente: ${key}`);
      }
      return key;
    }
    return interpolate(value, params);
  };

  return { t: localT, locale, meta, direction, setLocale };
}

// ============================================================
// Re-exports
// ============================================================

export type { LocaleCode, LocaleMeta, TranslationTree } from "./types";
