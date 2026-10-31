"use client";

import { useEffect, useState } from "react";
import { useMedia } from "@/lib/useMedia";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

/** Desktop-only cursor follower. Grows and shows a label over [data-cursor] elements. */
export default function Cursor() {
  const reduce = useReducedMotion();
  const fine = useMedia("(hover: hover) and (pointer: fine)");
  const enabled = fine && !reduce;
  const [label, setLabel] = useState("");
  const [down, setDown] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 380, damping: 32, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 380, damping: 32, mass: 0.4 });

  useEffect(() => {
    if (!enabled) return;
    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cursor]");
      setLabel(el?.dataset.cursor ?? "");
    };
    const dn = () => setDown(true);
    const up = () => setDown(false);
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseover", over, { passive: true });
    window.addEventListener("mousedown", dn);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      window.removeEventListener("mousedown", dn);
      window.removeEventListener("mouseup", up);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;
  const big = label !== "";
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[80] flex items-center justify-center rounded-full bg-coral-500 text-white mix-blend-normal"
        style={{ x: sx, y: sy, translateX: "-50%", translateY: "-50%" }}
        animate={{ width: big ? 96 : down ? 10 : 14, height: big ? 96 : down ? 10 : 14, opacity: big ? 1 : 0.9 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="mono text-[0.68rem] tracking-widest" style={{ opacity: big ? 1 : 0, transition: "opacity .2s" }}>{label}</span>
      </motion.div>
    </>
  );
}
