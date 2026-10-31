"use client";

import { useState } from "react";
import { Marquee, Panel, Reveal, Rise, SectionLabel } from "./motion-kit";
import { mailto, site } from "@/lib/site";
import { useShell } from "./shell-context";

const intents = [
  { label: "A role", subject: "Role opportunity for Juvenn", body: "Hi Juvenn,\n\nI'd like to talk with you about a role at our team.\n\nRole / team:\nPreferred time (GMT+7):\n" },
  { label: "A project", subject: "Project / freelance enquiry", body: "Hi Juvenn,\n\nI have a project I'd like to discuss.\n\nProject:\nTimeline:\n" },
  { label: "A conversation", subject: "Let's have a conversation", body: "Hi Juvenn,\n\nI'd like to set up a short conversation.\n\nPreferred time (GMT+7):\n" },
];

export default function Contact() {
  const { scrollTo } = useShell();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(site.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.location.href = mailto("Hello Juvenn");
    }
  };
  return (
    <Panel tone="cover" id="contact" label="Contact" overlap>
      <div className="wrap relative pt-[clamp(3.5rem,9vw,8rem)]">
        <SectionLabel n="08">Contact</SectionLabel>
        <h2 className="display mt-6 text-[clamp(2.8rem,10.5vw,12rem)] leading-[0.88]">
          <Rise>Let&apos;s work</Rise>
          <Rise delay={0.1}><span className="grad-text">together.</span></Rise>
        </h2>

        <div className="mt-[clamp(3rem,7vw,6rem)] grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="display-lc text-[clamp(1.35rem,2.3vw,2.2rem)] leading-tight">
                Tell someone to jump, and they&apos;ll jump. Tell me, and I&apos;ll ask &ldquo;how high?&rdquo;.
                <span className="text-peach-300"> I can be your &ldquo;how high&rdquo;.</span>
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-8 max-w-md text-lg text-white/80">
                Graduating in December 2026 and ready to bring research-driven thinking to a brand strategy or consulting team.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="lg:col-span-6 lg:col-start-7">
            <div className="rounded-[2rem] bg-white p-6 text-ink-900 shadow-[0_50px_100px_-50px_rgba(0,0,0,0.9)] sm:p-9">
              <p className="display-lc text-[clamp(1.2rem,1.9vw,1.7rem)]">Open to brand strategy &amp; consulting roles.</p>
              <p className="mono mt-6 text-coral-600">I&apos;m writing about…</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {intents.map((i) => (
                  <a key={i.label} href={mailto(i.subject, i.body)} className="btn btn-ink !px-5 !py-3 text-sm">{i.label} <span className="arrow" aria-hidden>↗</span></a>
                ))}
              </div>
              <p className="mt-3 text-sm text-ink-800/70">Each opens an email to me with a subject line ready. There&apos;s no booking calendar yet, so a short email is the way to set up a conversation.</p>

              <dl className="mt-7 divide-y divide-ink-900/15 border-y border-ink-900/15 text-[1rem]">
                <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <dt className="mono text-ink-800/60">Email</dt>
                  <dd className="flex items-center gap-3"><a className="link-u font-semibold" href={mailto("Hello Juvenn")}>{site.email}</a>
                    <button type="button" onClick={copy} className="rounded-full border border-ink-900/30 px-3 py-1 text-xs font-semibold transition hover:bg-ink-900 hover:text-white">{copied ? "Copied ✓" : "Copy"}</button>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3.5"><dt className="mono text-ink-800/60">LinkedIn</dt><dd><a className="link-u font-semibold" href={site.linkedin} target="_blank" rel="noopener noreferrer">linkedin.com/in/juvennelkins</a></dd></div>
                <div className="flex items-center justify-between gap-3 py-3.5"><dt className="mono text-ink-800/60">Portfolio</dt><dd><a className="link-u font-semibold" href={site.pdf} target="_blank" rel="noopener noreferrer">View Portfolio PDF</a></dd></div>
                <div className="flex items-center justify-between gap-3 py-3.5"><dt className="mono text-ink-800/60">Based in</dt><dd className="font-semibold">{site.location} (GMT+7)</dd></div>
              </dl>
              <p className="sr-only" aria-live="polite">{copied ? "Email address copied" : ""}</p>
            </div>
          </Reveal>
        </div>
      </div>

      <footer className="mt-[clamp(5rem,12vw,10rem)] overflow-hidden border-t border-white/20 pt-6">
        <Marquee speed={30}>
          {[0, 1].map((k) => (
            <span key={k} className="display pr-12 text-[clamp(3rem,12vw,13rem)] leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.55)]">
              Juvenn Elkins Ravelliyo <span className="text-coral-500">✺</span>
            </span>
          ))}
        </Marquee>
        <div className="wrap mono mt-6 flex flex-wrap items-center justify-between gap-4 pb-2 text-white/60">
          <span>© 2026 Juvenn Elkins Ravelliyo</span>
          <span>Brand Strategy Portfolio</span>
          <button type="button" onClick={() => scrollTo(0)} className="link-u text-white">Back to top ↑</button>
        </div>
      </footer>
    </Panel>
  );
}
