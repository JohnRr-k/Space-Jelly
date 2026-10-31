"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Panel, Reveal, SectionLabel } from "./motion-kit";
import { experience } from "@/lib/content";
import { useShell } from "./shell-context";

export default function Experience() {
  const { go } = useShell();
  const [open, setOpen] = useState<string>(experience[0].id);
  return (
    <Panel tone="cream" id="experience" label="Experience" overlap>
      <div className="wrap pt-[clamp(3.5rem,9vw,8rem)]">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-32">
              <Reveal><SectionLabel n="05">Experience</SectionLabel></Reveal>
              <Reveal delay={0.05}>
                <h2 className="display mt-6 text-[clamp(2.1rem,4.4vw,4.6rem)] text-ink-900">
                  Where I&apos;ve done <span className="text-coral-600">the work.</span>
                </h2>
              </Reveal>
              <Reveal delay={0.12}>
                <p className="mt-5 max-w-xs text-[var(--text-muted)]">Two internships and one student organization. Tap a row for what I actually did.</p>
              </Reveal>
            </div>
          </div>

          <ol className="lg:col-span-8 lg:col-start-5">
            {experience.map((e, i) => {
              const on = open === e.id;
              return (
                <Reveal as="li" key={e.id} delay={i * 0.05} className="border-t-2 border-ink-900 last:border-b-2">
                  <h3>
                    <button
                      type="button"
                      aria-expanded={on}
                      aria-controls={`exp-${e.id}`}
                      onClick={() => setOpen(on ? "" : e.id)}
                      className="group grid w-full grid-cols-[2.5rem_1fr_auto] items-start gap-x-4 gap-y-1 py-6 text-left transition-colors hover:text-coral-600 sm:grid-cols-[3.5rem_1fr_auto]"
                    >
                      <span className="mono pt-2 text-coral-600">0{i + 1}</span>
                      <span>
                        <span className="display-lc block text-[clamp(1.4rem,2.6vw,2.6rem)] leading-[1.05]">{e.role}</span>
                        <span className="mt-2 block text-[1.02rem] text-[var(--text-muted)]">{e.org} · {e.type}</span>
                      </span>
                      <span className="flex flex-col items-end gap-2">
                        <span className="mono whitespace-nowrap">{e.dates}</span>
                        <span aria-hidden className={`grid h-9 w-9 place-items-center rounded-full border-2 border-current text-xl transition-transform duration-500 ${on ? "rotate-45" : ""}`}>+</span>
                      </span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.div
                        id={`exp-${e.id}`}
                        role="region"
                        aria-label={`${e.org} details`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="grid gap-6 pb-8 pl-[3.25rem] sm:pl-[4.5rem] md:grid-cols-[1fr_auto]">
                          <div>
                            <p className="mono text-[var(--text-muted)]">{e.meta}</p>
                            <ul className="mt-4 space-y-3">
                              {e.points.map((p) => (
                                <li key={p} className="flex gap-3 leading-snug"><span aria-hidden className="mt-1 text-coral-600">↳</span>{p}</li>
                              ))}
                            </ul>
                            <a href={`/work/${e.slug}/`} onClick={(ev) => { ev.preventDefault(); go(`/work/${e.slug}/`, e.org); }} className="btn btn-ink mt-6 !px-5 !py-3 text-sm">
                              See the project <span className="arrow" aria-hidden>↗</span>
                            </a>
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={e.logo} alt={`${e.org} logo`} className="h-auto max-h-24 w-28 object-contain md:order-last" loading="lazy" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
      <div className="h-[clamp(2rem,6vw,5rem)]" />
    </Panel>
  );
}
