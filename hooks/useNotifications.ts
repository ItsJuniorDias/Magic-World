/**
 * hooks/useNotifications.ts
 * ============================================================
 * Bootstrap de notificações no boot do app. Roda uma vez, faz:
 *
 *   1. Hidrata as prefs do AsyncStorage (idempotente)
 *   2. Se o usuário já concedeu permissão em algum momento,
 *      re-registra o token (Expo pode rotacionar; assinatura RC
 *      pode ter mudado; locale pode ter mudado)
 *   3. Reagenda os locais no idioma atual (o texto foi congelado
 *      no OS na última vez que agendou; troca de idioma exige
 *      reagendamento)
 *   4. Configura o listener global de TAP em push → deep linking
 *
 * Deep linking:
 *   O payload `data.screen` é o roteador. Valores suportados:
 *     - "home"        → volta pras tabs
 *     - "paywall"     → abre `/(subscribe)`
 *     - "storie"      → abre `/(storie)` com storyId + title
 *
 *   Novos targets: adicionar case no `handleTap`.
 *
 * Este hook DEVE ser chamado no `_layout.tsx` raiz, DEPOIS do i18n
 * estar pronto — caso contrário o token vai gravar `locale: "en"`
 * mesmo pra usuário pt.
 */

import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import {
  registerForPushNotificationsAsync,
  refreshLocalRemindersLocale,
} from "@/services/notifications";
import { useNotificationsStore } from "@/store/useNotificationsStore";
import { useLocaleStore } from "@/i18n";

/**
 * Parse do payload `data` e navegação. Payload esperado:
 *
 *   { screen: "storie", storyId: "abc", title: "Story Name",
 *     thumbnail: "...", storie: "...", currentIndex: 0 }
 *   { screen: "paywall" }
 *   { screen: "home" }
 *
 * Se `data` vem malformado, cai em silêncio — não vale crashar por
 * causa de um payload ruim vindo do servidor.
 */
function handleTap(response: Notifications.NotificationResponse) {
  try {
    const data = response.notification.request.content.data as
      | Record<string, unknown>
      | undefined;
    const screen = typeof data?.screen === "string" ? data.screen : "home";

    switch (screen) {
      case "paywall":
        router.push("/(subscribe)");
        break;
      case "storie": {
        // Precisamos de storyId minimamente. Sem ele, cai pra home.
        const storyId =
          typeof data?.storyId === "string" ? data.storyId : null;
        if (!storyId) {
          router.push("/(tabs)");
          break;
        }
        router.push({
          pathname: "/(storie)",
          params: {
            storyId,
            title: typeof data?.title === "string" ? data.title : "",
            storie: typeof data?.storie === "string" ? data.storie : "",
            thumbnail:
              typeof data?.thumbnail === "string" ? data.thumbnail : "",
            currentIndex:
              typeof data?.currentIndex === "number"
                ? String(data.currentIndex)
                : "0",
          },
        });
        break;
      }
      case "home":
      default:
        router.push("/(tabs)");
        break;
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[notifications] falha ao rotear tap:", err);
    }
  }
}

/**
 * Hook principal — chamar UMA VEZ no `_layout.tsx` raiz.
 */
export function useNotifications() {
  const hydrate = useNotificationsStore((s) => s.hydrate);
  const ready = useNotificationsStore((s) => s.ready);
  const registered = useNotificationsStore((s) => s.registered);
  const bedtimeEnabled = useNotificationsStore((s) => s.bedtimeEnabled);
  const streakEnabled = useNotificationsStore((s) => s.streakEnabled);
  const setRegistered = useNotificationsStore((s) => s.setRegistered);
  const setPermissionStatus = useNotificationsStore(
    (s) => s.setPermissionStatus,
  );

  const locale = useLocaleStore((s) => s.locale);
  const localeReady = useLocaleStore((s) => s.ready);

  // Guarda pra evitar re-registro dentro da mesma sessão
  const bootstrappedRef = useRef(false);
  // Guarda o último locale reagendado — evita spam de scheduling
  const lastLocaleForRemindersRef = useRef<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Bootstrap: re-registro do token + reagendamento no idioma atual.
  useEffect(() => {
    if (!ready || !localeReady) return;
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    (async () => {
      // Só re-registra se o usuário JÁ concedeu permissão antes.
      // Isso evita mostrar o prompt de permissão em todo boot pra
      // quem ainda não interagiu com nenhum toggle.
      if (registered) {
        try {
          const result = await registerForPushNotificationsAsync();
          setPermissionStatus(result.permissionStatus);
          if (result.permissionStatus !== "granted") {
            // Usuário revogou nos Settings — reflete no store.
            await setRegistered(false);
          }
        } catch (err) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn("[notifications] bootstrap falhou:", err);
          }
        }
      }

      // Reagenda locais no idioma atual (mesmo que já estivessem
      // agendados — refaz pra pegar mudança de tradução se o app
      // atualizou).
      await refreshLocalRemindersLocale({
        bedtimeEnabled,
        streakEnabled,
      });
      lastLocaleForRemindersRef.current = locale;
    })();
  }, [
    ready,
    localeReady,
    registered,
    setPermissionStatus,
    setRegistered,
    bedtimeEnabled,
    streakEnabled,
    locale,
  ]);

  // Se o usuário trocar de idioma DURANTE a sessão, reagendar pra
  // pegar as strings novas.
  useEffect(() => {
    if (!ready || !localeReady) return;
    if (!bootstrappedRef.current) return;
    if (lastLocaleForRemindersRef.current === locale) return;

    (async () => {
      await refreshLocalRemindersLocale({
        bedtimeEnabled,
        streakEnabled,
      });
      lastLocaleForRemindersRef.current = locale;
    })();
  }, [locale, ready, localeReady, bedtimeEnabled, streakEnabled]);

  // Listener de TAP — funciona pra push tapado com app fechado
  // (via `getLastNotificationResponseAsync`) e pra app aberto/back-
  // ground (via `addNotificationResponseReceivedListener`).
  useEffect(() => {
    // Cold start: se o app foi aberto por causa de um tap, roteia.
    // Delay pequeno pro Stack estar pronto pra navegar.
    let mounted = true;
    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (mounted && last) {
        // Um pequeno timeout pra garantir que o navigator montou
        setTimeout(() => handleTap(last), 300);
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener(
      handleTap,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
}
