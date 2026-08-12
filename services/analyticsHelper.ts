/**
 * services/analyticsHelper.ts
 * ============================================================
 * GA4 sink (Measurement Protocol).
 *
 * WHY THIS FILE STILL EXISTS
 *
 *   The primary analytics pipeline now lives in `services/analytics.ts`
 *   and sends everything to our own backend. This file remained because:
 *
 *     1. We MIRROR every event to GA4 for continuity (dashboards there
 *        were already built), so `analytics.ts` calls `logEvent` below
 *        as a fire-and-forget secondary sink.
 *
 *     2. A handful of legacy call sites still import `logEvent` directly
 *        (paywall, etc). Rather than break them all at once, this file
 *        now forwards direct calls to the new engine — the GA4 request
 *        goes out AND the event lands in the new backend/funnel.
 *
 *   Once every screen migrates to `import { track } from "@/services/analytics"`,
 *   this file can shrink to just the GA4 helper.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-get-random-values"; // Necessário para o UUID funcionar no RN
import { v4 as uuidv4 } from "uuid";

const MEASUREMENT_ID = "G-3CXJ2CPHJT";
const API_SECRET = "oQuyyR-DTaSVBuQH_sEIAQ";

// Reutiliza o mesmo client_id que o app usa há tempos — trocar essa key
// zeraria a contagem de "usuários únicos" no GA4 de um dia pro outro.
const CLIENT_ID_KEY = "@analytics_client_id";

async function getOrCreateClientId(): Promise<string> {
  let clientId = await AsyncStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = uuidv4();
    await AsyncStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

/**
 * Envia UM evento pro GA4 via Measurement Protocol.
 *
 * Called two ways:
 *   • Directly from legacy screens (paywall, etc). In that case we also
 *     forward to the new engine so the funnel dashboard sees the event.
 *   • As a mirror from `services/analytics.ts` (the new engine). In that
 *     case the caller sets `__mirroredFromEngine` to true so we skip the
 *     re-forward and avoid a loop.
 */
export async function logEvent(
  eventName: string,
  params: Record<string, unknown> = {},
): Promise<void> {
  // Mirror path from the new engine — GA4 only, no re-forward.
  const mirrored = (params as { __mirroredFromEngine?: boolean })
    .__mirroredFromEngine === true;

  // Legacy direct call — forward into the new engine so it lands on the
  // funnel dashboard too. Dynamic import to avoid a require cycle at boot.
  if (!mirrored) {
    try {
      const mod = await import("@/services/analytics");
      mod.track(eventName as any, params);
    } catch {
      // If the engine isn't importable for some reason we still fire GA4
      // below — the legacy behaviour is preserved.
    }
  }

  // Sanitize params for GA4: drop our internal marker before sending.
  const sanitized: Record<string, unknown> = { ...params };
  delete (sanitized as { __mirroredFromEngine?: boolean }).__mirroredFromEngine;

  try {
    const clientId = await getOrCreateClientId();

    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          events: [
            {
              name: eventName,
              params: {
                ...sanitized,
                // debug_mode true expõe o evento no DebugView em tempo real;
                // ok em prod pois GA4 aceita o flag sem impacto quantitativo.
                debug_mode: true,
              },
            },
          ],
        }),
      },
    );

    if (__DEV__ && response.ok) {
      // eslint-disable-next-line no-console
      console.log(`[ga4] ${eventName} sent (client_id=${clientId})`);
    }
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[ga4] error:", error);
    }
  }
}
