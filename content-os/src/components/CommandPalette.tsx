import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Columns3,
  FilePlus2,
  Folder,
  Gauge,
  Lightbulb,
  Layers,
  ListVideo,
  Quote,
  Radio,
  Search,
  Shuffle,
  Sparkles,
  User,
  Paperclip,
  RotateCcw,
  Copy,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import type { EpisodeListItem } from '../lib/types';
import { cx, Kbd, Spinner } from './ui';
import { PhaseBadge } from './status';
import { useToast } from './toast';

interface Hit {
  kind: string;
  id: number;
  title: string;
  subtitle: string;
  archived: boolean;
  href: string;
}

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

const KIND_ICON: Record<string, LucideIcon> = {
  episode: ListVideo,
  idea: Lightbulb,
  source: BookOpen,
  insight: Quote,
  project: Folder,
  series: Layers,
  person: User,
  asset: Paperclip,
};

export function CommandPalette({ open, onClose, onNewEpisode, onNewIdea }: { open: boolean; onClose: () => void; onNewEpisode: () => void; onNewIdea: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'all' | 'similar'>('all');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(q.trim(), 120);

  useEffect(() => {
    if (open) {
      setQ('');
      setMode('all');
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const go = (href: string) => {
    onClose();
    navigate(href);
  };
  const episodeMatch = location.pathname.match(/^\/episodes\/(\d+)/);

  const commands: Command[] = useMemo(
    () => [
      { id: 'new-episode', label: 'Create episode', hint: 'N', icon: FilePlus2, keywords: 'new add', run: () => (onClose(), onNewEpisode()) },
      { id: 'new-idea', label: 'Capture idea', hint: 'I', icon: Lightbulb, keywords: 'new create add inbox', run: () => (onClose(), onNewIdea()) },
      { id: 'dashboard', label: 'Open Dashboard', hint: 'G D', icon: Gauge, keywords: 'home command center', run: () => go('/') },
      { id: 'today', label: 'Open Today', hint: 'G T', icon: CalendarCheck, keywords: 'queue daily', run: () => go('/today') },
      { id: 'projects', label: 'Open Projects', hint: 'G P', icon: Folder, run: () => go('/projects') },
      { id: 'board', label: 'Open Production Board', hint: 'G B', icon: Columns3, keywords: 'kanban', run: () => go('/board') },
      { id: 'episodes', label: 'Open Episode Library', hint: 'G E', icon: ListVideo, keywords: 'all list table', run: () => go('/episodes') },
      { id: 'ideas', label: 'Open Idea Inbox', hint: 'G I', icon: Lightbulb, run: () => go('/ideas') },
      { id: 'sources', label: 'Open Source Library', hint: 'G S', icon: BookOpen, keywords: 'books people', run: () => go('/sources') },
      { id: 'blocked', label: 'View blocked episodes', icon: Ban, run: () => go('/episodes?view=blocked') },
      { id: 'ready', label: 'View ready to post', icon: CheckCircle2, run: () => go('/episodes?view=ready') },
      { id: 'published', label: 'View published', icon: Radio, run: () => go('/episodes?view=published') },
      { id: 'voice', label: 'View waiting for voice', icon: ListVideo, run: () => go('/episodes?waitingFor=VOICE') },
      { id: 'edit', label: 'View waiting for edit', icon: ListVideo, run: () => go('/episodes?waitingFor=EDIT') },
      { id: 'resurface', label: 'Resurface forgotten work', hint: 'G R', icon: RotateCcw, keywords: 'dormant old', run: () => go('/resurface') },
      {
        id: 'random',
        label: 'Random idea',
        icon: Shuffle,
        keywords: 'surprise dormant',
        run: async () => {
          const r = await api.get<{ id: number | null }>('/random-idea');
          if (r.id) go(`/ideas?open=${r.id}`);
          else toast.warn('No open ideas to pick from.');
        },
      },
      {
        id: 'similar',
        label: episodeMatch ? 'Find similar to this episode' : 'Find similar episodes…',
        icon: Copy,
        keywords: 'duplicate already have',
        run: () => (episodeMatch ? go(`/episodes/${episodeMatch[1]}?tab=related`) : (setMode('similar'), setQ(''), setIndex(0))),
      },
      { id: 'activity', label: 'Open Activity', icon: Sparkles, keywords: 'history changes', run: () => go('/activity') },
      { id: 'archive', label: 'Open Archive & Trash', icon: Folder, keywords: 'deleted restore', run: () => go('/archive') },
      { id: 'settings', label: 'Open Settings', icon: Folder, keywords: 'content types target', run: () => go('/settings') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname],
  );

  const filtered = useMemo(() => {
    if (mode === 'similar') return [];
    const t = q.trim().toLowerCase();
    if (!t) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(t));
  }, [q, commands, mode]);

  const search = useQuery({
    queryKey: ['palette-search', debounced],
    queryFn: () => api.get<Hit[]>(`/search?q=${encodeURIComponent(debounced)}&limit=20`),
    enabled: open && mode === 'all' && debounced.length >= 2,
    placeholderData: (prev) => prev,
  });
  const similar = useQuery({
    queryKey: ['palette-similar', debounced],
    queryFn: () => api.post<(EpisodeListItem & { similarity: number })[]>('/similar', { text: debounced, limit: 12 }),
    enabled: open && mode === 'similar' && debounced.length >= 3,
  });

  type Row = { key: string; icon: LucideIcon; label: ReactNode; sub?: ReactNode; right?: ReactNode; run: () => void; group: string };
  const rows: Row[] = [];
  if (mode === 'similar') {
    for (const e of similar.data ?? [])
      rows.push({ key: `s${e.id}`, group: 'Similar episodes', icon: ListVideo, label: `${e.code} · ${e.title}`, sub: `${e.projectName} · ${e.similarity}% match`, right: <PhaseBadge phase={e.phase} blocked={e.blocked} />, run: () => go(`/episodes/${e.id}`) });
  } else {
    const showCommandsFirst = !debounced || filtered.length > 0;
    const cmdRows = filtered.slice(0, debounced ? 5 : 30).map((c) => ({ key: c.id, group: 'Commands', icon: c.icon, label: c.label, right: c.hint ? <Kbd>{c.hint}</Kbd> : undefined, run: c.run }));
    const hitRows = (debounced.length >= 2 ? search.data ?? [] : []).map((h) => ({
      key: `${h.kind}${h.id}`,
      group: 'Results',
      icon: KIND_ICON[h.kind] ?? Search,
      label: h.title,
      sub: h.subtitle,
      right: h.archived ? <span className="text-caption text-ink-3">archived</span> : undefined,
      run: () => go(h.href),
    }));
    rows.push(...(showCommandsFirst && !debounced ? cmdRows : [...hitRows, ...cmdRows]));
  }

  useEffect(() => setIndex(0), [debounced, mode]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;
  const loading = (mode === 'all' && search.isFetching) || (mode === 'similar' && similar.isFetching);

  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="animate-pop w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-2 border-b border-line px-3">
          {mode === 'similar' ? <Copy className="size-4 text-accent-text" /> : <Search className="size-4 text-ink-3" />}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === 'similar' ? 'Describe the idea — e.g. “envy between brothers”' : 'Search everything or run a command…'}
            className="h-12 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, rows.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                rows[index]?.run();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                if (mode === 'similar') setMode('all');
                else onClose();
              } else if (e.key === 'Backspace' && !q && mode === 'similar') setMode('all');
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
          {loading && <Spinner />}
        </div>
        <div ref={listRef} id="palette-list" role="listbox" className="max-h-[56vh] overflow-y-auto p-1.5 scroll-thin">
          {rows.length === 0 && (
            <p className="px-3 py-8 text-center text-ui text-ink-3">
              {mode === 'similar' ? (debounced.length < 3 ? 'Type a few words to compare against every episode.' : 'Nothing similar found — this looks new.') : debounced.length >= 2 && !loading ? `No matches for “${debounced}”.` : 'Type to search.'}
            </p>
          )}
          {rows.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            const Icon = r.icon;
            return (
              <div key={r.key}>
                {header && <div className="px-2.5 pt-2 pb-1 text-caption font-medium text-ink-3">{header}</div>}
                <button
                  data-idx={i}
                  role="option"
                  aria-selected={i === index}
                  onMouseMove={() => setIndex(i)}
                  onClick={r.run}
                  className={cx('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left', i === index ? 'bg-hover' : '')}
                >
                  <Icon className="size-4 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui text-ink">{r.label}</span>
                    {r.sub && <span className="block truncate text-caption text-ink-3">{r.sub}</span>}
                  </span>
                  {r.right}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-caption text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>Enter</Kbd> open
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>Esc</Kbd> {mode === 'similar' ? 'back' : 'close'}
          </span>
          <span className="ml-auto">Try a code like “BIB-041”</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
