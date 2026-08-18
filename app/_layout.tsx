import { useEffect, useRef, useState } from "react";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import TrackPlayer from "react-native-track-player";
import trackPlayerService from "../services/trackPlayer";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useLocaleStore } from "@/i18n";
import { useNotifications } from "@/hooks/useNotifications";
import { useProStatus } from "@/hooks/useProStatus";
import { initAnalytics, track, setAnalyticsContext } from "@/services/analytics";
import {
  markPaywallGateShown,
  wasPaywallGateShownThisSession,
} from "@/utils/paywallGate";

export const unstable_settings = {
  anchor: "(tabs)",
};

const queryClient = new QueryClient();

TrackPlayer.registerPlaybackService(() => trackPlayerService);

/**
 * AsyncStorage key set by `app/(app)/index.tsx` when the user finishes
 * the welcome CTA. Also read by `hooks/useAppReview.ts` for the review
 * prompt gate. Keep the string in sync with those two files.
 */
const ONBOARDING_COMPLETED_KEY = "@onboarding_completed";

/**
 * Route groups where the cold-start paywall gate MUST NOT fire, because
 * the user is legitimately somewhere else in the onboarding / paywall
 * chain and hijacking them would either loop (redirecting a paywall into
 * a paywall) or interrupt the flow they're already following.
 *
 *   - "(app)"                 — welcome / onboarding screen
 *   - "(profile-adventure)"   — adventure profile intro
 *   - "(profile-result-adventure)" — adventure profile result
 *   - "(paywall-onboarding)"  — the gate itself
 *   - "(subscribe)"           — the user-initiated paywall
 *
 * If the user deep-links into any other route (a story, a game, a
 * category) we let the gate fire — the product rule is "show every
 * time until they subscribe".
 */
const ONBOARDING_ROUTE_GROUPS = new Set<string>([
  "(app)",
  "(profile-adventure)",
  "(profile-result-adventure)",
  "(paywall-onboarding)",
  "(subscribe)",
]);

/**
 * Wrapper interno pra rodar `useNotifications` só depois do i18n
 * estar pronto. O hook já checa `useLocaleStore.ready` internamente,
 * mas isolar aqui deixa a intenção explícita e permite adicionar
 * outros hooks de bootstrap (ex.: analytics, remote config) sem
 * poluir o RootLayout.
 */
function AppBootstrap({ children }: { children: React.ReactNode }) {
  useNotifications();

  const router = useRouter();
  const segments = useSegments();

  // Analytics bootstrap.
  //
  // Runs exactly once per cold start. `initAnalytics` is idempotent so
  // a StrictMode double-mount in dev doesn't create two sessions. The
  // `app_open` event fires immediately after — this is the anchor for
  // every session in the funnel and drives the "active users" chart.
  //
  // We seed the locale from the store so events carry a stable `locale`
  // field from turn one; subsequent locale changes patch context via
  // `setAnalyticsContext`.
  const locale = useLocaleStore((s) => s.locale);
  useEffect(() => {
    (async () => {
      await initAnalytics({ locale });
      track("app_open");
    })();
    // Runs once — the locale effect below keeps context in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Keep analytics context in sync when the user switches language
    // mid-session. Cheap and safe to call on every locale change.
    setAnalyticsContext({ locale });
  }, [locale]);

  // Keep is_pro on analytics events accurate for the whole session.
  // useProStatus already subscribes to RevenueCat's customerInfo updates,
  // so this reacts to renewal / lapse / restore automatically — every
  // event fired after the change carries the correct is_pro value.
  const { isPro, loading: proLoading } = useProStatus();
  useEffect(() => {
    if (proLoading) return; // don't clobber with a stale default
    setAnalyticsContext({ isPro });
  }, [isPro, proLoading]);

  // ────────────────── Cold-start paywall gate ──────────────────
  //
  // Product rule: any user who has finished onboarding but hasn't
  // subscribed sees the paywall on every cold start, until they do.
  //
  // We evaluate ONCE per JS session (`gateAttemptedRef`), and only
  // after `useProStatus` has an authoritative answer (otherwise we'd
  // risk redirecting a paying user whose RC response is still in
  // flight). If the user is currently mid-onboarding-flow we skip —
  // that flow ends at the same paywall via a different route, and
  // double-redirecting would flash the paywall on top of the profile
  // intro.
  //
  // The session flag (`utils/paywallGate.ts`) is module-level, so it
  // naturally resets on cold start. It's ALSO set by the paywall
  // route itself on mount, which covers the case where the user is
  // pushed here from `(profile-adventure)` before this effect gets
  // to run — no double-fire either way.
  const gateAttemptedRef = useRef(false);
  useEffect(() => {
    if (gateAttemptedRef.current) return;
    if (proLoading) return;
    gateAttemptedRef.current = true;

    if (isPro) return;
    if (wasPaywallGateShownThisSession()) return;

    (async () => {
      let onboardingDone = false;
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
        onboardingDone = raw === "true";
      } catch {
        // If AsyncStorage is broken, don't hijack — the user can still
        // reach the paywall from Home / Favorite / locked story taps.
        return;
      }
      if (!onboardingDone) return; // first-run flow handles this itself

      // Don't hijack a user who's already inside the onboarding /
      // paywall chain.
      const firstSegment = segments[0];
      if (firstSegment && ONBOARDING_ROUTE_GROUPS.has(firstSegment)) return;

      markPaywallGateShown();
      track("paywall_gate_shown", { source: "cold_start_gate" });
      router.replace({
        pathname: "/(paywall-onboarding)",
        params: { source: "cold_start_gate" },
      });
    })();
    // `segments` is intentionally NOT in deps: we want a snapshot at
    // the moment the pro status resolves, not a re-fire on every nav.
    // The `gateAttemptedRef` guard would swallow re-runs anyway, but
    // omitting `segments` keeps the intent explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proLoading, isPro, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    ComicReliefRegular: require("../assets/fonts/ComicRelief-Regular.ttf"),
    ComicReliefBold: require("../assets/fonts/ComicRelief-Bold.ttf"),
  });

  // i18n hydration — reconstrói o locale escolhido (AsyncStorage)
  // ou detecta do dispositivo antes de renderizar qualquer tela.
  // Sem isso a primeira frame pode piscar em EN pra usuário PT.
  const [i18nReady, setI18nReady] = useState(false);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);

  useEffect(() => {
    hydrateLocale().finally(() => setI18nReady(true));
  }, [hydrateLocale]);

  if (!loaded || !i18nReady) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" translucent />

      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <AppBootstrap>
            {/*
              Nota: com expo-router v6, o file-based routing detecta
              automaticamente cada rota em `app/`. Só precisamos declarar
              Stack.Screen quando queremos customizar options. Como todas
              as rotas usam `headerShown: false`, aplicamos via
              `screenOptions` uma vez só.
            */}
            <Stack screenOptions={{ headerShown: false }} />
            <StatusBar style="auto" />
          </AppBootstrap>
        </ThemeProvider>
      </QueryClientProvider>
    </>
  );
}
