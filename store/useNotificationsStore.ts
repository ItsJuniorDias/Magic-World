/**
 * store/useNotificationsStore.ts
 * ============================================================
 * Persistência das preferências de notificação:
 *   - bedtimeEnabled  — toggle "Lembrete de leitura" (19h)
 *   - streakEnabled   — toggle "Lembrete de sequência" (20h)
 *   - registered      — se já rodou o registro do token
 *   - permissionStatus — resultado do último `getPermissions`
 *
 * Padrão: ambos desligados por default. O usuário LIGA se quiser.
 * Isso é anti-spam e melhor pra Apple review (não pede permissão
 * de push no primeiro boot).
 *
 * O store persiste em AsyncStorage sob a chave `@magic_world_notif_prefs`.
 * Se o storage falhar, opera em memória apenas — não bloqueia o app.
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  scheduleBedtimeReminder,
  scheduleStreakReminder,
} from "@/services/notifications";

const STORAGE_KEY = "@magic_world_notif_prefs";

type PermissionStatus = Notifications.PermissionStatus | "unknown";

type PersistedShape = {
  bedtimeEnabled: boolean;
  streakEnabled: boolean;
  registered: boolean;
};

type NotifState = PersistedShape & {
  ready: boolean;
  permissionStatus: PermissionStatus;

  hydrate: () => Promise<void>;
  setBedtimeEnabled: (v: boolean) => Promise<void>;
  setStreakEnabled: (v: boolean) => Promise<void>;
  setRegistered: (v: boolean) => Promise<void>;
  setPermissionStatus: (s: PermissionStatus) => void;
};

async function persist(state: PersistedShape) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sem storage: preferência é volátil, ok.
  }
}

export const useNotificationsStore = create<NotifState>((set, get) => ({
  bedtimeEnabled: false,
  streakEnabled: false,
  registered: false,
  ready: false,
  permissionStatus: "unknown",

  async hydrate() {
    if (get().ready) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        set({
          bedtimeEnabled: parsed.bedtimeEnabled ?? false,
          streakEnabled: parsed.streakEnabled ?? false,
          registered: parsed.registered ?? false,
        });
      }
    } catch {
      // ignora — cai no default
    }
    set({ ready: true });
  },

  async setBedtimeEnabled(v) {
    set({ bedtimeEnabled: v });
    await persist({
      bedtimeEnabled: v,
      streakEnabled: get().streakEnabled,
      registered: get().registered,
    });
    // O side-effect (agendar/cancelar) é feito aqui pra manter
    // store como única fonte de verdade. Se falhar, o próximo boot
    // pode ficar dessincronizado com o OS — improvável, mas se virar
    // problema dá pra fazer reconciliação em `hydrate`.
    await scheduleBedtimeReminder(v);
  },

  async setStreakEnabled(v) {
    set({ streakEnabled: v });
    await persist({
      bedtimeEnabled: get().bedtimeEnabled,
      streakEnabled: v,
      registered: get().registered,
    });
    await scheduleStreakReminder(v);
  },

  async setRegistered(v) {
    set({ registered: v });
    await persist({
      bedtimeEnabled: get().bedtimeEnabled,
      streakEnabled: get().streakEnabled,
      registered: v,
    });
  },

  setPermissionStatus(s) {
    set({ permissionStatus: s });
  },
}));
