import type { CSSProperties } from 'react';
import { about, person, projects } from '@/content/site';
import Ambient from './Ambient';
import { Rules, SectionHead } from './ui';

const emphasis = ['Bachelor of Laws', '3.91/4.00', 'Certified Legal Auditor (CLA)', 'Junior Associate at FRP Law Firm'];

/** Splits the profile into words, keeping the highlighted phrases, so each word can light up as you scroll. */
function tokens(text: string) {
  const re = new RegExp(`(${emphasis.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const out: { w: string; em: boolean }[] = [];
  for (const part of text.split(re)) {
    const em = emphasis.includes(part);
    for (const w of part.split(/\s+/).filter(Boolean)) out.push({ w, em });
  }
  return out;
}

export default function About() {
  const words = tokens(about.text);
  return (
    <section id="about" className="sec light about" data-section="about" data-label="About">
      <Rules />
      <Ambient kind="arcs" />
      <div className="wrap about-grid">
        <div className="about-side">
          <SectionHead n="02" label="About" title={['Professional', 'Profile']} />
          <dl className="facts" data-reveal>
            <div>
              <dt>Current position</dt>
              <dd>
                {person.position}, {person.firm}
              </dd>
            </div>
            <div>
              <dt>Credential</dt>
              <dd>
                Certified Legal Auditor (CLA) <a className="ulink" href="#credentials">See status</a>
              </dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>
                <a className="ulink" href={`mailto:${person.email}`}>
                  {person.email}
                </a>
                <br />
                <a className="ulink" href={person.linkedin} target="_blank" rel="noopener noreferrer">
                  LinkedIn profile<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </dd>
            </div>
          </dl>
        </div>

        <div className="about-main">
          <p className="about-text" data-scrub style={{ '--n': words.length + 4 } as CSSProperties}>
            {words.map((t, i) => (
              <span key={i} className="w" style={{ '--i': i } as CSSProperties}>
                {t.em ? <em>{t.w}</em> : t.w}
                {' '}
              </span>
            ))}
          </p>

          <ul className="stats" aria-label="Profile at a glance">
            <li data-reveal style={{ '--i': 0 } as CSSProperties}>
              <span className="stat-n">
                <span data-count="3.91" data-decimals="2">3.91</span>
                <small>/4.00</small>
              </span>
              <span className="stat-l">Cumulative GPA</span>
            </li>
            <li data-reveal style={{ '--i': 1 } as CSSProperties}>
              <span className="stat-n">
                <span data-count={projects.length} data-pad="2">{String(projects.length).padStart(2, '0')}</span>
              </span>
              <span className="stat-l">Selected legal engagements</span>
            </li>
            <li data-reveal style={{ '--i': 2 } as CSSProperties}>
              <span className="stat-n">
                <span data-count="4" data-pad="2">04</span>
              </span>
              <span className="stat-l">Core disciplines</span>
            </li>
            <li data-reveal style={{ '--i': 3 } as CSSProperties}>
              <span className="stat-n is-small">2021–2025</span>
              <span className="stat-l">Bachelor of Laws</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
