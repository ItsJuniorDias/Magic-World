import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values'; // Necessário para o UUID funcionar no RN
import { v4 as uuidv4 } from 'uuid';

const MEASUREMENT_ID = "G-3CXJ2CPHJT";
const API_SECRET = 'oQuyyR-DTaSVBuQH_sEIAQ';

// Função para pegar ou criar um ID fixo para este celular
async function getOrCreateClientId() {
  let clientId = await AsyncStorage.getItem('@analytics_client_id');

  if (!clientId) {
    clientId = uuidv4();
    await AsyncStorage.setItem('@analytics_client_id', clientId);
  }
  return clientId;
}

export async function logEvent(eventName, params = {}) {
  try {
    const clientId = await getOrCreateClientId();
    
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          events: [{
            name: eventName,
            params: {
              ...params,
              debug_mode: true // Adicione isso para ver no DebugView agora!
            },
          }],
        }),
      }
    );

    if (response.ok) {
      console.log(`✅ Evento [${eventName}] enviado! (ID: ${clientId})`);
    }
  } catch (error) {
    console.error('❌ Erro no GA4:', error);
  }
}