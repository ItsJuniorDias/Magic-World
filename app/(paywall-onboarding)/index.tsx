import { useCallback, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import PaywallScreen, {
  type PaywallSource,
} from "@/components/PaywallScreen";
import { markPaywallGateShown } from "@/utils/paywallGate";

/**
 * app/(paywall-onboarding)/index.tsx
 * ============================================================
 * The paywall shown BY THE GATE — reached in two ways:
 *
 *   1. Right after `(profile-adventure)`, when the user finishes
 *      the initial onboarding flow. `source=post_onboarding`.
 *   2. On any subsequent cold start, if the user finished onboarding
 *      but hasn't subscribed. Fired from `AppBootstrap` in
 *      `app/_layout.tsx`. `source=cold_start_gate`.
 *
 * WHY THIS IS SEPARATE FROM (subscribe)
 *
 *   The `(subscribe)` route is opened on top of a stack (Home, Favorite,
 *   locked story) and closes with `router.back()` — the user goes back
 *   where they came from. Reusing that route for the onboarding gate
 *   would break navigation (there's nothing meaningful "behind" a gate
 *   that fires at boot), and would also conflate two very different
 *   product events for analytics.
 *
 *   Instead this thin route shares the SAME `<PaywallScreen>` component
 *   but wires it with different dismiss/success callbacks and a
 *   different `source` label.
 *
 * DISMISS BEHAVIOR
 *
 *   Both close paths (✕ in the corner, "Maybe later" text button,
 *   successful purchase, successful restore) end at `/(tabs)` via
 *   `router.replace`. `replace` (not `push`) so the user can't swipe
 *   back into the paywall from the home tab.
 *
 * SESSION FLAG
 *
 *   We call `markPaywallGateShown()` in a mount effect so the
 *   `AppBootstrap` cold-start gate can't re-fire on top of us if it
 *   evaluates AFTER the profile-adventure route already navigated us
 *   here. Idempotent; harmless if the gate had already marked it.
 */
export default function PaywallOnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string }>();

  // Whitelist the source values we accept from the query string —
  // never trust a param blindly, especially for one that lands in
  // analytics and shapes the funnel dashboard.
  const source: PaywallSource =
    params.source === "cold_start_gate" ? "cold_start_gate" : "post_onboarding";

  useEffect(() => {
    markPaywallGateShown();
  }, []);

  const goToApp = useCallback(() => {
    router.replace("/(tabs)");
  }, [router]);

  return (
    <PaywallScreen
      source={source}
      onDismiss={goToApp}
      onPurchased={goToApp}
      showMaybeLater
    />
  );
}
