import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/firebaseConfig";

export type LikedStory = {
  storyId: string;
  title: string;
  thumbnail: string;
  createdAt?: any;
};


export async function getLikedStories(userId: string): Promise<LikedStory[]> {
  const q = query(
    collection(db, "liked", userId, "stories"),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    storyId: doc.id,
    ...(doc.data() as any),
  }));
}

export async function likeStory({
  userId,
  storyId,
  title,
  thumbnail,
}: {
  userId: string;
  storyId: string;
  title: string;
  thumbnail: string;
}) {
  const ref = doc(db, "liked", userId, "stories", storyId);

  await setDoc(ref, {
    storyId,
    title,
    thumbnail,
    createdAt: serverTimestamp(),
  });
}

export async function unlikeStory({
  userId,
  storyId,
}: {
  userId: string;
  storyId: string;
}) {
  const ref = doc(db, "liked", userId, "stories", storyId);
  await deleteDoc(ref);
}


