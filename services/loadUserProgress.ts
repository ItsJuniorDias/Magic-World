import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";

export async function loadUserProgress(userId: string) {
  const ref = doc(db, "user_progress", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return { chaptersRead: 0 };
  }

  return snap.data();
}
