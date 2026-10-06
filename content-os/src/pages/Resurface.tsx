import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Clock, FolderClock, Lightbulb, Shuffle, Sparkles, Hourglass } from 'lucide-react';
import { api } from '../lib/api';
import { useAction } from '../lib/hooks';
import type { EpisodeListItem } from '../lib/types';
import { relative, titleCase } from '../lib/format';
import { Button, ErrorState, Panel, Skeleton } from '../components/ui';
import { EpisodeList } from '../components/EpisodeList';
import { ProjectDot } from '../components/status';
import { PageShell } from '../components/Layout';
import { useToast } from '../components/toast';

interface ResurfaceData {
  thresholds: { dormantDays: number; stuckDays: number; quietDays: number };
  forgottenIdeas: { id: number; title: string; thought: string; status: string; project_name: string | null; project_color: string | null; source_title: string | null; message: string; untouchedDays: number }[];
  stalledEpisodes: EpisodeListItem[];
  quietProjects: { id: number; name: string; color: string; message: string }[];
  underusedSources: { id: number; title: string; type: string; author: string; message: string; episodes: number; potential: number | null; unused_insights: number }[];
  relatedToActive: { message: string; series_id?: number; project_id?: number; project_color: string }[];
}

/** Dormant intelligence: what you captured or started and then forgot. */
export default function Resurface() {
  const q = useQuery({ queryKey: ['resurface'], queryFn: () => api.get<ResurfaceData>('/resurface') });
  const navigate = useNavigate();
  const toast = useToast();
  const touch = useAction((a: { id: number; patch: Record<string, unknown> }) => api.patch(`/ideas/${a.id}`, a.patch), {
    success: (_r, a) => (a.patch.snoozeDays ? 'Snoozed for 30 days' : a.patch.status === 'DISCARDED' ? 'Discarded' : 'Kept — it won’t resurface for a while'),
  });
  const random = async () => {
    const r = await api.get<{ id: number | null }>('/random-idea');
    if (r.id) navigate(`/ideas?open=${r.id}`);
    else toast.warn('No open ideas to pick from.');
  };
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <PageShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading font-semibold">Resurface</h1>
          <p className="mt-0.5 max-w-2xl text-ui text-ink-2">The archive is dormant intelligence. Everything here was captured or started and then left alone. Decide on each: develop, keep, snooze or let go.</p>
        </div>
        <Button icon={<Shuffle className="size-3.5" />} onClick={random}>
          Random idea
        </Button>
      </div>
      {!d ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title={<span className="flex items-center gap-2"><Lightbulb className="size-4 text-ink-3" />Forgotten ideas ({d.forgottenIdeas.length})</span>} className="xl:row-span-2">
            <p className="-mt-1 mb-3 text-ui-sm text-ink-3">Untouched for {d.thresholds.dormantDays}+ days, oldest first.</p>
            {d.forgottenIdeas.length === 0 ? (
              <p className="py-6 text-center text-ui-sm text-ink-3">No forgotten ideas. Impressive.</p>
            ) : (
              <ul className="grid gap-2">
                {d.forgottenIdeas.map((i) => (
                  <li key={i.id} className="rounded-md border border-line px-3 py-2.5">
                    <Link to={`/ideas?open=${i.id}`} className="text-ui font-medium hover:underline">
                      {i.title}
                    </Link>
                    {i.thought && <p className="mt-0.5 line-clamp-2 text-ui-sm text-ink-2">{i.thought}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-caption">
                      <span className="text-progress-text">{i.message}</span>
                      {i.project_name && (
                        <span className="inline-flex items-center gap-1 text-ink-3">
                          <ProjectDot color={i.project_color ?? '#888'} /> {i.project_name}
                        </span>
                      )}
                      {i.source_title && <span className="text-ink-3">{i.source_title}</span>}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="primary" onClick={() => navigate(`/ideas?open=${i.id}`)}>
                        Develop
                      </Button>
                      <Button size="sm" onClick={() => touch.mutate({ id: i.id, patch: { touch: true } })}>
                        Keep
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Clock className="size-3.5" />} onClick={() => touch.mutate({ id: i.id, patch: { snoozeDays: 30 } })}>
                        Snooze 30d
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => touch.mutate({ id: i.id, patch: { status: 'DISCARDED' } })}>
                        Let go
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {d.relatedToActive.length > 0 && (
            <Panel title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-ink-3" />Old ideas for work you’re doing now</span>}>
              <ul className="grid gap-1.5">
                {d.relatedToActive.map((r, i) => (
                  <li key={i}>
                    <Link to={r.series_id ? `/series/${r.series_id}` : `/ideas?view=dormant&project=${r.project_id}`} className="-mx-1 flex items-center gap-2 rounded px-1 py-1 text-ui-sm hover:bg-hover">
                      <ProjectDot color={r.project_color} />
                      {r.message}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title={<span className="flex items-center gap-2"><Hourglass className="size-4 text-ink-3" />Stuck episodes ({d.stalledEpisodes.length})</span>} action={<Link to="/episodes?view=stalled" className="text-ui-sm text-accent-text hover:underline">All stalled</Link>}>
            <p className="-mt-1 mb-2 text-ui-sm text-ink-3">In production with no progress for {d.thresholds.stuckDays}+ days.</p>
            <EpisodeList items={d.stalledEpisodes} dense showStrip={false} right={(e) => <span className="whitespace-nowrap text-caption text-ink-3">{relative(e.progressAt ?? e.createdAt)}</span>} empty={<p className="py-4 text-center text-ui-sm text-ink-3">Nothing stuck.</p>} />
          </Panel>
          <Panel title={<span className="flex items-center gap-2"><BookOpen className="size-4 text-ink-3" />Sources with more to give</span>}>
            {d.underusedSources.length === 0 ? (
              <p className="text-ui-sm text-ink-3">Every source is either exhausted or well used.</p>
            ) : (
              <ul className="grid gap-2">
                {d.underusedSources.map((s) => (
                  <li key={s.id}>
                    <Link to={`/sources/${s.id}`} className="-mx-1 block rounded px-1 py-1 hover:bg-hover">
                      <span className="text-ui font-medium">{s.title}</span>
                      <span className="ml-2 text-caption text-ink-3">{titleCase(s.type)}</span>
                      <span className="block text-ui-sm text-ink-2">{s.message}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={<span className="flex items-center gap-2"><FolderClock className="size-4 text-ink-3" />Quiet projects</span>}>
            {d.quietProjects.length === 0 ? (
              <p className="text-ui-sm text-ink-3">Every active project moved in the last {d.thresholds.quietDays} days.</p>
            ) : (
              <ul className="grid gap-1.5">
                {d.quietProjects.map((p) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`} className="-mx-1 flex items-center gap-2 rounded px-1 py-1 hover:bg-hover">
                      <ProjectDot color={p.color} />
                      <span className="text-ui font-medium">{p.name}</span>
                      <span className="text-ui-sm text-ink-3">{p.message}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </PageShell>
  );
}
