# ARK

**Own Intentionally. Preserve Everything.**

A personal asset operating system: one place to organise, preserve, understand and
maintain everything you own across a lifetime. Not an expense tracker, not an
inventory spreadsheet, and deliberately not a shopping app.

People remember buying things. They rarely remember why. ARK keeps the reason
alongside the object — what it is for, what it replaced, who gave it to you, what it
needs in order to last, and what should happen to it eventually.

## Running it

Open `index.html` in any modern browser. There is no build step, no server, no
account and no network access. The entire application — markup, styles, logic,
artwork and sample library — is one self-contained file.

```
open ark/index.html
```

The library is stored in `localStorage` under `ark.library.v1` and can be exported
to JSON from Settings.

## What's in it

| Area | What it does |
|---|---|
| **Home** | Total assets, collection value, newest acquisition, what needs attention, maintenance schedule, warranty watch, most valuable collection, recent activity, growth timeline |
| **Collections** | Ten seeded collections plus custom ones; each with cover artwork, statistics and its own growth curve |
| **Asset page** | Every field the object deserves — provenance, warranty, serial, condition, usage, storage location, purpose, reason bought, story, care notes, service history, related items, succession lineage, cost per use, stewardship score |
| **Timeline** | Acquisitions, memories, services and partings across every year, filterable |
| **Maintenance** | Recurring and one-off reminders with intervals, completion history and warranty watch |
| **Value** | Growth over time, distribution by collection, committed-by-year, appreciation and depreciation, longest held — each chart with a table view |
| **Memories** | A feed of moments attached to objects, by year, kind and place |
| **Wishlist** | Priority, need vs want, alternatives, long-term value, and a readiness meter |
| **Decision support** | A seven-question reflection plus a thirty-day cooling-off period, both required before anything moves from the wishlist into the library |
| **Gallery** | Grid, editorial, by collection, by year and large-preview modes, with a lightbox |
| **Statistics** | Average holding period, most-owned category, usage and condition distributions, best value by use, most meaningful objects, intention gaps |
| **Search** | Global search over every field including stories and memories, with filters and a ⌘K palette |

## Design notes

- **Ownership, not acquisition.** Nothing in the interface encourages buying more. The
  wishlist enforces a wait, the statistics surface what is already owned and unused,
  and the ownership review asks whether things still serve you.
- **Parting with is recorded, not deleted.** Objects that leave stay in the timeline
  with the reason they left, and successors link back to what they replaced.
- **Stewardship over price.** Each object scores on how well it is kept — intention
  written down, story preserved, maintenance current, care notes, provenance,
  location, end-of-life plan — not on what it cost.
- **No external assets.** Cover artwork is generated deterministically from each
  object's id and its collection's hue, so an object's image is stable forever.
  Uploaded photographs are downscaled and stored inline.
- **Charts.** Single-measure, single-hue, one axis, direct labels, hover crosshairs and
  a table view on the main analyses. The ordinal ramp is validated for lightness
  monotonicity, step separation and contrast in both light and dark themes.
- **Motion and colour.** Warm black on off white with a muted gold accent; slow,
  meaningful transitions; full `prefers-reduced-motion` support; dark mode throughout.

## Architecture

One file, sectioned in order: utilities → seed library → store and persistence →
selectors → icons and generated artwork → charts → shell and router → views →
dialogs, forms and actions.

- **Single write path.** Every mutation goes through `mutate()`, which persists,
  appends to the activity log and re-renders — so storage, history and the UI cannot
  drift apart.
- **Derived truth lives in selectors.** Views read; they never compute.
- **Sync-ready data.** The library is versioned (`SCHEMA`), id-stable and carries
  `createdAt`/`updatedAt` timestamps, so two copies can be diffed rather than guessed
  at when synchronisation is added.
- **Hash routing** with query parameters for view state (sort, filter, gallery mode,
  photo index), so every screen is linkable.

## Keyboard

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette and global search |
| `/` | Same |
| `n` | Add an object |
| `Esc` | Close the topmost dialog |
| `↑` `↓` `↵` | Navigate and open palette results |
