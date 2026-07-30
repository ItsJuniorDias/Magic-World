import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import Purchases, { type CustomerInfo } from "react-native-purchases";

/**
 * Single source of truth for whether the user is a member.
 *
 * This exists because the current app has two entitlement bugs, and both of
 * them cost money:
 *
 *   1. `@user_is_pro` is only ever written inside the subscribe screen, after
 *      a purchase or a restore. Nothing re-syncs it at launch. A subscription
 *      that lapses therefore leaves the flag reading "true" forever, and the
 *      user keeps every paid chapter for free.
 *
 *   2. The same gap runs the other way. A paying member who reinstalls, or
 *      picks up a new device, arrives with an empty AsyncStorage and gets
 *      locked out of content they are currently paying for. They will not
 *      hunt for "Restore Purchases" — they will ask for a refund, or leave a
 *      one-star review, or both.
 *
 * The fix is to treat RevenueCat as authoritative and AsyncStorage as nothing
 * more than a cache for the first paint. On every mount we read the cache
 * immediately so the UI doesn't flicker, then reconcile against the network
 * and overwrite. The listener keeps it correct for the rest of the session.
 */

const ENTITLEMENT_ID = "pro";
const CACHE_KEY = "@user_is_pro";

/** Public SDK key, safe to ship — same value already in `app/(app)/index.tsx`. */
const REVENUECAT_IOS_KEY = "appl_UcIhNLORZZgNuPFDjVUoqawwHfK";

let configured = false;

/**
 * Idempotent SDK setup.
 *
 * `Purchases.configure` currently runs inside the onboarding screen, which is
 * only mounted on a user's first launch. Any screen that needs entitlements
 * on a later launch is therefore talking to an unconfigured SDK. Calling this
 * from the hook makes every consumer self-sufficient.
 *
 * Move the same call into `app/_layout.tsx` when you get a chance — this
 * function then becomes a no-op safety net rather than the primary path.
 */
export async function ensurePurchasesConfigured(): Promise<void> {
  if (configured) return;
  try {
    await Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
    configured = true;
  } catch (err) {
    // Configuring twice throws on some SDK versions and is harmless.
    configured = true;
    if (__DEV__) console.warn("[useProStatus] configure:", err);
  }
}

export function readEntitlement(info: CustomerInfo): boolean {
  return !!info.entitlements.active[ENTITLEMENT_ID];
}

/** Writes the cache in the exact format the existing screens read. */
export async function cacheProStatus(isPro: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, isPro ? "true" : "false");
  } catch (err) {
    if (__DEV__) console.warn("[useProStatus] cache write failed:", err);
  }
}

export interface ProStatus {
  isPro: boolean;
  /** True until the first authoritative answer arrives. */
  loading: boolean;
  /** Force a re-check, e.g. after returning from the subscribe screen. */
  refresh: () => Promise<boolean>;
}

export function useProStatus(): ProStatus {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      await ensurePurchasesConfigured();
      const info = await Purchases.getCustomerInfo();
      const active = readEntitlement(info);
      await cacheProStatus(active);
      if (mounted.current) {
        setIsPro(active);
        setLoading(false);
      }
      return active;
    } catch (err) {
      if (__DEV__) console.warn("[useProStatus] refresh failed:", err);
      // Network failure: fall back to the cache rather than locking out a
      // paying member because they're on the tube.
      if (mounted.current) setLoading(false);
      return isPro;
    }
  }, [isPro]);

  useEffect(() => {
    mounted.current = true;

    // 1. Optimistic paint from cache.
    AsyncStorage.getItem(CACHE_KEY)
      .then((cached) => {
        if (mounted.current && cached === "true") setIsPro(true);
      })
      .catch(() => {});

    // 2. Authoritative reconcile.
    refresh();

    // 3. Stay correct for the rest of the session — this fires on renewal,
    //    cancellation, restore and cross-device sync.
    let remove: (() => void) | undefined;
    ensurePurchasesConfigured()
      .then(() => {
        const listener = (info: CustomerInfo) => {
          const active = readEntitlement(info);
          cacheProStatus(active);
          if (mounted.current) setIsPro(active);
        };
        Purchases.addCustomerInfoUpdateListener(listener);
        remove = () => {
          try {
            Purchases.removeCustomerInfoUpdateListener(listener);
          } catch {
            // Older SDKs don't expose the remover; the listener is harmless.
          }
        };
      })
      .catch(() => {});

    return () => {
      mounted.current = false;
      remove?.();
    };
    // Intentionally runs once. `refresh` closes over `isPro` only for its
    // fallback return value, which does not need to re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isPro, loading, refresh };
}
