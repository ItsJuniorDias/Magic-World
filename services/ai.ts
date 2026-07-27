/**
 * services/ai.ts — abstração de LLM sobre OpenRouter
 * ============================================================
 * Substitui o uso direto de `@google/generative-ai` espalhado
 * pelas telas. Toda chamada de texto/JSON pro modelo vai por
 * aqui, com retry, timeout e tipos.
 *
 * OpenRouter é OpenAI-compatible — usamos o SDK `openai` já
 * instalado, apontando pra `https://openrouter.ai/api/v1`.
 *
 * ⚠️ SEGURANÇA
 * -----------
 * A chave é lida de `EXPO_PUBLIC_OPENROUTER_API_KEY`. Como
 * qualquer var `EXPO_PUBLIC_*`, ela vira parte do bundle do
 * app e fica visível pra quem baixar o IPA/APK.
 *
 * Consequências:
 *   1. Rotacione a chave periodicamente.
 *   2. Defina um limite de gasto mensal no dashboard do
 *      OpenRouter (Settings → Limits).
 *   3. Quando for pra produção séria, mova este serviço pra
 *      um proxy no seu Fastify e chame `POST /ai/generate`
 *      em vez de OpenRouter direto. Deixei os pontos de
 *      extensão marcados como TODO(proxy).
 *
 * MODELOS
 * -------
 * O default é `google/gemini-2.5-flash` (mesmo modelo que
 * você já usava), mas dá pra sobrescrever por chamada.
 * Aliases úteis:
 *   - `MODELS.fast`   → tarefas rápidas, JSON, tradução
 *   - `MODELS.smart`  → geração narrativa (capítulo final, etc)
 *   - `MODELS.cheap`  → fallback econômico
 */

import OpenAI from "openai";

// ============================================================
// Config
// ============================================================

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? "";
const APP_URL =
  process.env.EXPO_PUBLIC_OPENROUTER_APP_URL ??
  "https://apps.apple.com/app/id6757454902";
const APP_NAME = process.env.EXPO_PUBLIC_OPENROUTER_APP_NAME ?? "Magic World";

if (!API_KEY && __DEV__) {
  // eslint-disable-next-line no-console
  console.warn(
    "[ai] EXPO_PUBLIC_OPENROUTER_API_KEY não está definida. " +
      "Chamadas ao OpenRouter vão falhar. Configure em .env",
  );
}

// TODO(proxy): quando migrar pra proxy Fastify, troque
// `baseURL` pra `https://api.seu-dominio.com/ai` e remova
// `apiKey` (o proxy assina os requests do lado do servidor).
const client = new OpenAI({
  baseURL: OPENROUTER_BASE_URL,
  apiKey: API_KEY,
  // OpenRouter usa esses headers pra atribuir uso à sua app
  // no leaderboard e nos analytics do dashboard.
  defaultHeaders: {
    "HTTP-Referer": APP_URL,
    "X-Title": APP_NAME,
  },
  // No React Native, `dangerouslyAllowBrowser` é necessário
  // porque o SDK detecta o ambiente como não-Node.
  dangerouslyAllowBrowser: true,
});

// ============================================================
// Modelos disponíveis
// ============================================================

/**
 * Aliases pros modelos que a gente usa. Se mudar o default,
 * muda em um lugar só.
 *
 * IDs vão no formato `provider/model` — ver catálogo em
 * https://openrouter.ai/models
 */
export const MODELS = {
  /** Rápido e barato — bom pra JSON, tradução, listas. */
  fast: "google/gemini-2.5-flash",
  /** Mais forte pra narrativa longa. Trocar se quiser Claude/GPT. */
  smart: "google/gemini-2.5-flash",
  /** Fallback econômico se o principal falhar. */
  cheap: "openai/gpt-4o-mini",
} as const;

export type ModelAlias = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelAlias] | string;

// ============================================================
// Tipos
// ============================================================

export type GenerateOptions = {
  /** ID do modelo ou alias. Default: MODELS.fast */
  model?: ModelId | ModelAlias;
  /** Instrução de sistema opcional. */
  system?: string;
  /** Criatividade. 0 = determinístico, 1 = criativo. */
  temperature?: number;
  /** Máximo de tokens na resposta. */
  maxTokens?: number;
  /** Timeout por tentativa, ms. Default: 30000. */
  timeoutMs?: number;
  /** Tentativas totais (incluindo a primeira). Default: 3. */
  maxAttempts?: number;
  /** Sinal de cancelamento externo. */
  signal?: AbortSignal;
};

export class AIError extends Error {
  cause?: unknown;
  status?: number;
  isTransient: boolean;

  constructor(message: string, opts?: { cause?: unknown; status?: number; isTransient?: boolean }) {
    super(message);
    this.name = "AIError";
    this.cause = opts?.cause;
    this.status = opts?.status;
    this.isTransient = opts?.isTransient ?? false;
  }
}

// ============================================================
// Utils
// ============================================================

function resolveModel(m?: ModelId | ModelAlias): string {
  if (!m) return MODELS.fast;
  if (m in MODELS) return MODELS[m as ModelAlias];
  return m as string;
}

function isTransientStatus(status?: number): boolean {
  if (!status) return true; // erro de rede → tenta de novo
  return status === 408 || status === 429 || status >= 500;
}

/** Extrai JSON de uma resposta possivelmente cercada por ```json ... ``` */
function extractJSON(text: string): string {
  return text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new AIError("aborted", { isTransient: false }));
      };
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

// ============================================================
// Core — generate text
// ============================================================

/**
 * Gera texto livre. Retry automático em 429/5xx com backoff
 * exponencial (mesma lógica do translate antigo, mas
 * generalizada).
 */
export async function generateText(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<string> {
  const {
    model,
    system,
    temperature = 0.7,
    maxTokens,
    timeoutMs = 30_000,
    maxAttempts = 3,
    signal,
  } = opts;

  const modelId = resolveModel(model);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Cada tentativa tem seu próprio AbortController (timeout).
    const attemptController = new AbortController();
    const timeout = setTimeout(() => attemptController.abort(), timeoutMs);

    // Se o chamador passou um signal, cancela também.
    const onExternalAbort = () => attemptController.abort();
    signal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const completion = await client.chat.completions.create(
        {
          model: modelId,
          messages,
          temperature,
          max_tokens: maxTokens,
        },
        { signal: attemptController.signal },
      );

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        throw new AIError("resposta vazia do modelo", {
          isTransient: true,
        });
      }
      return content;
    } catch (err: any) {
      lastError = err;

      const status: number | undefined = err?.status ?? err?.response?.status;
      const transient =
        err?.name === "AbortError" ||
        err?.name === "AIError" && err.isTransient ||
        isTransientStatus(status);

      const shouldRetry = attempt < maxAttempts && transient;

      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ai] attempt ${attempt}/${maxAttempts} falhou (status=${status}, transient=${transient}, retry=${shouldRetry}):`,
          err?.message ?? err,
        );
      }

      if (!shouldRetry) break;

      // Backoff exponencial com jitter: 400ms, 1000ms, 2400ms
      const base = 400 * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 200;
      await delay(base + jitter, signal);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  throw new AIError("todas as tentativas falharam", {
    cause: lastError,
    isTransient: false,
  });
}

// ============================================================
// Core — generate JSON
// ============================================================

/**
 * Gera JSON estruturado. O parser é robusto a respostas
 * cercadas por ```json``` (comportamento antigo do Gemini).
 *
 * Se você tem certeza do formato, passe um `validate`
 * pra rejeitar respostas fora de shape (aí o retry funciona
 * até quando o modelo devolve JSON com campo faltando).
 */
export async function generateJSON<T = unknown>(
  prompt: string,
  opts: GenerateOptions & { validate?: (parsed: unknown) => parsed is T } = {},
): Promise<T> {
  const { validate, maxAttempts = 3, ...rest } = opts;

  // Anexa uma dica de formato ao prompt do usuário.
  const jsonPrompt =
    prompt.trim() +
    "\n\nReturn ONLY valid JSON. Do not wrap in code fences. Do not add commentary.";

  let lastParseError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await generateText(jsonPrompt, {
      ...rest,
      // Baixa temperatura pra JSON estruturado.
      temperature: rest.temperature ?? 0.3,
      // maxAttempts=1 aqui porque estamos gerenciando o loop
      // no nível do JSON (parse pode falhar mesmo com HTTP 200).
      maxAttempts: 1,
    }).catch((err) => {
      // Se generateText já esgotou tentativas HTTP, sobe.
      throw err;
    });

    try {
      const cleaned = extractJSON(raw);
      const parsed = JSON.parse(cleaned) as unknown;

      if (validate && !validate(parsed)) {
        throw new AIError("json fora do shape esperado");
      }

      return parsed as T;
    } catch (err) {
      lastParseError = err;
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ai] parse JSON attempt ${attempt}/${maxAttempts} falhou:`,
          err,
        );
      }
      if (attempt === maxAttempts) break;
      await delay(300 + Math.random() * 300);
    }
  }

  throw new AIError("modelo não retornou JSON válido após tentativas", {
    cause: lastParseError,
  });
}

// ============================================================
// Utilities exportadas
// ============================================================

/**
 * Tradução — atalho pra manter parity com o `translateText`
 * antigo do (storie). Usa `MODELS.fast` por default.
 */
export async function translateText(
  text: string,
  targetLang = "en",
  opts: GenerateOptions = {},
): Promise<string> {
  const prompt = `Translate the following text to ${targetLang}. Return only the translated text, no commentary or quotes.\n\nText: "${text}"`;
  const result = await generateText(prompt, {
    temperature: 0.2,
    ...opts,
  });
  // Remove aspas envolventes eventuais.
  return result.trim().replace(/^["']|["']$/g, "");
}

/** Aviso: se você chamar isso sem chave configurada, `generateText` vai lançar. */
export function isConfigured(): boolean {
  return Boolean(API_KEY);
}

// Export do client cru pra casos avançados (streaming, tool use).
export const openrouter = client;
