/**
 * scripts/sendUpdatePush.ts
 * ============================================================
 * Envia push pra base de tokens gravada em Firestore. Suporta
 * payloads multi-idioma: o script lê `locale` do doc e escolhe
 * o título/corpo correspondente. Se o locale do token não estiver
 * mapeado, cai em `en`.
 *
 * Uso típico (rodar via `bun scripts/sendUpdatePush.ts`):
 *
 *   PAYLOAD editável abaixo. Também filtra por `appVersion` se
 *   `TARGET_VERSION` for setado — assim manda push só pra galera
 *   que ainda não atualizou.
 *
 * O `data` é o mesmo pra todos e vira o payload que o app lê no
 * tap (deep linking) — ver `hooks/useNotifications.ts` pros
 * targets suportados.
 *
 * Expo push API: https://docs.expo.dev/push-notifications/sending-notifications/
 */

import { db } from "../firebaseConfig.js";
import { collection, getDocs } from "firebase/firestore";

// ============================================================
// Config da campanha — edita aqui antes de rodar.
// ============================================================

/**
 * Se preenchido, filtra pra devices que NÃO estão nessa versão.
 * Deixe `null` pra enviar pra todo mundo.
 */
const TARGET_VERSION: string | null = null;

/** Payload de deep linking — vira `data` no push. */
const DATA_PAYLOAD: Record<string, string> = {
  // Opções: "home" | "paywall" | "storie" (com storyId + title etc)
  screen: "home",
  campaign: "generic_update",
};

/**
 * Título/corpo por idioma. `en` é obrigatório (fallback).
 * Se um device tem `locale` que não está aqui, usa `en`.
 */
type LocalizedContent = { title: string; body: string };
const CONTENT: Record<string, LocalizedContent> = {
  en: {
    title: "New chapter awaits ✨",
    body: "A fresh audiobook is ready. Tap to open Magic World.",
  },
  pt: {
    title: "Novo capítulo te espera ✨",
    body: "Um novo audiolivro chegou. Toque pra abrir o Magic World.",
  },
  es: {
    title: "Un nuevo capítulo te espera ✨",
    body: "Un nuevo audiolibro está listo. Toca para abrir Magic World.",
  },
  fr: {
    title: "Un nouveau chapitre t'attend ✨",
    body: "Un nouvel audiolivre est prêt. Appuie pour ouvrir Magic World.",
  },
  zh: {
    title: "新篇章等待着你 ✨",
    body: "有一本新有声书。点击打开 Magic World。",
  },
  hi: {
    title: "नया अध्याय आपका इंतज़ार कर रहा है ✨",
    body: "नई ऑडियोबुक तैयार है। Magic World खोलने के लिए टैप करें।",
  },
  ar: {
    title: "فصل جديد بانتظارك ✨",
    body: "كتاب صوتي جديد جاهز. اضغط لفتح Magic World.",
  },
};

// ============================================================
// Envio
// ============================================================

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: "default";
};

/**
 * Envia em lotes de 100 (limite da Expo push API). Retorna a lista
 * de resultados. Não faz retry — se um lote falhar, log e segue.
 */
async function sendBatch(messages: ExpoMessage[]) {
  const CHUNK_SIZE = 100;
  let totalSent = 0;
  let totalFailed = 0;

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });
      const data = await res.json();

      // A Expo devolve `data: [{ status: "ok" | "error", ... }]`
      if (Array.isArray(data?.data)) {
        for (const r of data.data) {
          if (r?.status === "ok") totalSent += 1;
          else totalFailed += 1;
        }
      }
      // eslint-disable-next-line no-console
      console.log(
        `Lote ${Math.floor(i / CHUNK_SIZE) + 1}: ${chunk.length} devices — resposta:`,
        data,
      );
    } catch (err) {
      totalFailed += chunk.length;
      // eslint-disable-next-line no-console
      console.error("Erro ao enviar lote:", err);
    }
  }

  return { totalSent, totalFailed };
}

async function sendUpdatePush() {
  const snapshot = await getDocs(collection(db, "push_tokens"));

  const messages: ExpoMessage[] = [];
  let skippedNoToken = 0;
  let skippedVersion = 0;

  for (const docSnap of snapshot.docs) {
    const u = docSnap.data();

    if (!u?.token || typeof u.token !== "string") {
      skippedNoToken += 1;
      continue;
    }

    // Filtro opcional por versão do app (mesmo comportamento do
    // script original).
    if (TARGET_VERSION && u.appVersion === TARGET_VERSION) {
      skippedVersion += 1;
      continue;
    }

    // Escolhe conteúdo pelo locale gravado. Fallback pra `en`.
    const locale = typeof u.locale === "string" ? u.locale : "en";
    const content = CONTENT[locale] ?? CONTENT.en;

    messages.push({
      to: u.token,
      title: content.title,
      body: content.body,
      data: { ...DATA_PAYLOAD },
      sound: "default",
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Total docs: ${snapshot.size} | mensagens: ${messages.length} | pulados (sem token): ${skippedNoToken} | pulados (mesma versão): ${skippedVersion}`,
  );

  const { totalSent, totalFailed } = await sendBatch(messages);

  // eslint-disable-next-line no-console
  console.log(
    `\n✅ Concluído. Enviadas: ${totalSent} | Falhas: ${totalFailed}`,
  );
}

sendUpdatePush().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal:", err);
  process.exit(1);
});
