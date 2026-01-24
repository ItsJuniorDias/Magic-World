import { db } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";


export const getStoryProgress = async (userKey: string, storyId: string) => {
  const docRef = doc(db, "user_progress", userKey);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data()[storyId] || null;
  }
  return null;
};
