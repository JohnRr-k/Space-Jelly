"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

/** Fixed, slowly drifting backdrop built from the gradient blobs in the original portfolio. */
export default function Aurora() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const a = useTransform(scrollYProgress, [0, 1], ["8vh", "-70vh"]);
  const b = useTransform(scrollYProgress, [0, 1], ["-10vh", "60vh"]);
  const rot = useTransform(scrollYProgress, [0, 1], [0, 140]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ink-950">
      <div className="absolute -left-[20vw] -top-[25vh] h-[90vh] w-[80vw] rounded-full bg-[radial-gradient(closest-side,rgba(15,106,127,0.75),transparent)] [animation:drift-a_26s_ease-in-out_infinite]" />
      <div className="absolute -bottom-[30vh] -right-[15vw] h-[90vh] w-[75vw] rounded-full bg-[radial-gradient(closest-side,rgba(212,84,47,0.55),transparent)] [animation:drift-b_30s_ease-in-out_infinite]" />
      <motion.img
        src="/img/deco/blob-a.webp"
        alt=""
        className="absolute -right-[8vw] top-[8vh] w-[min(46vw,560px)] opacity-[0.55]"
        style={reduce ? undefined : { y: a, rotate: rot }}
      />
      <motion.img
        src="/img/deco/blob-d.webp"
        alt=""
        className="absolute -left-[10vw] bottom-[0vh] w-[min(40vw,480px)] opacity-[0.4]"
        style={reduce ? undefined : { y: b, rotate: rot }}
      />
    </div>
  );
}
