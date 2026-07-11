import type { ReactNode } from "react";

interface CardProps {
  /** Small-caps section label, e.g. "MORNING PROTOCOL". */
  label?: string;
  /** Right-aligned header detail, e.g. "6/8". */
  meta?: ReactNode;
  metaComplete?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({
  label,
  meta,
  metaComplete = false,
  className,
  children,
}: CardProps) {
  return (
    <section className={className ? `card ${className}` : "card"}>
      {(label || meta) && (
        <header className="card-header">
          {label && <h2 className="smallcaps">{label}</h2>}
          {meta !== undefined && (
            <span className={metaComplete ? "card-meta is-complete" : "card-meta"}>
              {meta}
            </span>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
