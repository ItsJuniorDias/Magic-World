import { create } from 'zustand';
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import * as Application from 'expo-application';
import { Platform } from 'react-native';


interface MagicState {
  chaptersRead: number;
  level: "Apprentice" | "Sorcerer" | "Wizard" | "Archmage";
  deviceId: string | null;
  initProgress: () => Promise<void>;
  addChapter: (userKey: string, storyId: string, chapterIndex: number) => Promise<void>;
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

       let newLevel: "Apprentice" | "Sorcerer" | "Wizard" | "Archmage" = "Apprentice";

      if (userSnap.exists()) {
        const data = userSnap.data();
        const count = data.chaptersRead || 0;
        
        // Atualiza estado local com os dados da nuvem
       

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
          level: newLevel,
          createdAt: new Date().toISOString() 
        });
      }
    } catch (e) {
      console.error("Erro ao sincronizar com Firestore iOS:", e);
    }
  },

  addChapter: async (userKey, storyId, chapterIndex) => {
    console.log({
      userKey,
      storyId,
      chapterIndex ,
    }, "PROPS ")

    // Referência para o documento do utilizador baseado na chave única do dispositivo
    const userRef = doc(db, "users", userKey);

    try {
      // Usamos setDoc com { merge: true } para que, se o documento 
      // não existir (primeira vez), ele seja criado.
      await setDoc(userRef, {
        chaptersRead: increment(1),
        createdAt: new Date().toISOString(),
        platform: Platform.OS,
      }, { merge: true });

      console.log("Progresso salvo com sucesso para o user:", userKey);
    } catch (e) {
      console.error("Erro ao salvar no Firestore:", e);
    }
}
}));

// Exemplo de estilos (não editados, apenas para contexto)