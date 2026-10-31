"use client";

import Image from "next/image";
import Link from "next/link";
import { Panel, Reveal, Rise, SectionLabel, CountUp, Ribbon } from "./motion-kit";
import { ProjectSpecial } from "./ProjectModules";
import { projects, type Project } from "@/lib/content";
import { useShell } from "./shell-context";
import { mailto } from "@/lib/site";

export default function CaseStudy({ project }: { project: Project }) {
  const { go } = useShell();
  const idx = projects.findIndex((p) => p.slug === project.slug);
  const next = projects[(idx + 1) % projects.length];
  const prev = projects[(idx - 1 + projects.length) % projects.length];
  const meta: [string, string][] = [
    ["Role", project.role],
    ["Period", project.period],
    ["Organization", project.org],
    ["Focus", project.discipline],
  ];

  return (
    <main id="main">
      {/* hero */}
      <section className="relative overflow-hidden pb-16 pt-32 sm:pt-40" style={{ background: `${project.tint}, var(--color-ink-900)` }}>
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,13,22,0.35),rgba(10,21,32,0.92))]" />
        <span aria-hidden className="halftone absolute -right-24 top-10 h-[34rem] w-[34rem] rounded-full text-white/20 [mask-image:radial-gradient(closest-side,#000,transparent)]" />
        <div className="wrap relative">
          <Link href="/#work" onClick={(e) => { e.preventDefault(); go("/#work", "Work"); }} className="mono link-u inline-flex items-center gap-2 text-white/80">← All work</Link>
          <p className="mono mt-10 text-peach-300">Case study {project.index} / {String(projects.length).padStart(2, "0")}</p>
          <h1 className="display mt-4 text-[clamp(2.2rem,7.4vw,8.4rem)]">
            <Rise trigger>{project.title}</Rise>
          </h1>
          <Reveal delay={0.3}><p className="mt-6 max-w-3xl text-[clamp(1.15rem,1.8vw,1.6rem)] leading-snug text-white/90">{project.tagline}</p></Reveal>

          <dl className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/20 bg-white/20 sm:grid-cols-2 lg:grid-cols-4">
            {meta.map(([k, v]) => (
              <div key={k} className="bg-ink-900/80 p-5 backdrop-blur"><dt className="mono text-peach-300">{k}</dt><dd className="mt-2 font-semibold leading-snug">{v}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      {/* context */}
      <Panel tone="cream" label="Context and objective" overlap>
        <div className="wrap pt-[clamp(3rem,8vw,7rem)]">
          <div className="grid gap-10 lg:grid-cols-12">
            <Reveal className="lg:col-span-3"><SectionLabel n="01">Context</SectionLabel></Reveal>
            <div className="space-y-6 lg:col-span-8">
              <Reveal><p className="display-lc text-[clamp(1.5rem,3vw,2.9rem)] leading-[1.12] text-ink-900">{project.summary}</p></Reveal>
              {project.context.map((c, i) => (
                <Reveal key={i} delay={0.05 * i}><p className="max-w-2xl text-[1.1rem] leading-relaxed text-[var(--text-muted)]">{c}</p></Reveal>
              ))}
            </div>
          </div>
        </div>
        <div className="h-[clamp(2rem,5vw,4rem)]" />
      </Panel>

      {/* the signature module */}
      <Panel tone="ink" label="Project highlight" overlap>
        <div className="wrap pt-[clamp(3rem,7vw,6rem)]">
          <SectionLabel n="02">The work, up close</SectionLabel>
          <Reveal className="mt-8">
            <div className="rounded-[2rem] border border-white/15 bg-white/[0.05] p-5 sm:p-9">
              <ProjectSpecial project={project} />
            </div>
          </Reveal>
        </div>
        <div className="h-8" />
      </Panel>

      {/* role */}
      <Panel tone="teal" label="What I did" overlap>
        <div className="wrap pt-[clamp(3rem,8vw,7rem)]">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <SectionLabel n="03">My role</SectionLabel>
                <h2 className="display mt-5 text-[clamp(2rem,4.2vw,4.4rem)]"><Rise>What I</Rise><Rise delay={0.1}><span className="grad-text">actually did.</span></Rise></h2>
                <p className="mono mt-5 text-white/70">{project.role}</p>
              </div>
            </div>
            <ol className="lg:col-span-8">
              {project.did.map((d, i) => (
                <Reveal as="li" key={d} delay={0.03} className="grid grid-cols-[3.2rem_1fr] items-baseline gap-4 border-t border-white/25 py-6 last:border-b">
                  <span className="display text-[1.8rem] text-peach-300">{String(i + 1).padStart(2, "0")}</span>
                  <p className="display-lc text-[clamp(1.1rem,1.7vw,1.6rem)] leading-snug">{d}</p>
                </Reveal>
              ))}
            </ol>
          </div>

          {/* selected execution */}
          <div className="mt-[clamp(4rem,9vw,8rem)]">
            <SectionLabel n="04">Selected execution</SectionLabel>
            <ul className="mt-8 columns-2 gap-5 sm:gap-7 lg:columns-3 [&>li]:mb-5 sm:[&>li]:mb-7">
              {project.gallery.map((g, i) => (
                <Reveal as="li" key={g.src} delay={(i % 3) * 0.07} className="break-inside-avoid">
                  <figure>
                    <div className="overflow-hidden rounded-2xl border-[3px] border-white bg-white shadow-[0_30px_60px_-35px_rgba(0,0,0,0.9)]" data-cursor="">
                      <Image src={g.src} alt={g.alt} width={g.w} height={g.h} sizes="(min-width:1024px) 30vw, 46vw" className="h-auto w-full transition-transform duration-700 hover:scale-[1.04]" loading="lazy" />
                    </div>
                    {g.caption && <figcaption className="mt-2 text-sm text-white/75">{g.caption}</figcaption>}
                  </figure>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
        <div className="h-8" />
      </Panel>

      {/* numbers + outcome */}
      <Panel tone="coral" label="Documented outcome" overlap>
        <div className="wrap pt-[clamp(3rem,8vw,7rem)]">
          <SectionLabel n="05">By the numbers</SectionLabel>
          <ul className="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {project.stats.map((s, i) => {
              const m = /^(\d+)(.*)$/.exec(s.value);
              return (
                <Reveal as="li" key={s.label} delay={i * 0.08} className="border-t-2 border-white/80 pt-4">
                  <p className="mono">{s.scope}</p>
                  <p className="display mt-3 text-[clamp(2.6rem,5vw,5.2rem)] leading-[0.9]">{m ? <><CountUp to={+m[1]} />{m[2]}</> : s.value}</p>
                  <p className="mt-3 leading-snug">{s.label}</p>
                </Reveal>
              );
            })}
          </ul>
          <Reveal className="mt-[clamp(3rem,7vw,6rem)]">
            <div className="grid gap-6 rounded-[2rem] bg-ink-900 p-7 text-white sm:p-10 lg:grid-cols-12">
              <p className="mono text-peach-300 lg:col-span-3">Documented outcome</p>
              <p className="display-lc text-[clamp(1.1rem,1.8vw,1.6rem)] leading-snug lg:col-span-9">{project.outcome}</p>
            </div>
          </Reveal>
        </div>
        <div className="h-8" />
      </Panel>

      <div className="relative z-30 -mb-6 -mt-2 overflow-x-clip"><Ribbon items={[`${project.title}`, project.role, project.period, "Next project"]} tone="ink" rotate={-1.6} /></div>

      {/* next */}
      <Panel tone="cover" label="Next project" overlap>
        <div className="wrap pt-[clamp(4rem,9vw,8rem)]">
          <p className="mono text-peach-300">Next project</p>
          <a href={`/work/${next.slug}/`} onClick={(e) => { e.preventDefault(); go(`/work/${next.slug}/`, next.title); }} className="group mt-4 block" data-cursor="Go">
            <span className="display block text-[clamp(2.2rem,8vw,9rem)] leading-[0.92] transition-transform duration-700 [transition-timing-function:var(--ease)] group-hover:translate-x-4">
              {next.title} <span className="inline-block text-coral-400 transition-transform duration-500 group-hover:translate-x-3 group-hover:-translate-y-3" aria-hidden>↗</span>
            </span>
            <span className="mt-4 block max-w-2xl text-lg text-white/80">{next.tagline}</span>
          </a>
          <div className="mt-14 flex flex-wrap items-center gap-3">
            <a href={`/work/${prev.slug}/`} onClick={(e) => { e.preventDefault(); go(`/work/${prev.slug}/`, prev.title); }} className="btn btn-ghost">← {prev.title.length > 24 ? prev.title.slice(0, 22) + "…" : prev.title}</a>
            <Link href="/#work" onClick={(e) => { e.preventDefault(); go("/#work", "Work"); }} className="btn btn-ghost">All work</Link>
            <a href={mailto(`About your ${project.title} work`)} className="btn">Talk to me about this <span className="arrow" aria-hidden>↗</span></a>
          </div>
        </div>
        <div className="h-[clamp(3rem,8vw,7rem)]" />
      </Panel>
    </main>
  );
}
