"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Panel, Parallax, Reveal, Rise, SectionLabel } from "./motion-kit";
import { certs, education, type Cert } from "@/lib/content";
import { useShell } from "./shell-context";

function Lightbox({ cert, onClose }: { cert: Cert; onClose: () => void }) {
  const { lock } = useShell();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    lock(true);
    const root = document.getElementById("app-root");
    root?.setAttribute("inert", "");
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("keydown", k); root?.removeAttribute("inert"); lock(false); opener?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createPortal(
    <motion.div className="fixed inset-0 z-[95] grid place-items-center p-4 sm:p-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div className="absolute inset-0 bg-ink-950/90 backdrop-blur-md" onClick={onClose} aria-hidden />
      <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={cert.title} tabIndex={-1} className="relative w-full max-w-4xl outline-none" initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <Image src={cert.src} alt={cert.alt} width={800} height={556} sizes="(min-width:1024px) 896px, 92vw" className="h-auto w-full rounded-2xl border-[3px] border-white" />
        <div className="mt-4 flex items-start justify-between gap-4 text-white">
          <div><p className="display-lc text-xl">{cert.title}</p><p className="text-sm text-white/75">{cert.detail} · {cert.date}</p></div>
          <button type="button" onClick={onClose} className="btn btn-light !px-5 !py-2.5 text-sm">Close <span aria-hidden>✕</span></button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

const offs = ["lg:mt-0", "lg:mt-20", "lg:-mt-6", "lg:mt-14"];
const rots = [-2.5, 2, 1.5, -2];

export default function Credentials() {
  const [cert, setCert] = useState<Cert | null>(null);
  const e = education;
  return (
    <Panel tone="teal" id="credentials" label="Education and certifications" overlap>
      <div className="wrap pt-[clamp(3.5rem,9vw,8rem)]">
        <SectionLabel n="07">Education &amp; research</SectionLabel>
        <h2 className="display mt-6 text-[clamp(2.2rem,6.4vw,7rem)]">
          <Rise>Learning,</Rise>
          <Rise delay={0.1}><span className="outline-text">on the record.</span></Rise>
        </h2>

        <div className="mt-[clamp(3rem,7vw,6rem)] grid gap-10 lg:grid-cols-12">
          {/* degree card, echoing the white cards in the original portfolio */}
          <Reveal className="lg:col-span-6">
            <div className="rounded-[2rem] bg-white p-7 text-ink-900 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.7)] sm:p-9">
              <p className="mono text-coral-600">{e.dates}</p>
              <h3 className="display-lc mt-2 text-[clamp(1.5rem,2.6vw,2.4rem)] leading-[1.05]">{e.degree}</h3>
              <p className="mt-1 text-ink-800 opacity-80">{e.school}</p>
              <dl className="mt-6 grid grid-cols-3 gap-3 border-y border-ink-900/15 py-5">
                {e.facts.map((f) => (
                  <div key={f.k}><dt className="mono text-ink-800/60">{f.k}</dt><dd className="display-lc mt-1 text-[clamp(1rem,1.6vw,1.35rem)] leading-tight">{f.v}</dd></div>
                ))}
              </dl>
              <p className="mono mt-5 text-ink-800/60">Key courses</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {e.courses.map((c) => <li key={c} className="rounded-full bg-cream-100 px-3 py-1.5 text-sm">{c}</li>)}
              </ul>
              <p className="mt-6 border-t border-ink-900/15 pt-5 text-sm leading-snug"><span className="mono text-coral-600">Earlier · </span>{e.earlier.school}. {e.earlier.detail}</p>
            </div>
          </Reveal>

          {/* research */}
          <div className="relative lg:col-span-6">
            <Reveal delay={0.1}>
              <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,210px)_1fr] lg:pt-6">
                <Parallax amount={20}>
                  <div className="relative mx-auto w-full max-w-[210px] rotate-[4deg]">
                    <Image src="/img/about/paper.webp" alt="First page of the research paper 'Analyzing AI Algorithms'" width={550} height={800} sizes="210px" className="h-auto w-full rounded-lg border-[3px] border-white bg-white shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]" />
                    <span className="pill absolute -right-5 bottom-6 -rotate-6 text-xs">Presented at ICISS 2026 (IEEE)</span>
                  </div>
                </Parallax>
                <div>
                  <p className="mono text-peach-300">Original research</p>
                  <h3 className="display-lc mt-2 text-[clamp(1.15rem,1.7vw,1.5rem)] leading-snug">{e.research.title}</h3>
                  <p className="mt-3 text-sm text-white/80">With {e.research.authors.replace("Juvenn Elkins Ravelliyo, ", "")}.</p>
                  <p className="mt-2 text-sm text-white/80">{e.research.where}.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="mt-[clamp(4rem,9vw,8rem)]">
          <div className="flex items-end justify-between gap-6">
            <h3 className="display text-[clamp(1.6rem,3.4vw,3.4rem)]">Selected certificates</h3>
            <p className="mono hidden text-white/60 sm:block">Tap to enlarge</p>
          </div>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:gap-x-10">
            {certs.map((c, i) => (
              <Reveal as="li" key={c.src} delay={(i % 2) * 0.1} className={offs[i]}>
                <button type="button" onClick={() => setCert(c)} aria-haspopup="dialog" className="group block w-full text-left" data-cursor="View">
                  <div className="overflow-hidden rounded-2xl border-[3px] border-white shadow-[0_40px_70px_-40px_rgba(0,0,0,0.9)] transition-transform duration-500 [transition-timing-function:var(--ease)] group-hover:-translate-y-2" style={{ rotate: `${rots[i]}deg` }}>
                    <Image src={c.src} alt={c.alt} width={800} height={556} sizes="(min-width:1024px) 44vw, 92vw" className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.04]" loading="lazy" />
                  </div>
                  <p className="display-lc mt-5 text-lg">{c.title}</p>
                  <p className="text-sm text-white/70">{c.detail} · <span className="mono">{c.date}</span></p>
                </button>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
      <div className="h-10" />
      <AnimatePresence>{cert && <Lightbox cert={cert} onClose={() => setCert(null)} />}</AnimatePresence>
    </Panel>
  );
}
