import { doc, setDoc, increment } from "firebase/firestore";
import { db } from "@/firebaseConfig";

export async function updateUserProgress(userId: string) {
  const ref = doc(db, "user_progress", userId);

  await setDoc(
    ref,
    {
      chaptersRead: increment(1),
      updatedAt: new Date(),
    },
    { merge: true }
  );
}
