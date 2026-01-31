import { useCallback } from 'react';
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REVIEW_KEY = '@app_review_requested';

export function useAppReview() {
  const requestReviewOnce = useCallback(async () => {
    try {
      const alreadyRequested = await AsyncStorage.getItem(REVIEW_KEY);

      // Já foi mostrado antes → não faz nada
      if (alreadyRequested === 'true') {
        return;
      }

      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) {
        return;
      }

      // Marca como já solicitado ANTES de mostrar (evita duplicar)
      await AsyncStorage.setItem(REVIEW_KEY, 'true');

      StoreReview.requestReview();
    } catch (error) {
      console.log('Review error:', error);
    }
  }, []);

  return { requestReviewOnce };
}
