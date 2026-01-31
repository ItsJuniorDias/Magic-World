import { db } from "../firebaseConfig.js";
import {  collection, getDocs } from "firebase/firestore";

const NEW_VERSION = "3.1.0";

async function sendUpdatePush() {
  const snapshot = await getDocs(collection(db, "push_tokens"));

  const messages = snapshot.docs
    .map((d) => d.data())
    .filter((u) => u.appVersion !== NEW_VERSION)
    .map((u) => ({
      to: u.token,
      title: "Nova versão disponível 🚀",
      body: "Atualize o app para acessar as novidades!",
      data: { type: "UPDATE_APP", version: NEW_VERSION },
      sound: "default",
    }));

    for (const msg of messages) {
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
      const data = await res.json();
      console.log("Resposta do Expo:", data);
    } catch (err) {
      console.error("Erro ao enviar push:", err);
    }
  }

  console.log(`Push enviado para ${messages.length} devices`);
}

sendUpdatePush();
