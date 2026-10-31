"use client";

import { Panel, Parallax, Reveal, SectionLabel, CountUp, Ribbon } from "./motion-kit";
import { evidence, evidenceMini } from "@/lib/content";

const place = [
  "lg:col-span-6 lg:col-start-1",
  "lg:col-span-5 lg:col-start-8 lg:mt-[10vw]",
  "lg:col-span-5 lg:col-start-2",
  "lg:col-span-6 lg:col-start-7 lg:mt-[8vw]",
];

export default function Evidence() {
  return (
    <>
      <Panel tone="coral" id="evidence" label="Evidence" overlap>
        <span className="halftone pointer-events-none absolute -right-10 top-24 h-[34rem] w-[34rem] rounded-full text-white/20 [mask-image:radial-gradient(closest-side,#000,transparent)]" aria-hidden />
        <div className="wrap relative pt-[clamp(3.5rem,8vw,7rem)]">
          <div className="grid gap-8 lg:grid-cols-12">
            <Reveal className="lg:col-span-3"><SectionLabel n="02">Evidence</SectionLabel></Reveal>
            <div className="lg:col-span-9">
              <Reveal>
                <h2 className="display text-[clamp(2.1rem,5.4vw,5.8rem)]">
                  Numbers with a name on them.
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-xl text-lg">
                  Each figure is tied to the work it came from, and marked as something I handled myself or a result of the wider team.
                </p>
              </Reveal>
            </div>
          </div>

          <ol className="mt-[clamp(3rem,8vw,7rem)] grid gap-x-8 gap-y-16 lg:grid-cols-12">
            {evidence.map((e, i) => (
              <li key={e.label} className={place[i]}>
                <Parallax amount={i % 2 ? 28 : 16}>
                  <div className="relative border-t-2 border-white/80 pt-4">
                    <div className="mono flex items-center justify-between">
                      <span>0{i + 1}</span>
                      <span className={`rounded-full px-3 py-1 ${e.who === "mine" ? "bg-white text-ink-900" : "border border-white"}`}>
                        {e.who === "mine" ? "Handled by me" : "Team result"}
                      </span>
                    </div>
                    <p className="display mt-3 flex items-baseline text-[clamp(4.4rem,12.5vw,13rem)] leading-[0.85]">
                      <CountUp to={e.value} />
                      <span className="text-[0.52em]">{e.suffix}</span>
                    </p>
                    <p className="display-lc mt-4 text-[clamp(1.3rem,2.2vw,2.1rem)]">{e.label}</p>
                    <p className="mt-2 max-w-sm text-[0.98rem] opacity-90">{e.detail}</p>
                    <p className="mt-3 max-w-sm text-[0.9rem] italic opacity-85">{e.scope}</p>
                  </div>
                </Parallax>
              </li>
            ))}
          </ol>
        </div>
        <div className="h-[clamp(3rem,8vw,7rem)]" />
      </Panel>
      <div className="relative z-30 -mt-10 mb-[-1.5rem] overflow-x-clip">
        <Ribbon items={[...evidenceMini, ...evidenceMini]} tone="ink" rotate={1.6} reverse />
      </div>
    </>
  );
}
