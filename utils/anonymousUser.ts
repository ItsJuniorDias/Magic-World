import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const STORAGE_KEY = "@anonymous_user_id";

export async function getAnonymousUserId(): Promise<string> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);

  if (stored) return stored;

  const newId = Crypto.randomUUID();


  await AsyncStorage.setItem(STORAGE_KEY, newId);

  return newId;
}
