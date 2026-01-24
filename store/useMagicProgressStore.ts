import { create } from 'zustand';
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

interface MagicState {
  chaptersRead: number;
  level: "Apprentice" | "Sorcerer" | "Wizard" | "Archmage";
  deviceId: string | null;
  initProgress: () => Promise<void>;
  addChapter: () => Promise<void>;
}

export const useMagicProgressStore = create<MagicState>((set, get) => ({
  chaptersRead: 0,
  level: "Apprentice",
  deviceId: null,

  initProgress: async () => {
    // Tratativa exclusiva para iOS
    if (Platform.OS !== 'ios') {
      console.warn("Este método está configurado apenas para dispositivos iOS.");
      return;
    }

    try {
      // 1. Obtém o ID específico do iOS (IDFV)
      const iosId = await Application.getIosIdForVendorAsync();
      
      if (!iosId) {
        console.error("Não foi possível obter o iOS Device ID");
        return;
      }

      set({ deviceId: iosId });

      // 2. Referência do documento no Firestore
      const userRef = doc(db, "users", iosId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const count = data.chaptersRead || 0;
        
        // Atualiza estado local com os dados da nuvem
        let newLevel: "Apprentice" | "Sorcerer" | "Wizard" | "Archmage" = "Apprentice";

        // Define o nível baseado no count
        if (count >= 100) newLevel = "Archmage";
        else if (count >= 50) newLevel = "Wizard";
        else if (count >= 10) newLevel = "Sorcerer"; 
        else newLevel = "Apprentice";

        set({ chaptersRead: count, level: newLevel });
      } else {
        // Se o usuário iOS entrar pela primeira vez, cria o registro no Firestore
        await setDoc(userRef, { 
          chaptersRead: 0, 
          platform: 'ios',
          createdAt: new Date().toISOString() 
        });
      }
    } catch (e) {
      console.error("Erro ao sincronizar com Firestore iOS:", e);
    }
  },

  addChapter: async () => {
    const { deviceId, chaptersRead } = get();
    
    // Se não tiver o ID (ex: erro na inicialização), não prossegue
    if (!deviceId) return;

    const newCount = chaptersRead + 1;
    
    // Update Otimista (Interface atualiza na hora)
    let newLevel: "Apprentice" | "Sorcerer" | "Wizard" | "Archmage" = "Apprentice";
     
     
      // Define o nível baseado no novo count
      if (newCount >= 100) newLevel = "Archmage";
      else if (newCount >= 50) newLevel = "Wizard";
      else if (newCount >= 10) newLevel = "Sorcerer"; 
      else newLevel = "Apprentice";

    set({ chaptersRead: newCount, level: newLevel });

    // Sincroniza com o Firestore em background
    try {
      const userRef = doc(db, "users", deviceId);
      await updateDoc(userRef, {
        chaptersRead: increment(1)
      });
    } catch (e) {
      console.error("Erro ao salvar capítulo no iOS:", e);
    }
  },
}));