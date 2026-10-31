import { certs, featuredRoles } from '@/content/site';
import CertLink from './CertLink';
import { Rules, SectionHead } from './ui';

export default function Leadership() {
  const further = certs.filter((c) => c.category !== 'achievement');
  return (
    <section id="leadership" className="sec dark lead" data-section="experience" data-label="Experience">
      <Rules />
      <div className="wrap">
        <SectionHead n="04" label="Leadership" title={['Leadership & Organizational', 'Experience']} />

        <ol className="timeline">
          {featuredRoles.map((r, i) => (
            <li key={r.period} className="tl-item" data-reveal style={{ '--i': i } as React.CSSProperties}>
              <span className="tl-line" aria-hidden="true" data-reveal="vline" />
              <span className="tl-dot" aria-hidden="true" />
              <p className="tl-period">{r.period}</p>
              <div className="tl-body">
                <h3>{r.title}</h3>
                <p>{r.org}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="further" data-reveal>
          <p className="eyebrow">Further organizational experience</p>
          <ul>
            {further.map((c) => (
              <li key={c.id}>
                <span className="f-period">{c.period}</span>
                <span className="f-role">{c.role}</span>
                <span className="f-org">{c.issuer}</span>
                <CertLink id={c.id} label={c.title} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
