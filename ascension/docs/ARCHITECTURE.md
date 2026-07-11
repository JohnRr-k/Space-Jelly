# ASCENSION — Architecture Decisions

## 1. Local-first, no backend

ASCENSION serves one user. A backend would add accounts, sync, latency,
hosting, and failure modes — and deliver nothing Russ needs. All state lives
in `localStorage` behind a versioned persistence layer (Zustand `persist`,
`name: "ascension-v1"`, `version: 1` with room to migrate). The build is a
static bundle with relative asset paths, so it runs from any static host and
works as a home-screen app.

**Trade-off accepted:** no cross-device sync. If that ever matters, the
persistence layer is the single seam to replace.

## 2. Three layers, one direction

```
domain/  →  data/  →  features/ + ui/ + app/
```

- **`domain/`** is pure TypeScript: Prime scoring, streaks, the time-context
  engine, the recommendation engine, day-record construction, seed defaults.
  Zero imports from React or the store. This is where every product rule
  lives, and it is the only layer with unit tests — because it is the only
  layer with logic worth testing.
- **`data/store.ts`** is the single Zustand store. It owns invariants that
  span records: sealed days are immutable, config edits sync today's open
  checklist but never history.
- **`features/`** are screen compositions; **`ui/`** are dumb primitives.
  Components read domain functions; they never re-implement rules.

## 3. History is snapshotted, never recomputed

A `DayRecord` copies the ids of the steps/standards (and the hydration
target) that existed when the day was created. Editing the system tomorrow
must never change what yesterday meant. Sealing a day additionally freezes
its score (`sealedScore`); open days always score live. This makes history
stable under any future config change, at the cost of storing a few extra
keys per day.

## 4. Prime scoring

`score = 30% morning + 25% night + 30% standards + 15% hydration`, rounded,
0–100. Bands: <40 Drifting, <70 Building, <90 Ascending, ≥90 Prime. A day
"holds" (extends a streak) at ≥70. Weights favor execution over consumption
deliberately; they live in one constant in `domain/prime.ts`.

## 5. Recommendations are deterministic pure functions

Outfit and fragrance picks hash the calendar date, so the recommendation is
stable for the whole day (an app that changes its mind at lunch creates
decision fatigue — the thing it exists to remove). Rules: the week dresses
sharper toward Friday, relaxes on weekends; fragrance follows phase of day,
weekend nights, and season. The engine sits behind two small function
signatures (`recommendOutfit`, `recommendFragrance`) so a weather-aware or
model-backed engine can replace it without touching UI.

## 6. Time is a context, not a query

`useNow()` is the app's only clock: it refreshes on an interval and on
focus/visibility, yields `{ now, dateKey, phase }`, and drives day-rollover
(`ensureDay`) plus the Daily screen's phase-aware card ordering. Components
never call `new Date()` themselves.

## 7. One theme, hand-rolled CSS

No CSS framework. `styles/tokens.css` is the entire design language (a
near-black surface scale, one champagne accent, a serif display stack); every
component styles itself from tokens. Dark-only is a product decision, not a
missing feature — the app is used at 05:30 and 22:00.

## 8. Testing posture

30 Vitest tests pin the domain: scoring weights and bands, streak semantics
(missing days break, unfinished today doesn't), date arithmetic across
boundaries, recommendation determinism and preferences. UI is kept thin
enough to verify visually; if a screen ever grows logic, that logic moves to
`domain/` and gets tests there.

## Known deferred items (deliberate)

- No service worker yet (installable-offline PWA is the natural next step;
  the bundle is already static and self-contained).
- Protocol steps can be added/removed but not reordered or edited in place.
- Reflections are stored but not yet resurfaced (a "past reflections" view
  belongs in Progress later).
- `AGENTS.md`-style AI recommendations: the engine is rule-based by design
  today; the seam for something smarter is documented in §5.
