import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { db } from "@/firebaseConfig";

export async function savePushToken(
  deviceId: string,
  token: string
) {
  const appVersion =
    Constants.expoConfig?.version ?? "unknown";

  await setDoc(
    doc(db, "push_tokens", deviceId),
    {
      deviceId,
      token,
      platform: Platform.OS,
      appVersion,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
