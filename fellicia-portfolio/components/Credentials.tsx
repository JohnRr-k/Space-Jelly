'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  achievements,
  certCategoryLabels,
  certs,
  credentialDocs,
  credentials,
  education,
  type Cert,
  type CertCategory,
} from '@/content/site';
import { media } from '@/lib/media';
import Ambient from './Ambient';
import Modal from './Modal';
import { Arrow, Rules, SectionHead } from './ui';

type Item = {
  id: string;
  title: string;
  kind: string;
  issuer: string;
  period: string;
  summary: string;
  note: string;
  src: string;
  w: number;
  h: number;
  alt: string;
};

const NOTE = 'The original document is shown as supplied and is written in Indonesian.';

const fromCert = (c: Cert): Item => ({
  id: c.id,
  title: c.title,
  kind: c.kind,
  issuer: c.issuer,
  period: c.period,
  summary: c.summary,
  note: NOTE,
  src: `${c.file}.webp`,
  w: c.w,
  h: c.h,
  alt: c.alt,
});

const docItems = (cred: (typeof credentials)[number]): Item[] =>
  cred.docs.map((k, i) => {
    const d = credentialDocs[k];
    return {
      id: `${cred.id}-${k}`,
      title: cred.title,
      kind: cred.status,
      issuer: cred.issuer,
      period: cred.date,
      summary: cred.note,
      note:
        cred.id === 'llb'
          ? 'Serial numbers, birth data, student number and the identification photograph have been redacted for privacy. The original document is in Indonesian and English.'
          : NOTE,
      src: d.src,
      w: d.w,
      h: d.h,
      alt: d.alt + (cred.docs.length > 1 ? ` (${i + 1} of ${cred.docs.length})` : ''),
    };
  });

export default function Credentials() {
  const [filter, setFilter] = useState<'all' | CertCategory>('all');
  const [viewer, setViewer] = useState<{ items: Item[]; i: number } | null>(null);

  const allCerts = useMemo(() => certs.map(fromCert), []);
  const archive = certs.filter((c) => filter === 'all' || c.category === filter);

  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const i = allCerts.findIndex((c) => c.id === id);
      if (i >= 0) setViewer({ items: allCerts, i });
    };
    window.addEventListener('open-cert', h);
    return () => window.removeEventListener('open-cert', h);
  }, [allCerts]);

  const openCerts = (list: Cert[], id: string) =>
    setViewer({ items: list.map(fromCert), i: list.findIndex((c) => c.id === id) });

  const cur = viewer ? viewer.items[viewer.i] : null;

  return (
    <>
      {/* ---------------------------------------------------------- Education */}
      <section id="credentials" className="sec dark2 cred" data-section="credentials" data-label="Credentials">
        <Rules />
        <Ambient kind="lines" />
        <div className="wrap">
          <SectionHead n="05" label="Credentials" title={['Academic Background', '& Credentials']} />

          <div className="edu">
            <div className="gpa" data-reveal>
              <p className="eyebrow">Cumulative GPA</p>
              <p className="gpa-num" aria-label={`${education.gpa} out of ${education.gpaScale}`}>
                <span data-count={education.gpa} data-decimals="2">{education.gpa}</span>
                <small>/{education.gpaScale}</small>
              </p>
              <p className="gpa-sub">
                {education.qualification}
                <br />
                {education.institution} · {education.period}
              </p>
            </div>

            <ol className="cred-line">
              {credentials.map((c, i) => (
                <li key={c.id} className="cred-card" data-reveal style={{ '--i': i } as React.CSSProperties}>
                  <span className="cred-dot" aria-hidden="true" />
                  <p className="eyebrow">{c.label}</p>
                  <p className="cred-date">{c.date}</p>
                  <h3>{c.title}</h3>
                  <p className="cred-issuer">{c.issuer}</p>
                  <p className={`status ${c.id === 'cla' ? 'is-pending' : ''}`}>{c.status}</p>
                  <p className="cred-note">{c.note}</p>
                  <div className="cred-docs">
                    {docItems(c).map((it, k, arr) => (
                      <button
                        key={it.id}
                        type="button"
                        className="doc-thumb"
                        aria-haspopup="dialog"
                        aria-label={`View document: ${c.title}${arr.length > 1 ? ` (${k + 1} of ${arr.length})` : ''}`}
                        onClick={() => setViewer({ items: arr, i: k })}
                      >
                        <img
                          src={media(credentialDocs[c.docs[k]].thumb)}
                          width={credentialDocs[c.docs[k]].w}
                          height={credentialDocs[c.docs[k]].h}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                        <span aria-hidden="true">View document</span>
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Achievements */}
      <section id="achievements" className="sec light ach" data-section="credentials" data-label="Credentials">
        <Rules />
        <div className="wrap">
          <SectionHead n="05" label="Achievements" title={['Achievements', '& Certificates']} />

          <div className="podium">
            {achievements.map((a, i) => (
              <article key={a.id} className={`podium-card ${i === 1 ? "is-down" : ""}`} data-reveal style={{ '--i': i } as React.CSSProperties}>
                <p className="eyebrow">{a.period}</p>
                <p className="podium-rank" aria-hidden="true">
                  III
                </p>
                <h3>{a.title}</h3>
                <p className="podium-issuer">{a.issuer}</p>
                <button type="button" className="podium-thumb" aria-haspopup="dialog" onClick={() => openCerts(achievements, a.id)}>
                  <span className="podium-img" data-reveal="mask">
                    <img src={media(`${a.file}.webp`)} width={a.w} height={a.h} alt={a.alt} loading="lazy" decoding="async" />
                  </span>
                  <span className="cta">
                    View certificate <Arrow />
                  </span>
                </button>
              </article>
            ))}
          </div>

          <div className="archive" data-reveal>
            <div className="archive-head">
              <h3 className="archive-title">Certificate Archive</h3>
              <div className="filters" role="group" aria-label="Filter certificates">
                <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                  All
                </button>
                {(Object.keys(certCategoryLabels) as CertCategory[]).map((k) => (
                  <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                    {certCategoryLabels[k]}
                  </button>
                ))}
              </div>
            </div>
            <ul className="archive-grid">
              {archive.map((c) => (
                <li key={c.id}>
                  <button type="button" className="arch-card" aria-haspopup="dialog" onClick={() => openCerts(archive, c.id)}>
                    <span className="arch-img">
                      <img src={media(`${c.file}-thumb.webp`)} width={480} height={Math.round((480 * c.h) / c.w)} alt={c.alt} loading="lazy" decoding="async" />
                    </span>
                    <span className="arch-meta">
                      <small>{certCategoryLabels[c.category]} · {c.period}</small>
                      <strong>{c.title}</strong>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Viewer */}
      <Modal open={!!cur} onClose={() => setViewer(null)} labelledBy="viewer-title" className="modal-viewer">
        {cur && viewer && (
          <div className="vw">
            <div className="vw-bar">
              <p className="eyebrow">
                Document {viewer.i + 1} / {viewer.items.length}
              </p>
              <button type="button" className="close" onClick={() => setViewer(null)} autoFocus>
                Close<span className="sr-only"> document preview</span>
                <i aria-hidden="true" />
              </button>
            </div>
            <div className="vw-grid">
              <div className="vw-img">
                <img key={cur.src} src={media(cur.src)} width={cur.w} height={cur.h} alt={cur.alt} style={{ maxWidth: `min(100%, ${cur.w}px)` }} />
              </div>
              <div className="vw-meta">
                <p className="vw-kind">{cur.kind}</p>
                <h3 id="viewer-title">{cur.title}</h3>
                <dl>
                  <div>
                    <dt>Issued by</dt>
                    <dd>{cur.issuer}</dd>
                  </div>
                  <div>
                    <dt>Period</dt>
                    <dd>{cur.period}</dd>
                  </div>
                  <div>
                    <dt>Details</dt>
                    <dd>{cur.summary}</dd>
                  </div>
                </dl>
                <p className="vw-note">{cur.note}</p>
                {viewer.items.length > 1 && (
                  <div className="vw-nav">
                    <button type="button" disabled={viewer.i === 0} onClick={() => setViewer({ ...viewer, i: viewer.i - 1 })}>
                      <Arrow className="flip" /> Previous
                    </button>
                    <button type="button" disabled={viewer.i === viewer.items.length - 1} onClick={() => setViewer({ ...viewer, i: viewer.i + 1 })}>
                      Next <Arrow />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
