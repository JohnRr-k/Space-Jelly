import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layers, Plus } from 'lucide-react';
import { api } from '../lib/api';
import type { SeriesRow } from '../lib/types';
import { num } from '../lib/format';
import { Button, Empty, ErrorState, PageHeader, Skeleton, cx } from '../components/ui';
import { ProgressBar, ProgressLegend } from '../components/charts';
import { ProjectDot } from '../components/status';
import { SeriesDialog } from '../components/forms';
import { PageShell } from '../components/Layout';

export default function SeriesList() {
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['series', archived], queryFn: () => api.get<SeriesRow[]>(`/series${archived ? '?archived=1' : ''}`) });
  const byProject = new Map<number, SeriesRow[]>();
  for (const s of q.data ?? []) byProject.set(s.project_id, [...(byProject.get(s.project_id) ?? []), s]);
  return (
    <PageShell>
      <PageHeader
        title="Series"
        subtitle="Thematic runs inside each project."
        actions={
          <>
            <Button variant="ghost" onClick={() => setArchived((a) => !a)}>
              {archived ? 'Hide archived' : 'Show archived'}
            </Button>
            <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
              New series
            </Button>
          </>
        }
      >
        <ProgressLegend className="mt-3" />
      </PageHeader>
      {q.error ? (
        <ErrorState error={q.error} />
      ) : !q.data ? (
        <Skeleton className="h-96" />
      ) : q.data.length === 0 ? (
        <Empty icon={<Layers className="size-6" />} title="No series yet" action={<Button onClick={() => setCreating(true)}>Create a series</Button>} />
      ) : (
        <div className="grid gap-5">
          {[...byProject.entries()].map(([pid, list]) => (
            <section key={pid} className="rounded-lg border border-line bg-surface shadow-card">
              <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <ProjectDot color={list[0].project_color ?? '#888'} />
                <Link to={`/projects/${pid}`} className="text-ui font-semibold hover:underline">
                  {list[0].project_name}
                </Link>
                <span className="text-caption text-ink-3">{list.length} series</span>
              </header>
              <div className="divide-y divide-line">
                {list.map((s) => (
                  <Link key={s.id} to={`/series/${s.id}`} className={cx('grid grid-cols-1 items-center gap-x-5 gap-y-1 px-4 py-2.5 hover:bg-hover md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_14rem]', s.archived_at && 'opacity-60')}>
                    <span className="min-w-0">
                      <span className="block truncate text-ui font-medium">{s.title}</span>
                      <span className="block truncate text-caption text-ink-3">{s.description}</span>
                    </span>
                    <ProgressBar stats={s.stats} />
                    <span className="flex justify-between gap-3 text-caption text-ink-3 tabular md:justify-end">
                      <span>{num(s.stats.total)}{s.target_count ? ` / ${num(s.target_count)}` : ''} created</span>
                      <span>{num(s.stats.inProduction)} in prod.</span>
                      <span className="font-medium text-ink-2">{num(s.stats.published)} pub.</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <SeriesDialog open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  );
}
