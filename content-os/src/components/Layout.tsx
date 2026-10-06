import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarCheck, Columns3, FilePlus2, Folder, Gauge, Layers, Lightbulb, ListVideo, Menu, Moon, RotateCcw, Search, Settings, Sun, Activity, Archive, X } from 'lucide-react';
import { api } from '../lib/api';
import { useLocalState, useMeta } from '../lib/hooks';
import { CommandPalette } from './CommandPalette';
import { NewEpisodeDialog, QuickIdeaDialog, type NewEpisodeDefaults } from './dialogs';
import { cx, Kbd } from './ui';
import { ProjectDot } from './status';

interface GlobalUI {
  openPalette: () => void;
  newEpisode: (d?: NewEpisodeDefaults) => void;
  newIdea: (d?: { projectId?: number | null; sourceId?: number | null }) => void;
}
const GlobalCtx = createContext<GlobalUI | null>(null);
export const useGlobalUI = () => useContext(GlobalCtx)!;

const NAV: { section: string; items: { to: string; label: string; icon: typeof Gauge; key?: string; badge?: 'today' | 'ideas' | 'blocked' }[] }[] = [
  {
    section: 'Command',
    items: [
      { to: '/', label: 'Dashboard', icon: Gauge, key: 'D' },
      { to: '/today', label: 'Today', icon: CalendarCheck, key: 'T', badge: 'today' },
    ],
  },
  {
    section: 'Production',
    items: [
      { to: '/episodes', label: 'Episodes', icon: ListVideo, key: 'E' },
      { to: '/board', label: 'Board', icon: Columns3, key: 'B' },
      { to: '/projects', label: 'Projects', icon: Folder, key: 'P' },
      { to: '/series', label: 'Series', icon: Layers },
    ],
  },
  {
    section: 'Content brain',
    items: [
      { to: '/ideas', label: 'Ideas', icon: Lightbulb, key: 'I', badge: 'ideas' },
      { to: '/sources', label: 'Sources', icon: BookOpen, key: 'S' },
      { to: '/resurface', label: 'Resurface', icon: RotateCcw, key: 'R' },
    ],
  },
  {
    section: 'System',
    items: [
      { to: '/activity', label: 'Activity', icon: Activity },
      { to: '/archive', label: 'Archive & trash', icon: Archive },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const GOTO: Record<string, string> = { d: '/', t: '/today', e: '/episodes', b: '/board', p: '/projects', i: '/ideas', s: '/sources', r: '/resurface' };

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

export function Layout() {
  const [palette, setPalette] = useState(false);
  const [episodeDlg, setEpisodeDlg] = useState<NewEpisodeDefaults | null>(null);
  const [ideaDlg, setIdeaDlg] = useState<{ projectId?: number | null; sourceId?: number | null } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const pendingG = useRef(false);

  useEffect(() => setMobileNav(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (pendingG.current) {
        pendingG.current = false;
        if (GOTO[k]) {
          e.preventDefault();
          navigate(GOTO[k]);
        }
        return;
      }
      if (k === 'g') {
        pendingG.current = true;
        setTimeout(() => (pendingG.current = false), 900);
      } else if (k === 'n') {
        e.preventDefault();
        setEpisodeDlg({});
      } else if (k === 'i') {
        e.preventDefault();
        setIdeaDlg({});
      } else if (k === '/') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const ui: GlobalUI = {
    openPalette: () => setPalette(true),
    newEpisode: (d = {}) => setEpisodeDlg(d),
    newIdea: (d = {}) => setIdeaDlg(d),
  };

  return (
    <GlobalCtx.Provider value={ui}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <aside className={cx('fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-line bg-sunken transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0', mobileNav ? 'translate-x-0' : '-translate-x-full')}>
          <Sidebar onClose={() => setMobileNav(false)} />
        </aside>
        {mobileNav && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileNav(false)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur sm:px-5">
            <button className="rounded-md p-1.5 text-ink-2 hover:bg-hover lg:hidden" aria-label="Open navigation" onClick={() => setMobileNav(true)}>
              <Menu className="size-4" />
            </button>
            <button
              onClick={() => setPalette(true)}
              className="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-line-strong bg-surface px-2.5 text-ui text-ink-3 shadow-card transition-colors hover:border-ink-3/40 hover:text-ink-2"
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left">Search episodes, ideas, sources…</span>
              <span className="hidden items-center gap-0.5 sm:inline-flex">
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setIdeaDlg({})} className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-ui text-ink-2 hover:bg-hover hover:text-ink sm:inline-flex" title="Capture idea (I)">
                <Lightbulb className="size-3.5" /> Idea
              </button>
              <button onClick={() => setEpisodeDlg({})} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-ui font-medium text-accent-fg shadow-card hover:bg-accent-hover" title="New episode (N)">
                <FilePlus2 className="size-3.5" /> <span className="hidden sm:inline">Episode</span>
              </button>
            </div>
          </header>
          <main id="main" className="min-w-0 flex-1 px-3 py-5 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNewEpisode={() => setEpisodeDlg({})} onNewIdea={() => setIdeaDlg({})} />
      <NewEpisodeDialog open={!!episodeDlg} defaults={episodeDlg ?? {}} onClose={() => setEpisodeDlg(null)} />
      <QuickIdeaDialog open={!!ideaDlg} defaults={ideaDlg ?? {}} onClose={() => setIdeaDlg(null)} />
    </GlobalCtx.Provider>
  );
}

function Sidebar({ onClose }: { onClose: () => void }) {
  const meta = useMeta();
  const [theme, setTheme] = useLocalState<'light' | 'dark' | 'system'>('theme', 'system');
  const badges = useQuery({
    queryKey: ['nav-badges'],
    queryFn: () => api.get<{ today: { remaining: number }; ideas: { inbox: number }; counts: { blocked: number } }>('/dashboard'),
    staleTime: 20_000,
    select: (d) => ({ today: d.today.remaining, ideas: d.ideas.inbox, blocked: d.counts.blocked }),
  });
  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, [theme]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2 px-4">
        <span className="grid size-6 place-items-center rounded-md bg-ink text-surface" aria-hidden>
          <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
            <rect x="1" y="9" width="3.4" height="6" rx="0.8" />
            <rect x="6.3" y="5" width="3.4" height="10" rx="0.8" />
            <rect x="11.6" y="1" width="3.4" height="14" rx="0.8" />
          </svg>
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-ui font-semibold text-ink">Content OS</div>
          <div className="text-caption text-ink-3">Grow Mindset</div>
        </div>
        <button className="ml-auto rounded p-1 text-ink-3 hover:bg-hover lg:hidden" aria-label="Close navigation" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3 scroll-thin" aria-label="Main">
        {NAV.map((g) => (
          <div key={g.section} className="mt-3">
            <div className="px-2 pb-1 text-caption text-ink-3">{g.section}</div>
            {g.items.map((it) => {
              const b = it.badge && badges.data ? badges.data[it.badge] : 0;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === '/'}
                  className={({ isActive }) =>
                    cx('group flex h-8 items-center gap-2.5 rounded-md px-2 text-ui transition-colors', isActive ? 'bg-surface font-medium text-ink shadow-card' : 'text-ink-2 hover:bg-hover hover:text-ink')
                  }
                >
                  <it.icon className="size-4 shrink-0 text-ink-3 group-aria-[current=page]:text-accent-text" />
                  <span className="flex-1">{it.label}</span>
                  {b ? <span className="tabular rounded bg-hover px-1.5 text-caption text-ink-2">{b}</span> : it.key ? <span className="hidden text-caption text-ink-3/70 group-hover:inline">G {it.key}</span> : null}
                </NavLink>
              );
            })}
          </div>
        ))}
        <div className="mt-4">
          <div className="px-2 pb-1 text-caption text-ink-3">Projects</div>
          {meta.data?.projects
            .filter((p) => !p.archivedAt)
            .map((p) => (
              <NavLink key={p.id} to={`/projects/${p.id}`} className={({ isActive }) => cx('flex h-7 items-center gap-2.5 rounded-md px-2 text-ui-sm', isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:bg-hover hover:text-ink')}>
                <ProjectDot color={p.color} />
                <span className="truncate">{p.name}</span>
              </NavLink>
            ))}
        </div>
      </nav>
      <div className="flex items-center gap-1 border-t border-line px-3 py-2">
        <span className="text-caption text-ink-3">Theme</span>
        <div className="ml-auto flex rounded-md bg-hover p-0.5">
          {(['light', 'system', 'dark'] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)} className={cx('rounded px-1.5 py-0.5 text-caption', theme === t ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink')} aria-pressed={theme === t}>
              {t === 'light' ? <Sun className="size-3.5" aria-label="Light" /> : t === 'dark' ? <Moon className="size-3.5" aria-label="Dark" /> : 'Auto'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1400px]">{children}</div>;
}
