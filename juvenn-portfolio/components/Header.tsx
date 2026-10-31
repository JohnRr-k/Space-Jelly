"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { nav, mailto } from "@/lib/site";
import { useShell } from "./shell-context";

export default function Header() {
  const { go, introDone, lock } = useShell();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setSolid(y > 40);
    setHidden(y > 240 && y > prev && !open);
  });

  useEffect(() => {
    const ids = nav.map((n) => n.href.slice(1));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    lock(open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, lock]);

  const onNav = (href: string) => {
    setOpen(false);
    window.setTimeout(() => go(href.startsWith("#") ? `/${href}` : href), open ? 350 : 0);
  };

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: introDone && !hidden ? 0 : -90, opacity: introDone ? 1 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto flex max-w-[1560px] items-center justify-between px-[var(--gutter)] pt-4">
          <Link
            href="/"
            onClick={(e) => { e.preventDefault(); go("/#top"); }}
            aria-label="Juvenn Elkins Ravelliyo — back to top"
            className="display-lc grid h-11 w-11 place-items-center rounded-full bg-white text-sm text-ink-900 transition-transform hover:rotate-[-8deg] hover:scale-105"
          >
            JER
          </Link>

          <nav aria-label="Primary" className={`hidden items-center gap-1 rounded-full border border-white/15 p-1.5 backdrop-blur-xl transition-colors md:flex ${solid ? "bg-ink-900/70" : "bg-white/5"}`}>
            {nav.map((n) => {
              const on = active === n.href.slice(1);
              return (
                <a
                  key={n.href}
                  href={`/${n.href}`}
                  aria-current={on ? "true" : undefined}
                  onClick={(e) => { e.preventDefault(); go(`/${n.href}`); }}
                  className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${on ? "text-ink-900" : "text-white/80 hover:text-white"}`}
                >
                  {on && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative">{n.label}</span>
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <a href={mailto("Let's talk — opportunity for Juvenn")} className="btn hidden !py-3 text-sm md:inline-flex">
              Let&apos;s connect <span className="arrow" aria-hidden>↗</span>
            </a>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
              className="relative grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-ink-900/60 backdrop-blur md:hidden"
            >
              <span className={`absolute h-[2px] w-5 bg-white transition-transform duration-300 ${open ? "rotate-45" : "-translate-y-[4px]"}`} />
              <span className={`absolute h-[2px] w-5 bg-white transition-transform duration-300 ${open ? "-rotate-45" : "translate-y-[4px]"}`} />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="tone-cover fixed inset-0 z-[55] flex flex-col justify-between px-[var(--gutter)] pb-8 pt-28 md:hidden"
            initial={{ clipPath: "circle(0% at calc(100% - 44px) 44px)" }}
            animate={{ clipPath: "circle(150% at calc(100% - 44px) 44px)" }}
            exit={{ clipPath: "circle(0% at calc(100% - 44px) 44px)" }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          >
            <ul className="flex flex-col gap-1">
              {nav.map((n, i) => (
                <li key={n.href} className="overflow-hidden">
                  <motion.a
                    href={`/${n.href}`}
                    onClick={(e) => { e.preventDefault(); onNav(n.href); }}
                    className="display flex items-baseline gap-3 py-1 text-[clamp(2.4rem,12vw,4.4rem)]"
                    initial={{ y: "110%" }}
                    animate={{ y: 0, transition: { delay: 0.25 + i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] } }}
                    exit={{ y: "110%", transition: { duration: 0.25 } }}
                  >
                    <span className="mono text-peach-300">0{i + 1}</span>
                    {n.label}
                  </motion.a>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3">
              <a href={mailto("Let's talk — opportunity for Juvenn")} className="btn justify-center">Let&apos;s connect <span className="arrow" aria-hidden>↗</span></a>
              <p className="mono text-center text-white/60">Open to brand strategy &amp; consulting roles</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
