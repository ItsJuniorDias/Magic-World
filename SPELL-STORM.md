# Spell Storm

A side-scrolling metroidvania for the Magic World Arcade tab. Twenty
interconnected rooms across eight biomes, seven bosses at the ends of seven
branches, benches to save at, and a paper-theatre art style.

**0 MB of art assets. 0 new dependencies.**

---

### v5 — the story

Before this pass, Spell Storm was a well-tuned combat loop with rooms
and bosses in it. That's a fine metroidvania at 0% of the way to being
a memorable one. What memorable metroidvanias have — and what this
didn't — is a reason to be here. A dead teacher. A missing friend. A
sky that used to be blue. Something that stops the ending screen from
being just a number.

**The arc.** You are Selûne's last apprentice. She went to seal the
Storm Dragon forty days ago; it's been sixty. Wren, an older
apprentice, sees you off at the Crossroads. On the way you meet three
more spirits — a cartographer who used to garden the Fungal, a blind
smith on the Spire, and a bone pile in the Cistern that used to be a
mage called Cael. Each boss knows Selûne. Each boss remembers her
differently. The third act reveal (spoken by Cael, echoed by Voidmaw,
confirmed by the Storm Dragon) is that the six Guardians didn't
corrupt from the Dragon — they corrupted the Dragon, to seal
something the seven of them couldn't fight alone. Selûne went in to
help hold. Every sigil you take loosens the seal. You do it anyway.
The Dragon speaks with her voice at the finale.

**Told entirely in dialogue.** Seven boss intros (3-6 lines each),
seven boss defeat lines (2-3 lines each), and four NPCs with three
variants each keyed by boss count (early / mid / late). No
narration outside the dialogue box; no lore item text; no unlock
screens between chapters. If a beat isn't spoken by someone on
screen, it doesn't exist. That constraint kept the story to what
the medium can carry — a small game gets a small story, and small
stories done well outlast big stories done sloppily.

**Every important beat is repeated in three mouths.** The twist about
the seal is in the Cistern NPC, the Voidmaw fight, AND the Dragon's
opening line, so a player who misses one still catches the others.
Selûne is named by Wren, alluded to by every boss, and only actually
recognised at the finale. Small children playing this on their
parents' phones don't need to catch every implication — the tone
does the work; the plot rewards paying attention rather than
punishing skipping.

**Cutscenes at boss gates.** When you enter an uncleared boss room
for the first time, a dialogue overlay drops in over the still-empty
arena, the room seals, the boss doesn't spawn. Once the cutscene
ends, the shop opens. Once the shop closes, the fight begins. A
returning player (died once, walked back) skips straight to the
shop — `progress.watchedCutscenes` remembers what has been seen.
That decision was the difference between "the cutscene is content"
and "the cutscene is a punishment for dying."

**NPCs are still figures with a pulsing prompt.** They don't walk,
don't idle-animate, don't turn to face you. Every animation would
compete with the mage and the boss, both of which matter more. A
still cloak and a bobbing gem overhead say "npc, come here" clearly
enough. Standing next to one for a moment lights up a TAP TO TALK
prompt in the HUD; the tap opens the dialogue overlay. Same bench
pattern as saving, minus the auto-fire — talking is a choice, not
a proximity accident.

**The React overlay does both jobs.** Same component draws boss
cutscenes and NPC chats, differentiated only by whether the SKIP
button shows and whether the header carries a boss name. Speaker
tint tells you who is talking: warm arcane for the mage, boss
crimson for the boss, gold for NPCs, dim italic for narrator lines.
No portraits — the paper-theatre style has no rendered faces and
adding some would break the whole visual grammar.

**The regression risk.** Making the sim pause during dialogue meant
extending the fade-in bookkeeping — the transition force-set
state.phase back to "transition" for the fade-in, which was
clobbering whatever enterRoom had asked for on the far side. The
fix is a sticky `arrivalPhase` local that remembers where to land
when the fade completes. It's the same shape of bug the shop v4
had, plus one new phase to preserve.

---

### v4 — the pre-boss shop

The problem: you'd reach a boss with whatever the drop table happened
to give you, which for a typical run through the Fungal branch was
"Spark and four hearts". Spark at ~5.9dps against a 42–96hp boss with
contact damage that outpaces your run speed is not a fight, it's a
coin flip weighted toward you losing. The shop is the negotiation
between the corridor's RNG and the arena.

**Where.** When you step into a boss room you haven't cleared, the room
seals behind you (same as it always did) but the boss doesn't spawn.
The shop overlay comes up instead. Six items, priced against a typical
essence bag, and one button — Enter the Arena — that commits you to
the fight. There is deliberately no back-out: a shop with an exit is a
shop that lets you farm the corridor's respawns forever, and that
turns every fight into a math problem.

**What it sells.**

    Full Heal        200   restore hearts
    Arcane Shield    500   next hit is free
    Triple Spark     400   3 bolts per cast, 5min
    Seeker Swarm     600   homing 2dmg, 5min
    Star Lance       900   piercing beam, 5min
    Vessel Fragment 1200   +1 max heart (cap 3), permanent

Prices are calibrated so a normal essence total buys two or three
items. Every other item resets on death; the Vessel Fragment persists
because it's the most expensive item in the catalog and losing it
every death would make it a trap.

**Why the effects live in `systems/shop.ts` and not in `player.ts`.**
The catalog is data. The mutations it triggers are data too — one entry
says "cure to max", another says "grant weapon X for 300s", a third
says "bump progress and refill". Keeping them in one switch means a
change to the catalog is a change to one file, not a scavenger hunt
across `player.ts` and the orchestrator. `player.ts` stays about how
the mage moves; `shop.ts` stays about what essence buys.

**The shield.** New `Player.shield` field, absorbs one hit outright but
still triggers i-frames and knockback so the save reads as a real hit
that landed on the shield rather than as the game eating the input. A
tiny cyan pip appears beside the hearts on the HUD while it's up. Reset
on death alongside weapons.

**The Vessel Fragment.** Bumps `Progress.bonusMaxHearts`, which
`Player.maxHearts` reads at every reset. Cap of three (so max hearts
tops out at seven). Saves from before the shop shipped migrate to
`bonusMaxHearts = 0` on load, so no existing player loses anything.

**Phase machine.** New `"shop"` phase sits between `"transition"` and
`"bossIntro"`. The sim is paused, the presentation still runs (so the
boss room is visible behind the overlay), the room is sealed. The
overlay is React state driven off `hud.shop`, not imperative — same
push-to-HUD pattern as everything else in this project, so the shop
doesn't need its own polling loop. Two imperative surfaces —
`buyShopItem(id)` and `closeShop()` — are the only things the React
layer calls into.

**Regression risk.** The bench-heal path already used `healPlayer(p)`,
which was reading `PLAYER.maxHearts`. Changed it to read `p.maxHearts`
so post-Vessel players actually refill to their new cap when resting.
`resetPlayer(p)` now takes `{maxHearts?}` and is called with the saved
bonus at both `start()` and `respawn()`.

---

### v3.1 — the aim you actually asked for

The v3 latch worked in isolation but had a subtle ordering bug that made
the ORIGINAL COMPLAINT still happen. The sequence is worth stating in
full because I got it wrong the first time and only the second time
worked.

**Wrong:** the latch captured `p.aimX/aimY` on `firePressed`, BEFORE
refreshing aim from the stick. So if the stick was still deflected up
when CAST fired, the latch saw the previous frame's aim (horizontal from
the fallback) and locked to that.

**Right:** three passes, in this exact order, once per frame:

1. **Refresh** aim from the stick's CURRENT direction. `snapAimStrict`
   returns null when the stick is idle, and in that case we keep the
   previous aim. This is what makes "push up, release, then press CAST"
   fire upward — the aim persists on release instead of snapping to the
   facing fallback.
2. **Latch** on `firePressed`. Now the snapshot reads the freshly-updated
   aim, so it captures the direction the player is currently pointing.
3. **Enforce** the latch. If engaged, aim is frozen to the snapshot;
   subsequent stick motion moves the mage without moving the shot.

The regression test in `test/sim.test.ts` walks the exact real-world thumb
sequence — push up, release, press CAST while stick idle, then run right
— and asserts it fires up throughout. That test would have failed on v3
and passes now.

### v3.1 — Landscape lock + a real loader

The game route now ships its own `_layout.tsx` that sets
`orientation: "landscape"` on the native stack. This is per-route, so the
rest of Magic World (which is a portrait kids-book app) is unaffected. No
new dependency — the option is a first-class prop on
`@react-navigation/native-stack`, which `expo-router` already uses.

The loading screen is no longer an `ActivityIndicator` on black. It's a
paper-theatre gradient built out of layered translucent rectangles (no
linear-gradient dep), a breathing arcane orb, the game logo, and a
rotating tip. The tips teach one control per launch — aim latch, pogo,
dash, benches, sealed doors, the boss rhythm — because the last complaint
was "I didn't know I could shoot up." Now you find out on the loader.

The loader also delays its fade-in by 380ms, so a fast load never flashes
the chrome. If load takes under 400ms nobody ever sees it.

---

---

## What v3 added

### Aim latch — the fix for the one-stick shooter problem

The stick used to do double duty: push it right to run right, push it up to
aim up. And that is where a single-stick touch shooter dies — moving is
aiming, so you can't run in one direction while shooting in another.

The fix is a latch. When CAST is pressed, the current stick direction is
captured as the aim. While CAST stays held, the stick controls movement
alone and the aim stays put. Release CAST and the latch clears.

    push stick up  →  press CAST  →  aim latches up
                   →  push stick right  →  runs right, keeps firing up
                   →  release CAST  →  aim unlocks, follows stick again

The reticle draws in the world (a cyan star at 2.4wu along the aim vector),
so the player sees where they're aiming and sees when it's locked — the
reticle grows and rotates faster while the latch is active. There is no
other way for the player to tell whether they're firing up or firing right
at phone-screen size, and the reticle is the entire feedback loop.

### Dash — double-tap the stick

24wu/s for 180ms with 240ms of i-frames, on a 900ms cooldown. Cancels
downward velocity at the start so you can use it to dodge a falling
projectile.

Triggered by double-tapping the movement zone in the direction of the
second tap. That gesture reads as intentional — a single tap never fires
it — and takes zero pixels of HUD, unlike a dedicated dash button that
would have to steal thumb real estate from CAST or JUMP.

The status pip next to CAST tells you when it's ready (cyan glow), when
it's active (white, scaled up) and when it's on cooldown (dim). The pip is
what teaches the mechanic without a modal.

### Pogo — the down-strike

Fire straight down while airborne, hit an enemy or a boss, bounce. Bounce
velocity is 21wu/s against a 23.6wu/s jump, so you *just* barely lose
altitude per pogo — enough that a chain reads as a rhythm skill rather than
free flight. Refunds the jump buffer so a chain isn't gated by the coyote
window closing after the first bounce.

One mechanic, and it reshapes the whole game: pogo Gorge Mother to stay
above her landing shockwaves, chain-pogo across the Emberway pits, use the
Choir orbs as stepping stones to circle the boss without touching the floor.

### Reticle

A world-space mesh, not a UI overlay, because it has to scroll with the
camera, get shaken by hitstop, and pop through FX rather than sit on top of
them. Two additive cards — an inner four-point star and an outer glow disc.
Grows and glows brighter under the latch so the aim mode is visible at a
glance.

---

## The v2 changes still apply

### The black band down the right of the screen

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
wrong.

### The map felt tiny because the camera showed all of it

`CAMERA.viewHeight` was 15.5 with width derived from the aspect ratio. On a
landscape phone (~2.2) that is **34 world units of visible width** — wider
than the entire 32wu arena. The level fitted on one screen and the camera
never moved.

The rig now owns the frustum and clamps the *width* (`CAMERA.maxViewWidth`),
shrinking the height on wide displays instead of revealing more world. It
also follows vertically through a deadzone, which the old flat 0.42
multiplier could not do — `spire_climb` is 62wu tall.

### Waves became a world

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

## The layout

```
config.ts              every tuning number in the game, including v3's
                       aimLatchOnCast / dashSpeed / pogoBounce
types.ts               shared entity, world and HUD types

world/
  rooms.ts             THE MAP — 20 rooms, 8 biomes, the gate graph

engine/
  useGLGame.ts         GL lifecycle, minimal render path, fixed-step loop
  Disposer.ts          resource tracking — nothing leaks
  input.ts             stick, 8-way aim + strict variant for the latch

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
  player.ts            controller, aim latch, dash, pogoBounce()
  projectiles.ts       pooled bolts, homing, piercing
  enemies.ts           pool + per-kind minion AI
  bossAI.ts            the seven state machines
  pickups.ts           drops, magnetism, blink-out
  world.ts             room transitions, gate locking, progression
  camera.ts            frustum fitting, follow, room clamping, shake

index.ts               orchestrator: rooms, bosses, death, collisions,
                       reticle, dash FX, pogo hook
```

### Why rooms are rebuilt rather than pre-built

Twenty rooms averaging ~80wu is on the order of a thousand extrusions.
Holding them all resident would be hundreds of MB of VRAM in an app that also
carries 97 MB of GLB. One room is 60–140 extrusions, built behind the 0.26s
transition fade where the screen is already black.

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

---

## Tests

```bash
npx tsx test/sim.test.ts
```

Around 90 checks covering aim (including all 8 headings, the latch, the
strict-snap fallback), dash (i-frames, cooldown, direction lock, re-arm),
pogo (bounce velocity, ground guard, chain viability), the movement feel
(coyote time, jump buffer, variable height, frame-rate independence), the
world graph (dangling gates, mismatched return gates, unreachable rooms),
spawn safety (no room drops the player onto a pit, no door lands them in
a hole), and the free-versus-member split (free reaches exactly three
bosses, membership opens the rest).

These aren't ceremony. Every failure listed above was a bug the tests
caught before the player did.
