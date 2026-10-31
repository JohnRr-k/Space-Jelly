import type { CSSProperties } from 'react';

const diamonds = [
  { x: '8%', y: '22%', d: '11s', s: 1 },
  { x: '22%', y: '68%', d: '14s', s: 0.7 },
  { x: '38%', y: '12%', d: '9s', s: 0.8 },
  { x: '57%', y: '78%', d: '13s', s: 1.1 },
  { x: '71%', y: '30%', d: '10s', s: 0.7 },
  { x: '84%', y: '62%', d: '15s', s: 1 },
  { x: '93%', y: '16%', d: '12s', s: 0.8 },
];

/** Decorative moving background layer. Pure CSS motion, never interactive, hidden from assistive tech. */
export default function Ambient({ kind = 'orbs' }: { kind?: 'orbs' | 'arcs' | 'lines' }) {
  return (
    <div className={`ambient ambient-${kind}`} aria-hidden="true">
      {kind === 'orbs' && (
        <>
          <i className="orb o1" />
          <i className="orb o2" />
          <i className="orb o3" />
        </>
      )}
      {kind === 'arcs' && (
        <>
          <svg className="arc a1" viewBox="0 0 400 400" fill="none">
            <circle cx="200" cy="200" r="198" />
            <circle cx="200" cy="200" r="150" />
            <circle cx="200" cy="200" r="102" />
          </svg>
          <svg className="arc a2" viewBox="0 0 400 400" fill="none">
            <path d="M20 380V190a180 180 0 0 1 360 0v190" />
            <path d="M60 380V196a140 140 0 0 1 280 0v184" />
          </svg>
        </>
      )}
      {kind === 'lines' && (
        <>
          <i className="sweep s1" />
          <i className="sweep s2" />
          <i className="sweep s3" />
        </>
      )}
      {diamonds.map((d, i) => (
        <i key={i} className="diamond" style={{ '--x': d.x, '--y': d.y, '--d': d.d, '--s': d.s } as CSSProperties} />
      ))}
    </div>
  );
}
