import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";

// Salvar progresso
export const saveStoryProgress = async (
  userKey: string,
  storyId: string,
  chapterIndex: number,
  currentPage: number
) => {
  const docRef = doc(db, "user_progress", userKey);
  await setDoc(
    docRef,
    {
      [storyId]: {
        chapterIndex,
        currentPage,
      },
    },
    { merge: true }
  );
};