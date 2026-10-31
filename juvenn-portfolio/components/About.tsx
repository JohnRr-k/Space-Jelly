"use client";

import Image from "next/image";
import { Marquee, Panel, Parallax, Reveal, ScrubText, SectionLabel } from "./motion-kit";
import { logos } from "@/lib/content";
import { site } from "@/lib/site";

const pills = [
  { t: "626 webinar registrations", c: "left-[-6%] top-[12%] -rotate-6", d: "0s" },
  { t: "20–30 content pieces", c: "right-[-8%] top-[30%] rotate-3", d: "-2s" },
  { t: "Authored the jury handbook", c: "left-[-10%] bottom-[22%] rotate-2", d: "-4s" },
  { t: "3 roles, 1 student org", c: "right-[-4%] bottom-[6%] -rotate-3", d: "-1s" },
];

const facts = [
  ["Now", "Finishing a BSc Information Systems & BA Management double degree at BINUS University, graduating December 2026"],
  ["Looking for", "Brand strategy and consulting roles"],
  ["Works in", "English and Bahasa Indonesia"],
  ["Based in", `${site.location} (GMT+7)`],
];

export default function About() {
  return (
    <Panel tone="cream" id="about" label="About Juvenn" overlap>
      <span className="reg right-8 top-[calc(var(--radius-panel)+1.5rem)] text-ink-900" aria-hidden />
      <div className="wrap pb-6 pt-[clamp(4rem,11vw,10rem)]">
        <div className="grid gap-y-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-3">
            <SectionLabel n="01">Who I am</SectionLabel>
          </Reveal>
          <div className="lg:col-span-9">
            <ScrubText
              className="display-lc text-[clamp(1.75rem,4.1vw,4.3rem)] leading-[1.1] text-ink-900"
              text="I turn market research into a clear plan, then build it: content calendars, pitch decks, outreach and events. Strategy first, but never only on paper."
              emphasis={["research", "plan", "build", "it"]}
            />
          </div>
        </div>

        <div className="mt-[clamp(5rem,12vw,11rem)] grid items-center gap-y-16 lg:grid-cols-12">
          <div className="relative mx-auto w-full max-w-[520px] lg:col-span-5 lg:col-start-2 lg:mx-0">
            <Parallax amount={34}>
              <div className="relative rotate-[-3deg] overflow-hidden rounded-[2rem] border-[3px] border-white shadow-[0_40px_80px_-40px_rgba(10,21,32,0.7)]" data-cursor="Chess">
                <Image src="/img/about/knights.webp" alt="Two chess knights, one light and one dark, facing each other across a board" width={1000} height={1038} sizes="(min-width:1024px) 40vw, 90vw" className="h-auto w-full" />
              </div>
            </Parallax>
            {pills.map((p) => (
              <span key={p.t} className={`pill float absolute hidden text-sm sm:inline-flex ${p.c}`} style={{ animationDelay: p.d }}>
                {p.t}
              </span>
            ))}
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <Reveal>
              <h2 className="display text-[clamp(1.6rem,3vw,2.8rem)] text-ink-900">
                Strategy student. <span className="text-coral-600">Builder</span> by habit.
              </h2>
            </Reveal>
            <dl className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {facts.map(([k, v], i) => (
                <Reveal as="div" key={k} delay={i * 0.06} className="grid grid-cols-[7rem_1fr] gap-4 py-4 sm:grid-cols-[9rem_1fr]">
                  <dt className="mono pt-1 text-coral-600">{k}</dt>
                  <dd className="text-[1.02rem] leading-snug">{v}</dd>
                </Reveal>
              ))}
            </dl>
            <Reveal delay={0.1} className="mt-8">
              <p className="max-w-md text-[var(--text-muted)]">
                Research first, then execution. I benchmark, build the strategy, and produce the work myself, in Figma, Canva, CapCut and Google Workspace.
              </p>
            </Reveal>
          </div>
        </div>
      </div>

      {/* places I've worked and studied */}
      <div className="mt-[clamp(4rem,9vw,8rem)] border-y border-[var(--line)] py-8" aria-label="Organizations I have worked and studied with">
        <Marquee speed={38}>
          {[...logos, ...logos, ...logos].map((l, i) => (
            <span key={i} className="mx-[clamp(2rem,6vw,5rem)] flex h-16 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.src} alt="" style={{ width: l.w }} className="h-auto max-h-14 w-auto object-contain" loading="lazy" />
            </span>
          ))}
        </Marquee>
      </div>
    </Panel>
  );
}
