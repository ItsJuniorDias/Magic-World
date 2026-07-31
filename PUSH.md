# Magic World — Push Notifications

Sistema completo de push + lembretes locais, integrado com i18n.

## O que foi feito

### Arquivos novos

- **`services/notifications.ts`** — camada única de push + agendamento local
  - `registerForPushNotificationsAsync({ entitlement })` — pede permissão, obtém Expo Push Token, grava em Firestore
  - `updatePushLocale(locale)` — sincroniza troca de idioma no doc do device
  - `scheduleBedtimeReminder(enabled, hour)` — lembrete diário às 19h (padrão)
  - `scheduleStreakReminder(enabled, hour)` — lembrete diário às 20h (padrão)
  - `refreshLocalRemindersLocale(prefs)` — reagenda com strings no idioma atual
  - `cancelAllScheduled()` — reset total
  - Foreground handler configurado (banner + som, sem badge)

- **`store/useNotificationsStore.ts`** — Zustand + AsyncStorage
  - `bedtimeEnabled`, `streakEnabled` — toggles
  - `registered` — se já rodou fluxo de permissão
  - `permissionStatus` — resultado do último `getPermissions`
  - `hydrate()`, `setBedtimeEnabled()`, `setStreakEnabled()`, `setRegistered()`
  - Side-effects de agendamento embutidos nos setters

- **`hooks/useNotifications.ts`** — bootstrap no boot do app
  - Re-registro do token se já tinha permissão
  - Reagendamento dos locais no idioma atual
  - Listener global de TAP → deep linking
  - Cold start: se o app foi aberto via tap, roteia automaticamente

### Modificações

- **`package.json`** — deps adicionadas
  ```json
  "expo-notifications": "~0.32.11"
  "expo-application": "~7.0.7"
  ```

- **`app.config.js`** — plugin `expo-notifications` com icon + accent color

- **`app/_layout.tsx`** — chamada de `useNotifications()` via wrapper `AppBootstrap`, executado após i18n estar pronto

- **`app/(tabs)/profile.tsx`** — nova seção "Notificações" com 2 toggles (bedtime + streak), fluxo de permissão integrado com Alert de fallback pros Ajustes se o usuário negar

- **`components/LanguageSelector/index.tsx`** — troca de idioma agora sincroniza `locale` no Firestore se o device já registrou push

- **`i18n/locales/*.ts`** — nova seção `notifications` com 12 chaves por idioma (labels dos toggles, textos das notifs locais, mensagens de erro de permissão)

- **`scripts/sendUpdatePush.ts`** — reescrito:
  - Envia em lotes de 100 (limite Expo)
  - Escolhe título/corpo por `locale` do doc (7 idiomas)
  - Filtro opcional por `appVersion`
  - Deep linking via campo `data`
  - Contadores de sucesso/falha

## Schema do Firestore

Collection: `push_tokens/{deviceId}`

```ts
{
  token: string          // ExponentPushToken[xxxxxxx]
  deviceId: string       // Android ID ou iOS IdentifierForVendor
  platform: "ios" | "android"
  locale: "en" | "pt" | "es" | "fr" | "zh" | "hi" | "ar"
  entitlement: boolean   // é assinante RC ou não
  appVersion: string
  updatedAt: Timestamp
}
```

O `deviceId` é o docId — evita duplicatas em reinstalação (usa `Application.getAndroidId()` ou `getIosIdForVendorAsync()`).

## Fluxo do usuário

1. **Primeiro boot** → nada acontece. O app NÃO pede permissão automaticamente. Isso é intencional: evita queimar o "primeira impressão" e melhora aprovação na Apple review.
2. **Usuário vai em Profile > Notificações** e liga o toggle "Lembrete de leitura"
3. → App pede permissão do OS
4. → Se autoriza: token é obtido, salvo no Firestore, e o lembrete de 19h é agendado. Store persiste `bedtimeEnabled: true`
5. → Se nega: Alert oferece ir pros Ajustes (`Linking.openSettings()`)
6. **Próximos boots** → hook re-verifica o status. Se o usuário revogou nos Ajustes, o toggle volta pra off silenciosamente
7. **Trocou de idioma** → `LanguageSelector` chama `updatePushLocale()` no Firestore + o hook detecta a mudança e reagenda os lembretes locais no novo idioma

## Deep linking

O campo `data` no payload da notificação define pra onde ir:

```ts
{ screen: "home" }       // -> /(tabs)
{ screen: "paywall" }    // -> /(subscribe)
{ screen: "storie", storyId: "abc", title: "...", storie: "...",
  thumbnail: "...", currentIndex: 0 }
                          // -> /(storie) com params
```

Payload malformado cai silenciosamente pra `/(tabs)` — não crashamos.

## Envio de push (backend)

O script `scripts/sendUpdatePush.ts` já está pronto pra usar. Rode com:

```bash
bun scripts/sendUpdatePush.ts
```

Edite antes:

```ts
const TARGET_VERSION = "3.1.0";        // null = todo mundo
const DATA_PAYLOAD = { screen: "paywall", campaign: "black_friday" };
const CONTENT = {
  en: { title: "...", body: "..." },
  pt: { title: "...", body: "..." },
  // ...
};
```

O script:
1. Lê todos os docs de `push_tokens`
2. Escolhe `content[u.locale]` (fallback `en` se locale desconhecido)
3. Envia em lotes de 100 pra `exp.host/--/api/v2/push/send`
4. Loga sucesso/falha por lote

## Textos das notificações (por idioma)

Bedtime reminder (19h):
- 🇬🇧 "Bedtime, story time ✨" · "Tap to open tonight's magical audiobook."
- 🇧🇷 "Hora de dormir, hora de histórias ✨" · "Toque pra abrir o audiolivro mágico de hoje."
- 🇪🇸 "Hora de dormir, hora de cuentos ✨" · "Toca para abrir el audiolibro mágico de hoy."
- 🇫🇷 "L'heure de l'histoire ✨" · "Appuie pour ouvrir l'audiolivre magique du soir."
- 🇨🇳 "睡觉前的故事时光 ✨" · "点击打开今晚的魔法有声书。"
- 🇮🇳 "सोने का समय, कहानी का समय ✨" · "आज रात की जादुई ऑडियोबुक खोलने के लिए टैप करें।"
- 🇸🇦 "وقت النوم، وقت القصة ✨" · "اضغط لفتح الكتاب الصوتي السحري لهذه الليلة."

Streak reminder (20h):
- 🇬🇧 "One story a day 📚" · "Keep your reading streak alive — a chapter is all it takes."
- 🇧🇷 "Uma história por dia 📚" · "Mantenha sua sequência viva — um capítulo já basta."
- (idem pros outros idiomas)

## Decisões técnicas

### Por que Expo Push Token e não FCM/APNs direto?

- Já está tudo integrado no SDK, zero config nativa
- Um único endpoint (`exp.host/--/api/v2/push/send`) pros dois OS
- Token estável entre reinstalações (via `deviceId`)
- Se um dia quiser sair pra FCM direto, a migração é trocar o campo `token` (Expo dá `getDevicePushTokenAsync()` também)

### Por que não pedir permissão no primeiro boot?

- Melhora conversão de permissão (usuário só vê o prompt quando já está no toggle, com contexto)
- Reduz risco de rejeição na Apple review (guideline 4.5.4 — sem push spam)
- Evita queimar o slot único de permissão do OS

### Como funciona o streak reminder localmente?

Ele agenda um push diário fixo às 20h. Ele NÃO sabe se o usuário abriu o app hoje — dispara sempre. Trade-off aceito:
- Pior UX: usuário que leu hoje recebe "não esqueça de ler" — chato
- Pior UX alternativa: usuário que esqueceu não recebe nada — perde sequência

Escolhemos o primeiro porque é o menos custoso. Se virar problema, dá pra mover pro backend via Cloud Function que só dispara se `lastReadAt < today`.

### RTL e árabe

O texto árabe é RTL-correct. O OS renderiza corretamente porque é conteúdo do usuário, não layout. Sem cuidados especiais aqui.

### Segurança

`push_tokens` só armazena token + metadata. Nenhum PII. Se um token vazar, o pior que acontece é alguém mandar push spam pra aquele device — e o Apple/Google vão banir o projectId rapidamente.

## O que não foi feito (intencional)

- **Segmentação por engajamento** — se quiser mandar push só pra "usuários ativos últimos 7 dias", precisa gravar `lastActiveAt` no doc. Fica pra depois.
- **A/B test de mensagens** — o script não sorteia variantes. Adicione manualmente se precisar.
- **Push agendado no backend** — só locais no device. Se quiser push global às 18h "toda quinta", precisa Cloud Function + Cloud Scheduler.
- **Rich media** (imagem no push) — Expo suporta via `mutableContent`, mas requer setup extra de Notification Service Extension no iOS. Fora do escopo.
- **Preferência de horário** — bedtime é fixo em 19h. Se quiser deixar configurável, adiciona um picker no Profile e passa a `hour` pra `scheduleBedtimeReminder()`.

## Como testar

**Local (bedtime/streak):**
1. Instala no device real
2. Vai em Profile > Notificações
3. Liga "Lembrete de leitura"
4. Autoriza permissão
5. Muda o horário do device pra 18:59
6. Aguarda 1 min → notif aparece

**Remoto (via script):**
1. Instala no device real, liga um toggle (isso registra o token)
2. Confere no Firebase Console que o doc apareceu em `push_tokens`
3. Edita `scripts/sendUpdatePush.ts` com o conteúdo desejado
4. Roda `bun scripts/sendUpdatePush.ts`
5. Push chega no device
6. Toca no push → app abre na tela do `data.screen`

**Testar deep linking sem servidor:**
```ts
// Em qualquer tela, temporariamente:
import * as Notifications from "expo-notifications";
Notifications.scheduleNotificationAsync({
  content: {
    title: "Teste",
    body: "Toque pra abrir o paywall",
    data: { screen: "paywall" },
  },
  trigger: { seconds: 5 },
});
```
