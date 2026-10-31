"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { projects, type Project } from "@/lib/content";
import { ProjectSpecial } from "./ProjectModules";
import { useShell } from "./shell-context";
import { Rise } from "./motion-kit";
import { useIsFile } from "@/lib/useMedia";

type Props = { project: Project; origin: { x: number; y: number }; onClose: () => void; onSwitch: (slug: string) => void };

export function Stats({ stats }: { stats: Project["stats"] }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-3xl border border-white/15 bg-white/15 sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-ink-900/90 p-5 backdrop-blur">
          <dt className="mono text-peach-300">{s.scope}</dt>
          <dd className="mt-2">
            <span className="display block text-[clamp(1.9rem,3.4vw,2.8rem)] leading-none">{s.value}</span>
            <span className="mt-2 block text-[0.92rem] leading-snug text-white/80">{s.label}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ProjectModal({ project, origin, onClose, onSwitch }: Props) {
  const { go, lock } = useShell();
  const dialog = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const idx = projects.findIndex((p) => p.slug === project.slug);
  const next = projects[(idx + 1) % projects.length];
  const closing = useRef(false);
  const isFile = useIsFile();

  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    if (window.history.state?.jerModal) window.history.back();
    else onClose();
  };

  // scroll lock, inert background, focus management, history entry
  useEffect(() => {
    lock(true);
    const root = document.getElementById("app-root");
    root?.setAttribute("inert", "");
    const opener = document.activeElement as HTMLElement | null;
    if (!window.history.state?.jerModal) window.history.pushState({ ...window.history.state, jerModal: project.slug }, "");
    dialog.current?.focus();
    const onPop = () => { if (!window.history.state?.jerModal) onClose(); };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      root?.removeAttribute("inert");
      lock(false);
      opener?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    if (window.history.state?.jerModal) window.history.replaceState({ ...window.history.state, jerModal: project.slug }, "");
  }, [project.slug]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); requestClose(); return; }
    if (e.key !== "Tab" || !dialog.current) return;
    const f = dialog.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const c = `circle(150% at ${origin.x}px ${origin.y}px)`;
  const c0 = `circle(0px at ${origin.x}px ${origin.y}px)`;

  return createPortal(
    <motion.div className="fixed inset-0 z-[95]" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1 }} onKeyDown={onKey}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { delay: 0.15 } }}
        onClick={requestClose}
      />
      <motion.div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 top-0 mx-auto flex max-w-[1240px] flex-col overflow-hidden bg-ink-900 text-white outline-none sm:inset-y-[2.5vh] sm:rounded-[2rem] sm:border sm:border-white/15"
        initial={{ clipPath: c0 }}
        animate={{ clipPath: c, transition: { duration: 0.9, ease: [0.76, 0, 0.24, 1] } }}
        exit={{ clipPath: c0, transition: { duration: 0.6, ease: [0.76, 0, 0.24, 1] } }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80" style={{ background: project.tint, maskImage: "linear-gradient(180deg,#000,transparent 38%)", WebkitMaskImage: "linear-gradient(180deg,#000,transparent 38%)" }} />
        <div aria-hidden className="halftone pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full text-white/15 [mask-image:radial-gradient(closest-side,#000,transparent)]" />

        <div className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
          <p className="mono text-white/80">Project {project.index} / {String(projects.length).padStart(2, "0")}</p>
          <button type="button" onClick={requestClose} className="btn btn-light !px-5 !py-2.5 text-sm" aria-label="Close project highlight">
            Close <span aria-hidden>✕</span>
          </button>
        </div>

        <div ref={scroller} data-lenis-prevent className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-5 pb-10 sm:px-8">
          <header className="pb-8 pt-4 sm:pt-8">
            <h2 id="modal-title" className="display text-[clamp(1.9rem,5.6vw,5rem)]">
              <Rise trigger>{project.title}</Rise>
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-white/90">{project.tagline}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {[project.role, project.period, project.discipline].map((t) => <li key={t} className="chip bg-white/10">{t}</li>)}
            </ul>
          </header>

          <section aria-label="Project highlight" className="rounded-[1.75rem] border border-white/15 bg-white/[0.05] p-5 sm:p-8">
            <ProjectSpecial project={project} />
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
            <section aria-labelledby="did-h">
              <h3 id="did-h" className="mono text-peach-300">What I did</h3>
              <ol className="mt-4 divide-y divide-white/15 border-y border-white/15">
                {project.did.map((d, i) => (
                  <li key={d} className="grid grid-cols-[2.2rem_1fr] gap-3 py-3.5 text-[1rem] leading-snug">
                    <span className="mono text-coral-400">{String(i + 1).padStart(2, "0")}</span>
                    {d}
                  </li>
                ))}
              </ol>
            </section>
            <section aria-labelledby="by-h">
              <h3 id="by-h" className="mono text-peach-300">By the numbers</h3>
              <div className="mt-4">
                <div className="grid gap-px overflow-hidden rounded-3xl border border-white/15 bg-white/15">
                  {project.stats.map((s) => (
                    <div key={s.label} className="flex items-baseline gap-4 bg-ink-900/90 p-4">
                      <span className="display min-w-[6.5rem] text-[1.9rem] leading-none text-coral-400">{s.value}</span>
                      <span className="text-[0.92rem] leading-snug"><span className="text-white/90">{s.label}</span><br /><span className="mono text-[0.66rem] text-white/55">{s.scope}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {!isFile && <button type="button" className="btn" onClick={() => {
                closing.current = true;
                window.history.replaceState({ ...window.history.state, jerModal: undefined }, "");
                go(`/work/${project.slug}/`, project.title);
              }}>
              Read the full case study <span className="arrow" aria-hidden>↗</span>
            </button>}
            <button type="button" className="btn btn-ghost" onClick={() => onSwitch(next.slug)}>
              Next: {next.title.length > 26 ? next.title.slice(0, 24) + "…" : next.title} <span className="arrow" aria-hidden>→</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
