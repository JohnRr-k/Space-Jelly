"use client";

import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Panel, Reveal, Rise, ScrubText, SectionLabel } from "./motion-kit";
import { stages, threeA } from "@/lib/content";

const ease = [0.16, 1, 0.3, 1] as const;

function Dial({ p, active }: { p: ReturnType<typeof useScroll>["scrollYProgress"]; active: number }) {
  const reduce = useReducedMotion();
  const rot = useTransform(p, [0, 1], [0, 220]);
  const dash = useTransform(p, [0, 1], [1, 0]);
  return (
    <div className="relative mx-auto aspect-square w-[min(31vw,60vh)]" aria-hidden>
      <motion.img src="/img/deco/blob-c.webp" alt="" className="absolute inset-[14%] h-[72%] w-[72%] object-contain opacity-90" style={reduce ? undefined : { rotate: rot }} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth=".35" />
        <motion.circle cx="50" cy="50" r="46" fill="none" stroke="#e56a42" strokeWidth=".9" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: dash }} />
      </svg>
      {stages.map((s, i) => {
        const a = (-90 + i * 72) * (Math.PI / 180);
        const on = i <= active;
        return (
          <div key={s.name} className="absolute" style={{ left: `${50 + 46 * Math.cos(a)}%`, top: `${50 + 46 * Math.sin(a)}%`, transform: "translate(-50%,-50%)" }}>
            <span className={`grid h-9 w-9 place-items-center rounded-full border-2 font-mono text-[0.68rem] transition-all duration-500 ${on ? "scale-110 border-coral-400 bg-coral-500 text-white" : "border-white/40 bg-ink-900 text-white/70"}`}>{s.n}</span>
          </div>
        );
      })}
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <span className="display-lc block text-[clamp(3rem,6vw,6rem)] leading-none text-white">{stages[active].n}</span>
          <span className="mono mt-2 block text-peach-300">{stages[active].name}</span>
        </div>
      </div>
    </div>
  );
}

export default function Approach() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(stages.length - 1, Math.floor(v * stages.length * 0.999))));

  return (
    <Panel tone="teal" id="approach" label="How I work" overlap>
      {/* DESKTOP: pinned, scroll steps through the five stages */}
      <div ref={ref} className="relative hidden h-[480vh] lg:block">
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <div className="wrap grid w-full grid-cols-12 items-center gap-8 pt-10">
            <div className="col-span-8">
              <SectionLabel n="04">How I work</SectionLabel>
              <p className="mt-5 max-w-md text-lg text-white/80">Five moves, in order. Research first, then execution.</p>
              <div className="relative mt-4 h-[clamp(4rem,8.6vw,9.6rem)]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.h2
                    key={active}
                    className="display absolute left-0 top-0 whitespace-nowrap text-[clamp(3rem,7.4vw,8.6rem)]"
                    initial={{ y: "110%", rotate: 3 }}
                    animate={{ y: "0%", rotate: 0 }}
                    exit={{ y: "-110%", rotate: -3 }}
                    transition={{ duration: 0.7, ease }}
                  >
                    {stages[active].name}
                  </motion.h2>
                </AnimatePresence>
              </div>
              <div className="relative mt-4 h-24 max-w-xl">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p key={active} className="display-lc text-[clamp(1.4rem,2.2vw,2.2rem)] leading-tight" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45, ease }}>
                    {stages[active].line}
                  </motion.p>
                </AnimatePresence>
              </div>
              <ul className="mt-6 flex gap-2" aria-label="Stages">
                {stages.map((s, i) => (
                  <li key={s.name} className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-14 bg-coral-400" : i < active ? "w-6 bg-white/70" : "w-6 bg-white/20"}`} />
                ))}
              </ul>
            </div>
            <div className="col-span-4"><Dial p={scrollYProgress} active={active} /></div>
          </div>
        </div>
      </div>

      {/* MOBILE / TABLET: a readable vertical sequence */}
      <div className="wrap pt-12 lg:hidden">
        <SectionLabel n="04">How I work</SectionLabel>
        <h2 className="display mt-6 text-[clamp(2.2rem,9vw,4rem)]"><Rise>Five moves.</Rise><Rise delay={0.1}><span className="grad-text">In order.</span></Rise></h2>
        <ol className="relative mt-10 space-y-2 border-l border-white/25 pl-6">
          {stages.map((s, i) => (
            <Reveal as="li" key={s.name} delay={0.05} className="relative pb-8">
              <span className="absolute -left-[2.15rem] top-1 grid h-6 w-6 place-items-center rounded-full bg-coral-500 font-mono text-[0.62rem]">{i + 1}</span>
              <h3 className="display text-[clamp(2rem,8vw,3rem)]">{s.name}</h3>
              <p className="mt-2 text-lg text-white/85">{s.line}</p>
            </Reveal>
          ))}
        </ol>
      </div>

      {/* 3A */}
      <div className="wrap pb-6 pt-[clamp(4rem,10vw,9rem)]">
        <Reveal><p className="mono text-peach-300">Running underneath it all: the 3A framework</p></Reveal>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {threeA.map((t, i) => (
            <Reveal key={t.word} delay={i * 0.1}>
              <div className="group relative h-full overflow-hidden rounded-[2rem] border border-white/25 p-7 transition-colors duration-500 hover:bg-white hover:text-ink-900">
                <span className="mono opacity-60">A{i + 1}</span>
                <p className="display mt-6 text-[clamp(2rem,3.6vw,3.6rem)]">{t.word}</p>
                <p className="mt-2 text-lg opacity-85">{t.line}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-[clamp(4rem,8vw,7rem)] max-w-5xl">
          <ScrubText className="display-lc text-[clamp(1.5rem,3.2vw,3.2rem)] leading-[1.15]" text="Decode the problem, sharpen the angle, deliver work that holds up in the real world." />
        </div>
      </div>
    </Panel>
  );
}
