# Fellicia Angelica Kholim, S.H., CLA. — Portfolio

A personal legal portfolio built as a static Next.js site (App Router, TypeScript, plain CSS design system).
Art direction: **"The Art of Legal Precision"** — editorial typography, architectural rules, obsidian + warm ivory
structure with a single burgundy accent, and restrained, purposeful motion.

> **Status: private build, not published.** See [`docs/PUBLICATION_CHECKLIST.md`](docs/PUBLICATION_CHECKLIST.md)
> for the approvals required before the public edition is deployed.

## Run locally

Requires Node.js 20 or newer.

```bash
cd fellicia-portfolio
npm install
npm run dev          # http://localhost:3000 (private edition, all supplied visuals)
```

Production build and preview:

```bash
npm run build        # private edition -> ./out (static files)
npm start            # serves ./out on http://localhost:3000
```

Public edition (client-related visuals are excluded from the output and the site becomes indexable):

```bash
SITE_URL=https://your-domain.example npm run build:public
```

`SITE_URL` is only used for Open Graph / canonical metadata.

## Where things live

| Path | Purpose |
|---|---|
| `content/site.ts` | **All text content.** Project descriptions are the original English passages from the portfolio PDF. Edit here, not in components. |
| `components/` | One component per section (`Hero`, `About`, `Expertise`, `Engagements`, `Leadership`, `Credentials`, `Contact`, …). |
| `app/globals.css` | The complete design system: tokens, typography, layout, motion, modals, reduced-motion rules. |
| `assets/open/` | Optimised WebP assets safe to publish (portrait, certificates, credential documents, redacted diploma). |
| `assets/restricted/` | Client-related visuals. Copied only into private builds. |
| `scripts/prepare-assets.mjs` | Copies assets into `public/media` depending on the edition. |
| `scripts/build-assets.py` | Provenance of the image pipeline (WebP conversion, thumbnails, diploma redaction). |

## Design system in brief

- **Colour:** Obsidian `#141416`, Warm Ivory `#F4F1EC`, Deep Burgundy `#791F31` (with a lighter tint `#D4768A` for text on dark surfaces so contrast stays AA), Slate for secondary text.
- **Type:** Cormorant Garamond (display) + Manrope (interface and body), self-hosted via Fontsource. No external font requests.
- **Motion:** opening sequence (~2.5 s, skippable, once per session), masked line reveals, image masks, drawing rules,
  a slow ticker, restrained parallax, scroll progress and a section index. All of it is disabled under `prefers-reduced-motion`
  and the page is fully readable without JavaScript.
- **Accessibility:** semantic landmarks and heading order, skip link, visible focus, native `<dialog>` modals (focus trap, Esc, focus return),
  ARIA tabs with roving tabindex, descriptive alt text, AA contrast. axe-core reports no violations on the page or either dialog type.

## Testing summary

Automated checks run against the production build with Playwright (Chromium) and axe-core:

- 0 console errors / failed requests, 0 horizontal overflow at 1440, 820 and 390 px.
- All 29 images load; none are shown above their native resolution.
- Project dialog (open, previous/next, Esc, focus return), expertise tabs (arrow keys), engagement filter,
  certificate viewer (from the archive, the credentials cards and the leadership list), `mailto:` and LinkedIn links, all in-page anchors.
- Reduced motion: no intro, nothing hidden, ticker static. No-JS: content visible, no intro overlay.
- Public edition: restricted visuals, their file names and descriptions are absent from the output bundle.
