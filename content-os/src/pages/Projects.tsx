import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderPlus } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectRow } from '../lib/types';
import { num, relative, titleCase } from '../lib/format';
import { Button, Empty, ErrorState, PageHeader, Skeleton, cx } from '../components/ui';
import { ProgressBar, ProgressLegend, ProgressNumbers } from '../components/charts';
import { ProjectDot } from '../components/status';
import { ProjectDialog } from '../components/forms';
import { PageShell } from '../components/Layout';

export default function Projects() {
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['projects', showArchived], queryFn: () => api.get<ProjectRow[]>(`/projects${showArchived ? '?archived=1' : ''}`) });
  return (
    <PageShell>
      <PageHeader
        title="Projects"
        subtitle="Each project is a content engine. Coverage = how much of the target exists; completion = how much of the target is actually produced."
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
            <Button variant="primary" icon={<FolderPlus className="size-3.5" />} onClick={() => setCreating(true)}>
              New project
            </Button>
          </>
        }
      >
        <ProgressLegend className="mt-3" />
      </PageHeader>
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : q.data.length === 0 ? (
        <Empty icon={<FolderPlus className="size-6" />} title="No projects yet" action={<Button variant="primary" onClick={() => setCreating(true)}>Create your first project</Button>}>
          A project is a long-running content engine — e.g. “Bible — 400 Human Stories”.
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className={cx('group block rounded-lg border border-line bg-surface p-5 shadow-card transition-colors hover:border-line-strong', p.archived_at && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <ProjectDot color={p.color} className="mt-1.5 size-2.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h2 className="truncate text-title font-semibold group-hover:underline">{p.name}</h2>
                    <span className="font-mono text-caption text-ink-3">{p.code}</span>
                    <span className={cx('ml-auto rounded px-1.5 text-caption', p.status === 'ACTIVE' ? 'bg-accent-subtle text-accent-text' : 'bg-hover text-ink-2')}>{p.archived_at ? 'Archived' : titleCase(p.status)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-ui-sm text-ink-2">{p.description || 'No description.'}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-baseline justify-between text-ui-sm">
                  <span className="tabular">
                    <b className="text-title">{num(p.stats.total)}</b>
                    <span className="text-ink-3">{p.target_count ? ` of ${num(p.target_count)} episodes` : ' episodes'}</span>
                  </span>
                  <span className="text-caption text-ink-3">{p.seriesCount} series · last activity {relative(p.stats.lastActivityAt)}</span>
                </div>
                <ProgressBar stats={p.stats} height="h-3" />
                <div className="mt-3 grid grid-cols-4 gap-2 text-ui-sm">
                  <Stat label="In production" value={p.stats.inProduction} />
                  <Stat label="Blocked" value={p.stats.blocked} tone={p.stats.blocked ? 'text-blocked-text' : undefined} />
                  <Stat label="Ready" value={p.stats.ready} />
                  <Stat label="Published" value={p.stats.published} />
                </div>
                <div className="mt-3 border-t border-line pt-3">
                  <ProgressNumbers stats={p.stats} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <ProjectDialog open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  );
}

export function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="text-caption text-ink-3">{label}</div>
      <div className={cx('tabular font-semibold', tone)}>{num(value)}</div>
    </div>
  );
}
