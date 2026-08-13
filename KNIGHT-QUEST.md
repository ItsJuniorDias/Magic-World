# Knight Quest — Magic World Integration Notes

**A Zelda-like top-down action game shipped as a Magic World mini-game.**

Built with three.js + expo-gl, following the same architecture as
`game/spell-storm/`.

## Route

`app/(knight-quest)/index.tsx` — expo-router route. Deep link:
`magicworld:///(knight-quest)`. Also linked from the Games tab
(`app/(tabs)/games.tsx`).

## Directory layout

```
game/knight-quest/
├── index.ts                    public API (used by app/(knight-quest)/)
├── game.ts                     createKnightQuest() facade
├── config.ts                   all tunable numbers
├── types.ts                    shared game types
├── engine/
│   ├── useKnightQuestGame.ts   the React hook (equivalent to useGLGame)
│   ├── assetManifest.ts        static require() map (Metro-safe)
│   ├── loader.ts               expo-asset backed GLB loader
│   ├── audio.ts                haptics-only stub (see AUDIO section below)
│   ├── anim.ts                 animation state helpers
│   ├── input.ts                InputState + touch helpers
│   └── Disposer.ts             GPU resource tracker
├── art/
│   └── fx.ts                   particle pool + procedural meshes
├── world/
│   ├── dungeon.ts              ASCII room definitions (pure data)
│   └── builder.ts              builds meshes for village + dungeon biomes
└── systems/
    ├── physics.ts              circle vs tile grid
    ├── camera.ts               3/4 top-down cam with room slides
    ├── rooms.ts                current-room, transitions, combat lock
    ├── player.ts               Knight state machine
    ├── enemies.ts              3 skeleton AIs
    ├── boss.ts                 Skeleton Warrior
    ├── projectiles.ts          mage bolts + boss shockwaves
    ├── pickups.ts              hearts, coins, keys with magnet
    └── props.ts                barrels, chests, spike traps

assets/game/knight-quest/
├── characters/                 12 files — KayKit hero + skeletons + weapons
├── dungeon/                    27 GLBs — KayKit Dungeon Remastered modules
├── polygon/                    97 GLBs — Synty POLYGON overworld props
└── LICENSE-*.txt               attribution files

app/(knight-quest)/
├── _layout.tsx                 stack layout (portrait, no header)
└── index.tsx                   screen shell: HUD + touch controls
```

## Dependencies

All already in package.json:
- `three@0.182.0` + `three-stdlib@2.36.1` (uses `GLTFLoader`, `SkeletonUtils`)
- `expo-asset@~12.0.13` (asset resolution)
- `expo-gl@~16.0.10` (WebGL context)
- `expo-haptics@~15.0.8` (SFX proxy)
- `expo-blur@^15.0.8` (HUD glass panels)
- `react-native-safe-area-context@~5.6.0`
- **No new native modules added.**

## Assets — how Metro finds them

`assetManifest.ts` has one `require()` per GLB, matched to a stable key
(`"knight"`, `"poly_house_a"`, etc). Metro sees the literal require, bundles
the file, and returns a numeric asset ID. `loader.ts` resolves that ID
through `Asset.fromModule(...).downloadAsync()` at runtime and hands the
resulting `localUri` to `GLTFLoader`.

**Metro is already configured** to pick up `.glb`/`.gltf` files — see
`metro.config.js` which adds them to `resolver.assetExts`.

## Audio

`engine/audio.ts` is a **haptics-only stub** that matches the API shape of
the web build's WebAudio synth. Every `sfx.hit()`, `sfx.coin()` etc. maps
to an `expo-haptics` impact so the game still feels punchy. The real audio
path can go either way:

1. **`expo-audio`** — bake procedural output to WAV once and ship. Small
   files, no runtime allocation.
2. **`react-native-track-player`** — Magic World already uses this. Wrap
   `startMusic()`/`stopMusic()` in a controller that adds/removes a
   dungeon-ambient track.

Neither is required for the game to be playable.

## Assets breakdown

- **KayKit** (CC0): Knight herói + 4 skeletons (76-95 anims each), 27 modules
- **Synty POLYGON** (paid Synty EULA): 97 environment props for the village
  overworld — houses, market stalls, well, campfire, fences, trees, bushes,
  rocks, ground tiles, streams, bridges, etc.
- **POLYGON characters NOT used** — they ship without usable animations in
  the FBX (T-pose only). The KayKit Knight is used instead.

## How the world is laid out

Player spawns in the **Willowvale Village** (biome=village, POLYGON assets).
Walking north through the village fence door enters the KayKit **Dungeon
Entrance** (biome=dungeon), and from there the classic Zelda-y room grid
opens up:

```
                        [Boss: Throne of Bones]
                              🔒
   [Treasury]─────[Great Hall]─────[Mage Den]
                        │
                    [Crossing]────[Armory]
                        │
                    [Entrance]
                        │
              [Willowvale Village]   ← spawn
```

## Testing

The web version of the game (`knight-quest.zip` we shipped earlier) has
unit tests validating door consistency across all rooms. That test suite
is at `../../knight-quest-web/test/dungeon.test.mjs` — the module code
here is byte-identical to the web version's `src/world/dungeon.ts` (only
the loader and audio differ per platform), so the same 38 assertions
apply.

## What still needs work (documented)

- **Music** — currently silent (see AUDIO section).
- **Save state** — the game restarts from scratch every entry; a
  RevenueCat-gated "endless mode" could persist coins to AsyncStorage.
- **Weapon load** — the skeleton weapons (Blade/Axe/Staff) come as
  `.gltf + .bin + .png` triples. The loader patches URIs in the .gltf on
  the fly; if this proves flaky on device, converting each to a
  self-contained `.glb` via `assimp` is a one-line fix.
- **Analytics** — no `track(...)` calls yet. Add `track("knight_quest_start")`
  on mount, `track("knight_quest_boss_defeated")` on victory,
  `track("knight_quest_death", { room: hud.roomKey })` on game over.
