'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Accessible modal on the native <dialog> element: focus trap, Esc to close,
 * inert background and focus return come from the platform. Clicking the backdrop closes it.
 */
export default function Modal({
  open,
  onClose,
  labelledBy,
  className = '',
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}
