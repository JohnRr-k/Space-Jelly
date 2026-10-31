# Juvenn Elkins Ravelliyo — Portfolio

Interactive, art-directed portfolio for a brand-strategy candidate. Built with Next.js (App Router, static export), TypeScript, Tailwind CSS v4, Motion and Lenis.

## Run it

```bash
cd juvenn-portfolio
npm install
npm run dev          # http://localhost:3000
```

Production build (static export into `out/`):

```bash
npm run build
npx serve out        # or any static file server
npm run lint && npm run typecheck
```

Optional: set the real domain at build time so Open Graph images, the sitemap and `robots.txt` use absolute URLs.
No domain is assumed anywhere in the code.

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example npm run build
```

## Where things live

| Path | What |
| --- | --- |
| `lib/content.ts` | **All copy, projects, figures, certificates.** Edit here; components never hard-code claims. |
| `lib/site.ts` | Email, LinkedIn, PDF path, navigation. |
| `app/globals.css` | Design tokens (colour, type, easing), buttons, textures. |
| `components/motion-kit.tsx` | Reveal, masked-line rise, scroll-scrubbed text, velocity-reactive marquee, section panel transition, count-up. |
| `components/Preloader.tsx` | Entry sequence (first visit per session, skippable, bypassed for reduced motion). |
| `components/Work.tsx`, `ProjectModal.tsx`, `ProjectModules.tsx` | Pinned horizontal work strip, highlight pop-up, per-project interactive modules. |
| `components/CaseStudy.tsx`, `app/work/[slug]` | Full case-study pages (static, one per project). |
| `scripts/extract-assets.py` | Re-creates `public/img` from the PDF (`pdfimages -png` output). |

## Design notes

- Palette sampled from the PDF cover: midnight navy `#0a1520`, deep teal `#0f6a7f`, coral `#d4542f`, peach `#f2b28c`; cream is used only for "paper" sections.
- Type: Archivo (variable, expanded width, close to the PDF's wide display face), DM Sans for text, DM Mono for labels. All self-hosted via Fontsource.
- Motion: Lenis smooth scroll; panels grow in from the sides on entry; a pinned horizontal strip for work; a pinned five-stage dial for "How I work"; scroll-velocity marquees. Everything respects `prefers-reduced-motion`.

## Honest notes

- There is **no booking link** in the source material, so conversations are arranged by email (pre-filled `mailto:` subjects). Nothing pretends to be a scheduler or form.
- The phone number in the PDF is intentionally **not** published.
- `public/Juvenn_Ravelliyo_Portfolio.pdf` is the supplied PDF, offered as "View Portfolio PDF" (not as a CV).
- Source-text tidy-ups: the PDF's "Keeping that bites." is shown as "Keep what bites."; "Guidebook" appears as "Handbook" to match the body text.
