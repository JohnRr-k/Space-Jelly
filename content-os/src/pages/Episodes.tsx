import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Bookmark, Filter, Lightbulb, ListVideo, Search, X, Trash2 } from 'lucide-react';
import { PHASES, PHASE_META, STAGES, STAGE_META, PRIORITY_LABEL, type Phase, type Stage } from '../../shared/domain';
import { api } from '../lib/api';
import { useAction, useDebounced, useMeta } from '../lib/hooks';
import { FILTER_PARAMS, VIEW_SLUGS, isCustomView, paramsFromQuery, queryFromParams } from '../lib/episodeQuery';
import type { EpisodeListItem, EpisodeQuery } from '../lib/types';
import { num, relative } from '../lib/format';
import { Button, Empty, ErrorState, Input, Modal, Popover, Select, Spinner, cx, useConfirm } from '../components/ui';
import { Code, Due, NextStage, PhaseBadge, PriorityMark, ProjectDot, Readiness, StageStrip, Tags } from '../components/status';
import { BulkBar } from '../components/BulkBar';
import { PageShell, useGlobalUI } from '../components/Layout';

const PAGE = 100;
const ROW_H = 46;

export default function Episodes() {
  const [params, setParams] = useSearchParams();
  const meta = useMeta();
  const navigate = useNavigate();
  const ui = useGlobalUI();
  const customViews = useMemo(() => meta.data?.views.filter((v) => !v.system) ?? [], [meta.data]);
  const query = useMemo(() => queryFromParams(params, customViews), [params, customViews]);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(search, 220);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const lastClicked = useRef<number | null>(null);

  // search box → URL (debounced)
  useEffect(() => {
    const cur = params.get('q') ?? '';
    if (debouncedSearch !== cur) {
      const next = new URLSearchParams(params);
      if (debouncedSearch) next.set('q', debouncedSearch);
      else next.delete('q');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  useEffect(() => setSearch(params.get('q') ?? ''), [params]);

  const queryKey = ['episodes', query];
  const list = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => api.episodes({ ...query, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    placeholderData: (prev) => prev,
  });
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;
  const groups = list.data?.pages[0]?.groups;

  // reset selection when the query changes
  const qsig = JSON.stringify(query);
  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [qsig]);

  // rows (with group headers)
  type Row = { type: 'group'; key: string; label: string; count: number } | { type: 'ep'; ep: EpisodeListItem; index: number };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    let last: string | undefined;
    items.forEach((ep, index) => {
      if (groups && ep.groupKey !== last) {
        const g = groups.find((x) => x.key === ep.groupKey);
        out.push({ type: 'group', key: `g-${ep.groupKey}`, label: g?.label ?? String(ep.groupKey), count: g?.count ?? 0 });
        last = ep.groupKey;
      }
      out.push({ type: 'ep', ep, index });
    });
    return out;
  }, [items, groups]);

  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i]?.type === 'group' ? 36 : ROW_H),
    overscan: 12,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });
  const vItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const last = vItems[vItems.length - 1];
    if (last && last.index >= rows.length - 20 && list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
  }, [vItems, rows.length, list]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const openView = (slug: string) => setParams(slug === 'all' ? {} : { view: slug });
  const activeView = params.get('view') ?? (FILTER_PARAMS.some((k) => params.get(k)) ? null : 'all');

  const toggle = (id: number, index: number, shift: boolean) => {
    setAllMatching(false);
    const anchor = lastClicked.current; // read now: the updater below runs later
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && anchor !== null) {
        const [a, b] = [Math.min(anchor, index), Math.max(anchor, index)];
        for (let i = a; i <= b; i++) next.add(items[i].id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastClicked.current = index;
  };
  const allLoadedSelected = items.length > 0 && items.every((e) => selected.has(e.id));
  const selectAllMatching = async () => {
    const r = await api.post<{ ids: number[] }>('/episodes/query-ids', query);
    setSelected(new Set(r.ids));
    setAllMatching(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selected.size && !document.querySelector('[role="dialog"]')) setSelected(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected.size]);

  const viewName = isCustomView(activeView) ? customViews.find((v) => `v${v.id}` === activeView)?.name : VIEW_SLUGS.find((v) => v.slug === activeView)?.name;

  return (
    <PageShell>
      <div className="grid gap-4 2xl:grid-cols-[12rem_minmax(0,1fr)] 2xl:gap-6">
        <ViewsNav active={activeView} onOpen={openView} customViews={customViews} />
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-heading font-semibold">{viewName ?? 'Episodes'}</h1>
              <p className="mt-0.5 text-ui text-ink-2 tabular">
                {list.isLoading ? 'Loading…' : `${num(total)} episode${total === 1 ? '' : 's'}`}
                {list.isFetching && !list.isLoading && <Spinner className="ml-2 inline size-3" />}
              </p>
            </div>
            <Button variant="primary" onClick={() => ui.newEpisode({ projectId: query.projectIds?.[0] })}>
              New episode
            </Button>
          </div>

          <Toolbar query={query} search={search} setSearch={setSearch} setParam={setParam} params={params} activeView={activeView} />
          <ActiveFilters params={params} setParams={setParams} />

          {list.error ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : (
            <div className="rounded-lg border border-line bg-surface shadow-card">
              <div className="sticky top-12 z-10 hidden h-9 items-center gap-3 rounded-t-lg border-b border-line bg-surface-2 px-3 text-caption font-medium text-ink-3 md:flex">
                <input
                  type="checkbox"
                  aria-label="Select all loaded"
                  className="size-3.5 accent-[var(--accent)]"
                  checked={allLoadedSelected}
                  onChange={() => {
                    setAllMatching(false);
                    setSelected(allLoadedSelected ? new Set() : new Set(items.map((e) => e.id)));
                  }}
                />
                <span className="w-16">Code</span>
                <span className="flex-1">Title</span>
                <span className="hidden w-[108px] lg:block" title="Research · Concept · Script · Voice · Visual · Edit · QC · Caption · Cover | Schedule · Publish">
                  Production
                </span>
                <span className="hidden w-44 lg:block">Waiting on</span>
                <span className="w-20">Due</span>
                <span className="w-12 text-right">Ready</span>
                <span className="w-24">Status</span>
                <span className="hidden w-20 text-right 2xl:block">Updated</span>
              </div>
              {list.isLoading ? (
                <div className="grid place-items-center py-16">
                  <Spinner />
                </div>
              ) : !items.length ? (
                <Empty icon={<ListVideo className="size-6" />} title="No episodes match" action={<Button onClick={() => setParams({})}>Clear filters</Button>}>
                  Try removing a filter, or create the episode that should be here.
                </Empty>
              ) : (
                <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                  {vItems.map((vi) => {
                    const row = rows[vi.index];
                    const style = { position: 'absolute' as const, top: 0, left: 0, right: 0, transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)` };
                    if (row.type === 'group')
                      return (
                        <div key={row.key} style={{ ...style, height: 36 }} className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 text-ui-sm font-semibold text-ink">
                          {row.label}
                          <span className="tabular font-normal text-ink-3">{num(row.count)}</span>
                        </div>
                      );
                    return (
                      <EpisodeRow key={row.ep.id} style={{ ...style, height: ROW_H }} ep={row.ep} selected={selected.has(row.ep.id)} onToggle={(shift) => toggle(row.ep.id, row.index, shift)} onOpen={() => navigate(`/episodes/${row.ep.id}`)} />
                    );
                  })}
                </div>
              )}
              {list.isFetchingNextPage && (
                <div className="grid place-items-center border-t border-line py-3">
                  <Spinner />
                </div>
              )}
            </div>
          )}
          {selected.size > 0 && <BulkBar ids={[...selected]} total={total} allSelected={allMatching || selected.size >= total} onSelectAll={selectAllMatching} onClear={() => setSelected(new Set())} />}
          <div className="h-20" />
        </div>
      </div>
    </PageShell>
  );
}

function EpisodeRow({ ep, selected, onToggle, onOpen, style }: { ep: EpisodeListItem; selected: boolean; onToggle: (shift: boolean) => void; onOpen: () => void; style: React.CSSProperties }) {
  return (
    <div style={style} className={cx('group flex items-center gap-3 border-b border-line px-3 text-ui', selected ? 'bg-accent-subtle/70' : 'hover:bg-hover', ep.archivedAt && 'opacity-60')}>
      <input
        type="checkbox"
        aria-label={`Select ${ep.title}`}
        className="size-3.5 shrink-0 accent-[var(--accent)]"
        checked={selected}
        onChange={() => {}}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(e.shiftKey);
        }}
      />
      <span className="hidden w-16 shrink-0 items-center gap-1.5 sm:flex">
        <ProjectDot color={ep.projectColor} />
        <Code>{ep.code}</Code>
      </span>
      <div className="min-w-0 flex-1">
        <Link
          to={`/episodes/${ep.id}`}
          className="block truncate font-medium leading-5 text-ink hover:underline"
          title={ep.title}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            onOpen();
          }}
        >
          {ep.title}
        </Link>
        <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-caption leading-4 text-ink-3">
          <span className="max-w-[45%] shrink-0 truncate">{ep.seriesTitle ?? ep.projectName}</span>
          <span className="hidden shrink-0 sm:inline">{ep.contentTypeName}</span>
          <span className="hidden min-w-0 md:inline-flex">
            <Tags tags={ep.tags} max={2} nowrap />
          </span>
        </div>
      </div>
      <span className="hidden w-[108px] shrink-0 lg:block">
        <StageStrip stages={ep.stages} contentTypeId={ep.contentTypeId} />
      </span>
      <span className="hidden w-44 min-w-0 shrink-0 lg:flex">
        {ep.phase === 'PUBLISHED' ? (
          <span className="text-caption text-ink-3">Published {relative(ep.publishedAt)}</span>
        ) : ep.phase === 'SCHEDULED' ? (
          <span className="text-caption text-sched-text">Goes out {relative(ep.scheduledAt)}</span>
        ) : ep.phase === 'READY' ? (
          <span className="text-caption text-done-text">Ready to post</span>
        ) : (
          <NextStage stage={ep.nextStage} actionable={ep.actionable} blocked={ep.blocked} note={ep.blockedNote} />
        )}
      </span>
      <span className="hidden w-20 shrink-0 flex-col sm:flex">
        <PriorityMark priority={ep.priority} />
        <Due date={ep.phase === 'PUBLISHED' ? null : ep.dueDate} />
      </span>
      <span className="hidden w-12 shrink-0 text-right sm:block">
        <Readiness value={ep.readiness} compact />
      </span>
      <span className="shrink-0 sm:w-24">
        <PhaseBadge phase={ep.phase} blocked={ep.blocked} />
      </span>
      <span className="hidden w-20 shrink-0 text-right text-caption text-ink-3 2xl:block">{relative(ep.updatedAt)}</span>
    </div>
  );
}

function ViewsNav({ active, onOpen, customViews }: { active: string | null; onOpen: (slug: string) => void; customViews: { id: number; name: string }[] }) {
  const confirm = useConfirm();
  const del = useAction((id: number) => api.del(`/views/${id}`), { success: 'View deleted' });
  const btn = (slug: string, label: string, extra?: React.ReactNode) => (
    <button
      key={slug}
      onClick={() => onOpen(slug)}
      className={cx('group flex h-7 w-auto shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 text-left text-ui-sm transition-colors 2xl:w-full', active === slug ? 'bg-surface font-medium text-ink shadow-card' : 'text-ink-2 hover:bg-hover hover:text-ink')}
    >
      <span className="flex-1 truncate">{label}</span>
      {extra}
    </button>
  );
  return (
    <nav aria-label="Saved views" className="min-w-0 2xl:sticky 2xl:top-16 2xl:self-start">
      <div className="flex gap-1 overflow-x-auto pb-1 scroll-thin 2xl:flex-col 2xl:overflow-visible">
        <div className="hidden px-2 pb-1 text-caption text-ink-3 2xl:block">Views</div>
        {VIEW_SLUGS.map((v) => btn(v.slug, v.name))}
        <Link to="/ideas?view=dormant" className="flex h-7 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 text-ui-sm text-ink-2 hover:bg-hover hover:text-ink">
          <Lightbulb className="size-3.5 text-ink-3" /> Old ideas
        </Link>
        {customViews.length > 0 && <div className="hidden px-2 pb-1 pt-3 text-caption text-ink-3 2xl:block">Your views</div>}
        {customViews.map((v) =>
          btn(
            `v${v.id}`,
            v.name,
            <span
              role="button"
              tabIndex={0}
              aria-label={`Delete view ${v.name}`}
              className="hidden rounded p-0.5 text-ink-3 hover:text-blocked-text group-hover:inline"
              onClick={async (e) => {
                e.stopPropagation();
                if (await confirm.ask(`Delete view “${v.name}”?`, 'Only the saved filter is removed — no episodes are affected.', 'Delete view')) del.mutate(v.id);
              }}
            >
              <Trash2 className="size-3" />
            </span>,
          ),
        )}
      </div>
      {confirm.node}
    </nav>
  );
}

function Toolbar({ query, search, setSearch, setParam, params, activeView }: { query: EpisodeQuery; search: string; setSearch: (s: string) => void; setParam: (k: string, v: string | null) => void; params: URLSearchParams; activeView: string | null }) {
  const meta = useMeta();
  const [saveOpen, setSaveOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toggleIn = (key: string, current: (string | number)[] | undefined, value: string | number) => {
    const set = new Set((current ?? []).map(String));
    if (set.has(String(value))) set.delete(String(value));
    else set.add(String(value));
    setParam(key, [...set].join(',') || null);
  };
  const filterCount = ['phase', 'waitingFor', 'type', 'priority', 'series', 'due', 'blocked', 'published', 'archived', 'stale', 'tags'].filter((k) => params.get(k)).length;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, idea, hook, script… or BIB-041" className="pl-8" />
      </div>
      <Select value={query.projectIds?.length === 1 ? query.projectIds[0] : ''} onChange={(e) => setParam('project', e.target.value || null)} className="w-auto min-w-36" aria-label="Project">
        <option value="">All projects</option>
        {meta.data?.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Popover
        align="end"
        className="w-[min(92vw,34rem)] p-3"
        trigger={({ toggle, open }) => (
          <Button onClick={toggle} className={cx(open && 'bg-hover')} icon={<Filter className="size-3.5" />}>
            Filters{filterCount ? <span className="tabular rounded bg-accent px-1 text-caption text-accent-fg">{filterCount}</span> : null}
          </Button>
        )}
      >
        {() => (
          <div className="grid gap-3 text-ui-sm">
            <FilterGroup label="Status">
              {PHASES.map((p) => (
                <Chip key={p} on={!!query.phases?.includes(p)} onClick={() => toggleIn('phase', query.phases, p)}>
                  {PHASE_META[p].label}
                </Chip>
              ))}
              <Chip on={query.blocked === true} onClick={() => setParam('blocked', query.blocked ? null : '1')}>
                Blocked
              </Chip>
            </FilterGroup>
            <FilterGroup label="Waiting for (prerequisites done, stage not)">
              {STAGES.filter((s) => s !== 'SCHEDULE' && s !== 'PUBLISH').map((s) => (
                <Chip key={s} on={!!query.waitingFor?.includes(s)} onClick={() => toggleIn('waitingFor', query.waitingFor, s)}>
                  {STAGE_META[s].label}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup label="Priority">
              {[0, 1, 2, 3].map((p) => (
                <Chip key={p} on={!!query.priorities?.includes(p)} onClick={() => toggleIn('priority', query.priorities, p)}>
                  {PRIORITY_LABEL[p]}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup label="Content type">
              {meta.data?.contentTypes.map((c) => (
                <Chip key={c.id} on={!!query.contentTypeIds?.includes(c.id)} onClick={() => toggleIn('type', query.contentTypeIds, c.id)}>
                  {c.name}
                </Chip>
              ))}
            </FilterGroup>
            {query.projectIds?.length === 1 && (
              <FilterGroup label="Series">
                {meta.data?.series
                  .filter((s) => s.projectId === query.projectIds![0])
                  .map((s) => (
                    <Chip key={s.id} on={!!query.seriesIds?.includes(s.id)} onClick={() => toggleIn('series', query.seriesIds, s.id)}>
                      {s.title}
                    </Chip>
                  ))}
              </FilterGroup>
            )}
            <FilterGroup label="Due">
              {(['overdue', 'today', 'week', 'any', 'none'] as const).map((d) => (
                <Chip key={d} on={query.due === d} onClick={() => setParam('due', query.due === d ? null : d)}>
                  {{ overdue: 'Overdue', today: 'Today', week: 'Next 7 days', any: 'Has due date', none: 'No due date' }[d]}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup label="Lifecycle">
              <Chip on={query.published === false} onClick={() => setParam('published', query.published === false ? null : '0')}>
                Unpublished
              </Chip>
              <Chip on={query.staleDays === 14} onClick={() => setParam('stale', query.staleDays ? null : '14')}>
                No progress 14d+
              </Chip>
              <Chip on={query.createdWithinDays === 7} onClick={() => setParam('created', query.createdWithinDays ? null : '7')}>
                Created this week
              </Chip>
              <Chip on={query.updatedWithinDays === 7} onClick={() => setParam('updated', query.updatedWithinDays ? null : '7')}>
                Updated this week
              </Chip>
              <Chip on={query.archived === 'include'} onClick={() => setParam('archived', query.archived === 'include' ? null : 'include')}>
                Include archived
              </Chip>
              <Chip on={query.archived === 'only'} onClick={() => setParam('archived', query.archived === 'only' ? null : 'only')}>
                Archived only
              </Chip>
            </FilterGroup>
            <FilterGroup label="Tags">
              {meta.data?.tags.slice(0, 30).map((t) => (
                <Chip key={t.id} on={!!query.tags?.includes(t.name)} onClick={() => toggleIn('tags', query.tags, t.name)}>
                  #{t.name} <span className="text-ink-3">{t.count}</span>
                </Chip>
              ))}
            </FilterGroup>
          </div>
        )}
      </Popover>
      <div className="flex items-center">
        <Select value={query.sort ?? 'updated'} onChange={(e) => setParam('sort', e.target.value)} className="w-auto rounded-r-none" aria-label="Sort by">
          {(
            [
              ['updated', 'Last updated'],
              ['priority', 'Priority'],
              ['readiness', 'Readiness'],
              ['due', 'Due date'],
              ['number', 'Episode number'],
              ['created', 'Created'],
              ['progress', 'Last progress'],
              ['title', 'Title'],
              ['published', 'Published date'],
              ['scheduled', 'Scheduled date'],
            ] as const
          ).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <button
          className="-ml-px grid h-8 w-8 place-items-center rounded-r-md border border-line-strong bg-surface text-ink-2 hover:bg-hover"
          aria-label="Toggle sort direction"
          title="Toggle sort direction"
          onClick={() => {
            const cur = query.dir ?? (['priority', 'due', 'number', 'title', 'progress', 'scheduled'].includes(query.sort ?? 'updated') ? 'asc' : 'desc');
            setParam('dir', cur === 'asc' ? 'desc' : 'asc');
          }}
        >
          {(query.dir ?? 'desc') === 'asc' ? <ArrowUpNarrowWide className="size-3.5" /> : <ArrowDownWideNarrow className="size-3.5" />}
        </button>
      </div>
      <Select value={query.group ?? 'none'} onChange={(e) => setParam('group', e.target.value === 'none' ? null : e.target.value)} className="w-auto" aria-label="Group by">
        <option value="none">No grouping</option>
        <option value="project">Group: project</option>
        <option value="series">Group: series</option>
        <option value="phase">Group: status</option>
        <option value="priority">Group: priority</option>
        <option value="type">Group: content type</option>
      </Select>
      <Button variant="ghost" icon={<Bookmark className="size-3.5" />} onClick={() => setSaveOpen(true)} title="Save the current filters as a view">
        Save view
      </Button>
      <SaveViewDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        query={query}
        onSaved={(id) => {
          qc.invalidateQueries({ queryKey: ['meta'] });
          setSaveOpen(false);
          navigate(`/episodes?view=v${id}`);
        }}
        disabled={activeView === 'all'}
      />
    </div>
  );
}

function SaveViewDialog({ open, onClose, query, onSaved, disabled }: { open: boolean; onClose: () => void; query: EpisodeQuery; onSaved: (id: number) => void; disabled: boolean }) {
  const [name, setName] = useState('');
  const save = useAction(() => api.post<{ id: number }>('/views', { name, query: { ...query } }), { success: 'View saved', onDone: (r) => onSaved(r.id) });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save as view"
      width="max-w-sm"
      footer={
        <Button variant="primary" disabled={!name.trim()} loading={save.isPending} onClick={() => save.mutate(undefined)}>
          Save view
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate(undefined);
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bible — waiting for edit" />
        {disabled && <p className="mt-2 text-caption text-ink-3">Tip: add some filters first — this would save “all episodes”.</p>}
      </form>
    </Modal>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-caption font-medium text-ink-3">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cx('rounded-md border px-2 py-0.5 text-ui-sm transition-colors', on ? 'border-accent bg-accent-subtle text-accent-text' : 'border-line-strong text-ink-2 hover:bg-hover')}>
      {children}
    </button>
  );
}

function ActiveFilters({ params, setParams }: { params: URLSearchParams; setParams: (p: URLSearchParams) => void }) {
  const meta = useMeta();
  const chips: { key: string; label: string }[] = [];
  const label = (k: string, v: string): string => {
    switch (k) {
      case 'project':
        return v.split(',').map((id) => meta.data?.projects.find((p) => p.id === Number(id))?.name ?? id).join(', ');
      case 'series':
        return 'Series: ' + v.split(',').map((id) => meta.data?.series.find((s) => s.id === Number(id))?.title ?? id).join(', ');
      case 'type':
        return v.split(',').map((id) => meta.data?.contentTypes.find((c) => c.id === Number(id))?.name ?? id).join(', ');
      case 'phase':
        return v.split(',').map((p) => PHASE_META[p as Phase]?.label ?? p).join(', ');
      case 'waitingFor':
        return 'Waiting for ' + v.split(',').map((s) => STAGE_META[s as Stage]?.label ?? s).join(', ');
      case 'priority':
        return v.split(',').map((p) => PRIORITY_LABEL[Number(p)]).join(', ');
      case 'tags':
        return v.split(',').map((t) => `#${t}`).join(' ');
      case 'blocked':
        return v === '1' ? 'Blocked' : 'Not blocked';
      case 'published':
        return v === '1' ? 'Published' : 'Unpublished';
      case 'due':
        return `Due: ${v}`;
      case 'stale':
        return `No progress ${v}d+`;
      case 'created':
        return `Created ≤ ${v}d`;
      case 'updated':
        return `Updated ≤ ${v}d`;
      case 'archived':
        return v === 'only' ? 'Archived only' : 'Incl. archived';
      case 'source':
        return 'From a source';
      case 'q':
        return `“${v}”`;
      default:
        return v;
    }
  };
  for (const k of FILTER_PARAMS) {
    const v = params.get(k);
    if (v && k !== 'q') chips.push({ key: k, label: label(k, v) });
  }
  if (!chips.length) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1 rounded-md bg-accent-subtle py-0.5 pl-2 pr-1 text-ui-sm text-accent-text">
          {c.label}
          <button
            aria-label={`Remove filter ${c.label}`}
            className="rounded p-0.5 hover:bg-accent/15"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete(c.key);
              setParams(next);
            }}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <button
        className="text-ui-sm text-ink-3 hover:text-ink"
        onClick={() => {
          const next = new URLSearchParams();
          for (const k of ['sort', 'dir', 'group']) if (params.get(k)) next.set(k, params.get(k)!);
          setParams(next);
        }}
      >
        Clear all
      </button>
    </div>
  );
}

export { paramsFromQuery };
