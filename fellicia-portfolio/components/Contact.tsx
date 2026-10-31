'use client';

import { useState } from 'react';
import { about, person } from '@/content/site';
import Ambient from './Ambient';
import Constellation from './Constellation';
import { Arrow, Ln, Rules } from './ui';

export default function Contact() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(person.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard unavailable: the address is shown in full and is a mailto link */
    }
  };
  const subject = encodeURIComponent('Professional enquiry');

  return (
    <section id="contact" className="sec dark contact" data-section="contact" data-label="Contact">
      <Rules />
      <Ambient kind="orbs" />
      <Constellation density={0.8} />
      <p className="drift-word is-big" aria-hidden="true">
        <span data-drift="-0.3">Professional Conversation — Professional Conversation —</span>
      </p>
      <div className="wrap">
        <p className="eyebrow" data-reveal>
          <span className="eyebrow-n">06</span>
          <i aria-hidden="true" />
          Contact
        </p>
        <h2 className="display contact-title" data-reveal="lines">
          <Ln i={0}>Let’s Start a</Ln>{' '}
          <Ln i={1}>
            <em>Professional</em> Conversation.
          </Ln>
        </h2>

        <div className="contact-grid">
          <blockquote className="contact-quote" data-reveal style={{ '--i': 2 } as React.CSSProperties}>
            <p>{about.closing}</p>
            <footer>{person.name}, {person.designation}</footer>
          </blockquote>

          <div className="contact-actions" data-reveal style={{ '--i': 3 } as React.CSSProperties}>
            <a className="btn btn-solid btn-lg" data-magnetic href={`mailto:${person.email}?subject=${subject}`}>
              Contact via Email <Arrow />
            </a>
            <a className="btn btn-ghost btn-lg" data-magnetic href={person.linkedin} target="_blank" rel="noopener noreferrer">
              Connect on LinkedIn <Arrow />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="contact-line">
              <a className="ulink" href={`mailto:${person.email}`}>
                {person.email}
              </a>
              <button type="button" className="copy" onClick={copy}>
                {copied ? 'Copied' : 'Copy address'}
              </button>
              <span className="sr-only" role="status" aria-live="polite">
                {copied ? 'Email address copied to clipboard' : ''}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
