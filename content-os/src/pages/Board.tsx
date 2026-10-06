import { useState, type DragEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Ban, Search } from 'lucide-react';
import { PHASES, PHASE_META, type Phase } from '../../shared/domain';
import { api } from '../lib/api';
import { useDebounced, useMeta, useMoveEpisode, useRefresh } from '../lib/hooks';
import type { EpisodeListItem, EpisodeQuery } from '../lib/types';
import { num, relative } from '../lib/format';
import { Input, Select, Spinner, cx, useConfirm } from '../components/ui';
import { Code, Due, NextStage, PriorityMark, ProjectDot, StageStrip } from '../components/status';
import { ScheduleDialog } from '../components/BulkBar';
import { useToast } from '../components/toast';

const PER_COLUMN = 40;

export default function Board() {
  const meta = useMeta();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDebounced(q, 250);
  const projectId = params.get('project') ? Number(params.get('project')) : undefined;
  const seriesId = params.get('series') ? Number(params.get('series')) : undefined;
  const typeId = params.get('type') ? Number(params.get('type')) : undefined;
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState<EpisodeListItem | null>(null);
  const [over, setOver] = useState<Phase | null>(null);
  const [scheduleFor, setScheduleFor] = useState<EpisodeListItem | null>(null);
  const move = useMoveEpisode();
  const confirm = useConfirm();

  const base: EpisodeQuery = { q: dq || undefined, projectIds: projectId ? [projectId] : undefined, seriesIds: seriesId ? [seriesId] : undefined, contentTypeIds: typeId ? [typeId] : undefined };
  const columns = useQueries({
    queries: PHASES.map((phase) => ({
      queryKey: ['episodes', 'board', phase, base, limits[phase] ?? PER_COLUMN],
      queryFn: () =>
        api.episodes({ ...base, phases: [phase], sort: phase === 'PUBLISHED' ? 'published' : phase === 'SCHEDULED' ? 'scheduled' : phase === 'IDEA' ? 'priority' : 'priority', limit: limits[phase] ?? PER_COLUMN }),
      placeholderData: (prev: unknown) => prev,
    })),
  });

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k === 'project') next.delete('series');
    setParams(next, { replace: true });
  };

  const onDrop = async (phase: Phase) => {
    const ep = dragging;
    setDragging(null);
    setOver(null);
    if (!ep || ep.phase === phase) return;
    if (phase === 'SCHEDULED') return setScheduleFor(ep);
    if (phase === 'IDEA' && !(await confirm.ask(`Reset “${ep.title}”?`, 'Moving to Idea resets every stage to not started. You can undo right after.', 'Reset'))) return;
    move.mutate({ episodeId: ep.id, phase, title: ep.title });
  };

  return (
    <div className="-mx-3 sm:-mx-6 lg:-mx-8">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-heading font-semibold">Production board</h1>
            <p className="mt-0.5 text-ui text-ink-2">Columns are a view of stage state. Dragging updates the right stages and keeps parallel progress.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter cards…" className="w-52 pl-8" />
            </div>
            <Select value={projectId ?? ''} onChange={(e) => setParam('project', e.target.value || null)} className="w-auto" aria-label="Project">
              <option value="">All projects</option>
              {meta.data?.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {projectId && (
              <Select value={seriesId ?? ''} onChange={(e) => setParam('series', e.target.value || null)} className="w-auto" aria-label="Series">
                <option value="">All series</option>
                {meta.data?.series
                  .filter((s) => s.projectId === projectId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
              </Select>
            )}
            <Select value={typeId ?? ''} onChange={(e) => setParam('type', e.target.value || null)} className="w-auto" aria-label="Content type">
              <option value="">All types</option>
              {meta.data?.contentTypes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto px-3 pb-6 scroll-thin sm:px-6 lg:px-8" style={{ minHeight: 'calc(100dvh - 11rem)' }}>
        {PHASES.map((phase, i) => {
          const col = columns[i];
          const data = col.data as { items: EpisodeListItem[]; total: number } | undefined;
          const blocked = data?.items.filter((x) => x.blocked).length ?? 0;
          return (
            <section
              key={phase}
              aria-label={`${PHASE_META[phase].label} column`}
              onDragOver={(e: DragEvent) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(phase);
              }}
              onDragLeave={() => setOver((o) => (o === phase ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(phase);
              }}
              className={cx('flex w-[17rem] shrink-0 flex-col rounded-lg border bg-sunken/70 transition-colors', over === phase && dragging?.phase !== phase ? 'border-accent bg-accent-subtle/60' : 'border-line')}
            >
              <header className="flex items-baseline gap-2 px-3 pt-2.5 pb-2">
                <h2 className="text-ui font-semibold">{PHASE_META[phase].label}</h2>
                <span className="tabular text-ui-sm text-ink-3">{data ? num(data.total) : ''}</span>
                {blocked > 0 && (
                  <span className="ml-auto inline-flex items-center gap-0.5 text-caption text-blocked-text" title={`${blocked} blocked in this column`}>
                    <Ban className="size-3" />
                    {blocked}
                  </span>
                )}
              </header>
              <p className="-mt-1 px-3 pb-2 text-caption text-ink-3">{PHASE_META[phase].hint}</p>
              <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2 scroll-thin" style={{ maxHeight: 'calc(100dvh - 15rem)' }}>
                {col.isLoading && <Spinner className="m-4" />}
                {data?.items.map((ep) => (
                  <Card key={ep.id} ep={ep} dragging={dragging?.id === ep.id} onDragStart={() => setDragging(ep)} onDragEnd={() => (setDragging(null), setOver(null))} />
                ))}
                {data && data.items.length === 0 && <p className="px-2 py-6 text-center text-caption text-ink-3">Empty</p>}
                {data && data.total > data.items.length && (
                  <button className="rounded-md py-1.5 text-ui-sm text-ink-2 hover:bg-hover" onClick={() => setLimits((l) => ({ ...l, [phase]: (l[phase] ?? PER_COLUMN) + 60 }))}>
                    Show more ({num(data.total - data.items.length)} hidden)
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {confirm.node}
      <BoardSchedule ep={scheduleFor} onClose={() => setScheduleFor(null)} />
    </div>
  );
}

function Card({ ep, dragging, onDragStart, onDragEnd }: { ep: EpisodeListItem; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  return (
    <Link
      to={`/episodes/${ep.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(ep.id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cx(
        'block cursor-grab rounded-md border bg-surface p-2.5 shadow-card transition-[opacity,border-color] hover:border-line-strong active:cursor-grabbing',
        ep.blocked ? 'border-blocked/50' : 'border-line',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-1.5">
        <ProjectDot color={ep.projectColor} />
        <Code>{ep.code}</Code>
        <span className="ml-auto flex items-center gap-1.5">
          <PriorityMark priority={ep.priority} />
          <span className="tabular text-caption text-ink-3">{ep.readiness}%</span>
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-ui-sm font-medium leading-snug text-ink">{ep.title}</p>
      <StageStrip stages={ep.stages} contentTypeId={ep.contentTypeId} className="mt-2" />
      <div className="mt-1.5 flex min-w-0 items-center gap-2">
        {ep.phase === 'PUBLISHED' ? (
          <span className="text-caption text-ink-3">{relative(ep.publishedAt)}</span>
        ) : ep.phase === 'SCHEDULED' ? (
          <span className="text-caption text-sched-text">{relative(ep.scheduledAt)}</span>
        ) : ep.phase === 'READY' || ep.phase === 'IDEA' ? (
          <span className="truncate text-caption text-ink-3">{ep.seriesTitle ?? ep.contentTypeName}</span>
        ) : (
          <NextStage stage={ep.nextStage} actionable={ep.actionable} blocked={ep.blocked} note={ep.blockedNote} />
        )}
        <span className="ml-auto">
          <Due date={ep.phase === 'PUBLISHED' ? null : ep.dueDate} />
        </span>
      </div>
    </Link>
  );
}

function BoardSchedule({ ep, onClose }: { ep: EpisodeListItem | null; onClose: () => void }) {
  const refresh = useRefresh();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <ScheduleDialog
      open={!!ep}
      publishNow={false}
      n={1}
      busy={busy}
      onClose={onClose}
      onSubmit={async (a) => {
        if (!ep) return;
        setBusy(true);
        try {
          await api.post(`/episodes/${ep.id}/move`, { phase: 'SCHEDULED', scheduledAt: a.startAt, platform: a.platform, account: a.account });
          toast.success(`${ep.title} scheduled`);
          refresh();
          onClose();
        } catch (e) {
          toast.error(e);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
