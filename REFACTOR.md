# Magic World — refactor v3.0

Este documento cobre o que mudou nesta versão do projeto, como
rodar a partir daqui, e o que ainda tem pra fazer.

---

## TL;DR

- LLM migrado de Gemini direto pra **OpenRouter** via
  `services/ai.ts` (usa o SDK `openai` já instalado).
- **Design system** com tokens semânticos (`constants/tokens.ts`)
  e dois componentes de UI reutilizáveis: `Button` e `Text`.
- Telas mais visíveis refatoradas: **onboarding, home, subscribe,
  games, categories, favorite**. As telas de jogo (endless-runner,
  platformer, memory-game) e o profile ficaram pra próxima fatia.
- Chave OpenRouter compartilhada em chat **foi rotacionada?**
  Se não, faça agora em
  https://openrouter.ai/settings/keys

---

## Setup

1. Copia o env de exemplo:
   ```bash
   cp .env.example .env
   ```

2. Preenche o `.env`:
   ```dotenv
   EXPO_PUBLIC_OPENROUTER_API_KEY=sk-or-v1-...
   EXPO_PUBLIC_GOOGLE_API_KEY=...  # opcional, só se rodar o seed de imagens
   ```

3. Instala as deps (já usa `bun.lock`, mas npm/yarn também rodam):
   ```bash
   bun install
   # ou: npm install
   ```

4. Roda:
   ```bash
   bun run ios      # ou: npm run ios
   ```

Nenhuma nova dependência foi adicionada — `openai` já estava
listada em `package.json` (linha ~57) e agora é usada de verdade
via `services/ai.ts`. `@google/generative-ai` continua no
projeto porque `generateStory` (o seed manual da home) usa
Nano Banana pra imagens; se você remover essa função no futuro,
dá pra remover o pacote também.

---

## Segurança da chave

`EXPO_PUBLIC_OPENROUTER_API_KEY` vira parte do bundle do app.
Consequência: quem baixar o IPA/APK e desempacotar vê a chave.
Isso é o mesmo comportamento da `EXPO_PUBLIC_GOOGLE_API_KEY`
que você já usava — não piorou nada, mas vale ter consciência.

Mitigação imediata (5 min):
- Defina **limite de gasto mensal** em
  https://openrouter.ai/settings/limits
- Rotacione a chave a cada 30-60 dias.

Mitigação séria (1-2 dias):
- Move o `services/ai.ts` pra um handler no seu Fastify.
- No app, troca `baseURL` de `openrouter.ai/api/v1` pra
  `api.seu-dominio.com/ai` e remove `apiKey` do lado do cliente.
- O proxy assina os requests com a chave real do servidor.
- Adiciona rate limit por device / anonymous user ID.
- Deixei um `TODO(proxy)` marcado em `services/ai.ts` no
  ponto exato onde essa troca acontece.

---

## O que mudou, arquivo por arquivo

### Fundação nova

| Arquivo | O que é |
|---|---|
| `.env.example` | Modelo de env sem chaves reais. |
| `constants/tokens.ts` | Design tokens (cor, spacing, radius, tipografia, sombra, motion). Fonte única de verdade. |
| `constants/theme.ts` | Refatorado como camada de compat — `Colors.dark.background` continua funcionando, mas por baixo puxa de `tokens`. |
| `hooks/use-tokens.ts` | `useThemedTokens()` retorna tokens já resolvidos pro color scheme atual. |
| `services/ai.ts` | Abstração OpenRouter. `generateText`, `generateJSON<T>`, `translateText`, retry com backoff exponencial + jitter, timeout, AbortSignal. |
| `components/ui/Button/index.tsx` | Botão do DS: 4 variants (primary/secondary/ghost/danger), 3 sizes (sm/md/lg), loading, ícones, disabled com alpha. |
| `components/ui/Text/index.tsx` | Componente tipográfico com nova API (`variant`/`size`/`weight`) e compat com API antiga (`title`/`fontFamily`/`fontSize`). |

### Compat / migração

| Arquivo | O que aconteceu |
|---|---|
| `components/text/index.tsx` | Virou re-export de `@/components/ui/Text`. Todos os ~40 imports antigos continuam funcionando sem tocar. |
| `components/button/` | Removido (era um `return <></>` vazio). Substituto real em `@/components/ui/Button`. |

### Telas refatoradas com tokens + DS

| Tela | Mudou |
|---|---|
| `app/(app)/index.tsx` (onboarding) | Usa Button do DS, tokens em tudo, cor de fundo removida do inline. |
| `app/(subscribe)/index.tsx` (paywall) | Reescrito. Zero hex hardcoded. Usa Button size=lg. |
| `app/(tabs)/games.tsx` | Objeto `theme` local removido. Accent colors dos games agora vêm de `palette`. |
| `app/(tabs)/index.tsx` (home) | Imports + styles. Section title e container usam tokens. |
| `app/(tabs)/favorite.tsx` | Imports + styles. |
| `app/(tabs)/_layout.tsx` | Tokens em vez de `Colors.light.tint`. |
| `app/(categories)/index.tsx` | Tokens em spacing e cores. |
| `components/card/` | Badge PRO, gradient e favorite usam tokens. |

### LLM

| Arquivo | O que mudou |
|---|---|
| `app/(quiz)/index.tsx` | `fetchQuestions` usa `generateJSON<QuizQuestion[]>` com validação de shape. |
| `app/(storie)/index.tsx` | 3 usos migrados: tradução (`aiTranslate`), branch options no cap 2 (`generateJSON`), cap 3 final (`generateJSON`). Wrapper local `translateText` mantém o Alert de fallback. |
| `app/(tabs)/index.tsx` | `generateStory` usa `generateJSON` pra texto. Gemini mantido só pra imagem (Nano Banana no seed manual). |

---

## API do `services/ai.ts`

```ts
import { generateText, generateJSON, translateText, MODELS } from "@/services/ai";

// Texto livre
const answer = await generateText("Explica o que é entropia pra uma criança", {
  model: "smart",              // ou "fast" | "cheap" | id específico
  temperature: 0.7,
  system: "Você fala português brasileiro casual.",
  maxTokens: 500,
  timeoutMs: 30_000,
  maxAttempts: 3,
});

// JSON estruturado com validação
type Question = { q: string; options: string[]; answer: string };

const questions = await generateJSON<Question[]>(prompt, {
  model: "fast",
  validate: (v): v is Question[] =>
    Array.isArray(v) && v.every(q => typeof q.q === "string"),
});

// Tradução (atalho)
const translated = await translateText("Hello world", "pt");
```

**Retry policy**: 3 tentativas por padrão, backoff exponencial
com jitter (400ms, 1s, 2.4s). Retenta em 408, 429, 5xx e erros
de rede. Não retenta em 4xx cliente (400, 401, 403, 404).

**Aliases de modelo** (edite em `services/ai.ts`):
- `MODELS.fast` → `google/gemini-2.5-flash` (default)
- `MODELS.smart` → `google/gemini-2.5-flash` (troque pra Claude/GPT se quiser)
- `MODELS.cheap` → `openai/gpt-4o-mini`

---

## Design tokens — cheat sheet

```ts
import { tokens } from "@/constants/tokens";
import { useThemedTokens } from "@/hooks/use-tokens";

// Componente que reage a light/dark
function MyView() {
  const t = useThemedTokens();
  return (
    <View style={{
      backgroundColor: t.color.bg,
      padding: t.spacing.lg,
      borderRadius: t.radius.xl,
    }}>
      <Text variant="heading" color={t.color.textPrimary}>Olá</Text>
    </View>
  );
}

// Uso estático (sempre dark) — pra places onde não precisa reagir
const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.dark.surface,
    padding: tokens.spacing.md,
  },
});
```

**Cores semânticas disponíveis** (dark scheme):
- Superfícies: `bg`, `surface`, `surfaceAlt`, `surfaceInverse`
- Texto: `textPrimary`, `textSecondary`, `textMuted`, `textInverse`, `textOnBrand`
- Borda: `border`, `borderStrong`
- Brand: `brand`, `brandHover`, `brandActive`, `brandSubtle`
- Feedback: `danger`, `success`, `warning`
- Overlay: `overlay`, `overlayStrong`

**Spacing** (múltiplos de 4): `xxxs`(2) `xxs`(4) `xs`(8) `sm`(12) `md`(16) `lg`(24) `xl`(32) `xxl`(40) `xxxl`(64)

**Radius**: `xs`(4) `sm`(8) `md`(12) `lg`(16) `xl`(20) `xxl`(24) `pill`(999) `circle`(9999)

**Font sizes**: `xs`(12) `sm`(14) `md`(16) `lg`(18) `xl`(20) `xxl`(24) `xxxl`(28) `display`(32) `hero`(40)

---

## Componentes de UI

### Button

```tsx
<Button label="Subscribe Now" size="lg" fullWidth onPress={handlePress} />
<Button label="Cancel" variant="ghost" size="md" />
<Button label="Delete" variant="danger" loading={isDeleting} />
<Button label="Learn more" variant="secondary" rightIcon={<ChevronRight />} />
```

### Text

Nova API (preferida):
```tsx
<Text variant="display">Título grande</Text>
<Text variant="heading" size="xxl">Subtítulo</Text>
<Text variant="body" color={t.color.textSecondary}>Corpo</Text>
<Text variant="caption">Legenda</Text>
```

API antiga (ainda funciona, sem migração forçada):
```tsx
<Text title="Título" fontFamily="bold" fontSize={24} color="#fff" />
```

O parser de `**bold**` inline continua funcionando na API antiga
por compat com strings salvas no Firestore.

---

## O que ficou para depois

Ordem sugerida das próximas fatias:

**Fatia 2 — telas informativas (baixo risco)**
- `app/(privacy-policy)/index.tsx`
- `app/(terms-eula)/index.tsx`
- `app/(profile-adventure)/index.tsx`
- `app/(profile-result-adventure)/index.tsx`

**Fatia 3 — profile (grande, mas contido)**
- `app/(tabs)/profile.tsx` (790 linhas) — só cores/spacing pra tokens, sem mexer na lógica.

**Fatia 4 — jogos (arriscado, mexe em gameplay)**
- `app/(endless-runner)/index.tsx` (689 linhas)
- `app/(platformer-adventure)/index.tsx` (723 linhas)
- `app/(memory-game)/index.tsx`
- `app/(quiz)/index.tsx` (parte visual — a lógica já foi refatorada)
- `app/(storie)/index.tsx` (parte visual — 1066 linhas, cuidado)

**Housekeeping (a qualquer momento)**
- Sincroniza `firebaseConfig.js` — o projeto ainda se chama
  `spotify-app-b4f9d` (leftover). Renomear no console do Firebase
  ou migrar pra project novo dedicado ao Magic World.
- Auditar assets pesados: `assets/models/*.glb` tem 150MB em
  3 arquivos (planet_of_phoenix, asteroid_low_poly, dark_armor).
  Se são sobras da fase adventure/platformer, sai do bundle.
- Adicionar teste smoke pro `services/ai.ts` (mock do fetch).
- Considerar mover LLM pro Fastify (ver seção "Segurança da chave").

---

## Checklist antes de subir pra loja

- [ ] `.env` preenchido com chave OpenRouter rotacionada
- [ ] Limite de gasto configurado em https://openrouter.ai/settings/limits
- [ ] Testado o quiz gerando 5 perguntas
- [ ] Testado tradução de 2 idiomas na tela de story
- [ ] Testado geração de escolhas ramificadas no cap 2
- [ ] Testado paywall (mensal + anual) com sandbox da Apple
- [ ] `expo prebuild --clean` roda sem erro
- [ ] `expo run:ios --configuration Release` builda
- [ ] Screenshots atualizadas (o visual do subscribe mudou)

---

## Fix do build iOS (Xcode 26.4+ / Apple Clang 21)

**Sintoma:** ao rodar `bun run ios` você vê:

```
ios/Pods/fmt/include/fmt/format-inl.h:59:24
call to consteval function 'fmt::basic_format_string<...>' is not a constant expression
```

E mais 4 erros similares em linhas 60, 1387, 1391, 1394.

**Causa:** fmt 11.0.2 (bundled via RCT-Folly no RN 0.81) usa
`FMT_STRING(...)` de um jeito que Apple Clang 21 (que veio com
Xcode 26.4) recusa. Fix upstream chegou em fmt 12.1.0, que só
entra em RN ≥ 0.83.9 / Expo SDK 56.

**Fix aplicado neste refactor:**

- Novo plugin `plugin/withFmtConstevalFix.js` — compila os pods
  `fmt` e `RCT-Folly` em C++17 e adiciona `FMT_USE_CONSTEVAL=0`
  no preprocessor. Idempotente, sobrevive a `expo prebuild --clean`.
  Escrito em CommonJS puro porque é o formato que o Expo espera
  pra config plugins locais (não usa ts-node).
- `app.config.js` — plugin registrado ao lado de `expo-router`.

**Como aplicar depois de extrair o zip:**

```bash
cd ios && rm -rf Pods Podfile.lock build && cd ..
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
bun run ios --device
```

**Como remover** (quando migrar pra Expo SDK 56+): tira a
linha `"./plugin/withFmtConstevalFix"` de `app.config.js`,
roda `expo prebuild --clean` e deleta o arquivo do plugin.

Referências: facebook/react-native#55601, expo/expo#44229, fmtlib/fmt#4740.

---

## Substituição do `expo-glass-effect` por `expo-blur`

**Sintoma:** ao rodar `bun run ios` você vê:

```
node_modules/expo-glass-effect/ios/GlassContainer.swift:49:24
method does not override any method from its superclass
```

Em `mountChildComponentView`, `unmountChildComponentView`, tanto em
`GlassContainer.swift` quanto em `GlassView.swift`.

**Causa:** `expo-glass-effect@0.1.8` foi atualizada em set/2025
(PR expo/expo#39595) pra usar overrides de Fabric
(`mountChildComponentView` / `unmountChildComponentView`) que só
existem quando `newArchEnabled: true`. O projeto está em old arch
(`newArchEnabled: false` em `app.config.js`), então os overrides
não encontram método na superclass e o build quebra.

**Fix aplicado neste refactor:**

- Novo componente `components/ui/Glass/index.tsx` — wrapper sobre
  `BlurView` de `expo-blur` (já instalado, `^15.0.8`) com API
  compatível com `GlassView`. Aceita as mesmas props (`style`,
  `isInteractive`, `glassEffectStyle`, `intensity`).
- Substituídos 6 imports em: `(completed-chapter)`, `(storie)`,
  `(categories-detail)`, `(quiz)`, `(categories)`, `(memory-game)`.
- Removido `expo-glass-effect` do `package.json`.

**Diferença visual:** `expo-glass-effect` é o "liquid glass" novo
do iOS 26 (com highlights dinâmicos). `expo-blur` é o blur
clássico do iOS (UIVisualEffectView). Pra chips, botões
circulares e modais que o app usa, a diferença é sutil.

**Como reverter** (quando migrar pra New Architecture):

1. Adiciona `expo-glass-effect` de volta ao `package.json`.
2. Edita `components/ui/Glass/index.tsx` pra usar `GlassView`
   internamente (a API já é compatível, só troca o interior).
3. Não precisa mexer em nenhuma das 6 telas.

**Passos depois de extrair o zip:**

```bash
# Remove os artifacts antigos com expo-glass-effect
rm -rf node_modules ios/Pods ios/Podfile.lock ios/build
bun install
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
bun run ios --device
```

---

## Limpeza de dead code (v3.5)

**Contexto:** o erro `Unable to resolve "../../../assets/texture/moon.jpg"` no
Metro apontou pra código legado dos jogos 3D que referenciavam assets grandes
sem que os jogos fossem realmente parte do fluxo principal do app (Magic World
é posicionado como audiobook infantil, não como plataforma de mini-games 3D).

### Rotas removidas

- `app/(platformer-adventure)/` — Knight's Quest. Usava `three`, `@react-three/fiber`,
  `expo-three`, `expo-gl` + GLBs pesados (espadas, robôs).
- `app/(endless-runner)/` — Space Runner. Usava GLBs de 50MB cada
  (planet_of_phoenix, asteroid_low_poly).
- `app/(runner-kart)/` — já era stub vazio, estava comentado no games.tsx.

### Componentes / utils removidos

- `components/(joysticky-control)/` — só usado no platformer.
- `components/(achievements-details)/` — 0 importadores.
- `utils/addCraters.ts`, `utils/getDeviceId.ts`, `utils/globals.ts` — 0 importadores.
- `helpers/shuffleArray.ts` — 0 importadores. Diretório removido.
- `hooks/use-theme-color.ts` — 0 importadores após tokens virarem primary.
- `services/getUserKey.ts`, `services/savePushToken.ts` — 0 importadores.
- `TrackPlayerService.ts` na raiz — duplicata órfã de `services/trackPlayer.ts`.
- `@types/glb.d.ts` — declaração de tipo pra `.glb`, sem imports depois da limpeza.
- `plugin/withUnity.ts` — arquivo vazio (0 bytes) desde o início.

### Deps removidas de `package.json`

- `three` (2MB)
- `three-stdlib` (600KB)
- `@react-three/fiber`, `@react-three/drei`
- `@types/three` (devDep)
- `expo-three`, `expo-gl`
- `expo-screen-orientation` (só era usado pra trancar landscape do platformer)
- `create-expo-module` (era dep de dev pra criar novos módulos)
- `expo-glass-effect` (removido na v3.4, substituído por wrapper sobre `expo-blur`)

Redução estimada de bundle: ~5–7MB comprimido, ~150MB de assets removidos.

### Imports órfãos limpos

- `app/(tabs)/index.tsx` — removidos `addDoc`, `collection`, `getDocs`,
  `serverTimestamp`, `setDoc`, `useMutation`, `useQueryClient`, `StoreReview`
  (só apareciam em bloco comentado do seed manual).
- `app/(storie)/index.tsx` — removidos `Application` (expo-application),
  `getUserKey`, constante `SAFE_MARGIN`.

### Games.tsx atualizado

Restam **2 jogos leves**:
- Quiz Master (`quiz`) — perguntas geradas via OpenRouter
- Memory Match (`memory-game`) — jogo de memória local

### Ação necessária na extração

⚠️ Este zip **não inclui** `assets/sounds/*.mp3` (background tracks) —
eles são grandes e não mudaram no refactor. Ao extrair:

```bash
# Extração que preserva os sons locais:
unzip -o Magic-World-refactor-v3.5.zip
# (o -o sobrescreve arquivos, mas não deleta os que não estão no zip)
```

Se você fez `rm -rf` do projeto antes de extrair, precisa restaurar
`assets/sounds/` do git ou de backup, senão o `constants/backgroundTracks.ts`
não vai conseguir resolver os requires e a tela de story quebra.

### Runtime — `expo-application` removido

**Sintoma:** ao rodar o app depois de fazer prebuild, dev-mode quebrava
com `Error: Cannot find native module 'ExpoApplication'`.

**Causa:** `useAdventureProfileStore.ts` e `useMagicProgressStore.ts`
importavam `expo-application` mas essa dep **nunca esteve** no
`package.json` original — só que essas stores eram carregadas lazy
e ninguém tinha esbarrado no bug antes do fluxo de onboarding rodar
sob teste de device.

**Fix:** trocar `Application.getIosIdForVendorAsync()` por
`getAnonymousUserId()` de `utils/anonymousUser.ts`, que já existia
no projeto e:
- Funciona no Android também (não é iOS-only)
- Não depende de nenhuma dep nativa extra
- Persiste via AsyncStorage com UUID gerado por `expo-crypto`
- Sobrevive a reinstalações do app (o que o `IDFV` do vendor não faz)

### `_layout.tsx` simplificado

Removidas `Stack.Screen` órfãs (`(profile)/index` não existe), e
substituídas ~12 declarações repetidas de `headerShown: false` por
um `screenOptions` global no `<Stack>`. O expo-router v6 detecta as
rotas automaticamente via file-based routing — só precisamos declarar
`Stack.Screen` quando queremos customizar options por rota.

### `(categories)/index.tsx` — VirtualizedList em ScrollView

Warning "VirtualizedLists should never be nested inside plain ScrollViews"
resolvido movendo o header pra `ListHeaderComponent` do `FlatList` em
vez de envelopar o FlatList num ScrollView externo. Deletado o
`Container` (styled ScrollView) que virou órfão.

### Imports órfãos de `React`

6 arquivos importavam `import React from "react"` sem usar `React.X`.
Com `reactCompiler: true` no `app.config.js` (novo JSX transform),
esses imports são bloat. Removidos.

### Runtime — `@expo/ui/swift-ui` removido (v3.8)

**Sintoma:** botão de menu de contexto no `(storie)` renderizava
como quadrado vermelho grande sobrepondo o header. Screenshot em
device confirmou.

**Causa:** `@expo/ui/swift-ui` é uma biblioteca de wrappers React
Native pra componentes SwiftUI nativos. Ela **requer Fabric/New
Architecture** pra montar as views. O projeto está com
`newArchEnabled: false`, então o `Host` do pacote renderiza um
placeholder vermelho de debug indicando "não consegui montar".

Componentes afetados:
- `app/(storie)/index.tsx` — usava `ContextMenu`, `Host`, `Picker`
  pra dropdown de Translate + Ambient Sound
- `components/card-skeleton/index.tsx` — importava `border` de
  `@expo/ui/swift-ui/modifiers` mas nunca usava (import morto)

**Fix aplicado:**

- Novo `components/ui/MenuSheet/index.tsx` — bottom action sheet
  reutilizável usando `Modal` do RN (funciona em old + new arch,
  iOS + Android, sem deps externas). API declarativa com múltiplas
  seções.
- `(storie)/index.tsx` — `renderContextMenu` (que retornava
  `Host/ContextMenu/Picker`) virou `renderContextMenuTrigger`
  (que retorna só o botão do ellipsis-vertical). O menu completo
  virou um `<MenuSheet>` renderizado no fim do JSX, disparado por
  state `showMenuSheet`.
- `card-skeleton/` — import morto removido.
- `@expo/ui` removido do `package.json`.

---

## Métricas do refactor

- **40+ cores hex hardcoded** → **~5** (as que sobraram estão nas
  telas de jogo e no profile, fatias 3 e 4).
- **`components/button` que era `return <></>`** → substituído por
  componente real com 4 variants × 3 sizes.
- **3 instâncias `new GoogleGenerativeAI(...)` copy-paste** → 1
  serviço central com retry, timeout e tipagem.
- **Divergência de versão** (app.config 3.0.0 vs package 2.0.0) →
  sincronizado em 3.0.0.
