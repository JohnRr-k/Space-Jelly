import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadSettings, saveSettings } from '../data/repo';
import { defaultSettings } from '../data/db';
import type { Settings } from '../data/types';
import { formatDate, formatTime, todayIn, type DateFormat } from '../lib/dates';

interface Ctx {
  settings: Settings;
  update: (fn: ((s: Settings) => Settings) | Partial<Settings>) => void;
}
const SettingsCtx = createContext<Ctx>({ settings: defaultSettings(), update: () => {} });
export const useSettings = () => useContext(SettingsCtx);

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const ref = useRef<Settings | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then((s) => { ref.current = s; setSettings(s); }).catch((e) => setFailed(String(e?.message ?? e)));
  }, []);

  const update = useCallback<Ctx['update']>((fn) => {
    const cur = ref.current;
    if (!cur) return;
    const next = typeof fn === 'function' ? fn(cur) : { ...cur, ...fn };
    ref.current = next;
    setSettings(next);
    saveSettings(next).catch(() => {});
  }, []);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    try {
      localStorage.setItem('blueroom.theme', settings.theme);
      localStorage.setItem('blueroom.motion', settings.motion);
    } catch { /* storage may be unavailable */ }
    if (settings.motion === 'off') root.dataset.motion = 'off'; else delete root.dataset.motion;
  }, [settings?.theme, settings?.motion]);

  const value = useMemo(() => (settings ? { settings, update } : null), [settings, update]);

  if (failed) {
    return (
      <div style={{ padding: 32, maxWidth: 560, margin: '10vh auto', fontFamily: 'var(--font-sans)' }}>
        <h1>The Blue Room can’t open its storage</h1>
        <p>Your browser blocked local database access (this happens in some private-browsing modes). Open the app in a regular window and nothing will be lost.</p>
        <p className="faint">{failed}</p>
      </div>
    );
  }
  if (!value) return <div className="boot" aria-busy="true" />;
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

/** Motion state: true when decorative animation should be minimal/off. */
export function useMotion() {
  const { settings } = useSettings();
  const [prefersReduced, setPrefersReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(REDUCED_QUERY).matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const m = matchMedia(REDUCED_QUERY);
    const on = () => setPrefersReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const reduced = prefersReduced || settings.motion === 'off';
  return { reduced, level: reduced ? ('off' as const) : settings.motion, prefersReduced };
}

/** Date/time formatting bound to the owner's preferences. */
export function useFmt() {
  const { settings: s } = useSettings();
  return useMemo(() => {
    const df: DateFormat = s.dateFormat;
    return {
      tz: s.timezone,
      date: (d?: string, o?: { weekday?: boolean; short?: boolean; year?: boolean }) => formatDate(d, df, o),
      time: (t?: string) => formatTime(t, s.timeFormat),
      today: () => todayIn(s.timezone),
      df,
      tf: s.timeFormat,
    };
  }, [s.dateFormat, s.timeFormat, s.timezone]);
}
