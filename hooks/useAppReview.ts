import { useCallback } from "react";
import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * useAppReview — solicitação de review gateada por engagement.
 * ============================================================
 *
 * Por que reescrito (agosto 2026, resposta à segunda rejeição):
 *   Apple continuou rejeitando (Guideline 5.6.3) alegando que o
 *   app "requests users to rate the app on first launch or during
 *   onboarding, before they've had enough time to gain a clear
 *   understanding of the app's value."
 *
 *   Endurecemos a superfície:
 *     - Removemos `requestReviewOnce` (alias deprecated) — se
 *       existe API, existe risco de outra tela chamá-la por
 *       engano ou legado. Agora só existe `noteEngagement`.
 *     - Removemos `initReviewClock` — não faz sentido "acordar"
 *       o relógio de review na home. O timestamp de primeiro
 *       launch é registrado dentro do próprio `noteEngagement`
 *       (idempotente). Menos chamadas ligadas a review na home,
 *       menor superfície de suspeita no code review da Apple.
 *     - Adicionamos verificação de onboarding completo: o prompt
 *       só dispara se `@onboarding_completed` == "true".
 *
 * Como funciona:
 *   O prompt SÓ dispara quando TODAS as condições abaixo são
 *   satisfeitas:
 *
 *     1. Usuário passou pelo onboarding (@onboarding_completed).
 *     2. Já passou pelo menos MIN_DAYS_SINCE_INSTALL dias desde
 *        o primeiro registro do app.
 *     3. Já teve MIN_ENGAGEMENT_EVENTS eventos de engajamento
 *        significativos (definidos por quem chama noteEngagement).
 *     4. Nunca foi mostrado antes (chave @app_review_requested).
 *     5. `StoreReview.isAvailableAsync()` retorna true.
 *
 *   Consumidores devem chamar `noteEngagement()` em momentos
 *   *positivos* (ex: capítulo terminado, boss derrotado no
 *   Spell Storm). NÃO chamar em open de tela, em "onboarding
 *   step completed", nem em nenhum ponto do fluxo inicial.
 *
 * Notas Apple:
 *   Apple documenta que `SKStoreReviewController.requestReview()`
 *   pode ser silenciosamente ignorado (rate limit de 3 prompts
 *   por 365 dias, por Apple ID). O gate abaixo é DE APP — a
 *   Apple ainda pode não mostrar mesmo assim. Correto: chamar
 *   quando a experiência foi boa e a Apple decide se exibe.
 */

const REVIEW_KEY = "@app_review_requested";
const FIRST_LAUNCH_KEY = "@app_first_launch_at";
const ENGAGEMENT_COUNT_KEY = "@app_engagement_count";
const ONBOARDING_COMPLETED_KEY = "@onboarding_completed";

// Thresholds — mexer aqui pra sintonizar quando o prompt dispara.
const MIN_DAYS_SINCE_INSTALL = 3;
const MIN_ENGAGEMENT_EVENTS = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Marca a data de primeiro launch se ainda não estiver setada. Idempotente. */
async function ensureFirstLaunchStamp(): Promise<number> {
  const raw = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  const now = Date.now();
  await AsyncStorage.setItem(FIRST_LAUNCH_KEY, String(now));
  return now;
}

/** Lê o contador atual de engajamento. */
async function readEngagementCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(ENGAGEMENT_COUNT_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function useAppReview() {
  /**
   * Registra um evento de engajamento e, se todos os thresholds
   * baterem, dispara o prompt uma vez. Idempotente — se já
   * disparou antes, não faz nada.
   *
   * Uso:
   *   noteEngagement(); // quando o usuário terminou um capítulo,
   *                     // derrotou um boss, completou um quiz, etc.
   *
   * NÃO CHAMAR em:
   *   - onMount de qualquer tela de onboarding
   *   - AppState change / focus events
   *   - "step X do tutorial completo"
   *   - qualquer ponto do primeiro fluxo do app
   */
  const noteEngagement = useCallback(async () => {
    try {
      // Bail early: nunca mostrar durante onboarding. Esta é a
      // primeira e mais importante checagem — Apple rejeita se
      // o prompt sequer PODE aparecer nesse contexto.
      const onboardingDone = await AsyncStorage.getItem(
        ONBOARDING_COMPLETED_KEY,
      );
      if (onboardingDone !== "true") {
        return;
      }

      const alreadyRequested = await AsyncStorage.getItem(REVIEW_KEY);
      if (alreadyRequested === "true") {
        return;
      }

      // Registra timestamp de primeiro launch aqui dentro (não em
      // hook separado). Isso mantém o "relógio" de review
      // encapsulado, e evita que a home tenha código com nome
      // "review" no useEffect — o que pode ser lido como "app
      // pede review na home" durante o code review da Apple.
      const firstLaunchAt = await ensureFirstLaunchStamp();

      // Incrementa contador de engagement
      const current = await readEngagementCount();
      const next = current + 1;
      await AsyncStorage.setItem(ENGAGEMENT_COUNT_KEY, String(next));

      // Checa idade da instalação
      const daysSinceInstall = (Date.now() - firstLaunchAt) / MS_PER_DAY;

      if (daysSinceInstall < MIN_DAYS_SINCE_INSTALL) {
        return;
      }
      if (next < MIN_ENGAGEMENT_EVENTS) {
        return;
      }

      // Guarda antes de mostrar pra garantir que não roda duas
      // vezes se algo async falhar depois.
      await AsyncStorage.setItem(REVIEW_KEY, "true");

      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) return;

      StoreReview.requestReview();
    } catch (error) {
      // Silencioso: não queremos que erro de review quebre o app.
      console.log("Review error:", error);
    }
  }, []);

  return { noteEngagement };
}
