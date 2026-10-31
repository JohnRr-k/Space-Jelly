"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { projects, type Img, type Project } from "@/lib/content";
import { EASE, CountUp } from "./motion-kit";

const byKind = (k: Project["kind"]) => projects.find((p) => p.kind === k)!;

/* ─────────────── Shared: poster card ─────────────── */
export function PosterImg({ img, className = "", priority = false, sizes = "(min-width:1024px) 22vw, 60vw" }: { img: Img; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <Image
      src={img.src}
      alt={img.alt}
      width={img.w}
      height={img.h}
      sizes={sizes}
      priority={priority}
      className={`h-auto w-full rounded-2xl border-[3px] border-white/90 bg-white object-cover shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] ${className}`}
    />
  );
}

/* ─────────────── HOVARLAY: draggable poster deck ─────────────── */
export function PosterDeck({ images }: { images: Img[] }) {
  const reduce = useReducedMotion();
  const [order, setOrder] = useState(images.map((_, i) => i));
  const next = () => setOrder((o) => [...o.slice(1), o[0]]);
  const prev = () => setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]);
  const top = order[0];
  return (
    <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
      <div className="relative mx-auto h-[min(62vh,520px)] w-full max-w-[340px]" data-cursor="Drag" aria-roledescription="carousel" aria-label="Selected HOVARLAY content, drag or use the buttons">
        {order.slice(0, 4).map((idx, pos) => {
          const im = images[idx];
          const isTop = pos === 0;
          return (
            <motion.div
              key={im.src}
              className="absolute inset-x-0 top-0 mx-auto w-[88%] touch-pan-y"
              style={{ zIndex: 10 - pos }}
              drag={isTop && !reduce ? "x" : false}
              dragSnapToOrigin
              dragElastic={0.7}
              onDragEnd={(_, i) => Math.abs(i.offset.x) > 90 && next()}
              initial={false}
              animate={{ y: pos * 20, scale: 1 - pos * 0.05, rotate: pos === 0 ? 0 : pos % 2 ? 4 + pos : -4 - pos, opacity: 1 - pos * 0.12 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
              <PosterImg img={im} sizes="340px" className="pointer-events-none select-none" />
            </motion.div>
          );
        })}
      </div>
      <div>
        <p className="mono text-peach-300">Selected content</p>
        <p aria-live="polite" className="display-lc mt-2 min-h-[3.4rem] text-2xl">{images[top].caption}</p>
        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={prev} className="btn btn-ghost !px-5" aria-label="Previous poster">←</button>
          <button type="button" onClick={next} className="btn btn-ghost !px-5" aria-label="Next poster">→</button>
          <span className="mono text-white/60">{String(images.findIndex((_, i) => i === top) + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span>
        </div>
        <div className="mt-8 border-t border-white/20 pt-5">
          <p className="mono text-peach-300">Brand template kit covers</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Posts", "Carousels", "Certificates"].map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
          <p className="mono mt-5 text-peach-300">Also built</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["“Live Case Study” series", "EN/ID pitch deck", "Partnership one-pagers", "Workshop recap videos"].map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Generic: scroll-snap poster strip ─────────────── */
export function PosterStrip({ images, label }: { images: Img[]; label: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const by = (d: number) => ref.current?.scrollBy({ left: d * (ref.current.clientWidth * 0.6), behavior: "smooth" });
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="mono text-peach-300">{label}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => by(-1)} className="btn btn-ghost !px-4 !py-2" aria-label="Scroll posters left">←</button>
          <button type="button" onClick={() => by(1)} className="btn btn-ghost !px-4 !py-2" aria-label="Scroll posters right">→</button>
        </div>
      </div>
      <ul ref={ref} className="no-bar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3" data-lenis-prevent-wheel tabIndex={0} aria-label={label}>
        {images.map((im) => (
          <li key={im.src} className="w-[min(54vw,230px)] shrink-0 snap-start">
            <figure>
              <PosterImg img={im} sizes="230px" />
              {im.caption && <figcaption className="mt-2 text-[0.82rem] text-white/70">{im.caption}</figcaption>}
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────── NPEA: who the work served ─────────────── */
export function AudienceLanes() {
  const lanes = [
    { who: "Students", sub: "Who submits", pts: ["20–30 posters, carousels and ad creatives across IG, LinkedIn and Facebook", "Captions and ad copy", "Official certificates"], stat: "300+", statLabel: "submissions" },
    { who: "The jury", sub: "Who judges", pts: ["Jury Handbook, authored from scratch", "Coordinated with the 5-member panel", "QA of the submission, judge and admin portals"], stat: "5", statLabel: "panel members" },
    { who: "Sponsors & universities", sub: "Who gives it weight", pts: ["Thousands of cold emails, tracked in a spreadsheet", "Sponsor spotlights", "MOU/MOA documentation"], stat: "45–50", statLabel: "institutions in MOU/MOA documentation" },
  ];
  return (
    <div>
      <p className="mono text-peach-300">Three audiences, one calendar</p>
      <ol className="mt-4 grid gap-4 md:grid-cols-3">
        {lanes.map((l, i) => (
          <motion.li
            key={l.who}
            className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/[0.06] p-5"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 0.8, ease: EASE, delay: i * 0.1 }}
          >
            <p className="mono text-peach-300">{l.sub}</p>
            <h4 className="display-lc mt-1 text-xl">{l.who}</h4>
            <p className="display mt-5 text-[2.4rem] text-coral-400">{l.stat}</p>
            <p className="text-xs text-white/65">{l.statLabel}</p>
            <ul className="mt-4 space-y-2 border-t border-white/15 pt-4 text-[0.92rem] text-white/85">
              {l.pts.map((p) => <li key={p} className="flex gap-2"><span aria-hidden className="text-coral-400">↳</span>{p}</li>)}
            </ul>
          </motion.li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-white/60">Figures describe the competition and the wider team, except the 45–50 institutions in MOU/MOA documentation, which I handled.</p>
    </div>
  );
}

/* ─────────────── Transcosmos: research → pitch ─────────────── */
export function ResearchToPitch({ inaco }: { inaco?: Img }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const steps = [
    ["Research", "10–15 prospective accounts"],
    ["Map", "How brands enter and win attention in Indonesia"],
    ["Draft", "Pitch-ready decks in Figma, Canva and PowerPoint"],
    ["Review", "Every proposal refined under manager review"],
    ["Pitch", "A live pitch cycle"],
  ];
  return (
    <div ref={ref}>
      <p className="mono text-peach-300">From research to pitch</p>
      <ol className="relative mt-5 grid gap-5 md:grid-cols-5">
        <span aria-hidden className="absolute left-0 right-0 top-[19px] hidden h-px bg-white/20 md:block" />
        <motion.span aria-hidden className="absolute left-0 top-[19px] hidden h-[2px] origin-left bg-coral-400 md:block" style={{ right: 0 }} initial={{ scaleX: 0 }} animate={seen ? { scaleX: 1 } : undefined} transition={{ duration: 1.8, ease: EASE, delay: 0.2 }} />
        {steps.map(([t, d], i) => (
          <motion.li key={t} initial={{ opacity: 0, y: 20 }} animate={seen ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.7, ease: EASE, delay: 0.25 + i * 0.22 }} className="relative">
            <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 border-coral-400 bg-ink-900 font-mono text-sm">{i + 1}</span>
            <h4 className="display-lc mt-3 text-lg">{t}</h4>
            <p className="mt-1 text-[0.9rem] text-white/75">{d}</p>
          </motion.li>
        ))}
      </ol>

      <div className="mt-10 grid items-start gap-8 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="mono text-peach-300">Industries in scope</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Automotive", "F&B", "Fintech"].map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
          <p className="mono mt-6 text-peach-300">Notable prospects researched</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Hyundai Capital", "Pilot Pen", "Warung Tani", "Inaco"].map((c) => <span key={c} className="chip border-dashed">{c}</span>)}
          </div>
          <p className="mt-3 max-w-md text-xs text-white/60">Researched prospects, not confirmed clients. Dashed outlines mark them as such.</p>
        </div>
        {inaco && (
          <figure className="mx-auto max-w-[210px] -rotate-3">
            <PosterImg img={inaco} sizes="210px" />
            <figcaption className="mt-2 text-xs text-white/65">Inaco campaign creative, referenced during prospect research</figcaption>
          </figure>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Wushu: four roles ─────────────── */
const roleTabs = [
  { id: "pm", name: "Project Manager", text: "Drove registrations for the “Transforming Stress to Strength” webinar through social campaigns and partnerships, while leading marketing, design and operations.", stat: { to: 626, suffix: "", label: "registrations" }, img: 0 },
  { id: "lead", name: "Lead Creative", text: "Set the visual identity for the “Achieving Athletic Prestige in University” talkshow, delivering assets ahead of schedule.", stat: { to: 0, suffix: "", label: "ahead of schedule" }, img: 1 },
  { id: "sec", name: "Regional Secretary", text: "Ran records, communications and logistics, delivering 3–4 events on IDR 2–3M budgets each.", stat: { to: 4, suffix: "", label: "events, up to" }, img: 5 },
  { id: "coach", name: "Coach", text: "Coached members as team coach in Wushu training.", stat: { to: 30, suffix: "+", label: "members coached" }, img: 4 },
];
export function RoleSwitcher({ images }: { images: Img[] }) {
  const [active, setActive] = useState(0);
  const r = roleTabs[active];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setActive((a) => (a + 1) % roleTabs.length);
    if (e.key === "ArrowLeft") setActive((a) => (a - 1 + roleTabs.length) % roleTabs.length);
  };
  return (
    <div>
      <p className="mono text-peach-300">Four hats, one organisation</p>
      <div role="tablist" aria-label="Roles in the Wushu student organization" onKeyDown={onKey} className="mt-3 flex flex-wrap gap-2">
        {roleTabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={i === active}
            aria-controls={`panel-${t.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${i === active ? "border-white bg-white text-ink-900" : "border-white/30 text-white hover:border-white"}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${r.id}`} aria-labelledby={`tab-${r.id}`} className="mt-6 grid items-center gap-6 md:grid-cols-[auto_1fr]">
        <AnimatePresence mode="wait">
          <motion.div key={r.id} initial={{ opacity: 0, y: 24, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: -2 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: EASE }} className="mx-auto w-[min(46vw,200px)]">
            <PosterImg img={images[r.img] ?? images[0]} sizes="200px" />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div key={r.id + "t"} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
            {r.id !== "lead" && (
              <p className="display text-[clamp(3rem,7vw,5.6rem)] leading-none text-coral-400">
                {r.id === "sec" ? "3–4" : <CountUp key={r.id} to={r.stat.to} duration={1.2} />}
                {r.stat.suffix}
              </p>
            )}
            {r.id !== "lead" && <p className="mono mt-1 text-white/70">{r.id === "sec" ? "events delivered" : r.stat.label}</p>}
            <p className={`${r.id === "lead" ? "display-lc text-2xl" : "mt-4 text-lg"} max-w-md text-white/90`}>{r.text}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─────────────── Switch ─────────────── */
export function ProjectSpecial({ project }: { project: Project }) {
  switch (project.kind) {
    case "hovarlay":
      return <PosterDeck images={project.gallery} />;
    case "npea":
      return (
        <div className="space-y-10">
          <AudienceLanes />
          <PosterStrip images={project.gallery} label="Campaign content" />
        </div>
      );
    case "transcosmos":
      return <ResearchToPitch inaco={project.gallery[0]} />;
    case "wushu":
      return (
        <div className="space-y-10">
          <RoleSwitcher images={project.gallery} />
          <PosterStrip images={project.gallery} label="Selected works" />
        </div>
      );
  }
}

export { byKind };
