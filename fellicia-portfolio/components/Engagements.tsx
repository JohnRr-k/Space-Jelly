'use client';

import { useEffect, useState } from 'react';
import { categories, projects, type CategoryId, type Project } from '@/content/site';
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
        <span key={f.src} className={`pv-img pv-img-${i}`}>
          <img src={media(f.src)} width={f.w} height={f.h} alt={f.alt} loading="lazy" decoding="async" />
        </span>
      ))}
    </div>
  );
}

export default function Engagements() {
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: Event) => setOpenId((e as CustomEvent<string>).detail);
    window.addEventListener('open-project', h);
    return () => window.removeEventListener('open-project', h);
  }, []);

  const visible = projects.filter((p) => filter === 'all' || p.category === filter);
  const current = projects.find((p) => p.id === openId) ?? null;
  const pos = current ? visible.findIndex((p) => p.id === current.id) : -1;
  const siblings = pos >= 0 ? visible : projects;
  const idx = current ? siblings.findIndex((p) => p.id === current.id) : -1;
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const catLabel = (id: CategoryId) => categories.find((c) => c.id === id)!.label;
  const shownFigs = current ? current.figures.filter(isShown) : [];

  return (
    <section id="experience" className="sec light eng" data-section="experience" data-label="Experience">
      <Rules />
      <div className="wrap">
        <div className="eng-grid">
          <aside className="eng-intro">
            <div className="eng-sticky">
              <SectionHead n="04" label="Experience" title={['Professional Experience', '& Project Highlights']} />
              <p className="eng-count" data-reveal>
                <strong>{String(projects.length).padStart(2, '0')}</strong> selected legal engagements
              </p>
              <div className="filters" role="group" aria-label="Filter engagements by discipline" data-reveal>
                <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                  All
                </button>
                {categories.map((c) => (
                  <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="eng-list">
            {projects.map((p) => (
              <article
                key={p.id}
                className={`project pk-${p.visual}`}
                hidden={!(filter === 'all' || p.category === filter)}
                data-reveal
              >
                <span className="project-n" aria-hidden="true">
                  {p.n}
                </span>
                <div className="project-body">
                  <p className="project-meta">
                    <span>{catLabel(p.category)}</span>
                    <i aria-hidden="true" />
                    <span>{p.organization}</span>
                  </p>
                  <h3 className="project-title">
                    <button type="button" className="project-open" onClick={() => setOpenId(p.id)} aria-haspopup="dialog">
                      {p.title}
                    </button>
                  </h3>
                  <p className="project-desc">{p.description}</p>
                  <span className="project-cta" aria-hidden="true">
                    Read the full engagement <Arrow />
                  </span>
                </div>
                <div className="project-visual" data-reveal="mask">
                  <Visual p={p} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <Modal open={!!current} onClose={() => setOpenId(null)} labelledBy="project-dialog-title" className="modal-project">
        {current && (
          <div className="pd" key={current.id}>
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
        )}
      </Modal>
    </section>
  );
}
