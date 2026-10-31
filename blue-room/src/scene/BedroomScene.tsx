import { useMemo, useRef, useState, type ReactNode } from 'react';
import { OceanCanvas } from './OceanCanvas';
import { monthName, parseDate, weekday, daysInMonth } from '../lib/dates';

/** The signature room, drawn entirely as original SVG (no stock imagery) on a 1600×900 canvas.
 *  Layers: wall → [live ocean canvas shows through the window] → frame, sheer curtains → furniture & objects →
 *  window light. Eight objects are real navigation points (keyboard accessible), each with a visible label on hover/focus. */

const W = 1600, H = 900;
const GLASS = { x: 396, y: 116, w: 488, h: 420 };

export interface SceneProps {
  today: string;
  photos: string[];
  onGo: (path: string) => void;
  onDive: () => void;
  animate: boolean;
}

interface HsDef { id: string; label: string; hint: string; path: string; x: number; y: number; w: number; h: number; rx?: number; labelAt?: 'top' | 'bottom' }

const HS: Record<string, HsDef> = {
  window: { id: 'window', label: 'Odyssey', hint: 'experiences, dreamed and lived', path: '/legacy/odyssey', x: GLASS.x, y: GLASS.y, w: GLASS.w, h: GLASS.h, rx: 6, labelAt: 'top' },
  shelf: { id: 'shelf', label: 'Legacy', hint: 'the archive of your story', path: '/legacy', x: 30, y: 122, w: 276, h: 684, rx: 10 },
  calendar: { id: 'calendar', label: 'Calendar', hint: 'events and schedules', path: '/calendar', x: 996, y: 114, w: 160, h: 224, rx: 10 },
  photos: { id: 'photos', label: 'Memories', hint: 'moments worth keeping', path: '/legacy/memories', x: 1176, y: 114, w: 254, h: 232, rx: 12 },
  goals: { id: 'goals', label: 'My Future', hint: 'goals and milestones', path: '/future', x: 1446, y: 124, w: 140, h: 214, rx: 12 },
  notes: { id: 'notes', label: 'Notes', hint: 'quick thoughts', path: '/notes', x: 362, y: 500, w: 120, h: 98, rx: 10 },
  oracle: { id: 'oracle', label: 'Oracle', hint: 'decisions and reasoning', path: '/oracle', x: 676, y: 470, w: 150, h: 128, rx: 12 },
  journal: { id: 'journal', label: 'Journal', hint: 'write today’s entry', path: '/journal', x: 920, y: 566, w: 104, h: 70, rx: 10 },
};

export function BedroomScene({ today, photos, onGo, onDive, animate }: SceneProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [bubbles, setBubbles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const bid = useRef(0);

  const hover = (d: HsDef) => {
    setActive(d.id);
    if (!animate) return;
    const id = ++bid.current;
    setBubbles((b) => [...b.slice(-2), { id, x: ((d.x + d.w / 2) / W) * 100, y: ((d.y + d.h * 0.3) / H) * 100 }]);
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 2600);
  };

  const hs = (d: HsDef, children: ReactNode) => <Hotspot key={d.id} d={d} onGo={onGo} onHover={hover} onLeave={() => setActive((a) => (a === d.id ? null : a))}>{children}</Hotspot>;
  const pct = (n: number, t: number) => `${(n / t) * 100}%`;

  return (
    <div ref={wrap} className={`scene ${animate ? '' : 'still'}`}>
      {/* the ocean, seen through the glass: sits behind the SVG, which has a transparent “hole” for the window */}
      <OceanCanvas variant="window" className="scene-ocean" pointerTarget={wrap}
        style={{ left: pct(GLASS.x, W), top: pct(GLASS.y, H), width: pct(GLASS.w, W), height: pct(GLASS.h, H) }} />

      <svg className="scene-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="group" aria-label="Your bedroom. Choose an object to open that part of The Blue Room.">
        <Defs />

        {/* ---------- room shell (wall has an even-odd hole where the glass is) ---------- */}
        <path fillRule="evenodd" fill="url(#wall)" d={`M0 0H${W}V730H0Z M${GLASS.x} ${GLASS.y}H${GLASS.x + GLASS.w}V${GLASS.y + GLASS.h}H${GLASS.x}Z`} />
        <rect x="980" y="0" width="620" height="730" fill="url(#wallRight)" />
        <rect x="976" y="0" width="10" height="730" fill="url(#corner)" />
        <rect x="0" y="708" width={W} height="26" fill="#f1f7fa" />
        <rect x="0" y="732" width={W} height="3" fill="#b7cfdb" opacity=".7" />
        <rect x="0" y="735" width={W} height={H - 735} fill="url(#floor)" />
        <g stroke="#c2d6e0" strokeWidth="1.2" opacity=".55">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1="0" x2={W} y1={760 + i * 24} y2={760 + i * 24} />)}</g>
        <path d={`M0 90H${W}`} stroke="#fff" strokeOpacity=".5" strokeWidth="2" />

        {/* wall mural: a single quiet wave line */}
        <path d="M1000 392c40-18 80-18 120 0s80 18 120 0 80-18 120 0 80 18 120 0" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />

        {/* ---------- window ---------- */}
        <WindowFrame />
        {hs(HS.window, <rect x={GLASS.x} y={GLASS.y} width={GLASS.w} height={GLASS.h} fill="transparent" />)}
        <path d={`M${GLASS.x} ${GLASS.y}h${GLASS.w}v${GLASS.h}h-${GLASS.w}z`} fill="url(#sheen)" pointerEvents="none" />

        {/* ---------- back curtain layers + rod ---------- */}
        <g className="sway sway-slow" style={{ transformOrigin: '640px 96px' }} pointerEvents="none"><path d="M470 98C560 140 610 240 560 360C520 450 560 500 540 560L472 560Z" fill="url(#sheer)" opacity=".55" /></g>
        <Curtain side="left" />
        <Curtain side="right" />
        <Rod />

        {/* ---------- wall objects ---------- */}
        {hs(HS.shelf, <Bookshelf />)}
        {hs(HS.calendar, <WallCalendar today={today} />)}
        {hs(HS.photos, <PhotoBoard photos={photos} />)}
        {hs(HS.goals, <GoalBoard />)}

        {/* ---------- floor, rug, shadows ---------- */}
        <ellipse cx="770" cy="846" rx="470" ry="40" fill="url(#rug)" />
        <ellipse cx="770" cy="846" rx="430" ry="30" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
        <ellipse cx="170" cy="812" rx="170" ry="16" fill="#0a3a5c" opacity=".14" />
        <ellipse cx="620" cy="808" rx="300" ry="14" fill="#0a3a5c" opacity=".13" />
        <ellipse cx="1300" cy="842" rx="330" ry="22" fill="#0a3a5c" opacity=".16" />

        <Desk />
        {hs(HS.notes, <DeskNotes />)}
        <Fishbowl animate={animate} />
        {hs(HS.oracle, <OracleConsole animate={animate} />)}
        <BedsideTable />
        {hs(HS.journal, <Journal />)}
        <JellyLamp animate={animate} />
        <Bed />

        {/* ---------- window light falling into the room ---------- */}
        <g className="beam" pointerEvents="none" style={{ mixBlendMode: 'screen' }}>
          <path d={`M${GLASS.x + 10} ${GLASS.y + GLASS.h + 40}L${GLASS.x + GLASS.w - 10} ${GLASS.y + GLASS.h + 40}L1330 870L880 870Z`} fill="url(#beam)" />
        </g>
        <g className="motes" pointerEvents="none" fill="#fff">{[[610, 640, 2.4], [700, 700, 1.8], [820, 660, 2.2], [930, 770, 2.6], [1040, 700, 1.7], [760, 770, 2]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} opacity=".7" className={`mote m${i % 3}`} />)}</g>

        {/* “dive in”: opens the immersive ocean */}
        <g className="dive-btn" role="button" tabIndex={0} aria-label="Dive into the ocean (immersive view)" onClick={(e) => { e.stopPropagation(); onDive(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDive(); } }}>
          <rect x={GLASS.x + 14} y={GLASS.y + GLASS.h - 54} width="126" height="38" rx="19" />
          <text x={GLASS.x + 77} y={GLASS.y + GLASS.h - 29} textAnchor="middle">Dive in</text>
        </g>

        {/* labels live on top so they are never covered */}
        {Object.values(HS).map((d) => <HotspotLabel key={d.id} d={d} on={active === d.id} />)}
      </svg>

      <div className="scene-bubbles" aria-hidden="true">
        {bubbles.map((b) => (
          <span key={b.id} className="bubble-group" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
            {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ ['--dx' as any]: `${(i - 2) * 9}px`, animationDelay: `${i * 140}ms`, width: 6 + (i % 3) * 3, height: 6 + (i % 3) * 3 }} />)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ================================================================== hotspots

function Hotspot({ d, onGo, onHover, onLeave, children }: { d: HsDef; onGo: (p: string) => void; onHover: (d: HsDef) => void; onLeave: () => void; children: ReactNode }) {
  return (
    <g
      className={`hs hs-${d.id}`} role="link" tabIndex={0} aria-label={`${d.label} — ${d.hint}`}
      onClick={() => onGo(d.path)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGo(d.path); } }}
      onPointerEnter={() => onHover(d)} onFocus={() => onHover(d)} onPointerLeave={onLeave} onBlur={onLeave}
    >
      <rect className="hs-glow" x={d.x} y={d.y} width={d.w} height={d.h} rx={d.rx ?? 12} />
      <g className="hs-art">{children}</g>
      <rect className="hs-hit" x={d.x} y={d.y} width={d.w} height={d.h} rx={d.rx ?? 12} fill="transparent" />
    </g>
  );
}

function HotspotLabel({ d, on }: { d: HsDef; on: boolean }) {
  const w = d.label.length * 13 + 36;
  const cx = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, d.x + d.w / 2));
  const y = d.labelAt === 'bottom' ? d.y + d.h + 14 : Math.max(10, d.y - 44);
  return (
    <g className={`hs-label hs-label-${d.id} ${on ? 'on' : ''}`} transform={`translate(${cx} ${y})`} pointerEvents="none" aria-hidden="true">
      <rect x={-w / 2} y="0" width={w} height="34" rx="17" />
      <text x="0" y="23" textAnchor="middle">{d.label}</text>
    </g>
  );
}

// ================================================================== defs

function Defs() {
  return (
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6eaf2" /><stop offset="1" stopColor="#bcd9e6" /></linearGradient>
      <linearGradient id="wallRight" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8cfe0" /><stop offset="1" stopColor="#8fbdd3" /></linearGradient>
      <linearGradient id="corner" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6fa3bd" stopOpacity=".0" /><stop offset="1" stopColor="#4d86a3" stopOpacity=".35" /></linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9f2f6" /><stop offset="1" stopColor="#d3e3ea" /></linearGradient>
      <radialGradient id="rug" cx=".5" cy=".5" r=".6"><stop offset="0" stopColor="#dbe9f1" /><stop offset="1" stopColor="#b9d1de" /></radialGradient>
      <linearGradient id="sheer" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity=".65" /><stop offset=".5" stopColor="#f2f9fc" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity=".55" /></linearGradient>
      <linearGradient id="sheerFold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".8" /><stop offset="1" stopColor="#fff" stopOpacity=".1" /></linearGradient>
      <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".35" stopColor="#fff" stopOpacity=".05" /><stop offset=".36" stopColor="#fff" stopOpacity=".12" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dff4ff" stopOpacity=".26" /><stop offset="1" stopColor="#dff4ff" stopOpacity="0" /></linearGradient>
      <linearGradient id="duvet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dbe8ef" /></linearGradient>
      <linearGradient id="pillow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d3e2ea" /></linearGradient>
      <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7fbfd" /><stop offset="1" stopColor="#dde9ef" /></linearGradient>
      <linearGradient id="woodDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9dbe5" /><stop offset="1" stopColor="#aec6d3" /></linearGradient>
      <linearGradient id="notebook" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1d6a96" /><stop offset="1" stopColor="#0c3b5c" /></linearGradient>
      <linearGradient id="headboard" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b5d3e2" /><stop offset="1" stopColor="#97bcd0" /></linearGradient>
      <radialGradient id="pearl" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff" /><stop offset=".5" stopColor="#d7ecf7" /><stop offset="1" stopColor="#8cc3de" /></radialGradient>
      <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#bfe9ff" stopOpacity=".9" /><stop offset="1" stopColor="#bfe9ff" stopOpacity="0" /></radialGradient>
      <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe6f6" /><stop offset="1" stopColor="#6fb5d6" /></linearGradient>
      <linearGradient id="pic1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8cc9e6" /><stop offset="1" stopColor="#2a78ab" /></linearGradient>
      <linearGradient id="pic2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dcdff4" /><stop offset="1" stopColor="#8d9bd9" /></linearGradient>
      <linearGradient id="pic3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9f1ef" /><stop offset="1" stopColor="#5fb3be" /></linearGradient>
      <clipPath id="bowlClip"><circle cx="535" cy="548" r="38" /></clipPath>
    </defs>
  );
}

// ================================================================== window, curtains

function WindowFrame() {
  const { x, y, w, h } = GLASS;
  return (
    <g pointerEvents="none">
      <path fillRule="evenodd" fill="#f6fafc" d={`M${x - 24} ${y - 24}H${x + w + 24}V${y + h + 24}H${x - 24}Z M${x} ${y}H${x + w}V${y + h}H${x}Z`} />
      <path fill="none" stroke="#b7cfdb" strokeWidth="2" d={`M${x - 24} ${y - 24}H${x + w + 24}V${y + h + 24}H${x - 24}Z`} />
      <rect x={x + w / 2 - 8} y={y} width="16" height={h} fill="#f6fafc" />
      <rect x={x} y={y + 205} width={w} height="12" fill="#f6fafc" />
      <rect x={x + w / 2 - 8} y={y} width="3" height={h} fill="#fff" opacity=".9" />
      <rect x={x - 6} y={y + h + 24} width={w + 12} height="26" rx="3" fill="url(#wood)" stroke="#b7cfdb" strokeWidth="1.5" />
      <rect x={x - 6} y={y + h + 48} width={w + 12} height="6" fill="#0a3a5c" opacity=".12" />
      <circle cx={x + w / 2 - 28} cy={y + 262} r="4" fill="#c5d2db" /><circle cx={x + w / 2 + 28} cy={y + 262} r="4" fill="#c5d2db" />
    </g>
  );
}

function Rod() {
  return (
    <g pointerEvents="none">
      <rect x="300" y="88" width="680" height="7" rx="3.5" fill="#c5d2db" /><rect x="300" y="88" width="680" height="2.5" rx="1.2" fill="#fff" opacity=".8" />
      <circle cx="298" cy="91.500" r="9" fill="#dbe5ec" stroke="#aebfcb" /><circle cx="982" cy="91.500" r="9" fill="#dbe5ec" stroke="#aebfcb" />
    </g>
  );
}

function Curtain({ side }: { side: 'left' | 'right' }) {
  const mirror = side === 'right';
  return (
    <g transform={mirror ? 'translate(1280 0) scale(-1 1)' : undefined} pointerEvents="none">
      <g className={`sway ${mirror ? 'sway-b' : 'sway-a'}`} style={{ transformOrigin: '395px 96px' }}>
        <path d="M322 96H470C476 230 454 340 464 480C474 610 450 700 470 794H322C334 690 312 560 326 440C340 320 314 210 322 96Z" fill="url(#sheer)" />
        <path d="M352 96C358 220 340 330 352 450C364 580 342 700 356 794" fill="none" stroke="#fff" strokeWidth="9" strokeOpacity=".5" strokeLinecap="round" />
        <path d="M392 96C400 230 384 330 396 460C406 590 388 710 402 794" fill="none" stroke="#a9c9d9" strokeWidth="5" strokeOpacity=".28" strokeLinecap="round" />
        <path d="M432 96C440 230 424 340 438 470C448 600 430 710 444 794" fill="none" stroke="#fff" strokeWidth="7" strokeOpacity=".55" strokeLinecap="round" />
        <path d="M322 794H470" stroke="#fff" strokeOpacity=".7" strokeWidth="3" />
        <rect x="322" y="96" width="148" height="14" fill="#fff" opacity=".6" />
      </g>
      <g className={`sway ${mirror ? 'sway-a' : 'sway-b'}`} style={{ transformOrigin: '420px 96px' }} opacity=".7">
        <path d="M410 100C440 220 420 340 452 470C470 560 440 640 462 720L430 722C410 640 424 560 400 460C380 340 412 220 410 100Z" fill="url(#sheerFold)" opacity=".4" />
      </g>
    </g>
  );
}

// ================================================================== objects

function Bookshelf() {
  const colors = ['#14547b', '#76b7d1', '#f7fbfd', '#c5d2db', '#092b49', '#b8dce8', '#8496a5', '#dcdff4', '#3c86a8', '#e9eef2'];
  const rows = [
    { y: 290, books: [[22, 118, 0], [16, 104, 1], [26, 126, 2], [18, 98, 3], [24, 114, 4], [14, 92, 5], [22, 122, 6], [30, 108, 7], [16, 96, 8]] },
    { y: 450, books: [[28, 120, 4], [14, 100, 2], [22, 128, 0], [18, 90, 9], [24, 112, 3], [16, 124, 1], [26, 100, 5], [14, 116, 8]] },
    { y: 610, books: [[24, 114, 1], [18, 126, 2], [22, 98, 6], [30, 120, 0], [16, 106, 7], [22, 128, 4]] },
  ];
  return (
    <g>
      <rect x="36" y="130" width="264" height="672" rx="8" fill="url(#wood)" stroke="#b7cfdb" strokeWidth="2" />
      <rect x="50" y="144" width="236" height="620" fill="#c3dbe7" />
      <rect x="50" y="144" width="236" height="14" fill="#0a3a5c" opacity=".12" />
      {[290, 450, 610, 764].map((y) => <g key={y}><rect x="46" y={y} width="244" height="14" fill="url(#wood)" stroke="#b7cfdb" /><rect x="50" y={y + 14} width="236" height="8" fill="#0a3a5c" opacity=".1" /></g>)}
      <rect x="36" y="770" width="264" height="30" fill="url(#woodDark)" opacity=".5" />
      {rows.map((r, ri) => {
        let x = 58;
        return <g key={ri}>{r.books.map(([bw, bh, ci], i) => { const bx = x; x += bw + 2; const lean = ri === 1 && i === 6 ? -6 : 0; return <g key={i} transform={`rotate(${lean} ${bx + bw / 2} ${r.y})`}><rect x={bx} y={r.y - bh} width={bw} height={bh} rx="2" fill={colors[ci]} stroke="#092b49" strokeOpacity=".18" /><rect x={bx + 3} y={r.y - bh + 12} width={bw - 6} height="3" fill="#fff" opacity=".6" /><rect x={bx + 3} y={r.y - 16} width={bw - 6} height="2" fill="#fff" opacity=".45" /></g>; })}</g>;
      })}
      {/* top shelf: a pale lantern, a shell and a little plant */}
      <g transform="translate(70 290)"><rect x="0" y="-70" width="44" height="64" rx="4" fill="#f7fbfd" stroke="#aebfcb" /><path d="M6 -70L22 -88L38 -70" fill="#e1edf3" stroke="#aebfcb" /><rect x="10" y="-60" width="24" height="44" rx="2" fill="#d4ebf5" /><circle cx="22" cy="-38" r="9" fill="url(#glow)" /></g>
      <g transform="translate(150 290)"><path d="M0 0C-4-22 8-38 26-38S52-22 46 0Z" fill="#f4e9e1" stroke="#d1bfb2" /><path d="M10 0C8-18 16-30 26-34M26 0V-36M42 0C42-18 36-30 26-36" stroke="#d1bfb2" fill="none" /></g>
      <g transform="translate(222 290)"><path d="M8 0L12 -30H34L38 0Z" fill="#f7fbfd" stroke="#aebfcb" /><path d="M23 -30C17-50 6-56 0-52M23 -30C23-56 22-66 24-72M23 -30C29-50 40-54 48-48" stroke="#5fa39a" strokeWidth="3" strokeLinecap="round" fill="none" /></g>
      {/* third shelf: a starfish, a tiny frame */}
      <g transform="translate(170 610)"><path d="M20-34L25-18L42-16L29-5L33 12L20 3L7 12L11-5L-2-16L15-18Z" fill="#f3d9cf" stroke="#d1b3a6" /></g>
      <g transform="translate(236 610)"><rect x="-6" y="-46" width="36" height="46" rx="3" fill="#f7fbfd" stroke="#aebfcb" /><rect x="0" y="-40" width="24" height="34" fill="url(#pic1)" /></g>
      <rect x="54" y="772" width="228" height="20" rx="3" fill="#fff" opacity=".35" />
    </g>
  );
}

function WallCalendar({ today }: { today: string }) {
  const { y, m, d } = parseDate(today);
  const first = weekday(`${y}-${String(m).padStart(2, '0')}-01`);
  const days = daysInMonth(y, m);
  return (
    <g>
      <path d="M1076 108V122" stroke="#aebfcb" strokeWidth="3" /><circle cx="1076" cy="106" r="5" fill="#c5d2db" />
      <rect x="1004" y="122" width="144" height="208" rx="10" fill="#f9fcfd" stroke="#b7cfdb" strokeWidth="2" />
      <path d="M1004 132a10 10 0 0 1 10-10h124a10 10 0 0 1 10 10v54H1004Z" fill="#14547b" />
      <text x="1076" y="164" textAnchor="middle" className="cal-month">{monthName(m).toUpperCase()}</text>
      <text x="1076" y="180" textAnchor="middle" className="cal-year">{y}</text>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={1014 + i * 18.5} y="198" width="14" height="3" rx="1.500" fill="#b7cfdb" />)}
      {Array.from({ length: 42 }, (_, i) => {
        const dayN = i - first + 1;
        if (dayN < 1 || dayN > days) return null;
        const cx = 1021 + (i % 7) * 18.5, cy = 214 + Math.floor(i / 7) * 18;
        const isToday = dayN === d;
        return <g key={i}>{isToday && <circle cx={cx} cy={cy - 1} r="8.500" fill="#76b7d1" />}<text x={cx} y={cy + 2.500} textAnchor="middle" className={`cal-day ${isToday ? 'today' : ''}`}>{dayN}</text></g>;
      })}
      <g fill="#c5d2db"><circle cx="1030" cy="124" r="3" /><circle cx="1076" cy="124" r="3" /><circle cx="1122" cy="124" r="3" /></g>
    </g>
  );
}

function PhotoBoard({ photos }: { photos: string[] }) {
  const frames = [
    { x: 1198, y: 164, r: -5, pic: 'pic1' }, { x: 1262, y: 188, r: 3, pic: 'pic3' }, { x: 1330, y: 160, r: -2, pic: 'pic2' },
    { x: 1214, y: 252, r: 4, pic: 'pic2' }, { x: 1300, y: 262, r: -4, pic: 'pic1' },
  ];
  return (
    <g>
      <rect x="1182" y="122" width="242" height="220" rx="12" fill="#f4f9fb" stroke="#b7cfdb" strokeWidth="2" />
      <rect x="1194" y="134" width="218" height="196" rx="6" fill="#cfe4ee" />
      {/* string lights */}
      <path d="M1194 140C1230 168 1262 128 1300 152S1372 132 1412 150" fill="none" stroke="#8fa6b5" strokeWidth="1.500" />
      {[1212, 1243, 1275, 1306, 1338, 1372, 1400].map((x, i) => <circle key={x} cx={x} cy={[156, 154, 142, 152, 152, 142, 148][i]} r="4" fill="#fffbe9" className={`twinkle t${i % 3}`} />)}
      {frames.map((f, i) => (
        <g key={i} transform={`rotate(${f.r} ${f.x + 30} ${f.y + 36})`}>
          <rect x={f.x} y={f.y} width="62" height="74" rx="2" fill="#fff" stroke="#c5d2db" />
          {photos[i] ? <image href={photos[i]} x={f.x + 5} y={f.y + 5} width="52" height="52" preserveAspectRatio="xMidYMid slice" /> : <g><rect x={f.x + 5} y={f.y + 5} width="52" height="52" fill={`url(#${f.pic})`} /><path d={`M${f.x + 5} ${f.y + 42}q13-9 26 0t26 0V${f.y + 57}H${f.x + 5}Z`} fill="#fff" opacity=".35" /></g>}
          <circle cx={f.x + 31} cy={f.y - 2} r="3" fill="#14547b" />
        </g>
      ))}
      <g transform="translate(1366 258)"><path d="M0 40C0 14 20 0 40 0S76 14 76 40Z" fill="#fff" stroke="#c5d2db" /><text x="38" y="30" textAnchor="middle" className="board-note">keep</text></g>
    </g>
  );
}

function GoalBoard() {
  return (
    <g>
      <rect x="1452" y="132" width="128" height="198" rx="12" fill="#f9fcfd" stroke="#b7cfdb" strokeWidth="2" />
      <rect x="1464" y="144" width="104" height="174" rx="6" fill="#1b648f" />
      <g fill="#fff" opacity=".85">{[[1480, 170], [1550, 180], [1500, 214], [1536, 232], [1484, 262], [1556, 270], [1520, 160]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.600 : 1.100} />)}</g>
      <path d="M1482 296C1496 268 1524 276 1526 252S1530 224 1546 212" fill="none" stroke="#b8dce8" strokeWidth="2.400" strokeDasharray="2 7" strokeLinecap="round" />
      <path d="M1546 212V190" stroke="#fff" strokeWidth="2.600" strokeLinecap="round" /><path d="M1546 190l22 7-22 8Z" fill="#76b7d1" />
      <g transform="translate(1516 232)" className="north-star"><path d="M0 -20L5 -5L20 0L5 5L0 20L-5 5L-20 0L-5 -5Z" fill="#f7fbfd" opacity=".95" /></g>
    </g>
  );
}

function Desk() {
  return (
    <g pointerEvents="none">
      <rect x="352" y="640" width="26" height="162" rx="3" fill="url(#wood)" stroke="#b7cfdb" />
      <rect x="862" y="640" width="26" height="162" rx="3" fill="url(#wood)" stroke="#b7cfdb" />
      <rect x="392" y="614" width="456" height="54" rx="4" fill="url(#wood)" stroke="#b7cfdb" />
      <rect x="404" y="626" width="204" height="34" rx="4" fill="#e6f0f5" stroke="#b7cfdb" /><circle cx="506" cy="643" r="4" fill="#9bb4c3" />
      <rect x="622" y="626" width="204" height="34" rx="4" fill="#e6f0f5" stroke="#b7cfdb" /><circle cx="724" cy="643" r="4" fill="#9bb4c3" />
      <rect x="330" y="596" width="580" height="22" rx="5" fill="url(#wood)" stroke="#b7cfdb" strokeWidth="1.500" />
      <rect x="330" y="596" width="580" height="4" rx="2" fill="#fff" opacity=".9" />
    </g>
  );
}

function DeskNotes() {
  return (
    <g>
      <g transform="translate(374 566)"><rect x="0" y="0" width="52" height="30" rx="3" fill="#dcdff4" stroke="#aab6e8" /><rect x="2" y="-4" width="52" height="30" rx="3" fill="#fff7d9" stroke="#e7d9a0" transform="rotate(-4 28 12)" /><rect x="6" y="-12" width="48" height="30" rx="3" fill="#d9f1ef" stroke="#a2d3cf" transform="rotate(5 28 4)" /><path d="M14 -2h26M14 5h20" stroke="#6fa5a0" strokeWidth="1.600" strokeLinecap="round" transform="rotate(5 28 4)" /></g>
      <g transform="translate(436 548)"><rect x="0" y="0" width="26" height="48" rx="5" fill="#14547b" /><rect x="0" y="12" width="26" height="4" fill="#fff" opacity=".35" /><path d="M7 0L10-26M13 0L14-30M19 0L17-24" stroke="#c5d2db" strokeWidth="3" strokeLinecap="round" /><path d="M13 -30l1.500-6" stroke="#76b7d1" strokeWidth="3" strokeLinecap="round" /></g>
    </g>
  );
}

function Fishbowl({ animate }: { animate: boolean }) {
  return (
    <g pointerEvents="none">
      <ellipse cx="535" cy="596" rx="40" ry="5" fill="#0a3a5c" opacity=".14" />
      <circle cx="535" cy="552" r="40" fill="#e1f2fa" fillOpacity=".5" stroke="#9fc5d8" strokeWidth="2" />
      <g clipPath="url(#bowlClip)">
        <rect x="490" y="538" width="90" height="60" fill="url(#water)" opacity=".85" />
        <path d="M492 540q10-5 20 0t20 0t20 0t20 0t20 0" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2" />
        <path d="M512 590c-4-14 6-22 2-34M522 590c2-12-4-18 0-28" stroke="#4f9c8e" strokeWidth="3" fill="none" strokeLinecap="round" />
        <g className={animate ? 'bowl-fish' : ''}><path d="M520 566c6-8 16-8 22 0-6 8-16 8-22 0zM542 566l9-6v12z" fill="#f7fbfd" stroke="#8fb7cb" strokeWidth="1" /><circle cx="526" cy="565" r="1.300" fill="#092b49" /></g>
        <g className={animate ? 'bowl-fish b2' : ''}><path d="M548 580c4-5 10-5 14 0-4 5-10 5-14 0zM562 580l6-4v8z" fill="#76b7d1" /></g>
      </g>
      <path d="M512 530a30 30 0 0 1 20-14" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeOpacity=".8" />
      <g className={animate ? 'bowl-bubbles' : ''} fill="none" stroke="#fff" strokeOpacity=".8"><circle cx="548" cy="560" r="2.500" /><circle cx="552" cy="548" r="1.800" /></g>
    </g>
  );
}

function OracleConsole({ animate }: { animate: boolean }) {
  return (
    <g>
      <ellipse cx="750" cy="596" rx="66" ry="6" fill="#0a3a5c" opacity=".16" />
      <rect x="722" y="580" width="56" height="16" rx="6" fill="#c5d2db" stroke="#9db4c2" />
      <rect x="745" y="540" width="10" height="44" fill="#aebfcb" />
      <rect x="690" y="478" width="120" height="76" rx="12" fill="#092b49" stroke="#c5d2db" strokeWidth="3" />
      <rect x="699" y="487" width="102" height="58" rx="7" fill="#0f4466" />
      <circle cx="750" cy="516" r="30" fill="url(#glow)" className={animate ? 'pearl-glow' : ''} />
      <circle cx="750" cy="516" r="15" fill="url(#pearl)" stroke="#fff" strokeOpacity=".6" />
      <path d="M743 510a9 9 0 0 1 8-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".9" />
      <path d="M706 536h22M772 536h22" stroke="#76b7d1" strokeWidth="2" strokeLinecap="round" opacity=".6" />
    </g>
  );
}

function BedsideTable() {
  return (
    <g pointerEvents="none">
      <rect x="936" y="660" width="20" height="142" rx="3" fill="url(#wood)" stroke="#b7cfdb" /><rect x="1014" y="660" width="20" height="142" rx="3" fill="url(#wood)" stroke="#b7cfdb" />
      <rect x="930" y="640" width="110" height="64" rx="5" fill="url(#wood)" stroke="#b7cfdb" /><rect x="942" y="652" width="86" height="40" rx="4" fill="#e6f0f5" stroke="#b7cfdb" /><circle cx="985" cy="672" r="4" fill="#9bb4c3" />
      <rect x="920" y="626" width="130" height="18" rx="5" fill="url(#wood)" stroke="#b7cfdb" strokeWidth="1.500" /><rect x="920" y="626" width="130" height="4" rx="2" fill="#fff" opacity=".9" />
    </g>
  );
}

function Journal() {
  return (
    <g>
      <g transform="rotate(-3 960 610)">
        <rect x="930" y="598" width="86" height="26" rx="4" fill="url(#notebook)" />
        <rect x="934" y="624" width="80" height="4" rx="2" fill="#f7fbfd" stroke="#c5d2db" strokeWidth=".8" />
        <path d="M930 604h86" stroke="#fff" strokeOpacity=".25" />
        <rect x="938" y="606" width="40" height="3" rx="1.500" fill="#c5d2db" opacity=".8" /><rect x="938" y="612" width="26" height="2.600" rx="1.300" fill="#c5d2db" opacity=".6" />
        <path d="M1004 624v14l-5-4-5 4v-14" fill="#76b7d1" />
      </g>
      <path d="M946 590l60-6" stroke="#c5d2db" strokeWidth="4" strokeLinecap="round" /><path d="M1002 584.500l6-.6" stroke="#14547b" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function JellyLamp({ animate }: { animate: boolean }) {
  return (
    <g pointerEvents="none" className={animate ? 'jelly-lamp' : ''}>
      <circle cx="1022" cy="580" r="38" fill="url(#glow)" opacity=".55" />
      <path d="M1004 612c0-16 8-28 18-28s18 12 18 28z" fill="#e9f6fc" stroke="#9fc5d8" strokeWidth="1.600" opacity=".95" />
      <path d="M1010 600c2-8 6-12 12-13" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M1010 612c-1 8 2 10 0 14M1018 612c0 8-2 10 0 14M1026 612c0 8 2 10 0 14M1034 612c1 8-2 10 0 12" stroke="#b8dce8" strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Bed() {
  return (
    <g pointerEvents="none">
      {/* frame, legs and shadow */}
      <rect x="1500" y="420" width="110" height="390" rx="14" fill="url(#headboard)" stroke="#86aec4" strokeWidth="2" />
      {[1522, 1548, 1574].map((x) => <line key={x} x1={x} x2={x} y1="436" y2="700" stroke="#7fa9bf" strokeOpacity=".5" strokeWidth="2" />)}
      <rect x="1046" y="738" width="560" height="52" rx="8" fill="url(#wood)" stroke="#b7cfdb" strokeWidth="1.500" />
      <rect x="1060" y="788" width="20" height="30" rx="3" fill="#cfe0e9" /><rect x="1480" y="788" width="20" height="30" rx="3" fill="#cfe0e9" />
      {/* mattress */}
      <rect x="1050" y="670" width="552" height="76" rx="22" fill="#f4f9fb" stroke="#cfe0e9" strokeWidth="1.500" />
      {/* duvet with soft folds */}
      <path d="M1056 664C1110 640 1180 654 1250 648S1390 632 1470 640S1560 650 1604 648V756C1560 764 1500 748 1450 760S1330 772 1270 758S1130 770 1070 754C1056 750 1046 730 1056 664Z" fill="url(#duvet)" stroke="#cfe0e9" strokeWidth="1.500" />
      <g fill="none" stroke="#7da5bb" strokeOpacity=".3" strokeWidth="2.200" strokeLinecap="round">
        <path d="M1100 690c40-10 60 6 100-4s60-14 100-2" /><path d="M1180 726c40-8 70 8 110-2s70-12 120-2" /><path d="M1330 676c20 10 40 6 70-4" /><path d="M1090 740c30-8 50 4 80-2" />
      </g>
      <g fill="none" stroke="#fff" strokeOpacity=".95" strokeWidth="3" strokeLinecap="round"><path d="M1110 676c40-10 60 6 100-4s60-14 100-2" /><path d="M1360 700c40-6 70 8 110-2" /></g>
      {/* folded throw */}
      <path d="M1064 680C1110 668 1160 676 1210 670L1214 726C1160 736 1108 728 1068 738Z" fill="#a8cfe0" stroke="#86aec4" />
      <path d="M1070 700c40-6 80 2 140-4M1070 714c40-6 80 2 140-4" stroke="#fff" strokeOpacity=".5" strokeWidth="2" fill="none" />
      {/* pillows */}
      <g>
        <path d="M1376 630C1380 586 1470 582 1520 592C1540 600 1548 628 1540 650C1500 662 1410 664 1376 630Z" fill="url(#pillow)" stroke="#cfe0e9" strokeWidth="1.500" />
        <path d="M1400 616c30-12 70-14 110-6" stroke="#9cbdcf" strokeOpacity=".5" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M1296 650C1296 606 1386 600 1434 612C1454 624 1458 648 1448 668C1400 682 1316 678 1296 650Z" fill="url(#pillow)" stroke="#cfe0e9" strokeWidth="1.500" transform="translate(-6 8)" />
        <rect x="1230" y="620" width="62" height="54" rx="14" fill="#76b7d1" stroke="#5b9fba" transform="rotate(-10 1260 646)" />
        <path d="M1244 642c8-6 16-6 24 0" stroke="#fff" strokeOpacity=".6" strokeWidth="2.600" strokeLinecap="round" fill="none" transform="rotate(-10 1260 646)" />
      </g>
    </g>
  );
}
