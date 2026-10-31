import { useEffect, useRef } from 'react';
import { OceanCanvas } from './OceanCanvas';
import { Icon } from '../components/Icon';
import { SoundToggle } from '../app/Shell';

/** A full-screen, optional, purely decorative ocean. Esc or the button returns to the room. */
export function DiveOverlay({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const prev = useRef<Element | null>(null);

  useEffect(() => {
    prev.current = document.activeElement;
    closeBtn.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') { // keep focus inside the overlay
        const f = ref.current?.querySelectorAll<HTMLElement>('button'); if (!f?.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; (prev.current as HTMLElement | null)?.focus?.(); };
  }, [onClose]);

  return (
    <div className="dive" role="dialog" aria-modal="true" aria-label="Immersive ocean" ref={ref}>
      <OceanCanvas variant="immersive" className="dive-canvas" />
      <div className="dive-ui">
        <p className="dive-hint">Move your cursor through the school. There’s nothing to do here but breathe.</p>
        <div className="row">
          <SoundToggle />
          <button ref={closeBtn} type="button" className="btn dive-close" onClick={onClose}><Icon name="x" />Back to the room</button>
        </div>
      </div>
    </div>
  );
}
