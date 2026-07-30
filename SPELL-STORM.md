# Spell Storm

A side-scrolling metroidvania for the Magic World Arcade tab. Twenty
interconnected rooms across eight biomes, seven bosses at the ends of seven
branches, benches to save at, and a paper-theatre art style.

**0 MB of art assets. 0 new dependencies.**

---

## What changed in v2

### 1. The black band down the right of the screen

`engine/useGLGame.ts` did this:

```ts
renderer.setSize(bufferW * 0.75, bufferH * 0.75, false);
```

In a browser that is a legitimate optimisation — `updateStyle: false` shrinks
the canvas backing store and CSS stretches it back to full size, so you pay
for 56% of the fragments and the user sees a full, slightly soft image.

React Native has no CSS. The expo-gl surface stays at full pixel size; all
`setSize` does is call `gl.viewport(0, 0, w*0.75, h*0.75)`. The scene was
drawn into the bottom-left three quarters of the display and the rest of the
framebuffer kept the clear colour, which is black. That is the band on the
right and the dead strip along the top.

The renderer is now always sized to the full drawing buffer.

The first attempt at keeping the fragment saving was to render into an
offscreen `WebGLRenderTarget` and blit it up with a textured quad. That
produced a *second* black screen, and the reason is worth writing down:
**expo-gl does not guarantee that its presentable framebuffer is FBO 0.**
`renderer.setRenderTarget(null)` binds zero, three.js caches that state, and
the blit lands somewhere nobody ever presents. HUD on top, void underneath.

`RENDER.offscreenUpscale` is therefore **off by default** and the game renders
straight to the surface at full resolution — no indirection, nothing to get
wrong. The offscreen path is still there, now with the framebuffer captured
before the first bind and restored before the blit, if you want the ~35% of
fragments back and can verify it on a device.

### 2. The map felt tiny because the camera showed all of it

`CAMERA.viewHeight` was 15.5 with width derived from the aspect ratio. On a
landscape phone (~2.2) that is **34 world units of visible width** — wider
than the entire 32wu arena. The level fitted on one screen and the camera
never moved.

The rig now owns the frustum and clamps the *width* (`CAMERA.maxViewWidth`),
shrinking the height on wide displays instead of revealing more world. It
also follows vertically through a deadzone, which the old flat 0.42
multiplier could not do — `spire_climb` is 62wu tall.

`resize()` is also actually called now, from the screen's `onLayout`. It never
was, so rotating the phone left the frustum on the previous aspect ratio.

### 3. Waves became a world

The old loop was a wave director: one arena, a spawn queue, a boss on wave 10.
That shape has a ceiling — waves are a *score* game, and a score game ends the
moment the player stops caring about the number.

Now: explore, find a door, find a boss, kill it, the door it was guarding
opens. 1,584wu of traversal across 20 rooms, versus 32wu before.

---

## The map

```
                    [spire_climb]──[nightwing_perch ★2]
                          │
[thorn_hollow ★5]     [spire_hall]
       │                  │
  [thornwood]         (up)│
       │                  │
 [thorn_gate]─────────────┤
       │                  │
[gorge_lair ★1]      [CROSSROADS]──(ledge, needs 6)──[storm_ascent]──[storm_throne ★7]
       │              │        │
[fungal_deep]    (down)│        └──(right)──[emberway]──[ember_forge]──[cinder_hall ★3]
       │               │                          │(down)
[fungal_hollow]────────┤                     [void_stair]
                       │                          │
                [cistern_fall]               [void_vault ★6]
                       │
                [cistern_choir]──[lumen_sanctum ★4]
```

**Free:** Fungal, Spire, Ember — a hub, three branches, three bosses, an
ending. **Members:** Thorn, Cistern, Void, Storm.

The gate is a sealed door standing in the world, not a modal that fires when
you try to leave. Same silhouette as an open door, barred and sigil-marked, so
the player files it as "later" rather than as "wall".

## The seven

Each asks a different question, and each keeps the same three-phase contract
(65% / 30%) so the rhythm is learnable once and applied seven times.

| Boss | HP | Asks |
|---|---|---|
| Gorge Mother | 42 | vertical space — she owns the floor, you live on platforms |
| Nightwing | 48 | horizontal space — she crosses faster than you can run |
| Cinder Warden | 64 | patience — armoured, slow, punishes greed |
| Lumen Choir | 68 | pattern reading — bullet geometry, no contact threat |
| Thorn Warden | 70 | footing — the floor itself becomes the hazard |
| Voidmaw | 76 | control — it moves YOU rather than moving itself |
| Storm Dragon | 96 | all of the above, on a clock |

Every attack telegraphs for at least ~0.4s through `Enemy.tell`, which the art
layer turns into a physical wind-up — the Warden's core swells, Nightwing goes
dead still, Voidmaw's rings spin up. Nothing telegraphs with a screen-space
icon. A boss that warns you with its body is one you read; a boss that warns
you with UI is one you memorise.

## Death and saving

Benches heal, save, and become your respawn point. Death costs 25% of your
essence and a walk back — not the run. Eight benches across twenty rooms.

---

## Install

Copy these into the Magic World project root, preserving paths:

```
game/spell-storm/…              the game (including world/ and the new systems)
app/(spell-storm)/index.tsx     REPLACES the existing screen
test/sim.test.ts                REPLACES the existing tests
```

That's it. Every package it imports is already in your `package.json`:
`expo-gl`, `three`, `expo-haptics`, `expo-router`, `react-native-purchases`,
`@react-native-async-storage/async-storage`.

`expo-router` picks the route up automatically. Run `bun run ios` and it's in
the Arcade tab.

### One thing to check

`components/ui/Text` is imported with `variant` and `size` props matching the
existing usage in `games.tsx`. If your `Text` doesn't accept `size="xs"`, the
badge in the Arcade card is the only place that uses it — change it to `"sm"`.

---

## Bug fixes bundled in

Two of these are separate from the game and worth applying regardless.

**`hooks/useProStatus.ts` closes two revenue leaks.** Today `@user_is_pro` is
only written inside the subscribe screen, after a purchase or restore, and
nothing re-syncs it at launch. So a lapsed subscription keeps full access
forever, and a paying member who reinstalls gets locked out of content they
are currently paying for. The hook treats RevenueCat as authoritative,
AsyncStorage as a first-paint cache, and subscribes to entitlement updates.

**`Purchases.configure()` should move to `app/_layout.tsx`.** It currently
lives in `app/(app)/index.tsx`, which is the onboarding screen — a screen that
may not mount on a returning user's launch. `ensurePurchasesConfigured()` in
the hook is a safety net, not a substitute; move the real call up.

**The engine cancels its animation frame and disposes its GPU resources.**
`app/(endless-runner)/index.tsx` does neither: no `cancelAnimationFrame`, no
`.dispose()` anywhere in 1,275 lines. The loop runs forever after the user
navigates away, and the scene stays in VRAM. `engine/useGLGame.ts` is written
to be reusable — porting Space Runner onto it is the highest-value cleanup
available in this codebase.

---

## Why there are no character models

The obvious build was KayKit for the mage and Quaternius for the monsters,
loaded as GLB. This does not do that, for three reasons.

**Weight.** Magic World currently ships 97 MB of GLB. Two files account for
almost all of it — and they contain eight 4096×4096 PNG textures for meshes of
434 and 6,912 triangles. Decoded, that's roughly 680 MB of VRAM for two
objects that occupy a few hundred pixels. Spell Storm adds 0 MB.

**Draw calls.** A `SkinnedMesh` can't be instanced and needs its own
`AnimationMixer` per entity. Forty enemies is forty mixers and forty skinning
passes on the JS thread. Puppets are shared-geometry cards with rotations
written directly, so the enemy pool stays cheap.

**Responsiveness.** Procedural poses read live game state. The run cycle
scales its stride to actual velocity, the cast pose points along the real aim
vector, and recoil is additive. Clip playback needs a blend tree to
approximate any of that.

If you still want KayKit later, `art/puppet.ts` is the seam. Build a
`GltfPuppet` with the same `poseHumanoid(input)` signature, map the pose
values onto bone rotations, and nothing else in the codebase changes.

---

## Architecture

```
config.ts              every tuning number in the game
types.ts               shared entity, world and HUD types

world/
  rooms.ts             THE MAP — 20 rooms, 8 biomes, the gate graph

engine/
  useGLGame.ts         GL lifecycle, offscreen blit, fixed-timestep loop
  Disposer.ts          resource tracking — nothing leaks
  input.ts             stick handling, 8-way aim snapping

art/
  palette.ts           the colour system, including the seven boss hues
  paper.ts             shape builders + the two-tone card factory
  sky.ts               gradient backdrop, per-biome stops
  roomStage.ts         builds ONE room, disposes it on exit
  puppet.ts            the jointed rig and pose solver
  mage.ts              the player character
  bestiary.ts          slime, bat, golem, wisp, storm dragon
  bosses.ts            the six new bosses
  fx.ts                pooled particles and shockwaves

systems/
  arena.ts             the active room's collision geometry
  physics.ts           AABB, one-way platforms, solids, hazards
  player.ts            the controller — most of the game feel
  projectiles.ts       pooled bolts, homing, piercing
  enemies.ts           pool + per-kind minion AI
  bossAI.ts            the seven state machines
  pickups.ts           drops, magnetism, blink-out
  world.ts             room transitions, gate locking, progression
  camera.ts            frustum fitting, follow, room clamping, shake

index.ts               orchestrator: rooms, bosses, death, collisions
```

### Why rooms are rebuilt rather than pre-built

Twenty rooms averaging ~80wu is on the order of a thousand extrusions. Holding
them all resident would be hundreds of MB of VRAM in an app that also carries
97 MB of GLB. One room is 60–140 extrusions, built behind the 0.26s transition
fade where the screen is already black.

Each room owns a private `Disposer` and a private `PaperKit`. Leaving disposes
both, so the GPU only ever holds the room you are standing in. The kit is
private because PaperKit caches materials by colour, and a shared cache would
leak the fungal palette into the ember rooms.

### Why the active room is module state

`physics.ts` used to import `ARENA` and `PLATFORMS` from config, which was
fine when there was one arena forever. Threading a `room` argument through
`resolveGround`, `clampToArena`, `updatePlayer`, the enemy loop and seven boss
behaviours would touch a dozen signatures to express one genuinely global
fact: exactly one room is being simulated at a time. `systems/arena.ts` holds
it, written once per transition and read-only during a frame.

### The two rules

1. **Time is in seconds, never frames.** The loop drains an accumulator in
   fixed 1/60 slices. Space Runner does `obs.position.z += currentSpeed` per
   frame, which means it runs at literally double speed on a 120 Hz ProMotion
   device and its high scores aren't comparable across hardware. There is a
   test asserting Spell Storm's jump height matches at 60 Hz and 120 Hz.

2. **If you `new` a geometry, material or texture, it goes through
   `disposer.track()`.** No exceptions.

---

## Game design

**Controls.** Left half of the screen is a floating stick that appears where
your thumb lands — it steers *and* aims, 8-way, like a Metal Slug d-pad. Right
side is CAST (hold to auto-fire) and JUMP.

**The curve.** Waves 1–3 are slimes only, teaching ground movement. Wave 4
adds bats, so you look up. Wave 7 adds the golem, which soaks damage and
telegraphs an area slam. Wave 10 is the dragon, three phases keyed to its HP.
Past 10, composition is procedural on a threat budget and the dragon returns
every fifth wave.

**Where the paywall sits.** Wave 11. That is deliberate: the free player gets
a complete arc with a real ending — ten waves and a boss kill — and the gate
lands on the high of having just won, not in the middle of a grind. Change it
with `WAVES.freeWaves`.

**The combo.** Kills within 2.6 s of each other chain up to 8×. It's the
reason to push forward into a wave instead of camping a platform, and it's
what makes the score worth chasing.

### Game feel

Everything in `FEEL` and the jump section of `PLAYER` exists to hide the fact
that touch input is imprecise:

| Mechanic | What it fixes |
|---|---|
| Coyote time (110 ms) | "I pressed jump and nothing happened" after walking off a ledge |
| Jump buffer (130 ms) | Pressing jump slightly before landing |
| Variable jump height | Makes the jump a decision rather than a commitment |
| Asymmetric gravity (1.55× falling) | Stops the jump feeling like the moon |
| Hitstop (60–110 ms) | Makes hits feel like they land |
| Hit flash on enemies | Tells you a shot connected — essential once the golem soaks five |
| Pickup magnetism | Removes near-miss frustration mid-firefight |
| Pickup blink before expiry | Turns "the game took my heart" into "I was too slow" |

Tuning all of it lives in `config.ts` and nowhere else.

---

## Tests

```bash
npx tsx test/sim.test.ts
```

40 checks over aim snapping, one-way platforms, coyote time, jump buffering,
variable height, frame-rate independence, damage and i-frames, the wave curve
and the paywall gate.

These aren't ceremony. The first run caught a real bug: the original
`jumpVelocity` of 20.5 produced a 3.45 wu peak against platforms at 3.6 wu —
**all three platforms were unreachable.** It's now 23.6, giving 4.61 wu. That
is not something you reliably notice by playing; it just feels like the
platforms are decorative.

---

## Known limitations

**No audio.** Haptics stand in on the events that matter. Wiring sound means
handling `onSound` in the screen — the engine already emits every event you'd
need. Note that the Space Runner BGM currently streams from
`soundhelix.com`, which is a placeholder you'll want gone before the next
submission.

**Old architecture.** `newArchEnabled: false` in `app.config.js`. This is
fine today and is what Space Runner already relies on, but Expo is pushing
Fabric hard. Nothing here depends on the old renderer specifically.

**Not localised.** All strings are inline English, matching the rest of the
app. They're confined to `app/(spell-storm)/index.tsx` — about a dozen — so
wiring them into your i18n system is a small job.

**Enemy visual pools are fixed.** 12 slimes, 10 bats, 5 golems, 6 wisps, 1
dragon. Exceeding a kind's pool skips that spawn and retries next tick rather
than popping in a new mesh mid-fight. If deep waves feel thin, raise the
counts in `systems/enemies.ts`.

---

## Before you ship it

Playtest waves 1–4 on a real device first, specifically for whether the jump
arc feels right in your hand. Every number in this build is reasoned from the
arena geometry rather than from feel, and feel is the thing you can only get
from a thumb on glass. `PLAYER.jumpVelocity`, `PLAYER.maxSpeed` and
`CAMERA.viewHeight` are the three that will want the most adjustment.

Then check the frame rate on the oldest device you support during wave 9,
which is the heaviest non-boss wave. If it dips, `RENDER.resolutionScale` is
the first dial — dropping it to 0.6 is nearly invisible in this art style.
