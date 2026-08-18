import { useCallback } from "react";
import { useRouter } from "expo-router";

import PaywallScreen from "@/components/PaywallScreen";

/**
 * app/(subscribe)/index.tsx
 * ============================================================
 * The user-initiated paywall — reached from:
 *
 *   - Home / Category cards on a locked (Pro) story
 *     (`app/(tabs)/index.tsx`, `story_open_locked` event).
 *   - The Favorite tab locked prompt (`app/(tabs)/favorite.tsx`).
 *   - Any other "tap to upgrade" affordance we add later.
 *
 * These flows open the paywall ON TOP of an existing stack, so the
 * dismiss behavior is `router.back()` — the user returns exactly
 * where they were. That's the ONLY thing this route customises;
 * everything else (RC purchase, restore, parental gate, timeline,
 * legal links, analytics) lives inside `<PaywallScreen>`.
 *
 * If you're looking for the paywall that fires AT boot after
 * onboarding or on subsequent cold starts, see
 * `app/(paywall-onboarding)/index.tsx`.
 */
export default function SubscribeScreen() {
  const router = useRouter();
  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <PaywallScreen
      source="subscribe_screen"
      onDismiss={goBack}
      onPurchased={goBack}
    />
  );
}
