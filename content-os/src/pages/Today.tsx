import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, CheckCircle2, Plus, Radio, X, XCircle } from 'lucide-react';
import { STAGE_META, PLATFORM_LABEL, type Platform, type Stage } from '../../shared/domain';
import { api } from '../lib/api';
import { useAction, useMoveEpisode, useStageChange } from '../lib/hooks';
import type { Bottleneck, EpisodeListItem, NextAction } from '../lib/types';
import { fullDate, num, shortDate, time } from '../lib/format';
import { Button, ErrorState, Panel, Skeleton, cx } from '../components/ui';
import { EpisodeList } from '../components/EpisodeList';
import { TargetMeter } from '../components/charts';
import { NextActions } from './Dashboard';
import { Code, ProjectDot } from '../components/status';
import { PageShell } from '../components/Layout';

interface PubRow {
  id: number;
  episode_id: number;
  platform: Platform;
  scheduled_at: string | null;
  published_at: string | null;
  title: string;
  code: string;
  project_color: string;
}

interface TodayData {
  day: string;
  today: { target: number; published: number; publications: number; remaining: number; scheduledToday: number; stageCompletions: number };
  queue: EpisodeListItem[];
  ready: EpisodeListItem[];
  scheduled: PubRow[];
  publishedToday: PubRow[];
  due: EpisodeListItem[];
  blocked: EpisodeListItem[];
  bottleneck: Bottleneck;
  bottleneckEpisodes: EpisodeListItem[];
  doneToday: { stage: Stage; c: number }[];
  actions: NextAction[];
}

export default function Today() {
  const q = useQuery({ queryKey: ['today'], queryFn: () => api.get<TodayData>('/today'), refetchInterval: 60_000 });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <PageShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-heading font-semibold">Today</h1>
          <p className="mt-0.5 text-ui text-ink-2">{fullDate()}</p>
        </div>
        {d && (
          <div className="w-full max-w-md">
            <div className="mb-1.5 flex items-baseline gap-4 text-ui">
              <span>
                <span className="text-ink-3">Target </span>
                <b className="tabular">{d.today.target}</b>
              </span>
              <span>
                <span className="text-ink-3">Published </span>
                <b className="tabular">{d.today.published}</b>
              </span>
              <span>
                <span className="text-ink-3">Remaining </span>
                <b className={cx('tabular', d.today.remaining ? '' : 'text-done-text')}>{d.today.remaining}</b>
              </span>
              <span className="ml-auto text-caption text-ink-3">{d.today.stageCompletions} stages finished today</span>
            </div>
            <TargetMeter done={d.today.published} target={d.today.target} />
          </div>
        )}
      </div>
      {!d ? (
        <div className="grid gap-4" aria-busy="true">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 content-start gap-5">
            <NextActions actions={d.actions.slice(0, 4)} />
            <QueuePanel d={d} />
            <ReadyPanel d={d} />
            {d.scheduled.length > 0 && <ScheduledPanel rows={d.scheduled} />}
            {d.due.length > 0 && (
              <Panel title={`Due or overdue (${d.due.length})`}>
                <EpisodeList items={d.due} dense right={(e) => <AdvanceButton ep={e} />} />
              </Panel>
            )}
          </div>
          <div className="grid min-w-0 content-start gap-5">
            <BatchPanel d={d} />
            <Panel title={`Blocked (${d.blocked.length})`} action={<Link to="/episodes?view=blocked" className="text-ui-sm text-accent-text hover:underline">All blocked</Link>}>
              <EpisodeList items={d.blocked} dense showStrip={false} empty={<p className="py-4 text-center text-ui-sm text-ink-3">Nothing blocked.</p>} right={(e) => <UnblockButton ep={e} />} />
            </Panel>
            <PublishedTodayPanel rows={d.publishedToday} />
          </div>
        </div>
      )}
    </PageShell>
  );
}

/** Completes the episode's first workable stage right from the list. */
function AdvanceButton({ ep }: { ep: EpisodeListItem }) {
  const change = useStageChange();
  const move = useMoveEpisode();
  if (ep.phase === 'READY')
    return (
      <Button size="sm" className="relative z-10" icon={<Radio className="size-3.5" />} onClick={() => move.mutate({ episodeId: ep.id, phase: 'PUBLISHED', title: ep.title })} loading={move.isPending}>
        Published
      </Button>
    );
  const stage = ep.actionable.find((s) => STAGE_META[s].phase !== 'release');
  if (!stage || ep.blocked) return null;
  return (
    <Button size="sm" className="relative z-10" icon={<Check className="size-3.5" />} loading={change.isPending} onClick={() => change.mutate({ episodeId: ep.id, stage, status: 'DONE' })} title={`Mark ${STAGE_META[stage].label} done`}>
      {STAGE_META[stage].label} done
    </Button>
  );
}

function UnblockButton({ ep }: { ep: EpisodeListItem }) {
  const change = useStageChange();
  const stage = (Object.entries(ep.stages).find(([, st]) => st === 'BLOCKED')?.[0] as Stage) ?? null;
  if (!stage) return null;
  return (
    <Button size="sm" variant="ghost" className="relative z-10" loading={change.isPending} onClick={() => change.mutate({ episodeId: ep.id, stage, status: 'IN_PROGRESS' })} title="Mark the blocked stage as in progress again">
      Unblock
    </Button>
  );
}

function QueuePanel({ d }: { d: TodayData }) {
  const remove = useAction((id: number) => api.del(`/today/queue/${id}`));
  const reorder = useAction((ids: number[]) => api.put('/today/queue', { episodeIds: ids }));
  const ids = d.queue.map((e) => e.id);
  const swap = (i: number, j: number) => {
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    reorder.mutate(next);
  };
  return (
    <Panel title={`Your queue (${d.queue.length})`} action={<span className="text-caption text-ink-3">Pin episodes here from anywhere: “Add to today”</span>}>
      {d.queue.length === 0 ? (
        <p className="py-4 text-center text-ui-sm text-ink-3">Nothing pinned for today. Add ready or high-priority episodes from the lists, or select episodes in the library and choose “Add to today’s queue”.</p>
      ) : (
        <EpisodeList
          items={d.queue}
          right={(e) => {
            const i = ids.indexOf(e.id);
            return (
              <span className="relative z-10 flex items-center gap-0.5">
                <AdvanceButton ep={e} />
                <button className="rounded p-1 text-ink-3 hover:bg-active hover:text-ink disabled:opacity-30" disabled={i === 0} aria-label="Move up" onClick={() => swap(i, i - 1)}>
                  <ArrowUp className="size-3.5" />
                </button>
                <button className="rounded p-1 text-ink-3 hover:bg-active hover:text-ink disabled:opacity-30" disabled={i === ids.length - 1} aria-label="Move down" onClick={() => swap(i, i + 1)}>
                  <ArrowDown className="size-3.5" />
                </button>
                <button className="rounded p-1 text-ink-3 hover:bg-active hover:text-ink" aria-label="Remove from queue" onClick={() => remove.mutate(e.id)}>
                  <X className="size-3.5" />
                </button>
              </span>
            );
          }}
        />
      )}
    </Panel>
  );
}

function ReadyPanel({ d }: { d: TodayData }) {
  const add = useAction((ids: number[]) => api.post('/today/queue', { episodeIds: ids }), { success: 'Added to queue' });
  const shortfall = Math.max(0, d.today.remaining - d.ready.length);
  return (
    <Panel
      title={`Ready to post (${d.ready.length})`}
      action={
        d.ready.length > 0 && (
          <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => add.mutate(d.ready.slice(0, d.today.remaining || 5).map((e) => e.id))}>
            Queue {Math.min(d.ready.length, d.today.remaining || 5)}
          </Button>
        )
      }
    >
      {shortfall > 0 && <p className="mb-2 rounded-md bg-progress-bg px-2.5 py-1.5 text-ui-sm text-progress-text">You need {shortfall} more finished episode{shortfall > 1 ? 's' : ''} to hit today’s target. The batch panel shows where to push.</p>}
      <EpisodeList items={d.ready} dense showStrip={false} empty={<p className="py-4 text-center text-ui-sm text-ink-3">Nothing is fully produced yet.</p>} right={(e) => <AdvanceButton ep={e} />} />
    </Panel>
  );
}

function ScheduledPanel({ rows }: { rows: PubRow[] }) {
  const confirm = useAction((a: { id: number; status: string }) => api.patch(`/publications/${a.id}`, { status: a.status }), { success: (_r, a) => (a.status === 'PUBLISHED' ? 'Confirmed as published' : 'Marked as failed') });
  return (
    <Panel id="scheduled" title={`Scheduled for today (${rows.length})`}>
      <ul className="divide-y divide-line">
        {rows.map((p) => {
          const late = p.scheduled_at && new Date(p.scheduled_at).getTime() < Date.now();
          return (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span className={cx('w-20 text-caption tabular', late ? 'font-medium text-blocked-text' : 'text-ink-2')}>
                {shortDate(p.scheduled_at)} {time(p.scheduled_at)}
              </span>
              <ProjectDot color={p.project_color} />
              <Code>{p.code}</Code>
              <Link to={`/episodes/${p.episode_id}`} className="min-w-0 flex-1 truncate text-ui hover:underline">
                {p.title}
              </Link>
              <span className="text-caption text-ink-3">{PLATFORM_LABEL[p.platform]}</span>
              {late && (
                <span className="flex gap-1">
                  <Button size="sm" icon={<CheckCircle2 className="size-3.5" />} onClick={() => confirm.mutate({ id: p.id, status: 'PUBLISHED' })}>
                    Went live
                  </Button>
                  <Button size="sm" variant="ghost" icon={<XCircle className="size-3.5" />} onClick={() => confirm.mutate({ id: p.id, status: 'FAILED' })}>
                    Failed
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function BatchPanel({ d }: { d: TodayData }) {
  const stage = d.bottleneck.stage;
  if (!stage)
    return (
      <Panel title="Batch work">
        <p className="text-ui-sm text-ink-3">No bottleneck right now — production is flowing.</p>
      </Panel>
    );
  const f = d.bottleneck.flows.find((x) => x.stage === stage)!;
  return (
    <Panel
      title={
        <span>
          Batch: <span className="text-accent-text">{STAGE_META[stage].label}</span>
        </span>
      }
      action={
        <Link to={`/episodes?waitingFor=${stage}`} className="text-ui-sm text-accent-text hover:underline">
          All {num(f.waiting + f.inProgress)}
        </Link>
      }
    >
      <p className="mb-2 text-ui-sm text-ink-2 text-pretty">{d.bottleneck.explanation}</p>
      <EpisodeList items={d.bottleneckEpisodes} dense showStrip={false} right={(e) => <AdvanceButton ep={e} />} empty={<p className="text-ui-sm text-ink-3">Queue cleared.</p>} />
    </Panel>
  );
}

function PublishedTodayPanel({ rows }: { rows: PubRow[] }) {
  return (
    <Panel title={`Published today (${rows.length})`}>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-ui-sm text-ink-3">Nothing out yet today.</p>
      ) : (
        <ul className="grid gap-1.5">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-ui-sm">
              <span className="w-14 text-caption tabular text-ink-3">{time(p.published_at)}</span>
              <Code>{p.code}</Code>
              <Link to={`/episodes/${p.episode_id}`} className="min-w-0 flex-1 truncate hover:underline">
                {p.title}
              </Link>
              <span className="text-caption text-ink-3">{PLATFORM_LABEL[p.platform]}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
