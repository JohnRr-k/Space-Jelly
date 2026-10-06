import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAction } from '../lib/hooks';
import type { ActivityItem, ProjectStats, SeriesRow } from '../lib/types';
import { num, relative, titleCase } from '../lib/format';
import { Button, ErrorState, Panel, Skeleton, useConfirm } from '../components/ui';
import { ProgressBar, ProgressLegend, ProgressNumbers } from '../components/charts';
import { ProjectDot, Tags } from '../components/status';
import { ActivityFeed } from './Dashboard';
import { SeriesDialog } from '../components/forms';
import { PageShell, useGlobalUI } from '../components/Layout';
import { EpisodeTablePreview } from '../components/EpisodeTablePreview';
import { useToast } from '../components/toast';

interface SeriesData {
  series: SeriesRow;
  project: { id: number; name: string; code: string; color: string };
  stats: ProjectStats;
  sources: { id: number; title: string; type: string; author: string; episodes: number }[];
  ideas: { id: number; title: string; status: string; touched_at: string; created_at: string }[];
  activity: (ActivityItem & { episode_id: number | null })[];
}

export default function SeriesDetail() {
  const id = Number(useParams().id);
  const q = useQuery({ queryKey: ['series-detail', id], queryFn: () => api.get<SeriesData>(`/series/${id}`) });
  const [editing, setEditing] = useState(false);
  const ui = useGlobalUI();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const archive = useAction((archived: boolean) => api.patch(`/series/${id}`, { archived }), { success: (_r, a) => (a ? 'Series archived' : 'Series restored') });
  const del = useAction(() => api.del(`/series/${id}`), { onDone: () => (toast.success('Series moved to trash'), navigate('/series')) });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return <Skeleton className="h-96" />;
  const s = d.series;
  return (
    <PageShell>
      <header className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link to={`/projects/${d.project.id}`} className="inline-flex items-center gap-1.5 text-ui-sm text-ink-3 hover:text-ink">
            <ProjectDot color={d.project.color} /> {d.project.name}
          </Link>
          <h1 className="mt-1 text-heading font-semibold">{s.title}</h1>
          {s.description && <p className="mt-1 max-w-3xl text-ui text-ink-2">{s.description}</p>}
          <div className="mt-2">
            <Tags tags={s.tags} max={8} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => ui.newEpisode({ projectId: d.project.id, seriesId: id })}>
            Episode in series
          </Button>
          <Button icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" icon={s.archived_at ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />} onClick={() => archive.mutate(!s.archived_at)}>
            {s.archived_at ? 'Restore' : 'Archive'}
          </Button>
          <Button
            variant="ghost"
            aria-label="Move to trash"
            onClick={async () => {
              if (await confirm.ask(`Move series “${s.title}” to the trash?`, d.stats.total ? `It still has ${d.stats.total} episodes — reassign them first, or archive the series instead.` : 'You can restore it from Archive & trash.', 'Move to trash')) del.mutate(undefined);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </header>
      <section className="mb-5 rounded-lg border border-line bg-surface p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-ui">
          <span className="tabular">
            <b className="text-heading">{num(d.stats.total)}</b>
            <span className="text-ink-3">{s.target_count ? ` of ${num(s.target_count)} episodes` : ' episodes'}</span>
          </span>
          <span className="text-ink-2">{num(d.stats.inProduction)} in production</span>
          <span className="text-ink-2">{num(d.stats.ready)} ready</span>
          {d.stats.blocked > 0 && <span className="text-blocked-text">{d.stats.blocked} blocked</span>}
        </div>
        <ProgressBar stats={d.stats} height="h-3" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <ProgressNumbers stats={d.stats} />
          <ProgressLegend />
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <EpisodeTablePreview query={{ seriesIds: [id], sort: 'number' }} title="Episodes in this series" href={`/episodes?project=${d.project.id}&series=${id}&sort=number`} />
        <div className="grid min-w-0 content-start gap-5">
          <Panel title="Sources feeding this series">
            {d.sources.length === 0 ? (
              <p className="text-ui-sm text-ink-3">No sources linked through its episodes yet.</p>
            ) : (
              <ul className="grid gap-1">
                {d.sources.map((src) => (
                  <li key={src.id} className="flex items-center gap-2 text-ui-sm">
                    <Link to={`/sources/${src.id}`} className="min-w-0 flex-1 truncate hover:underline">
                      {src.title}
                    </Link>
                    <span className="text-caption text-ink-3">{titleCase(src.type)}</span>
                    <span className="tabular text-caption text-ink-2">{src.episodes} ep</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={`Related ideas (${d.ideas.length})`} action={<Button size="sm" variant="ghost" onClick={() => ui.newIdea({ projectId: d.project.id })}>Capture</Button>}>
            {d.ideas.length === 0 ? (
              <p className="text-ui-sm text-ink-3">No open ideas attached to this series or sharing its tags.</p>
            ) : (
              <ul className="grid gap-1.5">
                {d.ideas.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-ui-sm">
                    <Link to={`/ideas?open=${i.id}`} className="min-w-0 flex-1 truncate hover:underline">
                      {i.title}
                    </Link>
                    <span className="text-caption text-ink-3">untouched {relative(i.touched_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Recent activity">
            <ActivityFeed items={d.activity} />
          </Panel>
        </div>
      </div>
      {confirm.node}
      <SeriesDialog open={editing} onClose={() => setEditing(false)} series={s} />
    </PageShell>
  );
}
