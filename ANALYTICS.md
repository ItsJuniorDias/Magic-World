# Magic World — Analytics

## What lives where

- **Engine** — `services/analytics.ts`. Batch queue, session mgmt, offline persistence, dual sink (backend + GA4). This is what every screen calls.
- **Backend sink** — [analytics-magicworld.onrender.com](https://analytics-magicworld.onrender.com). First-party, Fastify + Postgres. Owns the funnel dashboard.
- **GA4 sink** — `services/analyticsHelper.ts`. Mirrors every event (fire-and-forget) so the Firebase dashboards keep working during the transition.
- **User id** — `utils/anonymousUser.ts`. Random UUID persisted in AsyncStorage. Kids-safe: no IDFA, no email, no name.

## How to fire an event

```ts
import { track } from "@/services/analytics";

track("story_open", {
  story_id: story.id,
  story_title: story.title,
  is_pro_content: !!story.isPro,
  source: "home",
});
```

Naming rules:

- `snake_case`, `[a-z][a-z0-9_]*`, ≤ 64 chars.
- Present-tense verb OR noun phrase. `story_open`, not `opening_a_story`.
- Pair events explicitly: `chapter_view` / `chapter_finished`, `favorite_added` / `favorite_removed`.
- One event, one intent. Don't fold "user viewed AND scrolled AND liked" into a single event.

The engine enriches every event with `user_id`, `session_id`, `platform`, `app_version`, `country`, `locale`, `is_pro`, `ts`. Don't pass those manually.

## Event dictionary

### Session
| Event      | Where | Params |
| ---------- | ----- | ------ |
| `app_open` | `_layout.tsx` bootstrap | — |

### Onboarding
| Event                       | Where | Params |
| --------------------------- | ----- | ------ |
| `onboarding_view`           | `(app)/index.tsx` mount | — |
| `onboarding_cta_pressed`    | Get Started button | `cta` |

### Navigation (tab impressions)
| Event             | Where |
| ----------------- | ----- |
| `home_view`       | `(tabs)/index.tsx` mount |
| `favorite_view`   | `(tabs)/favorite.tsx` mount |
| `games_hub_view`  | `(tabs)/games.tsx` mount |
| `profile_view`    | `(tabs)/profile.tsx` focus |

### Stories
| Event                  | Where | Params |
| ---------------------- | ----- | ------ |
| `story_open`           | Card `onPress` (home, favorite) | `story_id, story_title, is_pro_content, source` |
| `story_open_locked`    | Same, when pro content + free user | `story_id, story_title, source` |
| `chapter_view`         | `(storie)` mount per chapter | `story_id, story_title, chapter_index` |
| `chapter_finished`     | `handleFinishReading(force=true)` | `story_id, story_title, chapter_index` |
| `chapter_next_locked`  | `handleNextChapter` gate | `story_id, chapter_index, blocked_target_index` |

### Favorites
| Event                | Where | Params |
| -------------------- | ----- | ------ |
| `favorite_removed`   | `(tabs)/favorite.tsx` toggle | `story_id, source` |

*(`favorite_added` isn't emitted yet — the home Card `onPress` currently opens instead of toggling. If you add a heart on the home card that toggles, wire `favorite_added` there.)*

### Games
| Event             | Where | Params |
| ----------------- | ----- | ------ |
| `game_open`       | Games hub card | `game_id, featured` |

*(`game_finished` per game is a good next step — Quiz has a natural `showFinalModal` moment, Spell Storm has boss defeated, Memory has all matched, Endless Runner has death. Not wired yet.)*

### Paywall funnel (canonical — the backend dashboard queries these by name)
| Event                     | Where | Params |
| ------------------------- | ----- | ------ |
| `paywall_gate_shown`      | `AppBootstrap` cold-start gate, before `router.replace` | `source` |
| `paywall_view`            | `loadOfferings` | `source, has_monthly, has_annual, default_selection` |
| `paywall_plan_selected`   | Plan card `onPress` | `source, plan, package` |
| `checkout_initiated`      | Subscribe button tap | `source, plan, product_id, value, currency, trial_days` |
| `start_trial`             | RC returns active + `trial_days > 0` | `source, plan, product_id, value, currency, trial_days` |
| `subscribe`               | RC returns active + no trial | `source, plan, product_id, value, currency` |
| `purchase_cancelled`      | Apple sheet closed by user | `source, plan, package, reason` |
| `purchase_restored`       | Restore button | `source, active` |
| `paywall_dismissed`       | Close button | `source` |
| `paywall_link_opened`     | Terms / Privacy | `source, link` |

**`source` values** — the paywall UI (`components/PaywallScreen`) backs three routes; every event above carries a `source` field so the funnel can split them:

- `"subscribe_screen"`   — user-initiated from Home / Favorite / locked story (`app/(subscribe)`)
- `"post_onboarding"`    — forced gate right after `(profile-adventure)` (`app/(paywall-onboarding)?source=post_onboarding`)
- `"cold_start_gate"`    — recurring gate on every cold start until the user subscribes (`app/(paywall-onboarding)?source=cold_start_gate`, fired from `AppBootstrap`)

**Why `paywall_gate_shown` is separate from `paywall_view`:** the gate event fires the moment `AppBootstrap` decides to route the user to the paywall — before RC offerings have loaded. `paywall_view` fires INSIDE the paywall after `getOfferings()` returns. The split lets us measure "offering fetch failure" as a distinct funnel drop from "user dismissed" or "user converted". Expected ratio in a healthy build: `paywall_gate_shown ≈ paywall_view` with a ~2–5% delta from offline / network failures.

**Why the split between `start_trial` and `subscribe` matters:** the funnel dashboard on the backend computes trial → paid conversion using these two events specifically. If both trial starts and paid conversions land under a single `purchase_successful` (the old GA4 name), we lose the ability to see how many trials actually converted vs cancelled during the trial window.

### Settings
| Event                  | Where | Params |
| ---------------------- | ----- | ------ |
| `language_changed`     | LanguageSelector | `from, to` |
| `notification_toggled` | Profile toggles | `kind, enabled` |

## Debugging

- In DEV every `track()` call prints to the Metro console prefixed with `[analytics]`. Look for the enriched params — that's exactly what hits the wire.
- Every GA4 send prints `[ga4] event_name sent (client_id=…)` in DEV.
- If the backend is down, events sit in the AsyncStorage queue (`@analytics_queue_v1`) and get retried on the next flush interval (5s) or the next app open. Nothing is lost as long as the process isn't killed with > 500 events queued.
- Force a flush before a route that might kill the process:
  ```ts
  import { flushAnalytics } from "@/services/analytics";
  await flushAnalytics(1500); // 1.5s timeout, non-blocking beyond that
  ```

## Environment

- `EXPO_PUBLIC_ANALYTICS_ENDPOINT` — override the backend URL. Empty string disables the backend sink entirely (useful in E2E tests). Defaults to `https://analytics-magicworld.onrender.com/events`.

## Configuration constants (in `services/analytics.ts`)

| Const                  | Default | Meaning |
| ---------------------- | ------- | ------- |
| `BATCH_SIZE`           | 20      | Force flush when the queue reaches this |
| `FLUSH_INTERVAL_MS`    | 5_000   | Timer-based flush cadence |
| `SESSION_IDLE_MS`      | 30 min  | New session id after this much silence |
| `MAX_QUEUE`            | 500     | Hard cap for both memory and AsyncStorage persistence |
| `MIRROR_TO_GA4`        | true    | Flip to `false` when GA4 is retired |

## Adding a new event

1. **Pick a canonical name** using the rules above and add it to the `CanonicalEvent` union in `services/analytics.ts` so callers get autocomplete.
2. **Call `track("event_name", { ...params })`** wherever the event fires. Never `await` — it's fire-and-forget by design.
3. **Update this file** with a one-line description of when it fires and what params it carries.
4. If the event should feed a new funnel widget in the dashboard, coordinate with the backend — the current dashboard only draws bars for the funnel-critical four (`paywall_view`, `checkout_initiated`, `start_trial`, `subscribe`).

## Privacy

Everything sent is either device-neutral metadata (platform, app version, locale, country) or a random UUID. No IDFA, no email, no name, no birthdate. Consistent with the Kids Category policy the app operates under.
