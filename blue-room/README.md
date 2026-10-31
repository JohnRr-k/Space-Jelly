# The Blue Room

A private, local-first personal sanctuary for Janice: a cozy bedroom beside a living ocean that doubles as a journal,
a life archive (**Legacy**), a decision log (**Oracle**), a goals tracker (**My Future**), a calendar with reminders, and quick notes.

> Not a portfolio and not a public site. There are no accounts, no analytics, no trackers, and nothing is uploaded anywhere.

## Run it

```bash
cd blue-room
npm install
npm run dev          # http://127.0.0.1:5173
npm run build        # type-check + production build into dist/
npm run preview      # serve the build on http://127.0.0.1:4173
npm test             # unit tests (dates, recurrence, reminders, storage, backup, ORACLE integrity)
node e2e/smoke.cjs   # browser end-to-end test against `npm run preview` (needs Playwright)
```

Stack: Vite + React 19 + TypeScript, Dexie (IndexedDB), React Router (hash routes, so it works from any static host),
self-hosted Manrope + Newsreader fonts. No UI framework, no animation library: the scene is original SVG, the ocean is a small canvas engine.

## What's inside

| Area | What it does |
| --- | --- |
| **My Room** | Illustrated bedroom (SVG) with a live ocean through the window. 8 objects are real navigation: journal, calendar, photo board → Memories, goal board → My Future, desk notes, Oracle console, bookshelf → Legacy, window → Odyssey. Below it, a scroll story with a different layout per section, running marquee assets, parallax, a depth gauge, and pop-up "spotlights" shaped per item type. Phones get a compact ocean header + tiles. |
| **Journal** | Writing canvas, autosaved drafts, optional prompts, tags, categories, photos, calendar view, monthly/yearly archive, search & filters, prev/next, promote an entry to a Legacy memory (by reference, once). |
| **Legacy** | All nine sections: Timeline, Chapters (The Story) · Memories, Odyssey, People, Places (The Record) · Lessons, Letters, Achievements (What It Meant). Records connect to each other through links, never copies. Odyssey stages are editable in Settings. Letters can be sealed until a date (a gentle seal, not encryption). |
| **Oracle** | Decision Records (frozen once recorded, enforced in the storage layer) → Outcome Reflection (separate records) → Decision Replay (outcome hidden until the end) → Wisdom Library. Plain arithmetic "patterns" only; no AI. |
| **My Future** | Goals with milestones, board/list/archive views, auto or manual progress, calm wording for delays. |
| **Calendar** | Month / week / day / upcoming; recurring events (daily/weekly/monthly/yearly, intervals, end rules), all-day, per-occurrence completion, reschedule, goal milestones overlay, time zones & DST aware. |
| **Reminders** | In-app bell, evaluated every ~20 s while the app is open; missed ones are labelled as missed. Optional browser notifications (only while a tab is open). |
| **Notes** | Quick capture, pin, categories, tags, convert to a journal entry. |
| **Settings** | Name/greeting, theme intensity (Mist / Tide / Deep), motion, opening animation, formats, time zone, prompts, categories, sound, reminders, backup & restore. |

## Privacy & honesty notes

* **Storage**: everything lives in this browser's IndexedDB. It does not sync between devices, and it is **not encrypted at rest**.
  Clearing site data deletes it, so use *Settings → Your data & privacy* to download backups (JSON with photos, an AES-256 passphrase-encrypted copy, or the journal as Markdown).
* **No login**: there is no backend, so there is no real authentication to offer, and a fake lock screen would protect nothing. If a backend is added later, `src/data/repo.ts` is the single seam to replace.
* **Reminders cannot fire while the browser is closed.** No server or push service is configured, so the app says so wherever reminders are explained. The service worker (`public/sw.js`) exists only so notifications display on Android and when a tab is open; it does not run in the background.
* **Sound** is generated with the Web Audio API, is off by default, never autoplays, and stays silent after a reload until the speaker is tapped.
* No personal life data is pre-filled. The app starts empty.

## Layout of the code

```
src/data      types, Dexie schema, repository (validation, cascades, ORACLE immutability), backup/restore, search
src/lib       dates & time zones, recurrence, reminder engine, notifications, ambient sound, markdown
src/scene     ocean canvas engine, bedroom SVG, intro, immersive "dive"
src/modules   room, journal, legacy, oracle, future, calendar, notes, settings (+ RecordKit: schema-driven editor/detail/list)
src/components design-system pieces (modal, fields, tags, links, attachments, icons)
src/styles    tokens (3 themes), base, ui, shell, room, modules
```
