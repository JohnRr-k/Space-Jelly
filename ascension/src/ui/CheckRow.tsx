interface CheckRowProps {
  title: string;
  detail?: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * The core interaction of ASCENSION: one full-width tap, one quiet
 * animation, one step closer. No checkbox squares — a filled gold circle.
 */
export function CheckRow({
  title,
  detail,
  checked,
  disabled = false,
  onToggle,
}: CheckRowProps) {
  return (
    <button
      type="button"
      className={checked ? "checkrow is-done" : "checkrow"}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="checkrow-box" aria-hidden="true">
        <svg viewBox="0 0 12 12">
          <path d="M2 6.2 L4.8 9 L10 3.4" />
        </svg>
      </span>
      <span className="checkrow-text">
        <span className="checkrow-title">{title}</span>
        {detail && <span className="checkrow-detail">{detail}</span>}
      </span>
    </button>
  );
}
