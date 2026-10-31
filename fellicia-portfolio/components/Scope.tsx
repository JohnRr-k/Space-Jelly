import type { CSSProperties } from 'react';
import type { Scope as ScopeData } from '@/content/site';

const st = (i: number) => ({ '--i': i }) as CSSProperties;

/**
 * The "special element" of each engagement popup. Every label is a phrase from that engagement's own
 * description in the portfolio; the motion only shows how those phrases relate. No facts are added.
 */
export default function Scope({ scope }: { scope: ScopeData }) {
  return (
    <section className={`sc sc-kind-${scope.kind}`} aria-label={`${scope.title}, as described in the portfolio`}>
      <p className="sc-title">{scope.title}</p>

      {scope.kind === 'count' && (
        <>
          <div className="sc-count" role="img" aria-label={`From ${scope.from} to ${scope.to} ${scope.label.toLowerCase()}`}>
            <span className="sc-from">{scope.from}</span>
            <i className="sc-arrow" />
            <span className="sc-to">{scope.to}</span>
          </div>
          <p className="sc-cap">{scope.label}</p>
          <ul className="sc-dots" aria-hidden="true">
            {Array.from({ length: scope.from }).map((_, i) => (
              <li key={i} className={i < scope.to ? 'keep' : 'gone'} style={st(i)} />
            ))}
          </ul>
          <ul className="sc-chips">
            {scope.items.map((t, i) => (
              <li key={t} style={st(i)}>
                {t}
              </li>
            ))}
          </ul>
        </>
      )}

      {scope.kind === 'flow' && (
        <ol className="sc-flow">
          {scope.items.map((t, i) => (
            <li key={t} style={st(i)}>
              <span className="sc-n">{String(i + 1).padStart(2, '0')}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      )}

      {scope.kind === 'stack' && (
        <ul className="sc-stack" style={{ '--n': scope.items.length } as CSSProperties}>
          {scope.items.map((t, i) => (
            <li key={t} style={st(i)}>
              <span className="sc-n">{String(i + 1).padStart(2, '0')}</span>
              {t}
            </li>
          ))}
        </ul>
      )}

      {scope.kind === 'orbit' && (
        <div className="sc-orbit">
          <svg viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
            <circle cx="50" cy="50" r="38" pathLength="1" />
            {scope.items.map((_, i) => {
              const a = (-90 + (i * 360) / scope.items.length) * (Math.PI / 180);
              return <line key={i} x1="50" y1="50" x2={50 + 38 * Math.cos(a)} y2={50 + 38 * Math.sin(a)} pathLength="1" style={st(i)} />;
            })}
          </svg>
          <span className="sc-center">{scope.center}</span>
          <ul>
            {scope.items.map((t, i) => {
              const a = (-90 + (i * 360) / scope.items.length) * (Math.PI / 180);
              return (
                <li key={t} style={{ left: `${50 + 38 * Math.cos(a)}%`, top: `${50 + 38 * Math.sin(a)}%`, '--i': i } as CSSProperties}>
                  <span>{t}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {scope.kind === 'pair' && (
        <div className="sc-pair">
          {scope.items.map((t, i) => (
            <div key={t} className="sc-flip" tabIndex={0} style={st(i)}>
              <div className="sc-flip-in">
                <div className="sc-face front">
                  <span className="sc-n">{i === 0 ? 'BPM' : 'CPM'}</span>
                  <strong>{t}</strong>
                  <em>Hover or focus to turn</em>
                </div>
                <div className="sc-face back">
                  <ul>
                    {scope.back.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
