import { useEffect } from "react";
import type { ReactNode } from "react";

interface SheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet used for the rituals that deserve a dedicated moment. */
export function Sheet({ open, title, subtitle, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grab" aria-hidden="true" />
        <h2 className="sheet-title">{title}</h2>
        {subtitle && <p className="sheet-sub">{subtitle}</p>}
        {children}
      </div>
    </>
  );
}
