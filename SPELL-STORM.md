# Spell Storm

A wave-survival run-and-gun for the Magic World Arcade tab. Metal Slug's
structure — run, jump, 8-way aim, temporary weapon pickups, a boss — inside a
single arena, in a paper-theatre art style, gated at wave 11 by the
subscription.

**0 MB of art assets. 0 new dependencies.**

---

## Install

Copy these into the Magic World project root, preserving paths:

```
game/spell-storm/…              the game
app/(spell-storm)/index.tsx     the screen
hooks/useProStatus.ts           entitlement hook (see "Bug fixes" below)
app/(tabs)/games.tsx            REPLACES the existing file
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
types.ts               shared entity and state types

engine/
  useGLGame.ts         GL lifecycle, fixed-timestep loop, teardown
  Disposer.ts          resource tracking — nothing leaks
  input.ts             stick handling, 8-way aim snapping

art/
  palette.ts           the colour system
  paper.ts             shape builders + the two-tone card factory
  sky.ts               gradient backdrop, sun, stars, clouds
  stage.ts             parallax layers, ground, platforms
  puppet.ts            the jointed rig and pose solver
  mage.ts              the player character
  bestiary.ts          slime, bat, golem, wisp, dragon
  fx.ts                pooled particles and shockwaves

systems/
  physics.ts           AABB, one-way platform resolution
  player.ts            the controller — most of the game feel
  projectiles.ts       pooled bolts, homing, piercing
  enemies.ts           pool + per-kind AI
  pickups.ts           drops, magnetism, blink-out
  waves.ts             the difficulty curve and the paywall gate
  camera.ts            follow, look-ahead, shake

index.ts               orchestrator: loop, collisions, scoring
```

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
