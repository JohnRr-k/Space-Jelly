"use client";

import { useRef, useState } from "react";
import { useMedia } from "@/lib/useMedia";
import { motion, useReducedMotion } from "motion/react";
import { Marquee, Panel, Reveal, Rise, SectionLabel } from "./motion-kit";
import { coreSkills, tools } from "@/lib/content";

const spots = [
  "lg:left-[1%] lg:top-[4%] lg:-rotate-6",
  "lg:left-[50%] lg:top-[0%] lg:rotate-3",
  "lg:left-[8%] lg:top-[46%] lg:rotate-[-2deg]",
  "lg:left-[54%] lg:top-[62%] lg:-rotate-3",
];

function Tool({ t }: { t: string }) {
  return <span className="chip mx-2 !text-base">{t}</span>;
}

export default function Skills() {
  const stage = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const desk = useMedia("(min-width:1024px) and (hover:hover)");
  const [hint, setHint] = useState(coreSkills[0].note);

  return (
    <Panel tone="ink-clear" id="skills" label="Skills and tools" overlap>
      <div className="wrap pt-[clamp(3.5rem,9vw,8rem)]">
        <div className="grid items-end gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionLabel n="06">Skills</SectionLabel>
            <h2 className="display mt-6 text-[clamp(2.2rem,5.6vw,6rem)]">
              <Rise>Four things</Rise>
              <Rise delay={0.1}>I&apos;m <span className="grad-text">built on.</span></Rise>
            </h2>
          </div>
          <Reveal className="lg:col-span-4 lg:col-start-9">
            <p className="text-lg text-white/80">
              Research first, then execution. I benchmark, build the strategy, and produce the work myself.
            </p>
          </Reveal>
        </div>

        <div ref={stage} className="relative mt-12 flex flex-wrap gap-3 lg:mt-16 lg:block lg:h-[min(62vh,520px)]">
          {coreSkills.map((s, i) => (
            <motion.button
              key={s.name}
              type="button"
              drag={desk && !reduce}
              dragConstraints={stage}
              dragElastic={0.18}
              dragMomentum
              whileDrag={{ scale: 1.06, zIndex: 20 }}
              whileHover={{ scale: 1.04 }}
              onHoverStart={() => setHint(s.note)}
              onFocus={() => setHint(s.note)}
              data-cursor={desk ? "Drag" : undefined}
              className={`pill !px-[clamp(1.6rem,3.4vw,3.4rem)] !py-[clamp(1rem,2.2vw,2rem)] display-lc text-[clamp(1.4rem,3.6vw,3.6rem)] lg:absolute ${spots[i]} ${i === 1 ? "!bg-white !text-ink-900" : ""} ${i === 2 ? "!bg-teal-500" : ""} ${i === 3 ? "!bg-lilac-300 !text-ink-900" : ""}`}
              initial={reduce ? false : { opacity: 0, y: 60, scale: 0.8 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "0px 0px -10% 0px" }}
              transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              {s.name}
            </motion.button>
          ))}
          <p aria-live="polite" className="mono absolute bottom-0 right-0 hidden max-w-[16rem] text-right text-peach-300 lg:block">
            {hint}
            <span className="mt-2 block text-white/50">Drag the pills around</span>
          </p>
        </div>
        <ul className="mt-6 space-y-2 text-white/80 lg:hidden">
          {coreSkills.map((s) => <li key={s.name}><span className="font-semibold text-white">{s.name}</span>: {s.note}</li>)}
        </ul>
      </div>

      <div className="mt-[clamp(4rem,9vw,8rem)] space-y-5 py-4" role="group" aria-label="Tools I use">
        <p className="wrap mono text-peach-300">Tools I produce the work in</p>
        <Marquee speed={42}>{[...tools.build, ...tools.build, ...tools.build].map((t, i) => <Tool key={i} t={t} />)}</Marquee>
        <p className="wrap mono pt-3 text-peach-300">AI that speeds up research and drafts · outreach tooling</p>
        <Marquee speed={36} reverse>{[...tools.ai, ...tools.outreach, ...tools.ai, ...tools.outreach, ...tools.ai, ...tools.outreach].map((t, i) => <Tool key={i} t={t} />)}</Marquee>
        <p className="sr-only">Production: {tools.build.join(", ")}. AI assistance: {tools.ai.join(", ")}. Outreach: {tools.outreach.join(", ")}.</p>
      </div>
      <div className="h-8" />
    </Panel>
  );
}
