import { Fragment } from 'react';
import { about, person } from '@/content/site';
import { SectionHead, Rules, stagger } from './ui';

const emphasis = [
  'Bachelor of Laws',
  '3.91/4.00',
  'Certified Legal Auditor (CLA)',
  'Junior Associate at FRP Law Firm',
];

function Emphasised({ text }: { text: string }) {
  const re = new RegExp(`(${emphasis.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return (
    <>
      {text.split(re).map((part, i) =>
        emphasis.includes(part) ? (
          <em key={i}>{part}</em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export default function About() {
  return (
    <section id="about" className="sec light" data-section="about" data-label="About">
      <Rules />
      <div className="wrap">
        <SectionHead n="02" label="About" title={['Professional', 'Profile']} />
        <div className="about-grid">
          <p className="about-text" data-reveal style={stagger(1)}>
            <Emphasised text={about.text} />
          </p>
          <dl className="facts" data-reveal style={stagger(2)}>
            <div>
              <dt>Qualification</dt>
              <dd>Bachelor of Laws (S.H.), Tarumanagara University</dd>
            </div>
            <div>
              <dt>Academic record</dt>
              <dd>GPA 3.91/4.00</dd>
            </div>
            <div>
              <dt>Credential</dt>
              <dd>
                Certified Legal Auditor (CLA) <a className="ulink" href="#credentials">See status</a>
              </dd>
            </div>
            <div>
              <dt>Current position</dt>
              <dd>
                {person.position}, {person.firm}
              </dd>
            </div>
            <div>
              <dt>Professional experience</dt>
              <dd>Corporate law, regulatory compliance, legal advisory, and dispute resolution</dd>
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
      </div>
    </section>
  );
}
