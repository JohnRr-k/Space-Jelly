'use client';

import { useEffect, useRef } from 'react';

/**
 * A quiet network of nodes and hairlines that drifts on its own, brightens and parts around the cursor.
 * Pauses off-screen, thins out on small screens, and is not rendered under reduced motion.
 */
export default function Constellation({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const host = canvas.parentElement as HTMLElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    type N = { x: number; y: number; vx: number; vy: number; r: number };
    let w = 0,
      h = 0,
      nodes: N[] = [],
      raf = 0,
      visible = false,
      mx = -9999,
      my = -9999;

    const resize = () => {
      const r = host.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(95, (w * h) / 20000) * density * (w < 700 ? 0.55 : 1));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.6 + 0.9,
      }));
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const a of nodes) {
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;
        const dx = a.x - mx,
          dy = a.y - my,
          d = Math.hypot(dx, dy);
        if (d < 170 && d > 0.1) {
          a.x += (dx / d) * (170 - d) * 0.014;
          a.y += (dy / d) * (170 - d) * 0.014;
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 135) {
            const near = Math.max(0, 1 - Math.hypot((a.x + b.x) / 2 - mx, (a.y + b.y) / 2 - my) / 280);
            ctx.strokeStyle = `rgba(212,118,138,${(1 - d / 135) * (0.1 + near * 0.55)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const glow = Math.max(0, 1 - Math.hypot(a.x - mx, a.y - my) / 220);
        ctx.fillStyle = `rgba(244,241,236,${0.22 + glow * 0.7})`;
        const s = a.r + glow * 2.2;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
      raf = visible ? requestAnimationFrame(frame) : 0;
    };

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(frame);
      },
      { rootMargin: '100px' },
    );
    io.observe(host);
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    };
    const onLeave = () => {
      mx = my = -9999;
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [density]);

  return <canvas ref={ref} className="fx-canvas" aria-hidden="true" />;
}
