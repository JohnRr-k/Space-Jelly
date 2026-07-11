# ASCENSION

A personal transformation operating system, built for exactly one person: **Russ**.

ASCENSION is not a habit tracker, a to-do list, or a dashboard. It is the quiet
machine behind an intentional day: it decides what Russ wears, reminds him what
he holds himself to, walks him through a morning and a night ritual, and hands
him one number — his **Prime status** — that tells him where today stands.

## Run it

```bash
npm install
npm run dev        # local development
npm run build      # production bundle in dist/
npm run preview    # serve the production bundle
npm test           # domain test suite (Vitest)
npm run typecheck  # strict TypeScript, no emit
```

The production bundle in `dist/` is fully static (`base: "./"`); host it on any
static host, or open it on a phone and add it to the home screen. All data
lives in the device's localStorage — there is no backend, no account, and
nothing leaves the device.

## The product in one paragraph

The **Daily** screen is the heart. It reads the clock: at dawn it leads with
the Morning Protocol and the day's outfit + fragrance (already chosen — "Swap"
exists only for disagreement); through the day it foregrounds Standards and
hydration; after dark it turns to the Night Protocol and ends in the closing
ritual — three reflection prompts, then **Seal the day**, which freezes the
day's Prime score forever. **Progress** shows the streak, a 14-day trend, and
the four pillars. **System** is where the machine is configured: protocols,
standards, wardrobe, fragrances, identity.

## Layout

```
src/
  domain/    Pure business logic. No React, no storage. Fully unit-tested.
  data/      The Zustand store + versioned localStorage persistence.
  ui/        Reusable primitives (Card, CheckRow, ProgressRing, Sheet, Chip).
  features/  One folder per screen: daily/, progress/, system/.
  app/       Shell: App, TabBar, ErrorBoundary, useNow (time context).
  styles/    Design tokens, base, primitives, screen composition.
```

See `docs/ARCHITECTURE.md` for the decisions behind this and
`docs/PRODUCT.md` for the product principles the code answers to.
