'use client';

import { useRef, type ReactNode } from 'react';
import { Arrow } from './ui';

/** Horizontal scroll-snap rail with explicit previous/next controls (also swipeable and keyboard-scrollable). */
export default function HScroll({ label, children }: { label: string; children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  const go = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.7), behavior: reduce ? 'auto' : 'smooth' });
  };
  return (
    <div className="hs-wrap">
      <div className="hs-ctrl">
        <button type="button" onClick={() => go(-1)} aria-label="Scroll left">
          <Arrow className="flip" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Scroll right">
          <Arrow />
        </button>
      </div>
      <div className="hs" ref={rail} role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
    </div>
  );
}
