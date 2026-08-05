# Magic World — suporte a árabe nas histórias

Refactor mínimo pra habilitar árabe (`ar`) no fluxo de leitura de histórias, sem breaking change em nenhum dos outros 6 idiomas. Foco: destravar o mercado MENA (Iraque, Egito, Arábia Saudita, Marrocos, UAE, Argélia) que hoje instala o app via ASA mas recebe UI em inglês e não converte.

## Contexto

Análise de ASA de 01/08 mostrou 10 installs do Iraque em 1 dia a CPI $1,87. Sem árabe funcional na tela de história, esses installs abrem, veem inglês, e a conversão em trial start fica próxima de zero. O i18n do app já tinha `ar.ts` pronto desde a Mensagem 1 do refactor grande (ver `I18N.md`), mas a tela `(storie)` e o componente `Text` não sabiam lidar com o conteúdo em árabe:

1. Menu de tradução não oferecia árabe como alvo
2. TTS não tinha mapeamento pro locale `ar-SA`
3. Split de sentenças ignorava o ponto de interrogação árabe `؟`
4. Renderização era sempre LTR, mesmo com texto RTL
5. Fonte `ComicRelief` não tem glifos árabes → renderiza tofu (□)

## O que foi feito

### Infra nova

- **`helpers/textDirection.ts`** — utilitários determinísticos multi-script:
  - `isRTLText(text)` — detecção via ranges Unicode (árabe, hebraico, siriaco, thaana)
  - `getWritingDirection(text)` — devolve `'ltr'`/`'rtl'` pronto pra style
  - `getFontFamilyForText(text, custom)` — devolve a fonte custom pra latino, `undefined` pra scripts que precisam de system font (árabe/CJK/devanagari)
  - `splitIntoSentences(text)` — split que respeita `.!?` (latino), `؟؛` (árabe), `।॥` (hindi), `。！？` (CJK)
  - `resolveSpeechLanguage(code)` — mapeia ISO 639-3 do `franc-min` (e códigos curtos do i18n) pro BCP-47 do `expo-speech`. Cobre todos os 7 idiomas + fallback `en-US`.

### Telas refatoradas

- **`app/(storie)/index.tsx`**
  - Imports do novo helper substituindo o mapa de idiomas hardcoded e o split inline de sentenças
  - `languageLabels` e `languageCodes` agora incluem `"Arabic"` / `"ar"` (posicionado logo depois de English por peso de mercado MENA)
  - TTS: usa `resolveSpeechLanguage()` no lugar do map literal `{eng: "en-US", ...}` — automaticamente ganha `ar-SA` quando o `franc` detecta `arb`/`ara`
  - Título e sentenças ganham `writingDirection` + `textAlign` derivados do conteúdo (não do locale da UI, importante quando UI é EN e o usuário traduziu a história pra AR)
  - Fonte do título e das sentenças usa `getFontFamilyForText()` — cai no system font quando o texto é não-latino

### Componentes refatorados

- **`components/ui/Text/index.tsx`** — nova prop `autoDirection?: boolean` (default `false`, opt-in):
  - Detecta RTL no `children` (caminho novo) ou `title` (caminho legado) e aplica direção + alinhamento
  - Troca a fonte pra system font quando o texto é não-latino
  - Cobre também o parser inline de `**bold**` (mantém consistência de família dentro do mesmo texto)
  - Default `false` porque rodar regex em cada render de texto tem custo em ScrollViews densos, e a maior parte dos consumidores é label estático do i18n (que já vem com fonte adequada por design)

## Como usar

**Conteúdo dinâmico (Firestore, IA, tradução):**

```tsx
<Text autoDirection variant="body">
  {story.title}   {/* pode vir em qualquer idioma */}
</Text>
```

**Label estático do i18n (não precisa):**

```tsx
<Text variant="heading">{t("home.mostWatched")}</Text>
```

**Dentro do storie (já feito):**

```tsx
{sentences.map((sentence, index) => (
  <Text
    fontFamily="regular"
    fontSize={16}
    title={sentence}
    style={{
      writingDirection: isRTLText(sentence) ? "rtl" : "ltr",
      textAlign: isRTLText(sentence) ? "right" : "left",
      fontFamily: getFontFamilyForText(sentence, "ComicReliefRegular"),
    }}
  />
))}
```

## O que **não** foi tocado (intencional)

- **`I18nManager.forceRTL(true)`** — continua sem chamar, pelas razões descritas em `I18N.md`. O RTL é aplicado por texto, não globalmente no app. Vantagem: nenhum layout LTR quebra. Desvantagem: barra de progresso, ícones direcionais (chevron-left do back button) continuam LTR mesmo em árabe. Aceitável pra um V1 — o essencial é o texto da história ficar legível.
- **Fontes árabes dedicadas** — não adicionamos `NotoSansArabic-*.ttf` no `assets/fonts/`. O system font (Geeza Pro no iOS, Noto Sans Arabic no Android) tem cobertura ampla e evita +200KB no bundle. Se o QA em device real mostrar que a tipografia system fica muito "burocrática" pro tom infantil do Magic World, podemos adicionar `IBM Plex Sans Arabic` ou `Cairo` depois (ambas gratuitas na Google Fonts).
- **`translateX` animado do título** — em LTR o header title desliza da esquerda pra centro conforme o scroll. Em árabe o comportamento ideal seria espelhado (direita → centro). Não mudamos porque exigiria remontar as `Animated.Value` com base no locale detectado a cada renderização de tela, e o ganho visual é pequeno vs o risco de regressão em LTR.
- **TrackPlayer metadata** — `artist: "Magic World"` continua em EN (nome do app).
- **Corpo dos textos legais, nomes de categoria no Firestore, i18n dos jogos** — mesma decisão de `I18N.md`.

## Decisões técnicas

### Por que detectar RTL pelo conteúdo, não pelo locale?

O usuário pode ter a UI do app em inglês (locale `en`) mas traduzir a história atual pra árabe via menu. Nesse cenário, o `useLocaleStore.direction` continua `"ltr"` (correto pra UI), mas o corpo da história precisa ser RTL. Detectar pelo texto renderizado é o caminho robusto.

### Por que não `I18nManager.forceRTL(true)`?

Já explicado em `I18N.md`, mas reforçando: `forceRTL` exige reload do JS bundle, o que quebra qualquer navegação em andamento. Além disso, ativa RTL globalmente — todos os `flexDirection: 'row'`, `paddingLeft`, `marginLeft` invertem. Nosso layout foi feito LTR-first; ativar `forceRTL` seria um refactor massivo pra ganho marginal (o essencial é o texto da história ser legível, e isso é resolvido por `writingDirection` local).

### Por que `getFontFamilyForText` devolve `undefined`?

Passar `undefined` como `fontFamily` no RN faz o texto usar o system font — que no iOS 26 e Android moderno tem cobertura Unicode ampla incluindo árabe. É a solução mais barata: zero KB de bundle, zero risco de tofu, e o baseline/line-height ficam consistentes com o sistema.

Alternativa considerada e rejeitada: dispatch de fontes por script no `expo-font.loadAsync()`. Adiciona complexidade de carregamento assíncrono (a fonte árabe precisa carregar antes da primeira renderização de texto árabe) e ~200KB no bundle. Se algum dia a tipografia infantil for muito importante pro brand em árabe, dá pra ativar aí.

### `splitIntoSentences` vs regex inline anterior

Ganhos:
1. Cobre `؟` (question mark árabe U+061F) que estava faltando
2. Cobre `।` (danda hindi U+0964) — bônus de robustez pra hindi
3. Cobre `。！？` (CJK) — bônus de robustez pra scripts CJK
4. Centraliza a lógica pra reuso em outras telas se aparecer texto do Firestore em qualquer idioma

Perda: nenhuma. O comportamento pra `.!?` (latino) é idêntico ao anterior.

### Fallback do `resolveSpeechLanguage`

Se o `franc` devolver um ISO 639-3 não mapeado (ex: `deu` alemão, que o app não suporta mas que pode aparecer se o usuário copiar texto), o helper cai em `en-US`. Isso evita que `expo-speech` receba string vazia ou undefined e crashe silenciosamente. Escolha consciente: melhor ler em inglês torto do que não ler nada.

## Testes recomendados antes de submeter

1. **iOS Simulator** com Region/Language = Iraq/Arabic:
   - Abrir uma história em EN → menu de tradução → "Arabic" → texto deve virar árabe alinhado à direita, glifos legíveis
   - Play → TTS deve falar em árabe (voz Maged nativa do iOS)
2. **iOS device** com iOS 26.x (top 3 versões do Iraque hoje):
   - Mesmo fluxo acima
   - Verificar que o botão de play/back não fica sobreposto ao título em árabe
3. **Android** (Pixel 6+ ou equivalente com Google TTS instalado):
   - Verificar que o TTS árabe funciona; se não tiver voice pack, o `expo-speech` cai num TTS default ou não fala nada (não crasha, mas o usuário perde a leitura em voz)
4. **Regressão LTR**:
   - Abrir uma história em EN, PT, ES, FR, HI, ZH — nenhuma dessas deveria ter mudança visual perceptível
5. **Locale mixado**:
   - UI em EN, traduzir história pra AR → corpo em RTL, restante da UI em LTR (comportamento correto)

## Próximos passos possíveis (não bloqueiam submissão)

- Adicionar fonte árabe dedicada (`IBM Plex Sans Arabic`) se QA reclamar de aparência
- Espelhar chevrons direcionais quando `direction === "rtl"` no `useLocaleStore`
- Refatorar `translateX` animado do título pra respeitar direção
- Rodar o storie com `autoDirection` opt-in em outros lugares onde conteúdo de Firestore aparece (categorias, cards de história, favoritos)
- Considerar adicionar `he` (hebraico) — reaproveita 100% da infra RTL

## Arquivos alterados

```
helpers/textDirection.ts        (novo)
app/(storie)/index.tsx          (modificado)
components/ui/Text/index.tsx    (modificado)
ARABIC.md                       (novo — este arquivo)
```

Nenhuma dependência nova. Nenhum breaking change. Pronto pra `bun install` (não precisa, sem deps novas) → build → submit → EAS.
