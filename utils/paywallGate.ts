/**
 * utils/paywallGate.ts
 * ============================================================
 * Session-scoped gate for the post-onboarding / cold-start paywall.
 *
 * WHY THIS EXISTS
 *
 *   Product rule: users who haven't subscribed see the paywall on
 *   every cold start, until they do. But we should NOT re-shove it
 *   in their face mid-session — if they dismiss the paywall and
 *   start navigating tabs, a route change effect shouldn't decide
 *   to open it again.
 *
 *   This flag is a plain module-level boolean. It resets naturally
 *   on cold start because the JS runtime is fresh. "Session" here
 *   means "the current process instance" — same semantics used by
 *   `services/analytics.ts` for its session id.
 *
 *   The flag is flipped to `true` in exactly two places:
 *     1. `app/_layout.tsx` — cold-start gate right before it fires
 *        `router.replace("/(paywall-onboarding)")`.
 *     2. `app/(paywall-onboarding)/index.tsx` — on mount, defensive
 *        so that a manual navigation to that route (e.g. from
 *        profile-adventure) also blocks the cold-start gate from
 *        double-firing on the same session.
 *
 *   Do NOT persist this to AsyncStorage. Persisting would break the
 *   product rule ("show every time until they subscribe") because
 *   the flag would survive a kill/restart and suppress the gate on
 *   the next cold start.
 */

let shownThisSession = false;

/** Mark the onboarding paywall gate as having been displayed in this JS session. */
export function markPaywallGateShown(): void {
  shownThisSession = true;
}

/** True if the gate has already fired in this JS runtime. */
export function wasPaywallGateShownThisSession(): boolean {
  return shownThisSession;
}

/**
 * Testing hook — resets the flag to `false`. ONLY intended for unit
 * tests that need to simulate a fresh cold start without spinning up
 * a new JS runtime. Never call this from production code.
 */
export function __resetPaywallGateForTests(): void {
  shownThisSession = false;
}
