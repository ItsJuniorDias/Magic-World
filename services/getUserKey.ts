import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVORITE_KEY = "anonymous_user_key";

export const getUserKey = async () => {
  let key = await AsyncStorage.getItem(FAVORITE_KEY);
  
  if (!key) {
    key = Math.random().toString(36).substring(2, 12);
    await AsyncStorage.setItem(FAVORITE_KEY, key);
  }
  return key;
};
