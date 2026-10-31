import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode,
} from 'react';
import { Icon, JellyArt } from './Icon';

// ---------------------------------------------------------------- Buttons

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' | 'default'; size?: 'sm' | 'md' | 'lg'; icon?: string; solid?: boolean };
export function Button({ variant = 'default', size = 'md', icon, solid, className = '', children, type = 'button', ...rest }: BtnProps) {
  const cls = ['btn', variant !== 'default' ? variant : '', size !== 'md' ? size : '', solid ? 'solid' : '', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, size, bordered, className = '', badge, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; size?: 'sm'; bordered?: boolean; badge?: number }) {
  return (
    <button type="button" aria-label={label} title={label} className={['icon-btn', size ?? '', bordered ? 'bordered' : '', className].join(' ')} {...rest}>
      <Icon name={icon} />
      {badge ? <span className="badge-dot" aria-hidden="true">{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  );
}

// ---------------------------------------------------------------- Fields

export function Field({ label, hint, error, required, children, htmlFor, className = '' }: { label: string; hint?: string; error?: string; required?: boolean; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={htmlFor}>
        <span>{label}{required && <span className="req" aria-hidden="true"> *</span>}</span>
        {hint && <span className="hint">{hint}</span>}
      </label>
      {children}
      {error && <div className="err" role="alert">{error}</div>}
    </div>
  );
}

/** Convenience: a labelled text input with generated id. */
export function TextField({ label, value, onChange, hint, error, required, placeholder, type = 'text', multiline, rows, autoFocus, maxLength, className, min, max, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string; required?: boolean; placeholder?: string;
  type?: string; multiline?: boolean; rows?: number; autoFocus?: boolean; maxLength?: number; className?: string; min?: string; max?: string; inputMode?: 'text' | 'numeric';
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      {multiline ? (
        <textarea id={id} className="textarea" rows={rows ?? 4} value={value} placeholder={placeholder} autoFocus={autoFocus} maxLength={maxLength} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="input" type={type} value={value} placeholder={placeholder} autoFocus={autoFocus} maxLength={maxLength} min={min} max={max} inputMode={inputMode} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export function SelectField({ label, value, onChange, options, hint, className, allowEmpty, emptyLabel }: { label: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; hint?: string; className?: string; allowEmpty?: boolean; emptyLabel?: string }) {
  const id = useId();
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const has = !value || opts.some((o) => o.value === value);
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">{emptyLabel ?? '—'}</option>}
        {!has && <option value={value}>{value}</option>}
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Switch({ checked, onChange, label, describedBy }: { checked: boolean; onChange: (v: boolean) => void; label: string; describedBy?: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} aria-describedby={describedBy} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function TagInput({ label = 'Tags', value, onChange, suggestions = [], hint }: { label?: string; value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; hint?: string }) {
  const [draft, setDraft] = useState('');
  const id = useId();
  const listId = id + '-list';
  const add = (raw: string) => {
    const t = raw.trim().replace(/^#/, '').replace(/\s+/g, ' ').slice(0, 32);
    if (!t) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) { setDraft(''); return; } // duplicate prevention
    onChange([...value, t]);
    setDraft('');
  };
  return (
    <Field label={label} hint={hint ?? 'Press Enter or comma to add'} htmlFor={id}>
      <div className="taginput">
        {value.map((t) => (
          <span key={t} className="chip">#{t}
            <button type="button" className="x" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((v) => v !== t))}><Icon name="x" /></button>
          </span>
        ))}
        <input
          id={id} list={listId} value={draft} placeholder={value.length ? '' : 'Add a tag…'}
          onChange={(e) => { const v = e.target.value; if (v.endsWith(',')) add(v.slice(0, -1)); else setDraft(v); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(draft); }
            else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
        />
        <datalist id={listId}>{suggestions.filter((s) => !value.includes(s)).slice(0, 40).map((s) => <option key={s} value={s} />)}</datalist>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- Modal (native <dialog>: focus trap, Esc, inert background)

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', dismissible = true, labelledBy, className = '' }: {
  className?: string; open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg'; dismissible?: boolean; labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => { e.preventDefault(); if (dismissible) closeRef.current(); };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [dismissible]);

  if (!open) return <dialog ref={ref} className="modal" aria-hidden="true" />;
  const cls = `modal ${size === 'lg' ? 'wide' : size === 'sm' ? 'narrow' : ''} ${className}`;
  return (
    <dialog
      ref={ref} className={cls} aria-labelledby={labelledBy ?? titleId}
      onMouseDown={(e) => { if (dismissible && e.target === ref.current) closeRef.current(); }}
    >
      <div className="modal-panel">
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="sub">{subtitle}</p>}
          </div>
          {dismissible && <IconButton icon="x" label="Close" onClick={onClose} />}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------- Confirm

interface ConfirmOpts { title: string; body?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: 'danger' | 'default'; requireText?: string }
type ConfirmFn = (o: ConfirmOpts) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);
  const [typed, setTyped] = useState('');
  const confirm = useCallback<ConfirmFn>((opts) => new Promise((resolve) => { setTyped(''); setState({ opts, resolve }); }), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  const o = state?.opts;
  const blocked = !!o?.requireText && typed.trim() !== o.requireText;
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state} onClose={() => close(false)} title={o?.title ?? ''} size="sm"
        footer={<>
          <Button onClick={() => close(false)}>{o?.cancelLabel ?? 'Cancel'}</Button>
          <Button variant={o?.tone === 'danger' ? 'danger' : 'primary'} solid={o?.tone === 'danger'} disabled={blocked} onClick={() => close(true)}>{o?.confirmLabel ?? 'Confirm'}</Button>
        </>}
      >
        <div className="stack">
          {o?.body && <div className="muted">{o.body}</div>}
          {o?.requireText && (
            <TextField label={`Type “${o.requireText}” to continue`} value={typed} onChange={setTyped} />
          )}
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

// ---------------------------------------------------------------- Toasts

interface Toast { id: number; msg: string; tone: 'ok' | 'error'; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(msg: string, opts?: { tone?: 'ok' | 'error'; action?: Toast['action'] }) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const push = useCallback((msg: string, opts: { tone?: 'ok' | 'error'; action?: Toast['action'] } = {}) => {
    const id = idRef.current++;
    setList((l) => [...l.slice(-2), { id, msg, tone: opts.tone ?? 'ok', action: opts.action }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), opts.action ? 7000 : 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`}>
            <span>{t.msg}</span>
            {t.action && <button type="button" onClick={() => { t.action!.run(); setList((l) => l.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------- Bits

export function EmptyState({ title, body, action, compact, art = true }: { title: string; body?: string; action?: ReactNode; compact?: boolean; art?: boolean }) {
  return (
    <div className={`empty ${compact ? 'compact' : ''}`}>
      {art && <JellyArt />}
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function ProgressBar({ value, label, thin }: { value: number; label?: string; thin?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`progress ${thin ? 'thin' : ''}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, actions, icon }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode; icon?: string }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{icon && <Icon name={icon} size={15} />}{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </header>
  );
}

export function Chips({ items, onRemove }: { items: string[]; onRemove?: (v: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="chips">
      {items.map((t) => (
        <span className="chip plain" key={t}>#{t}
          {onRemove && <button type="button" className="x" aria-label={`Remove ${t}`} onClick={() => onRemove(t)}><Icon name="x" /></button>}
        </span>
      ))}
    </div>
  );
}

/** Reveal-on-scroll wrapper. Variants give each section its own entrance (no-ops under reduced motion via CSS). */
export type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'clip';
export function Reveal({ children, className = '', as: Tag = 'div', delay = 0, variant = 'up', style }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'li'; delay?: number; variant?: RevealVariant; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as any} className={`reveal rv-${variant} ${seen ? 'in' : ''} ${className}`} style={{ ...(delay ? { transitionDelay: `${delay}ms` } : {}), ...style }}>{children}</Tag>;
}

/** Writes a 0→1 `--p` CSS variable on the element as it scrolls through the viewport (for parallax and line-drawing). */
export function useScrollVar<T extends HTMLElement>(disabled = false) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (disabled) { el.style.setProperty('--p', '0.5'); return; }
    let raf = 0;
    const calc = () => {
      raf = 0;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      el.style.setProperty('--p', p.toFixed(4));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(calc); };
    calc();
    window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
  }, [disabled]);
  return ref;
}

/** Prevents double-submits: wraps an async handler and exposes a busy flag. */
export function useOnce<A extends any[]>(fn: (...a: A) => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = useCallback(async (...a: A) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(...a); } finally { lock.current = false; setBusy(false); }
  }, [fn]);
  return [run, busy] as const;
}

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export const useMemoList = useMemo;
