'use client';

import { useEffect, useRef, useState } from 'react';

const NAME = ['Fellicia', 'Angelica', 'Kholim'];

/**
 * "The Legal Seal Reveal": a burgundy rule draws across the screen, an arch frame draws
 * around the FAK monogram, the name rises line by line. ~2.4 s, skippable, played once per
 * session and never under reduced-motion (decided before paint by the boot script).
 */
export default function Intro() {
  const [phase, setPhase] = useState<'idle' | 'play' | 'exit' | 'gone'>('idle');
  const skip = useRef<HTMLButtonElement>(null);

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
    const timers: number[] = [];
    const finish = () => {
      if (done) return;
      done = true;
      setPhase('exit');
      timers.push(
        window.setTimeout(() => {
          root.dataset.intro = 'seen';
          window.dispatchEvent(new Event('intro:done'));
        }, 260),
        window.setTimeout(() => {
          setPhase('gone');
          (document.activeElement as HTMLElement | null)?.blur?.();
        }, 1000),
      );
    };
    timers.push(window.setTimeout(finish, 2500));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (phase === 'gone') return null;

  const finishNow = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  };

  return (
    <div className="intro" data-phase={phase} onClick={finishNow}>
      <div className="intro-stage" aria-hidden="true">
        <div className="intro-art">
          <svg viewBox="0 0 360 420" className="intro-arch" fill="none">
            <path d="M24 408V176a156 156 0 0 1 312 0v232" pathLength="1" />
            <path d="M44 408V178a136 136 0 0 1 272 0v230" pathLength="1" className="inner" />
          </svg>
          <span className="intro-mono">FAK</span>
          <i className="intro-rule" />
        </div>
        <p className="intro-name">
          {NAME.map((w, i) => (
            <span key={w} className="intro-word">
              <span style={{ animationDelay: `${1.05 + i * 0.12}s` }}>{w}</span>
            </span>
          ))}
        </p>
        <p className="intro-desig">S.H. | Certified Legal Auditor</p>
      </div>
      <button ref={skip} type="button" className="intro-skip" onClick={(e) => { e.stopPropagation(); finishNow(); }}>
        Skip intro
      </button>
    </div>
  );
}
