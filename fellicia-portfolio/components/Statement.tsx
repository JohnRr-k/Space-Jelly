import type { CSSProperties } from 'react';

const words = ['Precision.', 'Credibility.', 'Intellectual depth.', 'Professional authority.'];

/** Kinetic type moment: the section pins and each value swells into view, then gives way to the next. */
export default function Statement() {
  return (
    <section className="stmt" data-stmt data-section="about" data-label="About" aria-label={words.join(' ')}>
      <div className="stmt-in">
        <svg className="stmt-arc" viewBox="0 0 400 400" fill="none" aria-hidden="true">
          <circle cx="200" cy="200" r="198" />
          <circle cx="200" cy="200" r="150" />
          <circle cx="200" cy="200" r="102" />
          <circle cx="200" cy="200" r="54" />
        </svg>
        <ul className="stmt-words">
          {words.map((w, i) => (
            <li key={w} style={{ '--i': i } as CSSProperties}>
              <span className="stmt-n" aria-hidden="true">
                {String(i + 1).padStart(2, '0')} / {String(words.length).padStart(2, '0')}
              </span>
              <span className="stmt-w">{w}</span>
            </li>
          ))}
        </ul>
        <i className="stmt-bar" aria-hidden="true">
          <b />
        </i>
      </div>
    </section>
  );
}
