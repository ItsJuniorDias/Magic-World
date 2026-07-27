import { create } from "zustand";
import { db } from "@/firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  increment,
} from "firebase/firestore";
import { Platform } from "react-native";
import { getAnonymousUserId } from "@/utils/anonymousUser";

interface MagicState {
  chaptersRead: number;
  level: "Apprentice" | "Sorcerer" | "Wizard" | "Archmage";
  deviceId: string | null;
  initProgress: () => Promise<void>;
  addChapter: (
    userKey: string,
    storyId: string,
    chapterIndex: number,
  ) => Promise<void>;
}

function levelFor(count: number): MagicState["level"] {
  if (count >= 100) return "Archmage";
  if (count >= 50) return "Wizard";
  if (count >= 10) return "Sorcerer";
  return "Apprentice";
}

export const useMagicProgressStore = create<MagicState>((set) => ({
  chaptersRead: 0,
  level: "Apprentice",
  deviceId: null,

  initProgress: async () => {
    try {
      const userId = await getAnonymousUserId();
      set({ deviceId: userId });

      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const count = data.chaptersRead ?? 0;
        set({ chaptersRead: count, level: levelFor(count) });
      } else {
        // Primeiro acesso — cria registro
        await setDoc(userRef, {
          chaptersRead: 0,
          platform: Platform.OS,
          level: "Apprentice",
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("Erro ao sincronizar com Firestore:", e);
    }
  },

  addChapter: async (userKey, storyId, chapterIndex) => {
    console.log({ userKey, storyId, chapterIndex }, "PROPS");

    const userRef = doc(db, "users", userKey);

    try {
      await setDoc(
        userRef,
        {
          chaptersRead: increment(1),
          createdAt: new Date().toISOString(),
          platform: Platform.OS,
        },
        { merge: true },
      );

      console.log("Progresso salvo com sucesso para o user:", userKey);
    } catch (e) {
      console.error("Erro ao salvar no Firestore:", e);
    }
  },
}));
