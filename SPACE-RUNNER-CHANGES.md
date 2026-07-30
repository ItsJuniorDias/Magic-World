# Space Runner — Integração completa

Este documento lista tudo que foi alterado/adicionado no Magic-World pra ligar
o jogo Space Runner (extraído do `story-box`).

Pra code review rápido: são **3 arquivos alterados** e **5 arquivos novos**.

---

## Arquivos alterados (3)

### 1. `package.json`

Adicionadas 3 deps de produção e 1 de dev (em ordem alfabética):

```diff
+ "expo-gl": "~16.0.7",
+ "three": "^0.182.0",
+ "three-stdlib": "^2.36.1",

  devDependencies:
+ "@types/three": "^0.182.0",
```

**Sobre a versão do `expo-gl`:** chutei `~16.0.7` pra bater com SDK 54 do
Expo. Se `bun install` reclamar de peer dep, roda:

```bash
npx expo install expo-gl
```

Que força a versão exata que a Expo declarou pro SDK 54 instalado.

**O que NÃO adicionei (e por quê):**

| Package                   | Motivo                                            |
| ------------------------- | ------------------------------------------------- |
| `expo-audio`              | Reescrevi pra `expo-av` (que já tá no bundle)     |
| `@react-three/fiber/drei` | O jogo não usa (mexe direto no `three`)           |
| `expo-three`              | Não é usado                                       |

### 2. `app/(tabs)/games.tsx`

Adicionei o Space Runner no array `GAMES` — assim ele aparece no hub Arcade
junto do Quiz e do Memory Match:

```diff
  {
    id: "memory-game",
    title: "Memory Match",
    ...
  },
+ {
+   id: "endless-runner",
+   title: "Space Runner",
+   emoji: "🚀",
+   accent: tokens.palette.amber500,
+   route: "/(endless-runner)",
+   description: "Navigate through asteroids.",
+ },
];
```

Cor `amber500` (#FF9F0A) é a mesma que o story-box usava — mantém identidade
visual do card entre os dois apps.

### 3. `app/_layout.tsx`

**Não mexi.** Como o Stack usa `screenOptions` global sem `Stack.Screen`
manual, a nova rota `(endless-runner)` é detectada automaticamente pelo
expo-router v6.

---

## Arquivos novos (5)

### 4. `app/(endless-runner)/index.tsx` (~530 linhas)

O jogo. Adaptado de `story-box:app/(endless-runner)/index.tsx`.

**Única diferença vs original:** substituí a lib de áudio `expo-audio` (que
só existe direito no SDK 55) por `expo-av` (que o Magic World já tem no
bundle). Trocaram-se ~15 linhas no bloco de useEffect que carrega a BGM.
Comportamento (autoplay, loop, restart no game over) é idêntico.

**Bônus:** adicionei `try/catch` no load da BGM — se der ruim de rede, o
jogo roda sem música em vez de crashar (original não tinha).

### 5-8. `assets/models/*.glb` (4 arquivos, ~100 MB total)

| Arquivo                    | Tamanho  | Uso                       |
| -------------------------- | -------- | ------------------------- |
| `craft_speederA.glb`       | 20 KB    | Nave do jogador           |
| `moon_planet.glb`          | 2.3 MB   | Planeta de fundo (esq.)   |
| `asteroid_low_poly.glb`    | 48 MB    | 8x obstáculos             |
| `planet_of_phoenix.glb`    | 50 MB    | Planeta de fundo (dir.)   |

**Aviso sério de bundle size:** +100 MB no IPA. Recomendações antes do
próximo release:

1. **Git LFS** antes do primeiro `git add`:
   ```bash
   git lfs install
   git lfs track "assets/models/*.glb"
   git add .gitattributes
   ```

2. **Ou** hospeda os 2 pesados em Firebase Storage / R2 e baixa on-demand.

3. **Ou** roda `gltf-transform optimize` — o `planet_of_phoenix` tá com
   geometria densa demais pra um objeto de fundo com escala 5x. Dá pra
   derrubar de 50 MB pra ~5 MB sem perda visual perceptível.

Não fiz nenhuma dessas — decisão tua.

---

## Como testar

```bash
bun install
# se expo-gl reclamar de peer dep:
#   npx expo install expo-gl
bun run start
```

No app: aba **Arcade** → card **Space Runner** → jogo abre.

### Smoke test (~2 min)

- [ ] Loading bar aparece e chega a 100%
- [ ] Nave renderiza no centro-baixo
- [ ] Estrelas de fundo se movem (efeito warp)
- [ ] Arrasta o dedo → nave move lateralmente
- [ ] Bater num asteroide → dano vermelho + `❤️` cai
- [ ] Pega heart (❤️) recupera vida
- [ ] Pega coin (🪙) soma 250 no score
- [ ] Pega shield (🛡️) ativa GRID no HUD
- [ ] Perder as 3 vidas → GAME OVER com RETRY / BACK
- [ ] BGM toca em loop (se rede falhar, jogo roda mudo — não crasha)
- [ ] Fechar e reabrir → best score persiste

---

## Pontos que valem revisar (não mudei, fica pra próxima)

1. **URL da BGM externa** (soundhelix.com, linha ~44 do `index.tsx`) — é
   áudio de exemplo público. Trocar antes de release por som próprio
   bundlado (`require('../../assets/sounds/space-runner-bgm.mp3')`).

2. **Chave `@high_score` no AsyncStorage** — pode colidir com outros jogos
   no futuro. Sugestão: `@space_runner:high_score`.

3. **Fail state do load de assets** — se um `.glb` falhar em prod,
   `setIsLoaded(true)` fica dentro do try, então o loading trava pra sempre.
   Um fallback UI ou telemetria ajudariam.

4. **Copy do card** — "Navigate through asteroids." tá em inglês pra bater
   com Quiz Master / Memory Match, que também estão em inglês. Se a estratégia
   for i18n depois, tem que mexer nos 3 juntos.

---

## Referência

Extraído do commit `5ac2aa770e9979c22eeef0202aeb23aa7163b124` do repo
`ItsJuniorDias/story-box`, arquivo `app/(endless-runner)/index.tsx`.
