"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Panel, Rise, SectionLabel } from "./motion-kit";
import ProjectModal from "./ProjectModal";
import { projects, type Img, type Project } from "@/lib/content";
import { useShell } from "./shell-context";
import { site, mailto } from "@/lib/site";
import { useIsFile, useMedia } from "@/lib/useMedia";

type Open = (slug: string, o: { x: number; y: number }) => void;

/* A poster in a collage: mobile = flows in a row, desktop = absolutely placed */
function Poster({ img, className, rot = 0, onOpen, delay = 0 }: { img: Img; className: string; rot?: number; onOpen: () => void; delay?: number }) {
  return (
    <div className={`${className} group`} style={{ ["--r" as string]: `${rot}deg` }}>
      <div
        data-cursor="View"
        onClick={onOpen}
        aria-hidden
        className="float cursor-pointer transition-[transform] duration-500 [transition-timing-function:var(--ease)] [animation-duration:9s] group-hover:!translate-y-[-10px] group-hover:scale-[1.04]"
        style={{ animationDelay: `${delay}s`, rotate: `${rot}deg` }}
      >
        <Image
          src={img.src}
          alt=""
          width={img.w}
          height={img.h}
          sizes="(min-width:1024px) 20vw, 44vw"
          className="h-auto w-full rounded-2xl border-[3px] border-white bg-white shadow-[0_40px_70px_-35px_rgba(0,0,0,0.9)]"
        />
      </div>
    </div>
  );
}

function SlideText({ p, onOpen, go, align = "left" }: { p: Project; onOpen: Open; go: (h: string, l?: string) => void; align?: "left" | "right" }) {
  const btn = useRef<HTMLButtonElement>(null);
  const isFile = useIsFile();
  return (
    <div className={`relative z-10 w-full lg:w-[27vw] lg:max-w-[460px] ${align === "right" ? "lg:text-left" : ""}`}>
      <p className="display text-[clamp(3.6rem,8vw,8rem)] leading-[0.8] text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.55)]" aria-hidden>{p.index}</p>
      <h3 className="display mt-3 text-[clamp(1.6rem,2.8vw,2.9rem)]">{p.title}</h3>
      <p className="mono mt-3 text-peach-300">{p.role}</p>
      <p className="mono text-white/60">{p.period}</p>
      <p className="mt-4 max-w-md text-[1.02rem] text-white/85">{p.summary}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          ref={btn}
          type="button"
          className="btn"
          onClick={() => {
            const r = btn.current!.getBoundingClientRect();
            onOpen(p.slug, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }}
          aria-haspopup="dialog"
        >
          Open highlight <span className="arrow" aria-hidden>↗</span>
        </button>
        {!isFile && (
          <a href={`/work/${p.slug}/`} onClick={(e) => { e.preventDefault(); go(`/work/${p.slug}/`, p.title); }} className="link-u text-sm font-semibold">
            Full case study →
          </a>
        )}
      </div>
    </div>
  );
}

function Slide({ p, onOpen, go }: { p: Project; onOpen: Open; go: (h: string, l?: string) => void }) {
  const open = (e?: React.MouseEvent) => onOpen(p.slug, { x: e?.clientX ?? innerWidth / 2, y: e?.clientY ?? innerHeight / 2 });
  const g = p.gallery;
  const click = (e: React.MouseEvent) => open(e);

  // distinct composition per project
  const visuals: Record<Project["kind"], React.ReactNode> = {
    hovarlay: (
      <div className="relative flex gap-3 lg:block lg:h-[66vh] lg:w-[36vw]" onClickCapture={click}>
        <Poster img={g[0]} rot={-5} className="w-[44%] lg:absolute lg:left-0 lg:top-[6%] lg:w-[15.5vw]" onOpen={() => {}} />
        <Poster img={g[1]} rot={4} delay={-2} className="w-[44%] lg:absolute lg:left-[13vw] lg:top-[30%] lg:z-10 lg:w-[14vw]" onOpen={() => {}} />
        <Poster img={g[2]} rot={-2} delay={-4} className="hidden lg:absolute lg:left-[19vw] lg:top-[-2%] lg:block lg:w-[13vw]" onOpen={() => {}} />
      </div>
    ),
    npea: (
      <div className="relative flex gap-3 lg:block lg:h-[70vh] lg:w-[42vw]" onClickCapture={click}>
        <Poster img={g[0]} rot={-3} className="w-[44%] lg:absolute lg:left-0 lg:top-[8%] lg:w-[15vw]" onOpen={() => {}} />
        <Poster img={g[1]} rot={3} delay={-3} className="w-[44%] lg:absolute lg:left-[14vw] lg:top-[-4%] lg:w-[13vw]" onOpen={() => {}} />
        <Poster img={g[2]} rot={-4} delay={-1} className="hidden lg:absolute lg:left-[26vw] lg:top-[16%] lg:block lg:w-[13vw]" onOpen={() => {}} />
        <Poster img={g[4]} rot={5} delay={-5} className="hidden lg:absolute lg:left-[19vw] lg:top-[48%] lg:z-10 lg:block lg:w-[11vw]" onOpen={() => {}} />
      </div>
    ),
    transcosmos: (
      <div
        onClick={click}
        data-cursor="View"
        aria-hidden
        className="relative flex min-h-[18rem] cursor-pointer flex-col justify-end overflow-hidden rounded-[2rem] border-2 border-white/80 p-6 lg:h-[62vh] lg:w-[31vw]"
        style={{ background: p.tint }}
      >
        <span className="halftone absolute -right-10 -top-10 h-72 w-72 rounded-full text-white/25 [mask-image:radial-gradient(closest-side,#000,transparent)]" />
        <p className="display absolute left-6 top-4 whitespace-nowrap text-[clamp(3.6rem,8.2vw,9rem)] leading-[0.85] text-white">10–15</p>
        <div className="relative mt-24 lg:mt-0">
          <p className="display-lc text-xl">prospective accounts researched</p>
          <p className="mt-1 text-sm text-white/80">Automotive · F&amp;B · Fintech</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Hyundai Capital", "Pilot Pen", "Warung Tani", "Inaco"].map((t) => <span key={t} className="chip border-dashed text-[0.78rem]">{t}</span>)}
          </div>
          <p className="mt-2 text-[0.72rem] text-white/70">Researched prospects, not clients</p>
        </div>
      </div>
    ),
    wushu: (
      <div className="relative flex gap-3 lg:block lg:h-[66vh] lg:w-[38vw]" onClickCapture={click}>
        <p className="display pointer-events-none absolute -left-2 top-1/2 z-0 hidden -translate-y-1/2 text-[17vw] leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.2)] lg:block" aria-hidden>626</p>
        <Poster img={g[0]} rot={-4} className="w-[44%] lg:absolute lg:left-[3vw] lg:top-[4%] lg:z-10 lg:w-[14vw]" onOpen={() => {}} />
        <Poster img={g[1]} rot={3} delay={-3} className="w-[44%] lg:absolute lg:left-[15vw] lg:top-[24%] lg:z-10 lg:w-[14vw]" onOpen={() => {}} />
        <Poster img={g[3]} rot={-2} delay={-5} className="hidden lg:absolute lg:left-[27vw] lg:top-[0%] lg:block lg:w-[11vw]" onOpen={() => {}} />
      </div>
    ),
  };

  const reverse = p.kind === "npea" || p.kind === "transcosmos";
  return (
    <article className="relative flex shrink-0 flex-col gap-10 lg:flex-row lg:items-center lg:gap-[4vw]" aria-labelledby={`slide-${p.slug}`}>
      <span id={`slide-${p.slug}`} className="sr-only">{p.title}</span>
      {reverse ? <>{visuals[p.kind]}<SlideText p={p} onOpen={onOpen} go={go} align="right" /></> : <><SlideText p={p} onOpen={onOpen} go={go} />{visuals[p.kind]}</>}
    </article>
  );
}

export default function Work() {
  const { go } = useShell();
  const reduce = useReducedMotion();
  const outer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  const desktop = useMedia("(min-width: 1024px)");
  const [active, setActive] = useState(0);
  const offsets = useRef<number[]>([]);
  const [modal, setModal] = useState<{ slug: string; x: number; y: number } | null>(null);

  const measure = useCallback(() => {
    const t = track.current;
    if (!t || !window.matchMedia("(min-width: 1024px)").matches) return setDist(0);
    setDist(Math.max(0, t.scrollWidth - window.innerWidth));
    offsets.current = Array.from(t.querySelectorAll<HTMLElement>("[data-slide]")).map((el) => el.offsetLeft);
  }, []);

  useEffect(() => {
    const first = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    window.addEventListener("resize", measure);
    const t = window.setTimeout(measure, 1200); // images settle
    return () => { cancelAnimationFrame(first); ro.disconnect(); window.removeEventListener("resize", measure); window.clearTimeout(t); };
  }, [measure]);

  const { scrollYProgress } = useScroll({ target: outer, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -dist]);
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const cx = v * dist + window.innerWidth * 0.45;
    let a = 0;
    offsets.current.forEach((o, i) => { if (o <= cx) a = i; });
    setActive(a);
  });

  const open: Open = (slug, o) => setModal({ slug, ...o });
  useEffect(() => {
    const h = (e: Event) => setModal({ slug: (e as CustomEvent<{ slug: string }>).detail.slug, x: window.innerWidth / 2, y: window.innerHeight / 2 });
    window.addEventListener("jer-open-project", h);
    return () => window.removeEventListener("jer-open-project", h);
  }, []);
  const current = modal ? projects.find((p) => p.slug === modal.slug) : null;

  return (
    <Panel tone="ink-clear" id="work" label="Selected work" overlap>
      <div ref={outer} style={desktop ? { height: `calc(100vh + ${dist}px)` } : undefined}>
        <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden">
          <motion.div ref={track} style={desktop && !reduce ? { x } : undefined} className="flex flex-col gap-24 px-[var(--gutter)] pb-20 pt-[clamp(3.5rem,8vw,6rem)] lg:h-full lg:flex-row lg:items-center lg:gap-[9vw] lg:pb-0 lg:pl-[var(--gutter)] lg:pr-[12vw] lg:pt-16">
            {/* intro */}
            <div data-slide className="relative shrink-0 lg:w-[38vw]">
              <SectionLabel n="03">Selected work</SectionLabel>
              <h2 className="display mt-6 text-[clamp(2.4rem,5.8vw,6.4rem)]">
                <Rise>Four</Rise>
                <Rise delay={0.1}><span className="grad-text">stories</span></Rise>
                <Rise delay={0.2}>of doing.</Rise>
              </h2>
              <p className="mt-6 max-w-sm text-lg text-white/80">
                Research, content, outreach and events. Open any project for the highlight, or read the full case study.
              </p>
              <p className="mono mt-8 hidden items-center gap-3 text-peach-300 lg:flex">
                <span className="inline-block h-px w-12 bg-peach-300" /> Keep scrolling →
              </p>
            </div>

            {projects.map((p) => (
              <div key={p.slug} data-slide className="shrink-0">
                <Slide p={p} onOpen={open} go={go} />
              </div>
            ))}

            {/* outro */}
            <div data-slide className="shrink-0 lg:w-[30vw]">
              <p className="display text-[clamp(2rem,4vw,4rem)]">Want it all in one file?</p>
              <p className="mt-4 max-w-sm text-white/80">The full portfolio, as I send it to recruiters.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={site.pdf} target="_blank" rel="noopener noreferrer" className="btn">View Portfolio PDF <span className="arrow" aria-hidden>↗</span></a>
                <a href={mailto("Let's talk — opportunity for Juvenn")} className="btn btn-ghost">Let&apos;s talk</a>
              </div>
            </div>
          </motion.div>

          {/* progress */}
          <div className="absolute inset-x-0 bottom-6 hidden items-center gap-5 px-[var(--gutter)] lg:flex" aria-hidden>
            <span className="mono w-24 text-white/80">{active === 0 ? "Intro" : active > projects.length ? "PDF" : `${String(active).padStart(2, "0")} / 0${projects.length}`}</span>
            <div className="h-[2px] flex-1 bg-white/15"><motion.div className="h-full bg-coral-500" style={{ width: bar }} /></div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {current && modal && (
          <ProjectModal key="modal" project={current} origin={{ x: modal.x, y: modal.y }} onClose={() => setModal(null)} onSwitch={(slug) => setModal({ slug, x: innerWidth / 2, y: innerHeight / 2 })} />
        )}
      </AnimatePresence>
    </Panel>
  );
}
