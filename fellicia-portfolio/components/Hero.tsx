import type { CSSProperties } from 'react';
import { person } from '@/content/site';
import { media } from '@/lib/media';
import Ambient from './Ambient';
import { Arrow, Ln, Rules, stagger } from './ui';

export default function Hero() {
  return (
    <section id="home" className="hero dark" data-section="home" data-label="Home" data-hero>
      <div className="hero-bg" aria-hidden="true">
        <i className="glow g1" />
        <i className="glow g2" />
      </div>
      <Ambient kind="lines" />
      <Rules />
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow" data-reveal style={stagger(0)}>
            {person.position} · {person.firm}
          </p>
          <h1 className="display hero-name" data-reveal="lines">
            <Ln i={0}>Fellicia</Ln>{' '}
            <Ln i={1}>
              <em>Angelica</em>
            </Ln>{' '}
            <Ln i={2}>Kholim</Ln>
          </h1>
          <p className="hero-desig" data-reveal style={stagger(3)}>
            <span>
              S.H.<b className="pipe" aria-hidden="true" />CLA.
            </span>
            <i aria-hidden="true" />
            <span>{person.positioning.join(' · ')}</span>
          </p>
          <p className="hero-lead" data-reveal style={stagger(4)}>
            Junior Associate at FRP Law Firm, with professional experience in corporate law, regulatory compliance, legal advisory, and dispute resolution.
          </p>
          <div className="hero-cta" data-reveal style={stagger(5)}>
            <a className="btn btn-solid" href="#experience" data-magnetic>
              Explore Selected Work <Arrow />
            </a>
            <a className="btn btn-ghost" href="#contact" data-magnetic>
              Get in Touch
            </a>
          </div>
        </div>

        <figure className="hero-portrait" data-reveal="arch" data-tilt style={{ '--i': 1 } as CSSProperties}>
          <div className="arch-frame" data-parallax="0.05" aria-hidden="true" />
          <div className="arch">
            <img
              src={media('portrait/fellicia.webp')}
              srcSet={`${media('portrait/fellicia-800.webp')} 800w, ${media('portrait/fellicia.webp')} 1066w`}
              sizes="(max-width: 900px) 78vw, 36vw"
              width={1066}
              height={1600}
              alt="Portrait of Fellicia Angelica Kholim in a black blazer and white shirt"
              fetchPriority="high"
              data-parallax="-0.04"
            />
          </div>
          <figcaption className="vertical-cap" aria-hidden="true">
            Fellicia Angelica Kholim, S.H., CLA.
          </figcaption>
        </figure>
      </div>

      <div className="wrap hero-meta" data-reveal style={stagger(6)}>
        <dl>
          <div>
            <dt>Education</dt>
            <dd>Bachelor of Laws, Tarumanagara University · GPA 3.91/4.00</dd>
          </div>
          <div>
            <dt>Credential</dt>
            <dd>Certified Legal Auditor (CLA)</dd>
          </div>
          <div>
            <dt>Current position</dt>
            <dd>
              {person.position}, {person.firm}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
