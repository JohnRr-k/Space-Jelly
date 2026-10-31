import { useEffect, useRef, useState } from 'react';
import { OceanCanvas, type OceanHandle } from './OceanCanvas';
import { useMotion, useSettings } from '../app/settings';

type Mode = 'full' | 'short' | 'none';

/** Decide which opening to play:
 *  • very first visit → the full (≈5s) arrival, unless turned off
 *  • a new browser session later → a brief (≈1.6s) surfacing
 *  • navigating around inside a session → nothing */
export function pickIntro(intro: 'full' | 'short' | 'off', reduced: boolean): Mode {
  if (reduced || intro === 'off') return 'none';
  let seen = false, session = false;
  try { seen = localStorage.getItem('blueroom.introSeen') === '1'; session = sessionStorage.getItem('blueroom.session') === '1'; } catch { /* ignore */ }
  if (session) return 'none';
  if (!seen && intro === 'full') return 'full';
  return 'short';
}

export function Intro({ name, line, onDone }: { name: string; line: string; onDone: () => void }) {
  const { settings } = useSettings();
  const { reduced } = useMotion();
  const [mode] = useState<Mode>(() => pickIntro(settings.intro, reduced));
  const [phase, setPhase] = useState<'in' | 'text' | 'sub' | 'out'>('in');
  const ocean = useRef<OceanHandle>(null);
  const done = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);
  const [depth, setDepth] = useState(30);
  const [prog, setProg] = useState(0);

  const finish = () => {
    if (done.current) return; done.current = true;
    try { localStorage.setItem('blueroom.introSeen', '1'); sessionStorage.setItem('blueroom.session', '1'); } catch { /* ignore */ }
    onDone();
  };

  useEffect(() => { if (mode === 'none') finish(); /* eslint-disable-next-line */ }, [mode]);

  useEffect(() => {
    if (mode === 'none') return;
    const full = mode === 'full';
    const T = full ? { text: 5200, sub: 6600, out: 8800, end: 9900, light: 5600 } : { text: 350, sub: 750, out: 1500, end: 2200, light: 900 };
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => { const p = Math.min(1, (now - start) / T.light); ocean.current?.setLight(full ? p : 0.35 + 0.65 * p); setDepth(Math.round((1 - p) * 30)); setProg(Math.min(1, (now - start) / T.out)); if (p < 1 || now - start < T.out) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const ts = [setTimeout(() => setPhase('text'), T.text), setTimeout(() => setPhase('sub'), T.sub), setTimeout(() => setPhase('out'), T.out), setTimeout(finish, T.end)];
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } };
    document.addEventListener('keydown', key);
    skipRef.current?.focus();
    return () => { cancelAnimationFrame(raf); ts.forEach(clearTimeout); document.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (mode === 'none') return null;
  return (
    <div className={`intro ${phase}`} role="dialog" aria-modal="true" aria-label="Welcome" onClick={finish}>
      <OceanCanvas ref={ocean} variant="intro" className="intro-canvas" initialLight={mode === 'full' ? 0 : 0.35} sharkEvery={0} />
      {mode === 'full' && (
        <div className={`intro-depth ${phase === 'in' ? '' : 'gone'}`} aria-hidden="true">
          <span className="intro-depth-label">{prog < 0.35 ? 'Taking a breath…' : prog < 0.6 ? 'Rising toward the light…' : 'Almost home…'}</span>
          <span className="intro-depth-num">{depth}<small> m</small></span>
          <span className="intro-bar"><i style={{ transform: `scaleX(${prog})` }} /></span>
        </div>
      )}
      <div className="intro-text" aria-live="polite">
        <h1 className="serif">Welcome back, {name || 'friend'}.</h1>
        {line && <p>{line}</p>}
      </div>
      <button ref={skipRef} type="button" className="intro-skip" onClick={(e) => { e.stopPropagation(); finish(); }}>Skip</button>
    </div>
  );
}
