import { useCallback } from "react";
import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * useAppReview — solicitação de review gateada por engagement.
 * ============================================================
 *
 * Por que reescrito (agosto 2026):
 *   Versão anterior chamava `requestReviewOnce()` 30s após abrir a
 *   Home. Apple rejeitou (Guideline 5.6.3, Developer Code of
 *   Conduct) porque "the app requests users to rate the app on
 *   first launch or during onboarding, before they've had enough
 *   time to gain a clear understanding of the app's value."
 *
 * Como funciona agora:
 *   O prompt SÓ dispara quando TODAS as condições abaixo são
 *   satisfeitas:
 *
 *     1. Já passou pelo menos MIN_DAYS_SINCE_INSTALL desde o
 *        primeiro registro do app (proxy pra "usuário já teve
 *        tempo de formar opinião").
 *     2. Já teve MIN_ENGAGEMENT_EVENTS eventos de engajamento
 *        significativos (definidos por quem chama noteEngagement).
 *     3. Nunca foi mostrado antes (chave @app_review_requested).
 *     4. `StoreReview.isAvailableAsync()` retorna true.
 *
 *   Consumidores devem chamar `noteEngagement()` em momentos
 *   *positivos* (ex: capítulo terminado, boss derrotado no
 *   Spell Storm). NÃO chamar em open de tela ou em "onboarding
 *   step completed".
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
   */
  const noteEngagement = useCallback(async () => {
    try {
      const alreadyRequested = await AsyncStorage.getItem(REVIEW_KEY);
      if (alreadyRequested === "true") {
        return;
      }

      // Incrementa contador
      const current = await readEngagementCount();
      const next = current + 1;
      await AsyncStorage.setItem(ENGAGEMENT_COUNT_KEY, String(next));

      // Checa idade da instalação
      const firstLaunchAt = await ensureFirstLaunchStamp();
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

  /**
   * @deprecated Use `noteEngagement()` disparado por eventos reais
   * de engajamento (fim de capítulo, etc). Mantido como alias
   * temporário pra chamadas antigas — a lógica de gating cobre
   * o caso de disparo prematuro.
   */
  const requestReviewOnce = noteEngagement;

  /** Só pra debug: força o registro do first-launch stamp cedo. */
  const initReviewClock = useCallback(async () => {
    try {
      await ensureFirstLaunchStamp();
    } catch {
      // ignore
    }
  }, []);

  return { noteEngagement, requestReviewOnce, initReviewClock };
}
