import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Ocean, type OceanVariant } from './ocean';
import { useMotion } from '../app/settings';

export interface OceanHandle { setLight: (v: number) => void }

/** Draws the living ocean into a canvas that fills its (positioned) parent box.
 *  Pauses when off-screen or when the tab is hidden; renders a single still frame when motion is off. */
export const OceanCanvas = forwardRef<OceanHandle, {
  variant: OceanVariant; className?: string; style?: React.CSSProperties; interactive?: boolean; pointerTarget?: React.RefObject<HTMLElement | null>; density?: number; sharkEvery?: number; initialLight?: number;
}>(function OceanCanvas({ variant, className, style, pointerTarget, density, sharkEvery, initialLight }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const oceanRef = useRef<Ocean | null>(null);
  const { reduced, level } = useMotion();

  useImperativeHandle(ref, () => ({ setLight: (v: number) => { if (oceanRef.current) { oceanRef.current.lightLevel = v; if (reduced) oceanRef.current.draw(); } } }), [reduced]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ocean = new Ocean(canvas, { variant, motion: reduced ? 'off' : level === 'gentle' ? 'gentle' : 'full', density, sharkEvery });
    if (initialLight !== undefined) ocean.lightLevel = initialLight;
    oceanRef.current = ocean;
    const fit = () => { const r = canvas.getBoundingClientRect(); ocean.resize(r.width, r.height); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(canvas);

    let visible = true, inView = true;
    const sync = () => { if (visible && inView && !reduced) ocean.start(); else ocean.stop(); };
    const io = new IntersectionObserver((es) => { inView = es.some((e) => e.isIntersecting); sync(); });
    io.observe(canvas);
    const vis = () => { visible = document.visibilityState === 'visible'; sync(); };
    document.addEventListener('visibilitychange', vis);
    sync();

    const target = pointerTarget?.current ?? canvas.parentElement;
    const move = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); ocean.setPointer((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
    const leave = () => ocean.setPointer(null);
    if (!reduced && target) { target.addEventListener('pointermove', move as any); target.addEventListener('pointerleave', leave); }

    return () => {
      ocean.destroy(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis);
      if (target) { target.removeEventListener('pointermove', move as any); target.removeEventListener('pointerleave', leave); }
      oceanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, reduced, level, density, sharkEvery]);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden="true" />;
});
