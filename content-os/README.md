# Grow Mindset — Content OS

A local-first operating system for a high-volume, multi-project content universe.
It answers three questions at a glance — *what is my whole content machine doing, what should I do right now, and what have I forgotten* — and stays fast at 10,000+ episodes.

```
npm install
npm run dev          # API on :4317, app on http://localhost:5173
```

On first start an empty database is created in `data/content-os.db` and filled with a realistic demo universe (5 projects, ~110 episodes in every production state). Set `CONTENT_OS_NO_DEMO=1` to start empty instead.

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) + Vite dev server with hot reload |
| `npm run build && npm start` | Production build; one process serves app + API on http://localhost:4317 |
| `npm run seed` | Reset to the demo universe (previous DB is moved to `data/backups/`, never deleted) |
| `npm run seed -- --scale 5000` | Demo + 5,000 synthetic episodes for performance testing |
| `npm run seed:empty` | Reset to a clean database with only base configuration |
| `npm run build:html` | Build the single-file app → `content-os.html` |
| `npm test` | Readiness-engine unit tests + the API suite against both Node SQLite and SQLite-WASM |
| `npm run typecheck` | TypeScript across server, shared and client |

Requires Node 20+. No external services, accounts or API keys.

### Single-file version (no install)

`content-os.html` is the whole app in one file. Double-click it — it opens in your browser with the demo universe and works offline. Build it yourself with `npm run build:html`.

- It runs the **same** API, services, schema and search as the server version, on SQLite compiled to WebAssembly (official `@sqlite.org/sqlite-wasm`, which includes FTS5) — the API test suite runs against both backends.
- Data is saved in that browser (IndexedDB) after every change. **Settings → Data & backup** downloads a backup, restores one, or resets to demo/empty (a safety copy downloads first).
- Backups are ordinary SQLite files and move freely between versions: copy one to `data/content-os.db` to continue on the server version; the server version’s **Download backup** (`/api/export`) can be restored into the HTML file.
- Differences: file *upload* is disabled (reference assets by path or link instead), and data is per-browser — another browser or computer starts fresh until you restore a backup.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Database | **SQLite** via `better-sqlite3`, WAL mode, FTS5 | Single-file, zero-ops, local-first, transactional; FTS5 gives indexed full-text search over thousands of scripts. Easy to back up (copy one file). |
| Server | **Hono** on Node, `zod` validation | Tiny, typed, fast. Synchronous SQLite calls inside transactions keep every write atomic. |
| Shared | `shared/domain.ts` | The readiness/dependency engine and all enums, imported by both server and client (and usable by future automation). |
| Client | **React 19 + Vite + TanStack Query + TanStack Virtual + Tailwind v4** | Server state with automatic refresh after writes; virtualised library for 10k rows; no client-side copy of the database. |

The repo root is a Unity project; Content OS lives self-contained in `content-os/` and doesn't touch it.

```
content-os/
  shared/domain.ts        stages, dependency graph, readiness engine, board-move semantics
  shared/api.ts           wire types
  server/schema.ts        versioned SQL migrations (tables, indexes, CHECKs, FTS triggers)
  server/db.ts            connection, migrations (+ automatic backup before migrating)
  server/services/        episodes · projects · library (ideas/sources/insights/people)
                          publishing (publications/assets/metrics) · intelligence · config
  server/api.ts           REST routes
  server/seed-data.ts     base configuration + demo universe generator
  src/pages/              Dashboard, Today, Episodes, EpisodeWorkspace, Board, Projects, …
  src/components/         shell, command palette, bulk bar, stage strip, charts, dialogs
  tests/                  vitest: domain engine + API integration
```

---

## Data model

```
PROJECT ─┬─ SERIES ─┐
         └──────────┴─ EPISODE ─┬─ episode_stages (11 rows: one per stage, independent status)
                                ├─ ASSETS (versioned: kind + name + version)
                                ├─ PUBLICATIONS (one per platform) ── publication_metrics (snapshots)
                                ├─ tasks (checklist)
                                ├─ episode_sources ── SOURCE ── PERSON
                                ├─ episode_insights ── INSIGHT ── SOURCE
                                ├─ episode_relations (related / sequel / variant / duplicate)
                                ├─ episode_tags ── TAG
                                └─ idea_id ── IDEA (origin) ── insight_id / source_id
```

Key decisions:

- **One episode = one content object.** Production state lives in `episode_stages` — one row per stage with its own status (`NOT_STARTED | IN_PROGRESS | BLOCKED | DONE | SKIPPED`), note (blocker reason), `started_at`, `completed_at`. There is no single global status column to overwrite.
- **Content types define workflows** (`content_type_stages`: `REQUIRED | OPTIONAL | NONE` per stage). A quote card has no voice/edit/cover; a long-form video requires everything. Changing a workflow recomputes readiness for every episode of that type.
- **Computed columns are a cache, not a source of truth.** `episodes.phase / readiness / next_stage / actionable / blocked / published_at / scheduled_at` are written only by `recomputeEpisodes()` after any stage, publication or type change. They exist so the library can filter and sort 10k episodes in SQL (“waiting for voice” is an indexed `LIKE` on `actionable`).
- **Books are sources with `type = BOOK`; people are first-class** (`people`, linked from sources). Avoids a parallel “books” table that would duplicate sources.
- **Insights are separate from ideas and episodes.** Research (insight) → content candidate (idea) → production (episode). One insight can seed many ideas/episodes.
- **Publications, not duplicated episodes.** One episode → Instagram + TikTok + YouTube rows. Publishing/scheduling a publication automatically completes the Publish/Schedule stages.
- **Analytics foundation:** `publication_metrics` stores time-stamped snapshots (views, likes, saves, shares, followers, watch time, completion) — append-only, so growth curves can be analysed later.
- **Soft delete vs archive.** `archived_at` = out of the way but searchable; `deleted_at` = trash (hidden, restorable). Permanent deletion only from the trash. Projects/series with episodes can't be deleted, only archived.
- **Safety.** CHECK constraints on every enum, foreign keys on, every write in a transaction, DB file backed up before any migration and before reseeding.
- **Search.** One FTS5 table maintained by triggers (rowid = kind × 10¹⁰ + id, so updates are O(log n)). Porter stemming + prefix indexes. Episode codes (`BIB-041`, `bib 41`) resolve directly.
- **Future AI layer.** `embeddings(entity_type, entity_id, model, content_hash, vector)` exists but is unused; similarity goes through a `SimilarityProvider` interface (V1 = BM25 over FTS). Swapping in embeddings changes no callers.

---

## How the engine thinks

### Dependencies (`shared/domain.ts`)

```
RESEARCH → CONCEPT → SCRIPT → VOICE ──┐
                         └──→ VISUAL ─┴→ EDIT → QC ──┐
                  CONCEPT → CAPTION ─────────────────┼→ SCHEDULE / PUBLISH
                  CONCEPT → COVER ───────────────────┘
```

Voice and visual run in parallel; caption and cover can be written during the edit. Dependencies are **advisory**: doing a stage early is allowed (with a gentle warning), never blocked. Only *required* stages participate; a non-required stage is skipped over to its own prerequisites.

### Readiness

Effort-weighted share of required stages that are done (visual = 3, script/edit = 2, voice = 1.5, research/concept = 1, packaging = 0.5, release = 0.25); in-progress counts 40%. **Current blocker** = the earliest unfinished required stage (or the blocked stage, with its reason). **Actionable** = every unfinished stage whose prerequisites are complete — what can be worked on right now.

### Board columns are a view

`IDEA → RESEARCH → SCRIPT → VOICE → VISUAL → EDIT → QC → READY → SCHEDULED → PUBLISHED` is derived from stage state. Dropping a card **forward** completes the required stages before that column and opens the target; **backward** re-opens the target stage only. Later work (e.g. a finished caption) is never destroyed. Every move and bulk change returns an undo snapshot.

### Bottleneck (Little’s law)

For each stage: *work at the station* = episodes whose prerequisites are done but the stage isn’t (not-started + in-progress); *throughput* = completions in the last 14 days. The bottleneck is the stage with the longest queue time (work ÷ daily throughput); a queue with zero recent throughput ranks first because nothing is moving. Caption/cover only count once production is finished, otherwise every early concept would look “stuck at caption”.

### Next best action

Deterministic, explainable scoring (no AI): publish ready work when today’s target isn’t met → confirm overdue scheduled posts → urgent/overdue episodes → batch the bottleneck stage (boosted when the ready queue is thin) → resolve blockers (scaled by count and age) → finish near-ready episodes → revive stalled work → process the inbox → refill the front of the pipeline. Each recommendation carries its reason and a deep link.

### Resurface engine

Ideas untouched for N days (configurable) with age; unfinished “developing” ideas; episodes with no progress for N days; active projects with no activity; sources whose produced count is below your estimated potential or whose insights were never used; dormant ideas related (by project or shared tags) to series you touched this week. Every item can be developed, kept (resets the clock), snoozed or let go.

### Today

Target = distinct **episodes** published today (cross-posting one episode to three platforms is one piece of output; publication count is shown alongside). Today shows the pinned queue, ready work with one-click publish, unconfirmed scheduled posts, due/overdue work, the bottleneck batch with one-click “stage done”, and blockers with one-click unblock.

---

## Using it

- **Ctrl K** — command palette: search everything (episodes, ideas, sources, insights, people, series, projects, assets), jump by code (`BIB-041`), run commands (create, open views, random idea, find similar).
- **N** new episode · **I** capture idea · **G then D/T/E/B/P/I/S/R** navigate.
- Library: filters live in the URL (shareable, restorable). Shift-click selects ranges; “Select all N” selects every match, not just loaded rows. Bulk: set any stage, move, priority, series, type, due date, tags, source, add to today, schedule at a cadence, mark published, duplicate, archive, trash — with undo.
- New episode dialog warns when something similar already exists.

## Automation API

Everything the UI does is a REST call under `/api`, so research/script/voice/visual agents can drive the same workflow. Send `X-Actor: automation:<agent-name>` to attribute changes in the activity feed.

```http
POST /api/sources                       {title, type, author}
POST /api/sources/:id/insights          {statement, locator}
POST /api/insights/:id/idea             {projectId}
POST /api/ideas/:id/convert             {to: "episode", projectId, seriesId}
PATCH /api/episodes/:id                 {script, hook, coreIdea, …}
PUT  /api/episodes/:id/stages           {changes: [{stage: "VOICE", status: "DONE"}]}
POST /api/episodes/:id/assets           JSON {kind, name, fileRef} or multipart with `file`
POST /api/episodes/:id/publications     {platform, status: "SCHEDULED", scheduledAt}
POST /api/publications/:id/metrics      {views, likes, saves, …}
POST /api/episodes/query                EpisodeQuery (filters/sort/group/paginate)
POST /api/episodes/bulk                 {ids, action}
GET  /api/dashboard · /api/today · /api/next-actions · /api/bottleneck · /api/resurface · /api/search?q=
```

Errors are JSON `{error, detail}` with meaningful status codes (400 validation, 404 missing, 409 conflicts such as duplicate codes or deleting a non-empty project).

---

## Assumptions

- **Single owner, no accounts.** Local-first; run it on your machine (or self-host behind your own auth). Multi-user permissions were deliberately not built.
- **Daily target counts episodes, not platform posts.** Changeable in one place (`todayNumbers()`), if posts are what you meant.
- **“Published today” uses your machine’s local day.**
- **Files stay where you keep them.** Assets store a path/URL; optional uploads go to `data/uploads/`. The app never deletes files on disk.
- **No social-platform integrations in V1.** Publishing is recorded, not executed. The publication + metrics tables are the boundary where platform APIs plug in.
- **No AI dependency.** Similarity, recommendations and resurfacing are deterministic. The `SimilarityProvider` seam and `embeddings` table are where an AI layer attaches.

## Performance (measured, 10,108 episodes)

| Operation | Time |
|---|---|
| Library page (100 rows, any filter/sort/group) | 4–70 ms |
| Full-text search / similarity | ~5 ms |
| Episode workspace | ~3 ms |
| Dashboard (all aggregates) | ~260 ms |
| Seed 10k episodes | ~7 s |

The client never loads the whole database: the library pages 100 rows at a time into a virtualised list; the board loads 40 cards per column with “show more”.
