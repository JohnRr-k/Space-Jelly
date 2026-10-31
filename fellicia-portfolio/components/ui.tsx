import { Fragment, type CSSProperties, type ReactNode } from 'react';

export const Arrow = ({ className = '' }: { className?: string }) => (
  <svg className={`arrow ${className}`} width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden="true" focusable="false">
    <path d="M0 7h20M14 1l6 6-6 6" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

/** Splits text into words of letters so each letter can rise on its own while wrapping stays natural. */
export function Chars({ text, base = 0 }: { text: string; base?: number }) {
  let c = base;
  return (
    <>
      {text.split(' ').map((word, wi, arr) => (
        <Fragment key={wi}>
          <span className="wd">
            {Array.from(word).map((ch, i) => (
              <span key={i} className="ch" style={{ '--c': c++ } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
          {wi < arr.length - 1 && ' '}
        </Fragment>
      ))}
    </>
  );
}

/** One masked line of a headline; the parent needs data-reveal="lines" or "chars". */
export function Ln({ children, i = 0 }: { children: ReactNode; i?: number }) {
  return (
    <span className="ln" style={{ '--i': i } as CSSProperties}>
      <span>{children}</span>
    </span>
  );
}

export function SectionHead({ n, label, title, id }: { n: string; label: string; title: string[]; id?: string }) {
  return (
    <div className="sec-head" data-reveal="chars">
      <p className="eyebrow">
        <span className="eyebrow-n">{n}</span>
        <i aria-hidden="true" />
        {label}
      </p>
      <h2 className="title" id={id} aria-label={title.join(' ')}>
        {title.map((t, i) => (
          <Fragment key={t}>
            {i > 0 && ' '}
            <Ln i={i}>
              <Chars text={t} base={i * 9} />
            </Ln>
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
