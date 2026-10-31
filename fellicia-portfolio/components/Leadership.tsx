import { certs, featuredRoles } from '@/content/site';
import CertLink from './CertLink';
import Ambient from './Ambient';
import HScroll from './HScroll';
import { Rules, SectionHead } from './ui';

export default function Leadership() {
  const further = certs.filter((c) => c.category !== 'achievement');
  return (
    <section id="leadership" className="sec dark lead" data-section="experience" data-label="Experience">
      <Rules />
      <Ambient kind="orbs" />
      <p className="drift-word" aria-hidden="true">
        <span data-drift="0.28">Leadership &amp; Organizational Experience</span>
      </p>
      <div className="wrap">
        <SectionHead n="04" label="Leadership" title={['Leadership & Organizational', 'Experience']} />

        <ol className="roles">
          {featuredRoles.map((r, i) => (
            <li key={r.period} className="role" data-reveal style={{ '--i': i } as React.CSSProperties}>
              <span className="role-dot" aria-hidden="true" />
              <p className="role-period">{r.period}</p>
              <h3>{r.title}</h3>
              <p className="role-org">{r.org}</p>
            </li>
          ))}
        </ol>

        <div className="further" data-reveal>
          <p className="eyebrow">Further organizational experience</p>
          <HScroll label="Further organizational experience">
            {further.map((c, i) => (
              <article key={c.id} className="f-card">
                <span className="f-i" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="f-period">{c.period}</p>
                <h3 className="f-role">{c.role}</h3>
                <p className="f-org">{c.issuer}</p>
                <CertLink id={c.id} label={c.title} />
              </article>
            ))}
          </HScroll>
        </div>
      </div>
    </section>
  );
}
