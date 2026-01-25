import { create } from "zustand";

import { db } from "@/firebaseConfig";
import { doc, setDoc, getDoc } from "firebase/firestore";
import * as Application from "expo-application"; // para pegar deviceId

export type AdventureProfileType =
  | "brave"
  | "clever"
  | "wild"
  | "wise";

interface AdventureProfileState {
  points: Record<AdventureProfileType, number>;
  profile: AdventureProfileType | null; 
  isLoading: boolean;
  
  loadProfile: () => Promise<void>;
  addPoint: (type: AdventureProfileType) => void;
  calculateProfile: () => Promise<AdventureProfileType>;
  resetProfile: () => void;
}

const initialPoints: Record<AdventureProfileType, number> = {
  brave: 0,
  clever: 0,
  wild: 0,
  wise: 0,
};

export const useAdventureProfileStore = create<AdventureProfileState>(
  (set, get) => ({
     points: initialPoints,
    profile: null,
    isLoading: true,

    // 1️⃣ Carrega o profile do Firebase
    loadProfile: async () => {
      set({ isLoading: true });
      try {
        const iosId = await Application.getIosIdForVendorAsync();


        if (!iosId) {
            console.error("Não foi possível obter o iOS Device ID");
            return
        }

        const userRef = doc(db, "users", iosId);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          set({
            profile: data.profile || null,
          });
        } else {
          // Cria documento padrão se não existir
          await setDoc(userRef, { points: initialPoints, profile: null });
          
          set({ points: initialPoints, profile: null });
        }
      } catch (error) {
        console.error("Erro ao carregar profile:", error);
      } finally {
        set({ isLoading: false });
      }
    },

    // 2️⃣ Adiciona ponto e atualiza no Firebase
    addPoint: async (type) => {
      set((state) => ({
        points: { ...state.points, [type]: state.points[type] + 1 },
      }));

      try {
        const iosId = await Application.getIosIdForVendorAsync();

        if (!iosId) {
              console.error("Não foi possível obter o iOS Device ID");
              return
          }

        const userRef = doc(db, "users", iosId);
        const { points } = get();

        await setDoc(
          userRef,
          { points },
          { merge: true }
        );
      } catch (error) {
        console.error("Erro ao atualizar pontos no Firebase:", error);
      }
    },

  calculateProfile: async () => {
    const { points } = get();

    const sorted = Object.entries(points).sort(
      (a, b) => b[1] - a[1]
    );
    const winner = sorted[0][0] as AdventureProfileType;

    set({ profile: winner });

    try {
      // Pega ID do usuário (ou deviceId)
      const iosId = await Application.getIosIdForVendorAsync();

      if (!iosId) {
        console.error("Não foi possível obter o iOS Device ID");
      } else {
        // Atualiza ou cria documento do usuário no Firestore
        const userRef = doc(db, "users", iosId);

        await setDoc(
          userRef,
          { profile: winner },
          { merge: true } // Merge mantém outros campos
        );

        console.log("Profile salvo com sucesso:", winner);
      }
    } catch (error) {
      console.error("Erro ao salvar profile no Firestore:", error);
    }

    return winner;
  },

    resetProfile: () =>
      set({
        points: initialPoints,
        profile: null,
      }),
  })
);
