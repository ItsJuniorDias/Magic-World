# What changed in this build

This is your Magic World project with **Spell Storm** integrated, plus two
fixes that are worth having regardless of the game.

Run it the same way you always do:

```bash
bun install
bun run ios
```

Spell Storm is the first card in the Arcade tab. No new dependencies —
everything it imports was already in your `package.json`.

---

## Before anything else

**Restore your `.env`.** I stripped the live OpenRouter key rather than ship a
secret through a file transfer. Copy `.env.example` to `.env` and paste your
key back in.

---

## Added

```
game/spell-storm/…              the game (22 files)
app/(spell-storm)/index.tsx     the screen
hooks/useProStatus.ts           entitlement hook
test/sim.test.ts                40 headless checks
scripts/optimize_glb.py         GLB texture repacker
assets/models-optimized/        your models at 1/120th the size
SPELL-STORM.md                  full documentation
```

## Modified

```
app/(tabs)/games.tsx            Spell Storm added as the featured entry
.env  ->  .env.example          secret removed, see above
```

Nothing else was touched. Space Runner, the stories, the paywall, the
onboarding and every asset are byte-for-byte as you sent them.

---

## The two fixes

### Entitlements are re-synced at launch

`hooks/useProStatus.ts`. Today `@user_is_pro` is only written inside the
subscribe screen, after a purchase or a restore, and nothing re-checks it on
launch. That leaks in both directions:

- A subscription that lapses leaves the flag reading `"true"` forever, so the
  user keeps every paid chapter for free.
- A paying member who reinstalls or switches device arrives with empty storage
  and gets locked out of content they are currently paying for. They will not
  go hunting for "Restore Purchases" — they will ask for a refund or leave a
  one-star review.

The hook treats RevenueCat as authoritative, AsyncStorage as a cache for the
first paint, and subscribes to entitlement updates for the rest of the
session. It writes the same `"true"` / `"false"` strings your existing screens
already read, so you can adopt it screen by screen.

**Still on your plate:** move `Purchases.configure()` out of
`app/(app)/index.tsx` and into `app/_layout.tsx`. It currently lives in the
onboarding screen, which may not mount on a returning user's launch.
`ensurePurchasesConfigured()` in the hook covers Spell Storm, but the rest of
the app is still relying on onboarding having run.

### The engine cleans up after itself

`game/spell-storm/engine/useGLGame.ts` cancels its animation frame and
disposes every GPU resource on unmount. `app/(endless-runner)/index.tsx` does
neither — there is no `cancelAnimationFrame` and no `.dispose()` anywhere in
its 1,275 lines, so the loop keeps running after the user navigates away and
the scene stays resident.

The hook is written to be reusable. Porting Space Runner onto it is the
highest-value cleanup available in this codebase, and it would fix the
frame-rate dependence at the same time — Space Runner moves obstacles with
`obs.position.z += currentSpeed` per frame, so it runs at literally double
speed on a 120 Hz ProMotion device.

---

## The 97 MB in assets/models

Your four GLB files total 99.4 MB. The geometry is tiny; almost all of that
weight is eight embedded PNGs at 4096x4096:

| file | size | triangles | textures |
|---|---|---|---|
| `asteroid_low_poly.glb` | 47.9 MB | 434 | 4 × 4096² |
| `planet_of_phoenix.glb` | 49.2 MB | 6,912 | 4 × 4096² |
| `moon_planet.glb` | 2.3 MB | 768 | 1 × 2048×1024 |
| `craft_speederA.glb` | 0.02 MB | 280 | none |

Decoded with mipmaps, a 4096² texture is roughly 85 MB of VRAM. Those two
files therefore ask for about **680 MB of GPU memory** to draw objects that
occupy a few hundred pixels. That is an out-of-memory crash on older iPhones,
a slow load, and download weight the App Store holds against you.

`assets/models-optimized/` holds the same four models with textures repacked
at 512px:

```
asteroid_low_poly.glb   47.9 MB  ->  0.24 MB   (99.5% smaller)
planet_of_phoenix.glb   49.2 MB  ->  0.50 MB   (99.0% smaller)
moon_planet.glb          2.3 MB  ->  0.05 MB   (97.7% smaller)
craft_speederA.glb       0.02 MB      unchanged, no textures

Total                   99.4 MB  ->  0.81 MB
```

Geometry, materials and node hierarchy are byte-identical — I verified
triangle counts, accessor ranges, bufferView alignment and that every repacked
image still decodes. Only the image bufferViews changed.

I did **not** swap these in. Look at them on device first, then if you're
happy, either point the `require()` calls in `app/(endless-runner)/index.tsx`
at `models-optimized`, or run:

```bash
pip install Pillow
python3 scripts/optimize_glb.py assets/models --in-place --size 512
```

Worth noting: Space Runner overwrites `mat.color` on both planets in
`randomizePlanetColor()` and re-tints every meteor on recycle, so those albedo
maps are being multiplied by a flat colour anyway. At 434 triangles the
asteroid would look near-identical at 256px, or with no maps at all.

---

## Everything else

`SPELL-STORM.md` covers the architecture, the game design, the feel tuning,
what the tests assert, and why there are no character models.

Run the tests with:

```bash
npx tsx test/sim.test.ts
```
