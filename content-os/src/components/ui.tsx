import { cloneElement, forwardRef, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ------------------------------------------------------------------ buttons
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-card',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-hover shadow-card',
  ghost: 'text-ink-2 hover:text-ink hover:bg-hover',
  subtle: 'bg-hover text-ink hover:bg-active',
  danger: 'bg-blocked text-white hover:opacity-90',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[background,color,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'h-7 px-2.5 text-ui-sm' : 'h-8 px-3 text-ui',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-hover hover:text-ink transition-colors', className)} {...rest}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ form fields
const fieldBase = 'rounded-md border border-line-strong bg-surface px-2.5 text-ui text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

/** Full width unless the caller sets its own width. */
const width = (className?: string) => (className && /(^|\s)(w-|flex-1|min-w-)/.test(className) ? '' : 'w-full');

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, width(className), 'h-8', className)} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(fieldBase, width(className), 'py-2 leading-relaxed', className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(fieldBase, width(className), 'h-8 pr-7 cursor-pointer', className)} {...rest}>
      {children}
    </select>
  );
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  const auto = useId();
  const hintId = `${auto}-hint`;
  // Single form controls get an explicit id so the label is their exact accessible name.
  const el = isValidElement(children) && typeof children.type !== 'string' || (isValidElement(children) && ['input', 'select', 'textarea'].includes(children.type as string)) ? (children as ReactElement<Record<string, unknown>>) : null;
  const id = (el?.props.id as string | undefined) ?? auto;
  const control = el ? cloneElement(el, { id, 'aria-describedby': hint || error ? hintId : undefined, 'aria-invalid': error ? true : el.props['aria-invalid'] }) : children;
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {el ? (
        <label htmlFor={id} className="text-ui-sm font-medium text-ink-2">
          {label}
        </label>
      ) : (
        <span className="text-ui-sm font-medium text-ink-2">{label}</span>
      )}
      {control}
      {error ? (
        <span id={hintId} className="text-caption text-blocked-text">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="text-caption text-ink-3">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ display
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface-2 px-1 font-sans text-[11px] font-medium text-ink-3">{children}</kbd>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-4 animate-spin text-ink-3', className)} aria-label="Loading" />;
}

export function Panel({ title, action, children, className, bodyClass, id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string }) {
  return (
    <section id={id} className={cx('min-w-0 rounded-lg border border-line bg-surface shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <h2 className="text-ui font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className={cx(title || action ? 'px-4 pb-4' : 'p-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function Empty({ icon, title, children, action, compact }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'py-6' : 'py-14')}>
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <p className="text-ui font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-ui-sm text-ink-3 text-pretty">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-blocked/30 bg-blocked-bg px-4 py-3 text-ui text-blocked-text">
      <p className="font-medium">{(error as Error)?.message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <button className="mt-1 underline underline-offset-2" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-hover', className)} />;
}

export function PageHeader({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-heading font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-ui text-ink-2 text-pretty">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number | null }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('flex gap-0.5 overflow-x-auto scroll-thin border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            '-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-ui transition-colors',
            value === t.value ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-3 hover:text-ink',
          )}
        >
          {t.label}
          {t.count !== undefined && t.count !== null && <span className="tabular text-caption text-ink-3">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ overlays
export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => {
      const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button:not([data-close])');
      first?.focus();
    });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-[10vh] backdrop-blur-[1px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className={cx('animate-pop w-full rounded-xl border border-line bg-surface shadow-pop', width)}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-title font-semibold">{title}</h2>
          <IconButton label="Close" data-close onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-4 scroll-thin">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** Lightweight anchored popover/menu. Closes on outside click and Escape. */
export function Popover({ trigger, children, align = 'start', className }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'start' | 'end'; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={cx('animate-pop absolute z-40 mt-1 min-w-48 rounded-lg border border-line bg-surface p-1 shadow-pop', align === 'end' ? 'right-0' : 'left-0', className)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick, icon, danger, active, disabled }: { children: ReactNode; onClick: () => void; icon?: ReactNode; danger?: boolean; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui transition-colors disabled:opacity-40',
        danger ? 'text-blocked-text hover:bg-blocked-bg' : 'text-ink hover:bg-hover',
        active && 'bg-hover font-medium',
      )}
    >
      {icon && <span className="text-ink-3 [&>svg]:size-3.5">{icon}</span>}
      {children}
    </button>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: ReactNode; confirm: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);
  const ask = (title: string, body: ReactNode, confirm = 'Confirm', danger = true) => new Promise<boolean>((resolve) => setState({ title, body, confirm, danger, resolve }));
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const node = (
    <Modal
      open={!!state}
      onClose={() => close(false)}
      title={state?.title}
      width="max-w-md"
      footer={
        <>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
            {state?.confirm}
          </Button>
        </>
      }
    >
      <div className="text-ui text-ink-2">{state?.body}</div>
    </Modal>
  );
  return { ask, node };
}
