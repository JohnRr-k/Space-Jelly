"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { stages } from "@/lib/content";

const MIN_MS = 3000; // length of the choreography on a first visit
const MAX_WAIT_MS = 9000; // never hold the page hostage if an asset stalls
const KEY = "jer-intro-seen";
const ASSETS = ["/img/about/portrait.webp", "/img/deco/blob-a.webp", "/img/deco/blob-d.webp", "/img/about/knights.webp"];

type Props = { onStart: () => void; onRelease: () => void; onDone: () => void };

/**
 * Entry sequence. The counter is bound to genuine loading (fonts + hero imagery),
 * and the choreography is paced so the five stages of Juvenn's process can be read.
 * It plays once per browser session, can be skipped, and is bypassed for reduced motion.
 */
export default function Preloader({ onStart, onRelease, onDone }: Props) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"check" | "run" | "exit" | "gone">("check");
  const [pct, setPct] = useState(0);
  const real = useRef(0);
  const started = useRef(0);
  const cb = useRef({ onStart, onRelease, onDone });
  useEffect(() => {
    cb.current = { onStart, onRelease, onDone };
  });

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {}
    if (reduce || seen) {
      queueMicrotask(() => {
        setPhase("gone");
        cb.current.onDone();
      });
      return;
    }
    queueMicrotask(() => setPhase("run"));
    cb.current.onStart();
    started.current = performance.now();

    // genuine progress: fonts + images
    let loaded = 0;
    const total = ASSETS.length + 1;
    const bump = () => {
      loaded += 1;
      real.current = loaded / total;
    };
    (document.fonts?.ready ?? Promise.resolve()).then(bump, bump);
    ASSETS.forEach((src) => {
      const im = new Image();
      im.onload = bump;
      im.onerror = bump;
      im.src = src;
    });

    let raf = 0;
    const tick = (now: number) => {
      const elapsed = Math.max(0, now - started.current);
      const timeP = Math.min(1, elapsed / MIN_MS);
      const realP = elapsed > MAX_WAIT_MS ? 1 : real.current;
      setPct((prev) => {
        const target = Math.min(timeP, realP);
        return prev + (target - prev) * 0.18;
      });
      if (timeP >= 1 && realP >= 1) {
        setPct(1);
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {}
      setPhase("exit");
      window.setTimeout(() => cb.current.onDone(), 380);
      window.setTimeout(() => {
        cb.current.onRelease();
        setPhase("gone");
      }, 1350);
    };
    (window as unknown as { __jerSkip?: () => void }).__jerSkip = () => {
      cancelAnimationFrame(raf);
      setPct(1);
      finish();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "gone" || phase === "check") {
    // "check" renders a plain cover so there's no flash of un-introduced content
    return phase === "check" ? <div className="jer-cover fixed inset-0 z-[100] bg-ink-950" aria-hidden /> : null;
  }

  const stage = Math.max(0, Math.min(4, Math.floor(pct * 5)));
  const exiting = phase === "exit";
  const ease = [0.76, 0, 0.24, 1] as const;

  return (
    <div className="fixed inset-0 z-[100]" role="status" aria-live="polite" aria-label="Loading portfolio">
      {/* coral trail */}
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-coral-500"
        style={{ borderRadius: exiting ? "0 0 50% 50% / 0 0 16vh 16vh" : 0 }}
        animate={{ y: exiting ? "-108%" : "0%" }}
        transition={{ duration: 0.95, ease, delay: exiting ? 0.1 : 0 }}
      />
      {/* ink sheet */}
      <motion.div
        className="tone-cover absolute inset-0 overflow-hidden"
        style={{ borderRadius: exiting ? "0 0 50% 50% / 0 0 16vh 16vh" : 0, background: "var(--color-ink-950)" }}
        animate={{ y: exiting ? "-104%" : "0%" }}
        transition={{ duration: 0.95, ease }}
      >
        <motion.img
          src="/img/deco/blob-a.webp"
          alt=""
          aria-hidden
          className="absolute -right-[12vw] top-1/2 w-[min(70vw,720px)] -translate-y-1/2 opacity-90"
          initial={{ scale: 0.6, rotate: -25, opacity: 0 }}
          animate={{ scale: 1, rotate: 20, opacity: 0.9 }}
          transition={{ duration: 3.2, ease: [0.16, 1, 0.3, 1] }}
        />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_70%_at_0%_10%,rgba(15,106,127,0.55),transparent_60%)]" />

        <div className="relative flex h-full flex-col justify-between px-[var(--gutter)] py-7 text-white">
          <div className="flex items-start justify-between">
            <span className="display-lc text-xl">JER<span className="text-coral-400">.</span></span>
            <span className="mono text-right text-white/70">Brand Strategy Portfolio<br />2026</span>
          </div>

          <div className="relative">
            <p className="mono mb-3 flex items-center gap-3 text-peach-300">
              <span className="inline-block h-px w-10 bg-peach-300" />
              Stage {String(stage + 1).padStart(2, "0")} / 05
            </p>
            <div className="relative h-[clamp(3.2rem,11vw,10rem)] overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={stage}
                  className="display absolute left-0 top-0 block whitespace-nowrap text-[clamp(2.6rem,10vw,9.5rem)]"
                  initial={{ y: "105%" }}
                  animate={{ y: "0%" }}
                  exit={{ y: "-105%" }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                >
                  {stages[stage].name}
                </motion.span>
              </AnimatePresence>
            </div>
            <p className="mt-3 max-w-md text-base text-white/75">{stages[stage].line}</p>
          </div>

          <div>
            <div className="mb-4 flex items-end justify-between">
              <span className="display-lc text-[clamp(4.5rem,16vw,13rem)] leading-[0.8] tabular-nums">
                {String(Math.round(pct * 100)).padStart(3, "0")}
              </span>
              <button
                type="button"
                onClick={() => (window as unknown as { __jerSkip?: () => void }).__jerSkip?.()}
                className="mono mb-2 rounded-full border border-white/40 px-4 py-2 text-white/85 transition hover:bg-white hover:text-ink-900"
              >
                Skip intro
              </button>
            </div>
            <div className="h-[3px] w-full bg-white/15">
              <div className="h-full bg-coral-500" style={{ width: `${pct * 100}%` }} />
            </div>
            <div className="mono mt-3 flex justify-between text-white/55">
              {stages.map((s, i) => (
                <span key={s.name} className={i <= stage ? "text-peach-300" : ""}>{s.name}</span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
