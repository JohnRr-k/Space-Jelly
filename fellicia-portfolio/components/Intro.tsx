'use client';

import { useEffect, useRef, useState } from 'react';

const NAME = ['Fellicia', 'Angelica', 'Kholim'];
const WORDS = ['Precision', 'Credibility', 'Intellectual Depth', 'Professional Authority'];
const DURATION = 4700; // ms of build-up before the curtain opens

/**
 * Cinematic opening (~5.5 s, skippable, once per session, never under reduced motion):
 * a counter climbs 000 → 100 while a burgundy rule and an arch draw themselves around the FAK monogram,
 * the name rises line by line, four values cycle underneath, then the screen parts like a curtain.
 */
export default function Intro() {
  const [phase, setPhase] = useState<'idle' | 'play' | 'exit' | 'gone'>('idle');
  const count = useRef<HTMLSpanElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLElement>(null);
  const arch = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== 'play') {
      setPhase('gone');
      return;
    }
    setPhase('play');
    try {
      sessionStorage.setItem('fak-intro', '1');
    } catch {}

    let done = false;
    let raf = 0;
    const timers: number[] = [];
    const t0 = performance.now();
    const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    const frame = (t: number) => {
      const p = Math.min(1, (t - t0) / DURATION);
      const v = Math.round(ease(p) * 100);
      if (count.current) count.current.textContent = String(v).padStart(3, '0');
      if (line.current) line.current.style.transform = `scaleX(${ease(p)})`;
      if (p < 1 && !done) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    /* The arch becomes a window: the ink layer gets an arch-shaped hole that swells until it swallows the screen. */
    const portal = () => {
      const el = bg.current;
      const svg = arch.current;
      if (!el || !svg) return;
      const r = svg.getBoundingClientRect();
      const W = window.innerWidth,
        H = window.innerHeight;
      const cx = r.left + r.width / 2;
      const hw0 = (r.width * 156) / 360;
      const cy = r.top + (r.height * (20 + 388 / 2)) / 420;
      const hh0 = (r.height * 194) / 420;
      const hwEnd = Math.max(W, H) * 1.5;
      const t1 = performance.now();
      const dur = 1900;
      const out = (p: number) => 1 - Math.pow(1 - p, 3);
      const step = (t: number) => {
        const p = Math.min(1, (t - t1 - 250) / dur);
        const e = p <= 0 ? 0 : out(p);
        const k = hw0 + (hwEnd - hw0) * e * e;
        const hh = hh0 * (k / hw0);
        const top = cy - hh,
          bottom = cy + hh;
        el.style.clipPath = `path(evenodd, "M0 0H${W}V${H}H0Z M${cx - k} ${bottom}V${top + k}A${k} ${k} 0 0 1 ${cx + k} ${top + k}V${bottom}Z")`;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      if (count.current) count.current.textContent = '100';
      setPhase('exit');
      portal();
      timers.push(
        window.setTimeout(() => {
          root.dataset.intro = 'seen';
          window.dispatchEvent(new Event('intro:done'));
        }, 800),
        window.setTimeout(() => setPhase('gone'), 2500),
      );
    };
    timers.push(window.setTimeout(finish, DURATION + 450));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') finish();
    };
    window.addEventListener('keydown', onKey);
    (window as unknown as { __introSkip: () => void }).__introSkip = finish;
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (phase === 'gone') return null;
  const skip = () => (window as unknown as { __introSkip?: () => void }).__introSkip?.();

  return (
    <div className="intro" data-phase={phase} onClick={skip}>
      <i className="intro-bg" ref={bg} />
      <div className="intro-content">
        <div className="intro-stage" aria-hidden="true">
          <span className="intro-orbit o1" />
          <span className="intro-orbit o2" />
          <div className="intro-art">
            <svg viewBox="0 0 360 420" className="intro-arch" fill="none" ref={arch}>
              <path d="M24 408V176a156 156 0 0 1 312 0v232" pathLength="1" />
              <path d="M44 408V178a136 136 0 0 1 272 0v230" pathLength="1" className="inner" />
              <path d="M64 408V180a116 116 0 0 1 232 0v228" pathLength="1" className="inner2" />
            </svg>
            <span className="intro-mono">FAK</span>
            <i className="intro-rule" />
          </div>
          <p className="intro-name">
            {NAME.map((w, i) => (
              <span key={w} className="intro-word">
                <span style={{ animationDelay: `${1.9 + i * 0.16}s` }}>{w}</span>
              </span>
            ))}
          </p>
          <p className="intro-desig">S.H. | Certified Legal Auditor</p>
          <ul className="intro-words">
            {WORDS.map((w, i) => (
              <li key={w} style={{ animationDelay: `${2.4 + i * 0.55}s` }}>
                {w}
              </li>
            ))}
          </ul>
        </div>
        <div className="intro-meter" aria-hidden="true">
          <span className="intro-count" ref={count}>
            000
          </span>
          <div className="intro-track">
            <div ref={line} />
          </div>
        </div>
        <button type="button" className="intro-skip" onClick={(e) => { e.stopPropagation(); skip(); }}>
          Skip intro
        </button>
      </div>
    </div>
  );
}
