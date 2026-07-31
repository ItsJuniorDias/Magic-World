/**
 * services/notifications.ts
 * ============================================================
 * Camada única de push + local notifications. Responsável por:
 *
 *   1. Registrar o device com Expo push (obter ExponentPushToken)
 *   2. Persistir o token no Firestore em `push_tokens/{deviceId}`
 *      (a mesma collection que `scripts/sendUpdatePush.ts` lê)
 *   3. Agendar lembretes locais (bedtime + streak) sem depender
 *      de backend
 *   4. Configurar handler de foreground (mostra banner mesmo com
 *      app aberto)
 *   5. Devolver o payload do tap pra quem escuta (deep linking)
 *
 * Schema de `push_tokens/{deviceId}`:
 *   - token         string   ExponentPushToken[...]
 *   - deviceId      string   UUID persistido no AsyncStorage
 *   - platform      "ios" | "android"
 *   - locale        LocaleCode ("en" | "pt" | ...)
 *   - entitlement   boolean   (assinante RC ou não)
 *   - appVersion    string
 *   - updatedAt     Timestamp
 *
 * O backend do `sendUpdatePush.ts` pode agora enviar payloads
 * multi-idioma e escolher o texto certo por doc (via `locale`).
 *
 * IMPORTANTE:
 * - `registerForPushNotificationsAsync` DEVE ser chamado DEPOIS
 *   do i18n estar hidratado (senão grava `locale: "en"` mesmo
 *   pra usuários pt).
 * - Em simulator iOS o Expo devolve `null` — a gente pula silen-
 *   ciosamente e ainda agenda os locais.
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import * as Application from "expo-application";

import { db } from "@/firebaseConfig";
import { useLocaleStore, t as translate } from "@/i18n";
import type { LocaleCode } from "@/i18n";

// ============================================================
// Foreground handler — controla como o app mostra pushes quando
// já está aberto. iOS 14+ separa alert/banner/list, mas mantemos
// tudo ligado por padrão (a UX de kids apps tolera bem banner).
// ============================================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false, // sem badge — não queremos pressão
  }),
});

// ============================================================
// Device ID — persistido no AsyncStorage. Usamos ele como docId
// em `push_tokens` pra evitar duplicatas quando o usuário rein-
// stala o app ou o Expo troca o token.
// ============================================================

const DEVICE_ID_KEY = "@magic_world_device_id";

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    // Prefere o ID de instalação do sistema (estável entre reinícios,
    // muda em reinstalação). Fallback pra UUID gerado localmente.
    const applicationId =
      Platform.OS === "android"
        ? await Application.getAndroidId()
        : await Application.getIosIdForVendorAsync();

    const id =
      applicationId ??
      `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // Se o AsyncStorage falhar, gera um efêmero. O push ainda
    // funciona nessa sessão.
    return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// ============================================================
// Registro de push
// ============================================================

/**
 * Result do registro. `token` null significa que o device é um
 * simulator ou o usuário negou a permissão.
 */
export type PushRegisterResult = {
  token: string | null;
  deviceId: string;
  permissionStatus: Notifications.PermissionStatus;
};

/**
 * Pede permissão, obtém o Expo Push Token e persiste no Firestore.
 * Idempotente: pode ser chamado a cada boot que só atualiza
 * `updatedAt` + campos que mudaram (locale, entitlement, versão).
 *
 * @param entitlement Se o usuário é assinante — permite campanhas
 *                    segmentadas ("50% off pra não assinantes").
 */
export async function registerForPushNotificationsAsync(opts?: {
  entitlement?: boolean;
}): Promise<PushRegisterResult> {
  const deviceId = await getOrCreateDeviceId();

  // Android exige canal declarado antes de agendar/exibir.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Magic World",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#8B5CF6",
      sound: "default",
    });
  }

  // Push real só funciona em device físico. Simulator iOS não
  // recebe APNs. Ainda retornamos algo pra caller poder decidir.
  if (!Device.isDevice) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[notifications] simulator detectado — pulando token");
    }
    return {
      token: null,
      deviceId,
      permissionStatus: Notifications.PermissionStatus.UNDETERMINED,
    };
  }

  // Solicita permissão. Só pergunta se ainda não pediu — evita
  // spammar o usuário a cada boot.
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    status = newStatus;
  }

  if (status !== "granted") {
    return {
      token: null,
      deviceId,
      permissionStatus: status,
    };
  }

  // Precisa do projectId pro Expo emitir um token vinculado ao app.
  // Sem isso a chamada dá erro em builds standalone.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        "[notifications] projectId ausente — Expo não vai emitir token",
      );
    }
    return { token: null, deviceId, permissionStatus: status };
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  const token = tokenResponse.data;

  // Persiste no Firestore. O sendUpdatePush lê essa collection.
  try {
    const locale = useLocaleStore.getState().locale;
    await setDoc(
      doc(db, "push_tokens", deviceId),
      {
        token,
        deviceId,
        platform: Platform.OS as "ios" | "android",
        locale,
        entitlement: opts?.entitlement ?? false,
        appVersion:
          Constants.expoConfig?.version ?? Application.nativeApplicationVersion ?? null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    // Não bloqueia o app se o Firestore falhar — reagendamos no
    // próximo boot. Log em dev pra debug.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[notifications] falha ao gravar token:", err);
    }
  }

  return { token, deviceId, permissionStatus: status };
}

/**
 * Atualiza o `locale` do token no Firestore. Chamado quando o
 * usuário troca de idioma — assim o backend passa a mandar push
 * no novo idioma.
 */
export async function updatePushLocale(locale: LocaleCode): Promise<void> {
  try {
    const deviceId = await getOrCreateDeviceId();
    await setDoc(
      doc(db, "push_tokens", deviceId),
      { locale, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[notifications] falha ao atualizar locale:", err);
    }
  }
}

// ============================================================
// Local notifications — bedtime + streak
// ============================================================

/** IDs estáveis pra poder cancelar/reagendar sem coletar tudo. */
const BEDTIME_ID = "magicworld.bedtime";
const STREAK_ID = "magicworld.streak";

/**
 * Agenda ou cancela o lembrete diário de leitura. Se `enabled`
 * for false, cancela. Se true, reagenda pra `hour`:00 todo dia.
 *
 * Os textos são lidos por `t()` no momento do agendamento e ficam
 * fixos no OS até reagendarmos — se o usuário trocar de idioma
 * depois, quem chama esta função de novo (via `useNotifications`
 * hook) atualiza as strings.
 */
export async function scheduleBedtimeReminder(
  enabled: boolean,
  hour: number = 19,
): Promise<void> {
  // Cancela antes — mesmo se vamos reagendar, evita duplicata.
  await Notifications.cancelScheduledNotificationAsync(BEDTIME_ID).catch(
    () => {},
  );
  if (!enabled) return;

  await Notifications.scheduleNotificationAsync({
    identifier: BEDTIME_ID,
    content: {
      title: translate("notifications.bedtimePushTitle"),
      body: translate("notifications.bedtimePushBody"),
      sound: "default",
      data: { screen: "home", type: "bedtime_reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute: 0,
      repeats: true,
    },
  });
}

/**
 * Streak reminder — diário às 20h como "última chance". A intenção
 * é diferente do bedtime: aqui é sobre não perder a sequência,
 * então dispara 1h depois pra pegar quem realmente esqueceu.
 *
 * NOTA: Expo local não sabe se o usuário abriu o app hoje. A gente
 * aceita o trade-off de mandar o push mesmo em dias que ele leu —
 * pior UX seria não avisar em dia que ele esqueceu. Se virar
 * problema, dá pra mover essa lógica pro backend com Cloud Functions
 * e mandar via push remoto só quando o `lastReadAt` do usuário
 * indica que ele ficou fora hoje.
 */
export async function scheduleStreakReminder(
  enabled: boolean,
  hour: number = 20,
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(STREAK_ID).catch(
    () => {},
  );
  if (!enabled) return;

  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_ID,
    content: {
      title: translate("notifications.streakPushTitle"),
      body: translate("notifications.streakPushBody"),
      sound: "default",
      data: { screen: "home", type: "streak_reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute: 0,
      repeats: true,
    },
  });
}

/** Cancela todos os agendamentos (usado no logout ou reset). */
export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

/**
 * Reagenda todos os locais ativos com strings no idioma atual.
 * Chamado quando o usuário troca de idioma pra que o próximo push
 * saia na língua correta.
 */
export async function refreshLocalRemindersLocale(prefs: {
  bedtimeEnabled: boolean;
  streakEnabled: boolean;
  bedtimeHour?: number;
  streakHour?: number;
}): Promise<void> {
  await Promise.all([
    scheduleBedtimeReminder(prefs.bedtimeEnabled, prefs.bedtimeHour),
    scheduleStreakReminder(prefs.streakEnabled, prefs.streakHour),
  ]);
}
