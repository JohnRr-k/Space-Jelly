# LEGACY

**Your Life. Remembered Forever.**

A personal archive for memories, experiences, people, places, and the lessons
between them. Open `index.html` in a browser — there is no build step, no
server, and no account. The archive lives in your browser and nowhere else.

The first version ships as a single self-contained HTML file. That is a
distribution format, not the architecture: the file is hand-written and
sectioned so each layer lifts out into its own module unchanged.

---

## The idea

Modules are not silos — they are **lenses over one typed record graph**.

A memory, an experience, a person, a place, a lesson, a letter, an achievement,
a track, a chapter and a collection are all records in a single flat map, joined
by typed relations. Timeline, Gallery, Search and the Places chart are views
over that same graph. This is why a person's page can show every memory you
share without a single field being duplicated, and why deleting a record severs
its edges everywhere at once.

## Layers

Read the file top to bottom; each section only knows the ones above it.

| § | Layer | Responsibility |
|---|-------|----------------|
| 01 | `core` | DOM hyperscript, dates, seeded hashing, event bus |
| 02 | `schema` | Every record type declared **once** |
| 03 | `store` | Flat record map, relation graph, persistence, migrations |
| 04 | `search` | Inverted index, weighted by the schema |
| 05 | `plates` | Procedural photographic fields on canvas |
| 06 | `sample` | A complete life, so nothing opens empty |
| 07 | `ui` | Sheets, toasts, the composer, the command palette |
| 08 | `views` | One lens per module |
| 09 | `boot` | Shell, router, keyboard, first run |

### The schema is the load-bearing idea

`SCHEMA` declares each record type's fields once, and that declaration drives
the composer form, the detail-page apparatus, search weighting, validation and
the timeline. Adding a field to a record type is a one-line change, not a sweep
through eleven views. All eleven types get create / edit / delete from a single
code path.

## Data

- **Graph** — `localStorage` under `legacy.archive`, JSON, versioned with a
  forward-migration table (`MIGRATIONS`).
- **Photographs** — `IndexedDB` (`legacy-assets`), referenced by id. Binary
  never enters the JSON graph.
- **Portability** — Settings exports the whole archive as JSON and imports it
  back. Swapping in a sync backend means reimplementing `Store.persist` /
  `Store.hydrate` and nothing above them.

Until you attach a real photograph, every record renders a **plate**: a
generated field seeded by the record's own id, so it is stable forever and
identical in every view.

## Design

Warm paper by day (**Daylight**), the same archive at night (**Nocturne**).
Both are designed at token level — the dark theme is not an inversion.

- Content a human wrote is set in an old-style serif.
- The archive's *apparatus* — dates, counts, coordinates, catalogue numbers —
  is typewritten in mono. That split carries the whole visual identity.
- Brass (`--brass`) is the only accent and appears as line, never as fill.
- Hairline rules instead of cards. No shadows on content, no rounded boxes.

## Keyboard

| | |
|---|---|
| `⌘K` / `/` | Search everything, jump anywhere, file anything |
| `N` | File something new in the current module |
| `G` then `H T M O P R L W A S G C` | Go to module |
| `⌘↵` | Save, from inside the composer |
| `Esc` | Close whatever is open |
| `?` | Shortcuts |

## Deliberate decisions

**Resonance, not a memory score.** Ranking your own memories numerically
cheapens them. Resonance is a private weighting that decides what resurfaces —
never displayed as a leaderboard.

**Sealed letters are a ritual, not encryption.** The words are in your own
archive and you could always look. The app says so plainly, and records when a
seal is broken early.

**Places is a navigational chart, not a street map.** Landmass geometry needs an
offline dataset a single-file build cannot carry, so places are plotted on a
real graticule framed on the ground you have actually covered — with the
latitude exaggeration stated in the caption rather than hidden. `project()` and
`toXY()` are the seam if you ever drop in tiles.

## Where this sits

LEGACY is one application in a personal ecosystem — ASCENSION grows you, LEGACY
remembers you, ORACLE guides you, ARK preserves what you own. Shared design
language, separate identities. The schema-driven store here is the pattern the
others should follow.
