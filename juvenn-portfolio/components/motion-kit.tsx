"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import {
  animate,
  motion,
  useAnimationFrame,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";

export const EASE = [0.16, 1, 0.3, 1] as const;

/* ── Fade + rise on enter ── */
export function Reveal({
  children,
  delay = 0,
  y = 36,
  className = "",
  as = "div",
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "p" | "span" | "section" | "figure";
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as] as ElementType;
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

/* ── Masked line rise. `trigger` lets the hero wait for the intro. ── */
export function Rise({
  children,
  delay = 0,
  className = "",
  trigger,
  inline = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  trigger?: boolean;
  inline?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  const on = trigger === undefined ? seen : trigger && seen;
  return (
    <span ref={ref} className={`${inline ? "inline-block" : "block"} overflow-hidden pb-[0.12em] -mb-[0.12em] ${className}`}>
      <motion.span
        className="block will-change-transform"
        initial={reduce ? false : { y: "112%", rotate: 2 }}
        animate={on ? { y: "0%", rotate: 0 } : undefined}
        transition={{ duration: 1.05, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/* ── Words that light up as you scroll through them ── */
export function ScrubText({ text, className = "", emphasis = [] as string[] }: { text: string; className?: string; emphasis?: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const words = text.split(" ");
  return (
    <p ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => {
        const start = i / words.length;
        const end = start + 1.6 / words.length;
        const clean = w.replace(/[.,;:]/g, "");
        return (
          <Word key={i} p={scrollYProgress} range={[start, Math.min(1, end)]} reduce={!!reduce} em={emphasis.includes(clean)}>
            {w}
          </Word>
        );
      })}
    </p>
  );
}
function Word({ children, p, range, reduce, em }: { children: ReactNode; p: MotionValue<number>; range: [number, number]; reduce: boolean; em: boolean }) {
  const o = useTransform(p, range, [0.18, 1]);
  return (
    <span aria-hidden className="mr-[0.26em] inline-block">
      <motion.span style={{ opacity: reduce ? 1 : o }} className={em ? "text-coral-600" : ""}>{children}</motion.span>
    </span>
  );
}

/* ── Count up that lands on the true value. The final number is always in the HTML;
      the animation only rewrites the text node's content in the browser. ── */
export function CountUp({ to, className = "", duration = 1.8 }: { to: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce || !ref.current) return;
    if (!seen) {
      ref.current.textContent = "0";
      return;
    }
    const el = ref.current;
    const c = animate(0, to, { duration, ease: EASE, onUpdate: (n) => { el.textContent = String(Math.round(n)); }, onComplete: () => { el.textContent = String(to); } });
    return () => { c.stop(); el.textContent = String(to); };
  }, [seen, to, duration, reduce]);
  return <span ref={ref} suppressHydrationWarning className={`tabular-nums ${className}`}>{to}</span>;
}

/* ── Marquee: drifts constantly, speeds up and reverses with scroll velocity ── */
export function Marquee({
  children,
  speed = 60,
  reverse = false,
  className = "",
}: {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const v = useSpring(useVelocity(scrollY), { damping: 60, stiffness: 400 });
  const boost = useTransform(v, [-2500, 0, 2500], [-3.2, 0, 3.2], { clamp: false });
  const inView = useInView(wrap, { margin: "200px" });

  useAnimationFrame((_, delta) => {
    if (reduce || !inView || !first.current) return;
    const w = first.current.offsetWidth;
    if (!w) return;
    const b = boost.get();
    const base = (speed * delta) / 1000;
    let next = x.get() + (reverse ? 1 : -1) * base * (1 + Math.abs(b) * 4) * (b < 0 ? -1 : 1);
    if (next <= -w) next += w;
    if (next > 0) next -= w;
    x.set(next);
  });

  return (
    <div ref={wrap} className={`flex overflow-hidden whitespace-nowrap ${className}`} aria-hidden>
      <motion.div className="flex shrink-0" style={{ x }}>
        <div ref={first} className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center">{children}</div>
      </motion.div>
    </div>
  );
}

/* ── Section panel: a sheet that grows in from the sides and rounds its shoulders ── */
export function Panel({
  id,
  tone,
  children,
  className = "",
  overlap = true,
  label,
}: {
  id?: string;
  tone: "ink" | "teal" | "cream" | "coral" | "cover" | "ink-clear";
  children: ReactNode;
  className?: string;
  overlap?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 30%"] });
  const inset = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 7, 0]);
  const clip = useMotionTemplate`inset(0px ${inset}vw 0px ${inset}vw round var(--radius-panel) var(--radius-panel) 0px 0px)`;
  return (
    <motion.section
      ref={ref}
      id={id}
      aria-label={label}
      style={{ clipPath: clip }}
      className={`tone-${tone} relative overflow-x-clip ${overlap ? "mt-[calc(var(--radius-panel)*-1)] pt-[var(--radius-panel)]" : ""} pb-[var(--radius-panel)] ${className}`}
    >
      {children}
    </motion.section>
  );
}

/* ── Tiny magnetic pull for key buttons ── */
export function Magnetic({ children, strength = 0.28, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className}`}
      style={{ x, y }}
      onMouseMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

export function SectionLabel({ n, children, className = "" }: { n: string; children: ReactNode; className?: string }) {
  return (
    <p className={`mono flex items-center gap-3 ${className}`}>
      <span className="rounded-full border border-current px-2.5 py-1">{n}</span>
      <span className="h-px w-8 bg-current opacity-50" />
      {children}
    </p>
  );
}

export { useMotionValueEvent };

/* ── Scroll-linked vertical drift ── */
export function Parallax({ children, amount = 60, className = "" }: { children: ReactNode; amount?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  return (
    <motion.div ref={ref} style={reduce ? undefined : { y }} className={className}>
      {children}
    </motion.div>
  );
}

/* ── Tilted ribbon that bridges two sections ── */
export function Ribbon({
  items,
  tone = "ink",
  rotate = -2,
  reverse = false,
  className = "",
}: {
  items: string[];
  tone?: "ink" | "coral" | "cream" | "peach";
  rotate?: number;
  reverse?: boolean;
  className?: string;
}) {
  const tones = {
    ink: "bg-ink-900 text-white",
    coral: "bg-coral-500 text-white",
    cream: "bg-cream-50 text-ink-900",
    peach: "bg-peach-300 text-ink-900",
  } as const;
  return (
    <div className={`relative z-20 -my-5 py-4 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.6)] ${tones[tone]} ${className}`} style={{ transform: `rotate(${rotate}deg) scale(1.04)` }} aria-hidden>
      <Marquee speed={48} reverse={reverse}>
        {items.map((t, i) => (
          <span key={i} className="display flex items-center gap-8 pr-8 text-[clamp(1.4rem,3.4vw,2.8rem)]">
            {t}
            <span className={tone === "coral" ? "text-ink-900" : "text-coral-500"}>✺</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}
