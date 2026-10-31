"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import Lenis from "lenis";
import { ShellContext } from "./shell-context";
import Preloader from "./Preloader";
import Cursor from "./Cursor";
import Header from "./Header";

type Curtain = "hidden" | "in" | "out";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const lenisRef = useRef<Lenis | null>(null);
  const lockCount = useRef(0);
  const [introDone, setIntroDone] = useState(false);
  const [curtain, setCurtain] = useState<Curtain>("hidden");
  const [label, setLabel] = useState("");
  const pendingHref = useRef<string | null>(null);

  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 });

  // Smooth scrolling (disabled for reduced motion)
  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95, smoothWheel: true });
    lenisRef.current = lenis;
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduce]);

  const lock = useCallback((locked: boolean) => {
    lockCount.current = Math.max(0, lockCount.current + (locked ? 1 : -1));
    const on = lockCount.current > 0;
    const l = lenisRef.current;
    if (l) {
      if (on) l.stop();
      else l.start();
    }
    document.documentElement.style.overflow = on ? "hidden" : "";
  }, []);

  const scrollTo = useCallback((target: string | number, opts?: { offset?: number; immediate?: boolean }) => {
    const l = lenisRef.current;
    if (l) {
      l.scrollTo(target as never, { offset: opts?.offset ?? 0, immediate: opts?.immediate, duration: 1.6, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
      return;
    }
    if (typeof target === "number") window.scrollTo({ top: target });
    else document.querySelector(target)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }, [reduce]);

  const go = useCallback(
    (href: string, lbl = "") => {
      // Opened straight from disk (file://): there are no sibling pages, so case studies open as highlights.
      if (window.location.protocol === "file:") {
        const m = /^\/work\/([^/#]+)/.exec(href);
        if (m) window.dispatchEvent(new CustomEvent("jer-open-project", { detail: { slug: m[1] } }));
        else scrollTo(href.includes("#") ? "#" + href.split("#")[1] : 0);
        return;
      }
      if (href.startsWith("#")) {
        scrollTo(href);
        history.replaceState(null, "", href);
        return;
      }
      if (href.includes("#") && href.split("#")[0].replace(/\/$/, "") === pathname.replace(/\/$/, "")) {
        scrollTo("#" + href.split("#")[1]);
        return;
      }
      pendingHref.current = href;
      setLabel(lbl);
      if (reduce) {
        router.push(href);
        return;
      }
      setCurtain("in");
      window.setTimeout(() => {
        if (pendingHref.current) router.push(pendingHref.current);
      }, 620);
    },
    [pathname, reduce, router, scrollTo],
  );

  // Reveal after route change
  useEffect(() => {
    if (pendingHref.current === null) return;
    pendingHref.current = null;
    scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    const hash = window.location.hash;
    if (hash) window.setTimeout(() => scrollTo(hash, { immediate: true }), 80);
    setCurtain("out");
    const t = window.setTimeout(() => setCurtain("hidden"), 900);
    return () => window.clearTimeout(t);
  }, [pathname, scrollTo]);

  // Scroll to hash on first load
  useEffect(() => {
    if (!introDone || !window.location.hash) return;
    const t = window.setTimeout(() => scrollTo(window.location.hash, { immediate: true }), 50);
    return () => window.clearTimeout(t);
  }, [introDone, scrollTo]);

  const ctx = useMemo(() => ({ introDone, go, scrollTo, lock }), [introDone, go, scrollTo, lock]);

  return (
    <ShellContext.Provider value={ctx}>
      <Preloader onStart={() => lock(true)} onRelease={() => lock(false)} onDone={() => setIntroDone(true)} />
      <Header />
      <motion.div aria-hidden className="fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-coral-500" style={{ scaleX: bar }} />
      <div id="app-root" className="relative z-[1]">{children}</div>
      <Cursor />
      <div className="grain" aria-hidden />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-coral-500"
        style={{ borderRadius: curtain === "in" ? "0 0 0 0" : "0 0 50% 50% / 0 0 14vh 14vh" }}
        initial={{ y: "100%" }}
        animate={{ y: curtain === "in" ? "0%" : curtain === "out" ? "-110%" : "100%" }}
        transition={curtain === "hidden" ? { duration: 0 } : { duration: curtain === "in" ? 0.6 : 0.85, ease: [0.76, 0, 0.24, 1] }}
      >
        <span className="display text-center text-[clamp(1.6rem,5vw,4rem)] text-white">{label}</span>
      </motion.div>
    </ShellContext.Provider>
  );
}
