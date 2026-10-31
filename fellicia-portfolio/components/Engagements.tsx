'use client';

import { useEffect, useState } from 'react';
import { categories, projects, type CategoryId, type Project } from '@/content/site';
import Ambient from './Ambient';
import Scope from './Scope';
import { isShown, media } from '@/lib/media';
import Modal from './Modal';
import { Arrow, Rules, SectionHead } from './ui';

/** Visual for a card or the detail view. Falls back to a typographic panel when assets are withheld. */
function Visual({ p, detail = false }: { p: Project; detail?: boolean }) {
  const figs = p.figures.filter(isShown);
  if (figs.length === 0) {
    return (
      <div className={`pv pv-empty ${detail ? 'is-detail' : ''}`}>
        <span className="pv-num" aria-hidden="true">
          {p.n}
        </span>
        <p>Supporting visual withheld for client confidentiality.</p>
      </div>
    );
  }
  return (
    <div className={`pv pv-${p.visual} ${detail ? 'is-detail' : ''}`}>
      {figs.map((f, i) => (
        <span key={f.src} className={`pv-img pv-img-${i}`} style={{ maxWidth: f.w }}>
          <img src={media(f.src)} width={f.w} height={f.h} alt={f.alt} loading="lazy" decoding="async" />
        </span>
      ))}
    </div>
  );
}

/** Every engagement has its own card composition, width and vertical position, with air between them. */
const layoutOf: Record<string, { k: string; w: number; as: 'start' | 'center' | 'end'; mt?: string; clamp: number }> = {
  'employee-liability-restructuring': { k: 'feature', w: 64, as: 'center', clamp: 5 },
  'legal-due-diligence-internal-regulatory-review': { k: 'card', w: 30, as: 'start', mt: '4vh', clamp: 3 },
  'employee-disciplinary-dispute': { k: 'card', w: 30, as: 'end', clamp: 3 },
  'good-corporate-governance-harmonization': { k: 'split', w: 54, as: 'center', clamp: 4 },
  'board-and-corporate-policy-manuals': { k: 'tall', w: 34, as: 'start', clamp: 3 },
  'personal-data-protection-compliance': { k: 'mini', w: 44, as: 'end', clamp: 4 },
  'iso-37301-compliance-management-system': { k: 'wide', w: 56, as: 'center', clamp: 4 },
  'digital-services-consumer-protection': { k: 'arch', w: 30, as: 'start', mt: '6vh', clamp: 3 },
  'ict-infrastructure-contracts': { k: 'doc', w: 46, as: 'center', clamp: 4 },
};

export default function Engagements() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [origin, setOrigin] = useState({ x: '50%', y: '50%' });

  const open = (id: string, e?: { clientX: number; clientY: number; detail: number; currentTarget: EventTarget }) => {
    if (e && e.detail > 0) setOrigin({ x: `${e.clientX}px`, y: `${e.clientY}px` });
    else if (e) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setOrigin({ x: `${r.left + r.width / 2}px`, y: `${r.top + r.height / 2}px` });
    } else setOrigin({ x: '50%', y: '50%' });
    setOpenId(id);
  };

  useEffect(() => {
    const h = (e: Event) => open((e as CustomEvent<string>).detail);
    window.addEventListener('open-project', h);
    return () => window.removeEventListener('open-project', h);
  }, []);

  const current = projects.find((p) => p.id === openId) ?? null;
  const idx = current ? projects.findIndex((p) => p.id === current.id) : -1;
  const prev = idx > 0 ? projects[idx - 1] : null;
  const next = idx >= 0 && idx < projects.length - 1 ? projects[idx + 1] : null;
  const catLabel = (id: CategoryId) => categories.find((c) => c.id === id)!.label;
  const shownFigs = current ? current.figures.filter(isShown) : [];

  return (
    <section id="experience" className="sec light eng" data-section="experience" data-label="Experience">
      <Rules />
      <Ambient kind="arcs" />
      <div className="wrap eng-top">
        <SectionHead n="04" label="Experience" title={['Professional Experience', '& Project Highlights']} />
        <p className="eng-count" data-reveal>
          <strong data-count={projects.length} data-pad="2">
            {String(projects.length).padStart(2, '0')}
          </strong>{' '}
          selected legal engagements
          <span className="eng-hint" aria-hidden="true">
            Keep scrolling <Arrow />
          </span>
        </p>
      </div>

      <div className="hpin" data-hscroll>
        <div className="hpin-in">
          <div className="hbar" aria-hidden="true">
            <span className="hbar-n" data-hcount>
              01
            </span>
            <i>
              <b />
            </i>
            <span>{String(projects.length).padStart(2, '0')}</span>
          </div>
          <div className="track">
            {projects.map((p) => {
              const L = layoutOf[p.id];
              return (
                <article
                  key={p.id}
                  className={`hc hc-${L.k}`}
                  style={{ '--w': `${L.w}vw`, '--as': L.as, '--mt': L.mt ?? '0px', '--clamp': L.clamp } as React.CSSProperties}
                  data-tilt
                  data-cursor-label="Open"
                >
                  <span className="hc-n" aria-hidden="true">
                    {p.n}
                  </span>
                  <div className="hc-body">
                    <p className="project-meta">
                      <span>{catLabel(p.category)}</span>
                      <i aria-hidden="true" />
                      <span>{p.organization}</span>
                    </p>
                    <h3 className="project-title">
                      <button type="button" className="project-open" onClick={(e) => open(p.id, e)} aria-haspopup="dialog">
                        {p.title}
                      </button>
                    </h3>
                    <p className="project-desc">{p.description}</p>
                    <span className="project-cta" aria-hidden="true">
                      Read the full engagement <Arrow />
                    </span>
                  </div>
                  <div className="hc-visual">
                    <Visual p={p} />
                  </div>
                </article>
              );
            })}
            <div className="track-end" aria-hidden="true">
              <span>09</span>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={!!current}
        onClose={() => setOpenId(null)}
        labelledBy="project-dialog-title"
        className="modal-project"
        style={{ '--ox': origin.x, '--oy': origin.y } as React.CSSProperties}
      >
        {current && (
          <div className="pd" key={current.id} data-tone={current.tone}>
            <div className="pd-in">
              <div className="pd-bar">
                <p className="eyebrow">
                  Engagement {current.n} / {String(projects.length).padStart(2, '0')}
                </p>
                <button type="button" className="close" onClick={() => setOpenId(null)} autoFocus>
                  Close<span className="sr-only"> engagement details</span>
                  <i aria-hidden="true" />
                </button>
              </div>
              <div className="pd-grid">
                <div className="pd-text">
                  <span className="pd-num" aria-hidden="true">
                    {current.n}
                  </span>
                  <p className="pd-cat">{catLabel(current.category)}</p>
                  <h3 id="project-dialog-title" className="pd-title">
                    {current.title}
                  </h3>
                  <dl className="pd-meta">
                    <div>
                      <dt>Organization</dt>
                      <dd>{current.organization}</dd>
                    </div>
                    <div>
                      <dt>Title in portfolio</dt>
                      <dd>{current.formalTitle}</dd>
                    </div>
                  </dl>
                  <p className="pd-desc">{current.description}</p>
                  <ul className="chips chips-sm" aria-label="Related legal disciplines">
                    {current.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div className="pd-figs">
                  <Scope scope={current.scope} />
                  {shownFigs.length === 0 ? (
                    <div className="pv pv-empty is-detail">
                      <span className="pv-num" aria-hidden="true">
                        {current.n}
                      </span>
                      <p>Supporting visual withheld for client confidentiality.</p>
                    </div>
                  ) : (
                    shownFigs.map((f) => (
                      <figure key={f.src}>
                        <img src={media(f.src)} width={f.w} height={f.h} alt={f.alt} decoding="async" />
                        <figcaption>{f.caption}</figcaption>
                      </figure>
                    ))
                  )}
                </div>
              </div>
              <nav className="pd-nav" aria-label="Engagement navigation">
                <button type="button" disabled={!prev} onClick={() => prev && setOpenId(prev.id)}>
                  <Arrow className="flip" />
                  <span>
                    <small>Previous</small>
                    {prev ? prev.title : '—'}
                  </span>
                </button>
                <button type="button" disabled={!next} onClick={() => next && setOpenId(next.id)}>
                  <span>
                    <small>Next</small>
                    {next ? next.title : '—'}
                  </span>
                  <Arrow />
                </button>
              </nav>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
