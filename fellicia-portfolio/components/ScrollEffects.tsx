'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    __fx?: boolean;
  }
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/**
 * The single client island that drives every scroll-linked and pointer-linked effect:
 * reveal, inertial smooth scroll, section entrance, pinned horizontal gallery, scrubbed text,
 * counters, drift, magnetic buttons, tilt, cursor and spotlight.
 * Everything degrades to a static, fully readable page (no JS, touch, reduced motion).
 */
export default function ScrollEffects() {
  const bar = useRef<HTMLDivElement>(null);
  const idx = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    window.__fx = true;
    const root = document.documentElement;
    root.classList.remove('fx-fail');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const wide = () => window.matchMedia('(min-width: 1000px)').matches;
    const cleanups: (() => void)[] = [];

    /* ------------------------------------------------ reveal + counters */
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const counters = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
    const fmt = (el: HTMLElement, v: number) => v.toFixed(+(el.dataset.decimals ?? 0)).padStart(+(el.dataset.pad ?? 0), '0');
    const runCount = (el: HTMLElement) => {
      const to = parseFloat(el.dataset.count!);
      const t0 = performance.now();
      const step = (t: number) => {
        const p = clamp((t - t0) / 1800);
        el.textContent = fmt(el, to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    let io: IntersectionObserver | undefined;
    let cio: IntersectionObserver | undefined;
    const startReveal = () => {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries)
            if (e.isIntersecting) {
              e.target.classList.add('is-in');
              io?.unobserve(e.target);
            }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
      );
      els.forEach((el) => io!.observe(el));
      if (!reduce) {
        counters.forEach((c) => (c.textContent = fmt(c, 0)));
        cio = new IntersectionObserver(
          (entries) => {
            for (const e of entries)
              if (e.isIntersecting) {
                runCount(e.target as HTMLElement);
                cio?.unobserve(e.target);
              }
          },
          { threshold: 0.4 },
        );
        counters.forEach((c) => cio!.observe(c));
      }
    };
    const onIntroDone = () => startReveal();
    if (reduce) els.forEach((el) => el.classList.add('is-in'));
    else if (root.dataset.intro === 'play') window.addEventListener('intro:done', onIntroDone, { once: true });
    else startReveal();

    /* ------------------------------------------------ sections / parallax / scrub / pin / drift */
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
    const secs = Array.from(document.querySelectorAll<HTMLElement>('.sec, .stmt'));
    const stmts = Array.from(document.querySelectorAll<HTMLElement>('[data-stmt]'));
    const par = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
    const drift = Array.from(document.querySelectorAll<HTMLElement>('[data-drift]'));
    const scrub = Array.from(document.querySelectorAll<HTMLElement>('[data-scrub]'));
    const pins = Array.from(document.querySelectorAll<HTMLElement>('[data-hscroll]'));
    const hero = document.querySelector<HTMLElement>('.hero');
    let current = '';
    let ticking = false;

    const layoutPins = () => {
      const on = wide() && !reduce;
      root.classList.toggle('hpin-on', on);
      stmts.forEach((s) => {
        const n = s.querySelectorAll('.stmt-words li').length;
        s.style.height = on ? `calc(100vh + ${n * 85}vh)` : '';
      });
      pins.forEach((pin) => {
        const track = pin.querySelector<HTMLElement>('.track');
        if (!track) return;
        if (!on) {
          pin.style.height = '';
          track.style.removeProperty('--hx');
          return;
        }
        const dist = track.scrollWidth - window.innerWidth;
        pin.style.height = `${Math.max(0, dist) + window.innerHeight}px`;
        pin.dataset.dist = String(Math.max(0, dist));
      });
    };

    let lastY = window.scrollY;
    let vel = 0;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      vel = vel * 0.8 + (y - lastY) * 0.2;
      lastY = y;
      const vh = window.innerHeight;
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, y / max)})`;
      root.toggleAttribute('data-scrolled', y > 24);

      /* active section + nav theme */
      let active = order[0];
      for (const s of sections) if (s.getBoundingClientRect().top <= vh * 0.38) active = s.dataset.section!;
      if (active !== current) {
        current = active;
        root.dataset.section = active;
        const i = order.indexOf(active) + 1;
        if (idx.current) {
          idx.current.textContent = `${String(i).padStart(2, '0')} / ${String(order.length).padStart(2, '0')}  ${labels[active]}`;
          idx.current.classList.remove('tick');
          void idx.current.offsetWidth;
          idx.current.classList.add('tick');
        }
      }
      let theme = 'dark';
      for (const s of secs) {
        const r = s.getBoundingClientRect();
        if (r.top <= 44 && r.bottom > 44) theme = s.classList.contains('light') ? 'light' : 'dark';
      }
      if (root.dataset.theme !== theme) root.dataset.theme = theme;

      if (reduce) return;

      /* section entrance: rounded card sliding in, flattening as it settles */
      for (const s of secs) {
        const r = s.getBoundingClientRect();
        const e = clamp((vh - r.top) / (vh * 0.55));
        s.style.setProperty('--enter', e.toFixed(3));
      }
      /* hero leaves with a slow fade and lift */
      if (hero) hero.style.setProperty('--hp', clamp(y / (vh * 0.9)).toFixed(3));

      for (const el of par) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const f = parseFloat(el.dataset.parallax ?? '0.06');
        el.style.setProperty('--py', `${((r.top + r.height / 2 - vh / 2) * -f).toFixed(1)}px`);
      }
      for (const el of drift) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -400 || r.top > vh + 400) continue;
        const f = parseFloat(el.dataset.drift ?? '0.2');
        el.style.setProperty('--dx', `${((r.top + r.height / 2 - vh / 2) * f).toFixed(1)}px`);
      }
      for (const el of scrub) {
        const r = el.getBoundingClientRect();
        const p = clamp((vh * 0.88 - r.top) / (vh * 0.4 + r.height));
        el.style.setProperty('--p', p.toFixed(3));
      }
      for (const s of stmts) {
        if (!root.classList.contains('hpin-on')) {
          s.querySelectorAll<HTMLElement>('.stmt-words li').forEach((li) => li.removeAttribute('style'));
          continue;
        }
        const r = s.getBoundingClientRect();
        const p = clamp(-r.top / Math.max(1, s.offsetHeight - vh));
        const lis = Array.from(s.querySelectorAll<HTMLElement>('.stmt-words li'));
        const n = lis.length;
        lis.forEach((li, i) => {
          const local = p * n - i; // 0..1 while this word is on stage
          const o = clamp(1.7 - Math.abs(local - 0.5) * 3.4);
          li.style.opacity = o.toFixed(3);
          li.style.transform = `translate3d(0,${((0.5 - local) * 90).toFixed(1)}px,0) scale(${(0.72 + clamp(local, -0.2, 1.2) * 0.42).toFixed(3)})`;
          li.style.filter = o < 0.98 ? `blur(${((1 - o) * 14).toFixed(1)}px)` : 'none';
        });
        s.style.setProperty('--sp', p.toFixed(4));
      }
      for (const pin of pins) {
        if (!root.classList.contains('hpin-on')) continue;
        const track = pin.querySelector<HTMLElement>('.track');
        if (!track) continue;
        const r = pin.getBoundingClientRect();
        const dist = parseFloat(pin.dataset.dist ?? '0');
        const p = clamp(-r.top / Math.max(1, pin.offsetHeight - vh));
        track.style.setProperty('--hx', `${(-p * dist).toFixed(1)}px`);
        pin.style.setProperty('--hp', p.toFixed(4));
        const cnt = pin.querySelector<HTMLElement>('[data-hcount]');
        const n = pin.querySelectorAll('.hc').length;
        if (cnt) cnt.textContent = String(Math.min(n, Math.floor(p * n) + 1)).padStart(2, '0');
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    layoutPins();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    const onResize = () => {
      layoutPins();
      onScroll();
    };
    window.addEventListener('resize', onResize);
    if (document.fonts?.ready) document.fonts.ready.then(onResize);
    window.addEventListener('load', onResize);
    cleanups.push(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', onResize);
    });

    /* ------------------------------------------------ inertial smooth scroll (mouse / trackpad only) */
    if (!reduce && fine) {
      let target = window.scrollY;
      let pos = target;
      let raf = 0;
      const maxY = () => document.documentElement.scrollHeight - window.innerHeight;
      const tick = () => {
        pos += (target - pos) * 0.1;
        if (Math.abs(target - pos) < 0.5) pos = target;
        window.scrollTo({ top: pos, behavior: 'instant' as ScrollBehavior });
        raf = pos === target ? 0 : requestAnimationFrame(tick);
      };
      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        const t = e.target as HTMLElement;
        if (t.closest?.('dialog[open], .hs')) return; // dialogs and rails scroll natively
        e.preventDefault();
        if (!raf) pos = window.scrollY;
        target = clamp(target + e.deltaY * (e.deltaMode === 1 ? 32 : 1), 0, maxY());
        if (!raf) raf = requestAnimationFrame(tick);
      };
      const sync = () => {
        if (!raf) target = pos = window.scrollY; // keyboard, scrollbar and anchor jumps keep us in step
      };
      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('scroll', sync, { passive: true });
      cleanups.push(() => {
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('scroll', sync);
        cancelAnimationFrame(raf);
      });
    }

    /* ------------------------------------------------ pointer: cursor, spotlight, magnet, tilt */
    if (!reduce && fine) {
      let px = -200,
        py = -200,
        rx = px,
        ry = py,
        raf = 0;
      const loop = () => {
        rx += (px - rx) * 0.16;
        ry += (py - ry) * 0.16;
        if (ring.current) ring.current.style.transform = `translate3d(${rx}px,${ry}px,0)`;
        if (dot.current) dot.current.style.transform = `translate3d(${px}px,${py}px,0)`;
        raf = Math.abs(px - rx) > 0.2 || Math.abs(py - ry) > 0.2 ? requestAnimationFrame(loop) : 0;
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        px = e.clientX;
        py = e.clientY;
        root.style.setProperty('--sx', `${px}px`);
        root.style.setProperty('--sy', `${py}px`);
        root.style.setProperty('--mx', ((px / window.innerWidth - 0.5) * 2).toFixed(3));
        root.style.setProperty('--my', ((py / window.innerHeight - 0.5) * 2).toFixed(3));
        root.classList.add('has-pointer');
        if (!raf) raf = requestAnimationFrame(loop);
      };
      const onOver = (e: PointerEvent) => {
        const t = e.target as HTMLElement;
        const hot = t.closest?.('a, button, [data-cursor]');
        const lab = (t.closest?.('[data-cursor-label]') as HTMLElement | null)?.dataset.cursorLabel ?? '';
        ring.current?.classList.toggle('is-hot', !!hot);
        ring.current?.classList.toggle('has-label', !!lab);
        if (label.current) label.current.textContent = lab;
      };
      const onLeave = () => root.classList.remove('has-pointer');
      document.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerover', onOver, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
      cleanups.push(() => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerover', onOver);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        cancelAnimationFrame(raf);
      });

      document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left - r.width / 2) / r.width;
          const y = (e.clientY - r.top - r.height / 2) / r.height;
          el.style.transform = `translate3d(${(x * 16).toFixed(1)}px,${(y * 14).toFixed(1)}px,0)`;
        };
        const leave = () => (el.style.transform = '');
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', leave);
      });
      document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          el.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
          el.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
        });
        el.addEventListener('pointerleave', () => {
          el.style.setProperty('--ry', '0deg');
          el.style.setProperty('--rx', '0deg');
        });
      });
    }

    /* ------------------------------------------------ marquees that feel the scroll: faster and skewed with velocity */
    if (!reduce) {
      const tracks = Array.from(document.querySelectorAll<HTMLElement>('[data-marquee]')).map((el) => ({
        el,
        o: 0,
        speed: parseFloat(el.dataset.speed ?? '50'),
        dir: parseFloat(el.dataset.dir ?? '1'),
        vis: true,
      }));
      if (tracks.length) {
        root.classList.add('js-marquee');
        const mio = new IntersectionObserver((es) => es.forEach((e) => {
          const t = tracks.find((x) => x.el.parentElement === e.target);
          if (t) t.vis = e.isIntersecting;
        }));
        tracks.forEach((t) => t.el.parentElement && mio.observe(t.el.parentElement));
        let last = performance.now();
        let mraf = 0;
        const mloop = (now: number) => {
          const dt = Math.min(64, now - last);
          last = now;
          vel *= 0.94;
          const boost = Math.min(900, Math.abs(vel) * 38);
          for (const t of tracks) {
            if (!t.vis) continue;
            const w = t.el.scrollWidth / 3;
            t.o = (t.o + ((t.speed + boost) * dt) / 1000) % w;
            const x = t.dir > 0 ? -t.o : t.o - w;
            t.el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${clamp(-vel * 0.5, -12, 12).toFixed(2)}deg)`;
          }
          mraf = requestAnimationFrame(mloop);
        };
        mraf = requestAnimationFrame(mloop);
        cleanups.push(() => {
          cancelAnimationFrame(mraf);
          mio.disconnect();
          root.classList.remove('js-marquee');
        });
      }
    }

    return () => {
      cleanups.forEach((c) => c());
      window.removeEventListener('intro:done', onIntroDone);
      io?.disconnect();
      cio?.disconnect();
    };
  }, []);

  return (
    <>
      <div className="progress" aria-hidden="true">
        <div ref={bar} />
      </div>
      <div className="section-index" ref={idx} aria-hidden="true" />
      <div className="spot" aria-hidden="true" />
      <div className="cursor" aria-hidden="true">
        <div className="c-ring" ref={ring}>
          <span ref={label} />
        </div>
        <div className="c-dot" ref={dot} />
      </div>
    </>
  );
}
