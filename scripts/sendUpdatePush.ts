import { db } from "../firebaseConfig.js";
import {  collection, getDocs } from "firebase/firestore";

const NEW_VERSION = "1.3.0";

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
    }));

  for (const msg of messages) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
  }

  console.log(`Push enviado para ${messages.length} devices`);
}

sendUpdatePush();
