'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { categories, projects, relatedExperience } from '@/content/site';
import { Arrow, Rules, SectionHead } from './ui';

export default function Expertise() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const cat = categories[active];
  const list = projects.filter((p) => p.category === cat.id);

  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(k)) return;
    e.preventDefault();
    let next = active;
    if (k === 'ArrowDown' || k === 'ArrowRight') next = (active + 1) % categories.length;
    if (k === 'ArrowUp' || k === 'ArrowLeft') next = (active - 1 + categories.length) % categories.length;
    if (k === 'Home') next = 0;
    if (k === 'End') next = categories.length - 1;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section id="expertise" className="sec dark" data-section="expertise" data-label="Expertise">
      <Rules />
      <div className="wrap">
        <SectionHead n="03" label="Expertise" title={['Core Areas', 'of Expertise']} />

        <div className="xp">
          <div className="xp-tabs" role="tablist" aria-label="Areas of expertise" aria-orientation="vertical" onKeyDown={onKey} data-reveal>
            {categories.map((c, i) => (
              <button
                key={c.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                role="tab"
                id={`tab-${c.id}`}
                aria-selected={i === active}
                aria-controls="xp-panel"
                tabIndex={i === active ? 0 : -1}
                type="button"
                onClick={() => setActive(i)}
              >
                <span className="xp-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="xp-label">{c.label}</span>
                <span className="xp-sub">{c.sub}</span>
              </button>
            ))}
          </div>

          <div className="xp-panel" role="tabpanel" id="xp-panel" aria-labelledby={`tab-${cat.id}`} tabIndex={0} key={cat.id}>
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
