# Space Runner — Visual Upgrade v2

Reescrita visual do `app/(endless-runner)/index.tsx`. **Zero mudança de
gameplay**: colisão (hitRadius), spawn/recycle, score, vidas, shield, pickups,
BGM, persistência do high score — tudo byte-a-byte igual em lógica.

O arquivo foi de ~530 pra ~1330 linhas. Tudo que é novo tá marcado com
comentário `v2 —` no código.

---

## O que mudou, por elemento

### 1. Nave — fogo dos motores

**Antes:** 1 cone laranja por motor com pulso simples.

**Agora:**
- **3 camadas por motor**: núcleo branco-quente (pequeno, opaco) → chama
  laranja (média) → envelope vermelho translúcido (grande). Additive blending
  entre elas cria gradiente de temperatura convincente.
- **Trilha de exaustão**: 54 partículas spawnam nos bocais e ficam pra trás
  no espaço, desvanecendo de amarelo-quente → laranja → tijolo escuro
  (fade via vertex colors, já que PointsMaterial não tem opacity por
  partícula).
- **Point light laranja** presa à traseira da nave — o glow do motor agora
  ilumina o casco e asteroides próximos.
- **Pulso orgânico**: 2 frequências de seno sobrepostas com fases diferentes
  por motor (antes era 1 seno síncrono, parecia mecânico).
- **Modo warp preservado**: em difficulty > 2 a paleta inteira (3 camadas +
  luz + exaustão) vira ciano-azul, como o comportamento original de trocar a
  cor da chama.

### 2. Meteoros

**Antes:** todos com o mesmo material cinza chumbo `0x444444`.

**Agora:**
- **4 variantes de rocha** (cinza rochoso, marrom ferroso, escuro azulado,
  bege empoeirado) com roughness/metalness próprios — re-sorteadas a cada
  respawn, então o campo de asteroides nunca parece repetido.
- **~30% "flamejantes"**: emissive laranja pulsante (brasa viva) + **cauda de
  fogo** additive apontando contra o movimento, com comprimento proporcional
  ao hitRadius. Caudas vivem na cena e são sincronizadas por frame (não são
  children — a escala aleatória por eixo dos asteroides distorceria a cauda).

### 3. Planetas

**Antes:** GLTF cru, parado, sem atmosfera.

**Agora:**
- **Atmosfera fresnel** (ShaderMaterial custom, BackSide + additive): rim
  glow azul no moon, laranja-salmão no phoenix. O shader é ~10 linhas de
  GLSL, custo desprezível.
- **Anéis estilo Saturno no phoenix**: RingGeometry com UV remapeada pra
  radial + textura de bandas gerada proceduralmente (DataTexture 128×1),
  inclinação de ~75°.
- **Rotação própria lenta** nos dois planetas.
- `randomizePlanetColor` ganhou guards (`userData.isFxLayer`, checagem de
  `.color`/`.emissive`) pra não crashar ao tentar recolorir a atmosfera
  (ShaderMaterial não tem `.color` — teria dado TypeError no primeiro
  respawn de planeta).

### 4. Estrelas

**Antes:** 1 camada de 800 pontos quadrados brancos.

**Agora — 4 objetos, 3 camadas lógicas com parallax:**

| Camada | Qtd | Tamanho | Warp | Cor |
| ------ | --- | ------- | ---- | --- |
| L1 base | 900 | 0.55 | 1.0× | branca |
| L2 coloridas | 260 | 1.15 | 1.35× | branco/azul/âmbar/rosa/teal (vertex colors) |
| L3 hero A+B | 30+30 | 2.2–2.4 | 1.6× | branco-azul / branco-âmbar |

- **Todas com sprite circular suave** (DataTexture radial gerada em runtime —
  não existe canvas DOM no RN, então a textura é desenhada pixel a pixel).
  Acabou o quadradinho.
- **Twinkle real nas hero stars**: as duas metades de L3 oscilam opacity em
  contrafase — céu vivo, inclusive na tela de game over (o twinkle roda fora
  do gate `gameActive`).
- Camadas mais próximas warpeiam mais rápido = **profundidade de verdade**.

### 5. Universo / cenário

- **Fundo `0x060412`** (roxo-espacial profundo) em vez de `0x020205` (preto
  chapado). Fog na mesma cor, alcance 12→230.
- **6 nebulosas**: sprites gigantes (70–130 un) coloridos (roxo, azul,
  magenta, teal, laranja, lilás) com additive blending e opacity baixa,
  algumas achatadas pra sugerir galáxias. Drift lento em parallax + respawn.
  `fog: false` (senão o fog engoliria tudo a -300).
- **Sol distante** com halo em (85, 55, -420) — âncora visual fixa.
- **Poeira de velocidade**: 160 partículas finas próximas cruzando a 34× a
  velocidade base — a sensação de warp ficou MUITO mais forte, e é o upgrade
  de custo/benefício mais alto do pacote.
- **Luz nova**: fill azul-frio de baixo (`0x4a5cff`, 0.7) + key levemente
  quente. Rochas e nave ganham modelagem bicolor (quente por cima, frio por
  baixo) em vez do flat ambient.

### 6. Bônus — bugfix visual

A explosão da morte **agora anima**. No original, cada partícula tinha
`velocity` definida mas nenhum código a movia — a "explosão" era um bloco
estático de cubos. Agora as partículas voam e giram, com 5 cores e tamanhos
variados (26 cubos, antes 20 iguais). `restartGame` reseta as posições.

---

## Técnica: por que DataTexture e não CanvasTexture

No React Native não existe `<canvas>` DOM (o polyfill de `document` no topo
do arquivo é fake, só pra o three não crashar). Toda textura procedural
(sprites de estrela, glows, bandas dos anéis) é gerada via
`THREE.DataTexture` com `Uint8Array` preenchido pixel a pixel. Zero assets
novos, zero dependência de rede.

## Performance (estimativa)

| Recurso | Custo |
| ------- | ----- |
| Pontos totais | ~1.430 (900+260+60+160 dust+54 exhaust) — trivial pra GPU mobile |
| Sprites | 8 (6 nebulosas + sol + halo) + 3 glows de pickup |
| Shaders custom | 2 atmosferas (fragment de 5 linhas) |
| Luzes | +2 (fill direcional + point light do motor) |
| Draw calls extras | ~25 vs v1 |

Nada disso deve mexer no frame rate de um iPhone dos últimos ~6 anos. Se
notar queda em device antigo, os knobs de corte rápido são: `DUST_COUNT`
(160→80), nebulosas (6→3) e L2 (260→150).

## Validação feita

- ✅ Sintaxe TSX (esbuild)
- ✅ Typecheck completo da API three r182 (tsc com stubs de RN/Expo) — zero erros
- ❌ Runtime em simulador — não rodei; smoke test continua contigo

## Smoke test v2 (adições ao checklist anterior)

- [ ] Fogo dos motores com gradiente branco→laranja→vermelho e trilha de faíscas
- [ ] Meteoros com cores variadas; ~1/3 deles brilhando laranja com cauda de fogo
- [ ] Planeta da direita (phoenix) com anéis; ambos com halo de atmosfera
- [ ] Estrelas redondas, algumas grandes piscando; camadas em velocidades diferentes
- [ ] Nebulosas coloridas ao fundo + sol com halo no canto superior direito
- [ ] Riscos finos de poeira passando rápido (sensação de velocidade)
- [ ] Na morte: cubos da explosão VOAM (não ficam parados)
- [ ] Em score alto (difficulty > 2): fogo e exaustão viram azul-ciano
- [ ] Trocar de planeta (respawn) não crasha e não descolore anéis/atmosfera
