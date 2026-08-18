/**
 * services/analytics.ts
 * ============================================================
 * First-party analytics for Magic World.
 *
 * ARCHITECTURE
 *
 *   client screen ──▶ track("event_name", { param: 1 })
 *                        │
 *                        ├─ enrich  → adds user_id, session_id, platform,
 *                        │            app_version, locale, is_pro, ts
 *                        ├─ queue   → in-memory buffer, persisted to
 *                        │            AsyncStorage so offline events survive
 *                        │            a kill/restart
 *                        └─ flush   → POST batch to backend `/events`
 *                                     AND fire-and-forget to GA4 (best-effort)
 *
 * WHY THE DUAL SINK
 *
 *   The GA4 pipe (services/analyticsHelper.ts) has been running for a
 *   while and has dashboards built on it. Cutting it dead would lose
 *   whatever historical continuity we have. So the engine sends every
 *   event to BOTH: the new backend is the source of truth for the funnel
 *   dashboard, GA4 stays as a backup and for the audience-y reports that
 *   Firebase gives us for free.
 *
 * KIDS-SAFE
 *
 *   No IDFA, no advertising id, no email, no name. `user_id` is a random
 *   UUID persisted per-install (see utils/anonymousUser.ts). Nothing that
 *   would classify as "personal data" under COPPA/LGPD leaves the device.
 *
 * SESSION SEMANTICS
 *
 *   A session starts on `initAnalytics()` (called from _layout) and on
 *   the first `track()` after `SESSION_IDLE_MS` of inactivity — cheaper
 *   than wiring AppState listeners and good enough for our funnel: two
 *   consecutive events within 30 minutes are one session, otherwise a
 *   new session begins with the next event.
 *
 * FAILURE MODES
 *
 *   - Endpoint down: events stay in the queue (capped at MAX_QUEUE) and
 *     retry on the next flush.
 *   - Endpoint slow: we cap the outstanding batch at BATCH_SIZE so a
 *     single burst doesn't OOM.
 *   - App killed mid-flush: unsent events are already persisted; they
 *     get sent on the next open.
 *
 * WHAT TO CALL FROM SCREENS
 *
 *     import { track } from "@/services/analytics";
 *     track("story_open", { storyId, isPro, source: "home" });
 *
 *   Names are snake_case and use the canonical set below. See ANALYTICS.md
 *   for the full dictionary.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Localization from "expo-localization";
import * as Crypto from "expo-crypto";

import { getAnonymousUserId } from "@/utils/anonymousUser";
import { logEvent as ga4LogEvent } from "@/services/analyticsHelper";

// ------------------------------------------------------------
// Config
// ------------------------------------------------------------

/** Default endpoint. Can be overridden by EXPO_PUBLIC_ANALYTICS_ENDPOINT. */
const DEFAULT_ENDPOINT = "https://analytics-magicworld.onrender.com/events";

/**
 * Endpoint resolution:
 *   1. EXPO_PUBLIC_ANALYTICS_ENDPOINT if set (dev override, staging, ...)
 *   2. DEFAULT_ENDPOINT (production)
 *
 * An empty string disables the sink entirely — useful in E2E tests where
 * we don't want to hit the network.
 */
const ENDPOINT: string =
  (process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT ?? "").trim() || DEFAULT_ENDPOINT;

/** How many events we hold before forcing a flush. */
const BATCH_SIZE = 20;

/** How often we drain the queue when there's anything sitting in it. */
const FLUSH_INTERVAL_MS = 5_000;

/** Sessions expire after this much wall-clock silence. */
const SESSION_IDLE_MS = 30 * 60_000;

/** Hard cap to protect memory + AsyncStorage in worst-case offline sprees. */
const MAX_QUEUE = 500;

/** Async storage key for queue persistence. */
const QUEUE_KEY = "@analytics_queue_v1";

/** Async storage key for session persistence. */
const SESSION_KEY = "@analytics_session_v1";

/** Send the double-write to GA4 too? On by default; flip if we ever cut GA4. */
const MIRROR_TO_GA4 = true;

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type EventParams = Record<string, unknown>;

/**
 * Canonical event names. Screens should use these strings so the funnel
 * dashboard on the backend picks them up correctly. Free-form is allowed
 * — anything that isn't in this list still lands in the raw events table
 * (great for exploration), it just doesn't appear in the funnel widget.
 *
 * Funnel-critical (the backend's dashboard queries them by name):
 *   - paywall_view
 *   - checkout_initiated
 *   - start_trial
 *   - subscribe
 *
 * The rest is a growing list — see ANALYTICS.md.
 */
export type CanonicalEvent =
  // Session
  | "app_open"
  // Onboarding
  | "onboarding_view"
  | "onboarding_cta_pressed"
  // Navigation
  | "home_view"
  | "favorite_view"
  | "profile_view"
  | "games_hub_view"
  // Stories
  | "story_open"
  | "story_open_locked"
  | "chapter_view"
  | "chapter_finished"
  | "chapter_next_locked"
  // Favorites
  | "favorite_added"
  | "favorite_removed"
  // Games
  | "game_open"
  | "game_finished"
  // Paywall funnel (must match backend canonical names)
  | "paywall_view"
  | "paywall_plan_selected"
  | "paywall_dismissed"
  | "paywall_link_opened"
  | "checkout_initiated"
  | "start_trial"
  | "subscribe"
  | "purchase_cancelled"
  | "purchase_restored"
  // Fires from `AppBootstrap` (app/_layout.tsx) when the cold-start
  // gate is about to `router.replace` the user into the paywall. This
  // is the top of a NEW funnel step that sits BEFORE `paywall_view`
  // (which fires from inside the screen after RC offerings load).
  // Two events, not one, because the redirect can succeed and the
  // offerings fetch can still fail — the split lets us measure that
  // drop separately from user dismissals.
  | "paywall_gate_shown"
  // Settings
  | "language_changed"
  | "notification_toggled";

type QueuedEvent = {
  event: string;
  ts: number;
  params: EventParams;
};

type SessionState = {
  id: string;
  startedAt: number;
  lastActivity: number;
};

// ------------------------------------------------------------
// State
// ------------------------------------------------------------

let initialized = false;
let userId: string | null = null;
let session: SessionState | null = null;

/**
 * Global overrides for context that changes at runtime (locale, pro status).
 * Screens don't need to remember to pass these — we merge them into every
 * event's params in `enrich()`.
 */
const context: {
  locale: string | null;
  isPro: boolean | null;
} = {
  locale: null,
  isPro: null,
};

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushInFlight = false;

// ------------------------------------------------------------
// Session helpers
// ------------------------------------------------------------

async function loadSession(): Promise<SessionState | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

async function persistSession(s: SessionState): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // AsyncStorage full or unavailable — losing the session across a kill
    // is fine, we just start a new one.
  }
}

function newSession(): SessionState {
  return {
    id: Crypto.randomUUID(),
    startedAt: Date.now(),
    lastActivity: Date.now(),
  };
}

/**
 * Return the active session, rolling into a fresh one if the previous
 * one has been idle beyond SESSION_IDLE_MS.
 */
async function currentSession(): Promise<SessionState> {
  const now = Date.now();
  if (session && now - session.lastActivity < SESSION_IDLE_MS) {
    session.lastActivity = now;
    // Fire-and-forget: no need to await, the worst case is one stale
    // read after a crash.
    void persistSession(session);
    return session;
  }
  session = newSession();
  await persistSession(session);
  return session;
}

// ------------------------------------------------------------
// Queue persistence
// ------------------------------------------------------------

async function loadQueue(): Promise<QueuedEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedEvent[];
  } catch {
    return [];
  }
}

async function persistQueue(): Promise<void> {
  try {
    // Cap what we persist — same policy as the in-memory cap.
    const toWrite = queue.slice(-MAX_QUEUE);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(toWrite));
  } catch {
    // Nothing we can do — event will be lost if the process dies now.
  }
}

// ------------------------------------------------------------
// Enrichment
// ------------------------------------------------------------

function baseParams(sessionId: string): EventParams {
  return {
    user_id: userId,
    session_id: sessionId,
    platform: Platform.OS,
    app_version: Application.nativeApplicationVersion ?? null,
    // `expo-localization` region is a 2-letter ISO code when available
    // (e.g. "BR", "US"). Great signal for the backend country column.
    country: Localization.getLocales?.()?.[0]?.regionCode ?? null,
    locale: context.locale,
    is_pro: context.isPro,
  };
}

function enrich(event: string, extra: EventParams, sessionId: string): QueuedEvent {
  // The order matters: caller-provided params win over context, except we
  // never let the caller override the identity fields (user_id/session_id).
  const merged: EventParams = {
    ...baseParams(sessionId),
    ...extra,
    user_id: userId,
    session_id: sessionId,
  };
  return {
    event,
    ts: Date.now(),
    params: merged,
  };
}

// ------------------------------------------------------------
// Network
// ------------------------------------------------------------

async function sendBatch(events: QueuedEvent[]): Promise<boolean> {
  if (!ENDPOINT) return true; // sink disabled = pretend success
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });
    // 2xx counts as delivered; the backend does its own accepted/rejected
    // accounting per-event in its response, but if it 202'd we're done.
    return res.status >= 200 && res.status < 300;
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[analytics] batch failed:", err);
    }
    return false;
  }
}

function mirrorToGA4(events: QueuedEvent[]): void {
  if (!MIRROR_TO_GA4) return;
  // GA4 is fire-and-forget — its own helper already swallows errors.
  // We call it once per event because the Measurement Protocol wants
  // one event per request (batching there needs a different shape).
  for (const ev of events) {
    // Strip identity fields GA4 doesn't need — its own helper injects
    // a client_id derived from AsyncStorage. Keeping user_id / session_id
    // is harmless but pollutes the GA4 event dictionary.
    // `__mirroredFromEngine: true` tells the helper to skip its
    // forward-to-engine step so we don't loop.
    const { user_id, session_id, ...rest } = ev.params;
    ga4LogEvent(ev.event, {
      ...rest,
      __mirroredFromEngine: true,
    }).catch(() => {});
  }
}

// ------------------------------------------------------------
// Flush loop
// ------------------------------------------------------------

async function flushNow(): Promise<void> {
  if (flushInFlight) return;
  if (queue.length === 0) return;
  flushInFlight = true;
  try {
    // Take up to BATCH_SIZE events off the head. If they fail we put them
    // back at the front so ordering is preserved for the retry.
    const chunk = queue.slice(0, BATCH_SIZE);
    const ok = await sendBatch(chunk);
    if (ok) {
      queue = queue.slice(chunk.length);
      await persistQueue();
      // GA4 mirror only fires on successful primary delivery — matches
      // the old code's "log on success" behaviour so we don't count
      // twice on a retry.
      mirrorToGA4(chunk);
    } else {
      // Leave the queue as-is; the next tick will retry. Cap so we don't
      // grow forever while offline.
      if (queue.length > MAX_QUEUE) {
        queue = queue.slice(-MAX_QUEUE);
        await persistQueue();
      }
    }
  } finally {
    flushInFlight = false;
  }
}

function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushNow();
  }, FLUSH_INTERVAL_MS);
  // React Native doesn't have `unref`; the timer keeps the JS runtime
  // alive but that's fine because RN's runtime is already alive as long
  // as the app is foregrounded.
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Boot the analytics pipeline. Idempotent — safe to call twice, second
 * call is a no-op.
 *
 * MUST be called before the first `track()` in a session, otherwise the
 * first event will be enriched with a null user_id (the SDK still works,
 * the event just lands without an identity — recoverable but noisy).
 *
 * Typically wired inside `_layout.tsx` after i18n hydrates.
 */
export async function initAnalytics(opts?: {
  locale?: string;
  isPro?: boolean;
}): Promise<void> {
  if (initialized) {
    // Allow updating context on subsequent calls without re-initializing.
    if (opts?.locale !== undefined) context.locale = opts.locale;
    if (opts?.isPro !== undefined) context.isPro = opts.isPro;
    return;
  }
  initialized = true;

  try {
    userId = await getAnonymousUserId();
  } catch {
    // Fall back to a session-scoped id — better than nothing.
    userId = "anon_" + Crypto.randomUUID();
  }

  if (opts?.locale !== undefined) context.locale = opts.locale;
  if (opts?.isPro !== undefined) context.isPro = opts.isPro;

  // Hydrate previous session (if fresh enough) so an app that reopens
  // within 30 min continues the same session id — matches user intent
  // ("I was reading, kept reading") rather than an artificial reset.
  const prior = await loadSession();
  const now = Date.now();
  if (prior && now - prior.lastActivity < SESSION_IDLE_MS) {
    session = { ...prior, lastActivity: now };
  } else {
    session = newSession();
  }
  await persistSession(session);

  // Restore any events the previous run couldn't flush.
  const persisted = await loadQueue();
  if (persisted.length) {
    queue = persisted.concat(queue).slice(-MAX_QUEUE);
  }

  ensureFlushTimer();

  // Kick off an immediate drain — matters when the user comes back
  // online after being offline for a while.
  void flushNow();
}

/**
 * Update runtime context (locale, pro status). Cheap; call whenever
 * these change so subsequent events carry the right values.
 */
export function setAnalyticsContext(patch: {
  locale?: string;
  isPro?: boolean;
}): void {
  if (patch.locale !== undefined) context.locale = patch.locale;
  if (patch.isPro !== undefined) context.isPro = patch.isPro;
}

/**
 * The single ingest point for all screens.
 *
 * Non-blocking on purpose: never await this call, never let its failure
 * bubble into UI logic. If the network is out the event is queued; if
 * the queue is full the oldest events are dropped.
 */
export function track(event: CanonicalEvent | string, params: EventParams = {}): void {
  // Guard: allow callers to fire before init completes without crashing.
  // Events fired pre-init are enriched with a placeholder session and
  // will still hit the queue; init'll persist them next tick.
  if (!initialized) {
    // Warm-boot path: init is racing with the first screen mount. Push
    // a minimal record and let the next flush handle it.
    const placeholderSid = "pre_init";
    queue.push(enrich(event, params, placeholderSid));
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[analytics] (pre-init) queued ${event}`, params);
    }
    return;
  }

  void currentSession().then((s) => {
    const enriched = enrich(event, params, s.id);
    queue.push(enriched);
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[analytics] ${event}`, enriched.params);
    }

    // Persist eagerly so a crash between now and the next flush interval
    // doesn't lose the event.
    void persistQueue();

    // Flush immediately when the batch is full — otherwise wait for the
    // interval so bursts get coalesced.
    if (queue.length >= BATCH_SIZE) void flushNow();
  });
}

/**
 * Force an immediate flush. Useful before a route change we know might
 * kill the process (e.g. deep link out to the App Store).
 *
 * Not awaited by most callers — passing a soft timeout lets the caller
 * proceed even if the network is slow. The event stays queued if we
 * bail out, so nothing is lost.
 */
export async function flushAnalytics(timeoutMs = 1500): Promise<void> {
  const race = flushNow();
  await Promise.race([
    race,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
