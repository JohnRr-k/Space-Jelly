'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    __fx?: boolean;
  }
}

/**
 * One client island for all scroll behaviour: reveal-on-scroll, progress bar,
 * active section tracking (written to <html data-section>), restrained parallax.
 * Everything degrades to a fully visible static page without JS or with reduced motion.
 */
export default function ScrollEffects() {
  const bar = useRef<HTMLDivElement>(null);
  const idx = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.__fx = true;
    const root = document.documentElement;
    root.classList.remove('fx-fail');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- reveal ---- */
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    let io: IntersectionObserver | undefined;
    const startReveal = () => {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add('is-in');
              io?.unobserve(e.target);
            }
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
      );
      els.forEach((el) => io!.observe(el));
    };
    const onIntroDone = () => startReveal();
    if (reduce) {
      els.forEach((el) => el.classList.add('is-in'));
    } else if (root.dataset.intro === 'play') {
      window.addEventListener('intro:done', onIntroDone, { once: true });
    } else {
      startReveal();
    }

    /* ---- sections, progress, parallax ---- */
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-section]'));
    const order: string[] = [];
    const labels: Record<string, string> = {};
    sections.forEach((s) => {
      const id = s.dataset.section!;
      if (!order.includes(id)) {
        order.push(id);
        labels[id] = s.dataset.label ?? id;
      }
    });
    const par = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
    let ticking = false;
    let current = '';

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, y / max)})`;
      root.toggleAttribute('data-scrolled', y > 24);

      let active = order[0];
      for (const s of sections) if (s.getBoundingClientRect().top <= vh * 0.38) active = s.dataset.section!;
      if (active !== current) {
        current = active;
        root.dataset.section = active;
        const i = order.indexOf(active) + 1;
        if (idx.current) idx.current.textContent = `${String(i).padStart(2, '0')} / ${String(order.length).padStart(2, '0')}  ${labels[active]}`;
      }

      if (!reduce) {
        for (const el of par) {
          const r = el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) continue;
          const f = parseFloat(el.dataset.parallax ?? '0.06');
          el.style.setProperty('--py', `${((r.top + r.height / 2 - vh / 2) * -f).toFixed(1)}px`);
        }
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('intro:done', onIntroDone);
      io?.disconnect();
    };
  }, []);

  return (
    <>
      <div className="progress" aria-hidden="true">
        <div ref={bar} />
      </div>
      <div className="section-index" ref={idx} aria-hidden="true" />
    </>
  );
}
