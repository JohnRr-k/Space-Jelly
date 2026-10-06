import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { cx } from './ui';

type Tone = 'success' | 'warning' | 'error' | 'info';
interface Toast {
  id: number;
  tone: Tone;
  message: ReactNode;
  detail?: ReactNode;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (t: Omit<Toast, 'id'>, ms?: number) => void;
  success: (message: ReactNode, opts?: Partial<Omit<Toast, 'id' | 'message' | 'tone'>>) => void;
  error: (err: unknown) => void;
  warn: (message: ReactNode, detail?: ReactNode) => void;
}

const Ctx = createContext<ToastApi | null>(null);
export const useToast = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('ToastProvider missing');
  return c;
};

const ICON: Record<Tone, ReactNode> = {
  success: <CheckCircle2 className="size-4 text-done" />,
  warning: <AlertTriangle className="size-4 text-progress" />,
  error: <XCircle className="size-4 text-blocked" />,
  info: <CheckCircle2 className="size-4 text-ink-3" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (t: Omit<Toast, 'id'>, ms = t.action ? 8000 : t.tone === 'error' ? 7000 : 3500) => {
      const id = ++seq.current;
      setToasts((list) => [...list.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );
  const api: ToastApi = {
    show,
    success: (message, opts) => show({ tone: 'success', message, ...opts }),
    error: (err) => show({ tone: 'error', message: (err as Error)?.message ?? String(err) }),
    warn: (message, detail) => show({ tone: 'warning', message, detail }),
  };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cx('animate-pop pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-pop')}>
            <span className="mt-0.5 shrink-0">{ICON[t.tone]}</span>
            <div className="min-w-0 flex-1 text-ui">
              <div className="text-ink">{t.message}</div>
              {t.detail && <div className="mt-0.5 text-ui-sm text-ink-3">{t.detail}</div>}
            </div>
            {t.action && (
              <button
                className="shrink-0 rounded px-1.5 py-0.5 text-ui font-medium text-accent-text hover:bg-accent-subtle"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="shrink-0 text-ink-3 hover:text-ink" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
