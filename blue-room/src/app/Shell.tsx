import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, JellyArt } from '../components/Icon';
import { Button, IconButton } from '../components/ui';
import { useSettings, useMotion, useFmt } from './settings';
import { useReminders } from './reminders';
import { useMediaQuery } from './hooks';
import { notificationPermission } from '../lib/notify';
import { ambient, soundSupported } from '../lib/sound';
import { formatInstant, relativeDays } from '../lib/dates';
import { newId } from '../data/repo';

export const NAV = [
  { to: '/', label: 'My Room', icon: 'room', end: true },
  { to: '/journal', label: 'Journal', icon: 'journal' },
  { to: '/legacy', label: 'Legacy', icon: 'legacy' },
  { to: '/oracle', label: 'Oracle', icon: 'oracle' },
  { to: '/future', label: 'My Future', icon: 'goal' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/notes', label: 'Notes', icon: 'note' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
] as const;

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="The Blue Room — home">
      <span className="brand-mark"><Icon name="jellyfish" /></span>
      {!compact && <span className="brand-name serif">The Blue Room</span>}
    </Link>
  );
}

function Loader() {
  return <div className="loader" role="status" aria-label="Loading"><JellyArt className="art" /></div>;
}

// ============================================================ quick add

const QUICK = [
  { label: 'Write a journal entry', icon: 'journal', to: () => `/journal/${newId()}` },
  { label: 'Add a memory', icon: 'memory', to: () => '/legacy/memories?new=1' },
  { label: 'Create a goal', icon: 'goal', to: () => '/future?new=1' },
  { label: 'Schedule an event', icon: 'calendar', to: () => '/calendar?new=1' },
  { label: 'Record a decision', icon: 'oracle', to: () => `/oracle/decisions/${newId()}` },
  { label: 'Add a quick note', icon: 'note', to: () => '/notes?new=1' },
];
export const QUICK_ACTIONS = QUICK;

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, close, ref]);
}

function QuickAdd() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  return (
    <div className="pop-wrap" ref={ref}>
      <Button variant="primary" icon="plus" className="quick-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><span className="hide-sm">Add</span></Button>
      {open && (
        <div className="popover" role="menu" aria-label="Quick add">
          {QUICK.map((q) => (
            <button key={q.label} type="button" role="menuitem" className="pop-item" onClick={() => { close(); nav(q.to()); }}><Icon name={q.icon} />{q.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================ sound

export function SoundToggle() {
  const { settings, update } = useSettings();
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState(false);
  if (!soundSupported()) return null;
  const pref = settings.sound.wasOn;
  const toggle = async () => {
    if (playing) { ambient.stop(); setPlaying(false); update((s) => ({ ...s, sound: { ...s.sound, wasOn: false } })); return; }
    try { await ambient.start(settings.sound.volume); setPlaying(true); setErr(false); update((s) => ({ ...s, sound: { ...s.sound, wasOn: true } })); }
    catch { setErr(true); }
  };
  const label = playing ? 'Mute ocean sound' : pref ? 'Resume ocean sound (tap to start)' : 'Play ocean sound';
  return (
    <IconButton icon={playing ? 'sound' : 'soundOff'} label={err ? 'Sound unavailable in this browser' : label} aria-pressed={playing} onClick={toggle} className={playing ? 'sound-on' : ''} />
  );
}

/** Keep the live volume in sync with the setting. */
export function useSoundVolume() {
  const { settings } = useSettings();
  useEffect(() => { ambient.setVolume(settings.sound.volume); }, [settings.sound.volume]);
}

// ============================================================ notification center

function NotificationCenter() {
  const { settings } = useSettings();
  const { due, upcoming, dismiss, snooze, dismissAll, now } = useReminders();
  const fmt = useFmt();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  const perm = notificationPermission();
  const today = fmt.today();
  const count = due.length;

  const browserLine = !settings.reminders.inApp
    ? 'In-app reminders are turned off in Settings.'
    : perm === 'granted' && settings.reminders.browser
      ? 'Browser notifications are on — they appear only while The Blue Room is open in a tab.'
      : perm === 'denied'
        ? 'Browser notifications are blocked in your browser settings. Reminders still appear here.'
        : 'Reminders appear here while The Blue Room is open. Browser notifications are off.';

  return (
    <div className="pop-wrap" ref={ref}>
      <IconButton icon="bell" label={count ? `Notifications, ${count} due` : 'Notifications'} aria-expanded={open} aria-haspopup="dialog" badge={count} onClick={() => setOpen((o) => !o)} />
      {open && (
        <section className="popover notif" role="dialog" aria-label="Reminders">
          <div className="row between notif-head">
            <strong>Reminders</strong>
            {due.length > 1 && <button type="button" className="btn ghost sm" onClick={dismissAll}>Clear all</button>}
          </div>
          <div className="notif-body">
            {due.length === 0 && upcoming.length === 0 && (
              <div className="empty compact"><JellyArt /><p>All calm. Nothing needs you right now.</p></div>
            )}
            {due.length > 0 && <h3 className="notif-h">Now</h3>}
            {due.map((r) => (
              <div className="notif-item" key={r.key}>
                <button type="button" className="notif-main" onClick={() => { close(); nav(r.route); }}>
                  <strong>{r.title}</strong>
                  <span className="small muted">{r.body}</span>
                  <span className="tiny faint">{r.missed ? `Missed — was due ${formatInstant(r.dueAt, settings.timezone, settings.timeFormat, settings.dateFormat, today)}` : formatInstant(r.dueAt, settings.timezone, settings.timeFormat, settings.dateFormat, today)}</span>
                </button>
                <div className="notif-actions">
                  <button type="button" className="btn ghost sm" onClick={() => snooze(r.key, 30)}>Snooze 30m</button>
                  <button type="button" className="btn ghost sm" onClick={() => dismiss(r.key)}>Dismiss</button>
                </div>
              </div>
            ))}
            {upcoming.length > 0 && <h3 className="notif-h">Coming up</h3>}
            {upcoming.slice(0, 6).map((r) => (
              <button type="button" className="notif-item notif-up" key={r.key} onClick={() => { close(); nav(r.route); }}>
                <strong>{r.title}</strong>
                <span className="small muted">{formatInstant(r.dueAt, settings.timezone, settings.timeFormat, settings.dateFormat, today)} · {r.body}</span>
              </button>
            ))}
          </div>
          <div className="notif-foot small muted">
            {browserLine} <Link to="/settings#reminders" onClick={close}>Reminder settings</Link>
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================ shell

export function Shell() {
  const { settings } = useSettings();
  const loc = useLocation();
  const nav = useNavigate();
  const isNarrow = useMediaQuery('(max-width: 899px)');
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('blueroom.nav') === 'collapsed'; } catch { return false; } });
  const [more, setMore] = useState(false);
  const [q, setQ] = useState('');
  const mainRef = useRef<HTMLElement>(null);
  const { reduced } = useMotion();
  useSoundVolume();

  useEffect(() => { try { localStorage.setItem('blueroom.nav', collapsed ? 'collapsed' : 'open'); } catch { /* ignore */ } }, [collapsed]);
  useEffect(() => { setMore(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);
  useEffect(() => {
    // move focus to the page on navigation so keyboard & screen-reader users land in the right place
    const t = setTimeout(() => { if (loc.pathname !== '/' || document.activeElement === document.body) mainRef.current?.focus({ preventScroll: true }); }, 30);
    return () => clearTimeout(t);
  }, [loc.pathname]);

  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) { nav(`/search?q=${encodeURIComponent(q.trim())}`); } };
  const isRoom = loc.pathname === '/';

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''} ${isRoom ? 'is-room' : ''}`}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
      <Ambient reduced={reduced} />

      {!isNarrow && (
        <nav className="sidebar" aria-label="Main">
          <div className="sidebar-top"><Brand compact={collapsed} /></div>
          <ul className="nav-list">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={'end' in n ? n.end : false} className="nav-link" title={collapsed ? n.label : undefined}>
                  <Icon name={n.icon} /><span className="nav-label">{n.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <button type="button" className="nav-collapse" aria-pressed={collapsed} onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
            <Icon name={collapsed ? 'chevR' : 'chevL'} /><span className="nav-label">Collapse</span>
          </button>
        </nav>
      )}

      <div className="shell-main">
        <header className="topbar">
          {isNarrow && <Brand compact />}
          <form className="topsearch" role="search" onSubmit={submitSearch}>
            <Icon name="search" />
            <input type="search" aria-label="Search everything" placeholder="Search your Blue Room…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="grow" />
          <QuickAdd />
          <SoundToggle />
          <NotificationCenter />
        </header>
        <main id="main" ref={mainRef} tabIndex={-1} className="main">
          <Suspense fallback={<Loader />}><Outlet /></Suspense>
        </main>
      </div>

      {isNarrow && (
        <nav className="bottomnav" aria-label="Main">
          {NAV.filter((n) => ['/', '/journal', '/calendar', '/future'].includes(n.to)).map((n) => (
            <NavLink key={n.to} to={n.to} end={'end' in n ? n.end : false} className="bn-link"><Icon name={n.icon} /><span>{n.label.replace('My ', '')}</span></NavLink>
          ))}
          <button type="button" className={`bn-link ${more ? 'open' : ''}`} aria-expanded={more} onClick={() => setMore((m) => !m)}><Icon name="more" /><span>More</span></button>
          {more && (
            <div className="bn-more" role="menu">
              {NAV.filter((n) => !['/', '/journal', '/calendar', '/future'].includes(n.to)).map((n) => (
                <NavLink key={n.to} to={n.to} role="menuitem" className="pop-item" onClick={() => setMore(false)}><Icon name={n.icon} />{n.label}</NavLink>
              ))}
            </div>
          )}
        </nav>
      )}
    </div>
  );
}

/** A quiet CSS-only sea behind the pages: slow light and a few drifting bubbles. */
function Ambient({ reduced }: { reduced: boolean }) {
  return (
    <div className="ambient" aria-hidden="true">
      <span className="ambient-ray r1" /><span className="ambient-ray r2" />
      {!reduced && [0, 1, 2, 3, 4, 5].map((i) => <i key={i} className={`ambient-bubble b${i}`} />)}
    </div>
  );
}

export type { ReactNode };
