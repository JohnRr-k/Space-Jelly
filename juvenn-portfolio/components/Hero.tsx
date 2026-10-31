"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { Magnetic, Marquee, Rise, EASE } from "./motion-kit";
import { useShell } from "./shell-context";
import { mailto, site } from "@/lib/site";

const words = ["Market research", "Brand strategy", "Content strategy", "Strategic planning"];

function JakartaClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () => setT(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: site.timezone }).format(new Date()));
    f();
    const i = setInterval(f, 15000);
    return () => clearInterval(i);
  }, []);
  return <span className="tabular-nums">{t || "--:--"}</span>;
}

export default function Hero() {
  const { introDone, go } = useShell();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  // The hero is pinned while the next panel slides over it, so progress is driven by page scroll, not by its own box.
  const { scrollY } = useScroll();
  const vh = () => (typeof window === "undefined" ? 900 : window.innerHeight);
  const fade = useTransform(scrollY, (y) => Math.max(0, 1 - (y / vh()) * 1.05));
  const scale = useTransform(scrollY, (y) => 1 - Math.min(1, y / vh()) * 0.07);
  const lift = useTransform(scrollY, (y) => -Math.min(1, y / vh()) * 60);
  const vis = useTransform(scrollY, (y) => (y > vh() * 1.15 ? "hidden" : "visible"));

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 90, damping: 20 });
  const sy = useSpring(my, { stiffness: 90, damping: 20 });
  const px = useTransform(sx, (v) => v * -26);
  const py = useTransform(sy, (v) => v * -20);
  const sxx = useTransform(sx, (v) => v * 38);
  const syy = useTransform(sy, (v) => v * 30);
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(40);
  const glow = useTransform([glowX, glowY], ([x, y]) => `radial-gradient(520px circle at ${x}% ${y}%, rgba(242,178,140,0.16), transparent 60%)`);

  return (
    <motion.section
      id="top"
      ref={ref}
      style={reduce ? undefined : { visibility: vis }}
      className="relative z-0 h-auto min-h-[100svh] overflow-hidden lg:sticky lg:top-0 lg:h-[100svh]"
      onMouseMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
        glowX.set(((e.clientX - r.left) / r.width) * 100);
        glowY.set(((e.clientY - r.top) / r.height) * 100);
      }}
    >
      <motion.div aria-hidden className="absolute inset-0" style={{ background: glow }} />
      <div aria-hidden className="absolute inset-0 text-white/[0.07] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:calc(100%/12)_96px] [mask-image:radial-gradient(80%_70%_at_50%_40%,#000,transparent)]" />
      <span className="reg left-6 top-24 text-white" aria-hidden />
      <span className="reg right-6 top-24 text-white" aria-hidden />

      <motion.div style={reduce ? undefined : { opacity: fade, scale, y: lift }} className="wrap relative flex min-h-[100svh] flex-col pb-32 pt-28 lg:h-full lg:pb-28 lg:pt-28">
        <div className="grid flex-1 items-center gap-10 lg:grid-cols-12">
          {/* copy */}
          <div className="relative z-10 lg:col-span-8">
            <motion.p
              className="mono mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-peach-300"
              initial={{ opacity: 0, y: 12 }}
              animate={introDone ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-white">
                <span className="h-2 w-2 rounded-full bg-teal-300 [animation:pulse-dot_2.4s_infinite]" />
                Open to brand strategy &amp; consulting roles
              </span>
              <span className="text-white/60">Graduating Dec 2026</span>
            </motion.p>

            <h1 className="display whitespace-nowrap text-[clamp(1.9rem,8.8vw,2.6rem)] sm:text-[clamp(2.6rem,7.1vw,9rem)]" aria-label="Research first, then the work.">
              <Rise trigger={introDone} delay={0.15}>Research</Rise>
              <Rise trigger={introDone} delay={0.27}>
                <span className="outline-text">First,</span> then
              </Rise>
              <Rise trigger={introDone} delay={0.39}>
                <span className="grad-text">the work.</span>
              </Rise>
            </h1>

            <motion.div
              className="mt-8 max-w-[34rem] space-y-6"
              initial={{ opacity: 0, y: 24 }}
              animate={introDone ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.9, ease: EASE, delay: 0.7 }}
            >
              <p className="text-lg leading-relaxed text-white/85">
                I&apos;m <strong className="font-semibold text-white">Juvenn Elkins Ravelliyo</strong>, a strategy student who turns market research into a clear plan, then builds it: content calendars, pitch decks, outreach and events.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Magnetic>
                  <a href="#work" onClick={(e) => { e.preventDefault(); go("#work"); }} className="btn">
                    Explore my work <span className="arrow" aria-hidden>↓</span>
                  </a>
                </Magnetic>
                <a href={mailto("Let's talk — opportunity for Juvenn")} className="btn btn-ghost">
                  Let&apos;s connect <span className="arrow" aria-hidden>↗</span>
                </a>
              </div>
            </motion.div>
          </div>

          {/* portrait composition */}
          <div className="relative z-0 mx-auto w-full max-w-[420px] lg:col-span-4 lg:max-w-none">
            <motion.div style={reduce ? undefined : { x: px, y: py }} className="relative mx-auto aspect-square w-[min(78vw,400px)] lg:w-[min(30vw,420px)]">
              <motion.div
                className="absolute inset-0"
                initial={{ clipPath: "inset(100% 0 0 0 round 34px)", rotate: 6, scale: 1.08 }}
                animate={introDone ? { clipPath: "inset(0% 0 0 0 round 34px)", rotate: 3, scale: 1 } : undefined}
                transition={{ duration: 1.3, ease: EASE, delay: 0.3 }}
              >
                <div className="relative h-full w-full overflow-hidden rounded-[34px] border-[3px] border-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
                  <Image src="/img/about/portrait.webp" alt="Portrait of Juvenn Elkins Ravelliyo" fill priority sizes="(min-width:1024px) 30vw, 78vw" className="object-cover" />
                  <div aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,transparent_55%,rgba(212,84,47,0.35))]" />
                </div>
              </motion.div>

              <motion.div style={reduce ? undefined : { x: sxx, y: syy }} className="absolute -left-4 bottom-8 z-10 sm:-left-10" initial={{ opacity: 0, scale: 0.6 }} animate={introDone ? { opacity: 1, scale: 1 } : undefined} transition={{ delay: 1.1, duration: 0.7, ease: EASE }}>
                <span className="pill float -rotate-[7deg] text-sm [--r:-7deg]">626 webinar registrations</span>
              </motion.div>
              <motion.div style={reduce ? undefined : { x: sxx, y: syy }} className="absolute -right-3 top-6 z-10 sm:-right-8" initial={{ opacity: 0, scale: 0.6 }} animate={introDone ? { opacity: 1, scale: 1 } : undefined} transition={{ delay: 1.25, duration: 0.7, ease: EASE }}>
                <span className="pill float rotate-[6deg] bg-white text-sm !text-ink-900 [--r:6deg] [animation-delay:-3s]">EN / ID bilingual</span>
              </motion.div>

              {/* rotating badge */}
              <motion.div className="absolute -bottom-10 -right-2 z-20 h-32 w-32 sm:-right-10 sm:h-36 sm:w-36" initial={{ opacity: 0, scale: 0.4, rotate: -90 }} animate={introDone ? { opacity: 1, scale: 1, rotate: 0 } : undefined} transition={{ delay: 1.4, duration: 1, ease: EASE }}>
                <svg viewBox="0 0 120 120" className="spin-slow h-full w-full" aria-hidden>
                  <defs><path id="circ" d="M60,60 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0" /></defs>
                  <circle cx="60" cy="60" r="58" fill="#0a1520" stroke="rgba(255,255,255,.25)" />
                  <text fill="#f2b28c" fontSize="9.4" fontFamily="var(--font-mono)" >
                    <textPath href="#circ" textLength="290" lengthAdjust="spacing">BRAND STRATEGY • CONSULTING •</textPath>
                  </text>
                </svg>
                <span className="absolute inset-0 grid place-items-center text-2xl text-white" aria-hidden>↗</span>
              </motion.div>
            </motion.div>
          </div>
        </div>

        <div className="mono mt-10 flex flex-wrap items-end justify-between gap-4 text-white/60">
          <span>North Jakarta · <JakartaClock /> GMT+7</span>
          <span className="hidden items-center gap-3 sm:flex">
            <span className="relative block h-9 w-[1.5px] overflow-hidden bg-white/20" aria-hidden>
              <motion.span className="absolute inset-x-0 top-0 h-3 bg-white" animate={{ y: [-14, 40] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
            </span>
            Scroll
          </span>
          <span>Brand Strategy Portfolio · 2026</span>
        </div>
      </motion.div>

      {/* running skills ribbon */}
      <div className="absolute inset-x-0 bottom-0 z-10 -rotate-[1.2deg] bg-coral-500 py-2.5 text-white shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.6)]" aria-hidden>
        <Marquee speed={55}>
          {[...words, ...words].map((w, i) => (
            <span key={i} className="display-lc flex items-center gap-6 pr-6 text-[clamp(1rem,2vw,1.5rem)] uppercase">
              {w}
              <span className="text-ink-900">✦</span>
            </span>
          ))}
        </Marquee>
      </div>
    </motion.section>
  );
}
