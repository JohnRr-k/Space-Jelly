'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { categories, projects, relatedExperience } from '@/content/site';
import { Arrow, Rules, SectionHead } from './ui';

/** Horizontal accordion: the open discipline widens, the others fold into vertical labels. */
export default function Expertise() {
  const [active, setActive] = useState(0);
  const heads = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const map: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: categories.length - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    heads.current[(map[e.key] + categories.length) % categories.length]?.focus();
  };

  return (
    <section id="expertise" className="sec dark xp-sec" data-section="expertise" data-label="Expertise">
      <Rules />
      <div className="wrap">
        <SectionHead n="03" label="Expertise" title={['Core Areas', 'of Expertise']} />

        <div className="xpx" data-reveal>
          {categories.map((c, i) => {
            const open = i === active;
            const list = projects.filter((p) => p.category === c.id);
            return (
              <div key={c.id} className={`xpx-card ${open ? 'is-open' : ''}`}>
                <button
                  ref={(el) => {
                    heads.current[i] = el;
                  }}
                  type="button"
                  className="xpx-head"
                  id={`xpx-h-${c.id}`}
                  aria-expanded={open}
                  aria-controls={`xpx-p-${c.id}`}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => onKey(e, i)}
                >
                  <span className="xpx-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="xpx-label">{c.label}</span>
                  <span className="xpx-sub">{c.sub}</span>
                </button>
                <div className="xpx-body" id={`xpx-p-${c.id}`} role="region" aria-labelledby={`xpx-h-${c.id}`} inert={!open}>
                  <p className="eyebrow">Related engagements</p>
                  <ul>
                    {list.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="xp-row"
                          onClick={() => window.dispatchEvent(new CustomEvent('open-project', { detail: p.id }))}
                          aria-haspopup="dialog"
                        >
                          <span className="xp-row-n">{p.n}</span>
                          <span className="xp-row-t">{p.title}</span>
                          <span className="xp-row-o">{p.organization}</span>
                          <Arrow />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <div className="related" data-reveal>
          <p className="eyebrow">Related professional experience</p>
          <ul className="chips">
            {relatedExperience.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
