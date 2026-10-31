import { Fragment, type CSSProperties, type ReactNode } from 'react';

export const Arrow = ({ className = '' }: { className?: string }) => (
  <svg className={`arrow ${className}`} width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden="true" focusable="false">
    <path d="M0 7h20M14 1l6 6-6 6" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

/** One masked line of a headline; the parent needs data-reveal="lines". */
export function Ln({ children, i = 0 }: { children: ReactNode; i?: number }) {
  return (
    <span className="ln" style={{ '--i': i } as CSSProperties}>
      <span>{children}</span>
    </span>
  );
}

export function SectionHead({ n, label, title, id }: { n: string; label: string; title: string[]; id?: string }) {
  return (
    <div className="sec-head" data-reveal="lines">
      <p className="eyebrow">
        <span className="eyebrow-n">{n}</span>
        <i aria-hidden="true" />
        {label}
      </p>
      <h2 className="title" id={id}>
        {title.map((t, i) => (
          <Fragment key={t}>
            {i > 0 && ' '}
            <Ln i={i}>{t}</Ln>
          </Fragment>
        ))}
      </h2>
    </div>
  );
}

/** Fine vertical editorial rules that draw themselves in. */
export function Rules() {
  return (
    <div className="rules" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((n) => (
        <i key={n} data-reveal="vline" style={{ '--i': n, left: `${n * 25}%` } as CSSProperties} />
      ))}
    </div>
  );
}

export const stagger = (i: number) => ({ '--i': i }) as CSSProperties;
