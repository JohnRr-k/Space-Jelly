import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Columns3, ListVideo, MoreHorizontal, Pencil, Plus, Trash2, Lightbulb } from 'lucide-react';
import { STAGE_META } from '../../shared/domain';
import { api } from '../lib/api';
import { useAction } from '../lib/hooks';
import type { ActivityItem, Bottleneck, EpisodeListItem, ProjectRow, ProjectStats, SeriesRow } from '../lib/types';
import { num, titleCase } from '../lib/format';
import { Button, ErrorState, MenuItem, Panel, Popover, Skeleton, Tabs, cx, useConfirm } from '../components/ui';
import { FlowChart, ProgressBar, ProgressLegend, ProgressNumbers } from '../components/charts';
import { EpisodeList } from '../components/EpisodeList';
import { ProjectDot } from '../components/status';
import { ActivityFeed } from './Dashboard';
import { ProjectDialog, SeriesDialog } from '../components/forms';
import { PageShell, useGlobalUI } from '../components/Layout';
import { useToast } from '../components/toast';

interface ProjectData {
  project: ProjectRow;
  stats: ProjectStats;
  series: SeriesRow[];
  blocked: EpisodeListItem[];
  ready: EpisodeListItem[];
  inProduction: EpisodeListItem[];
  sources: { id: number; title: string; type: string; author: string; status: string; potential: number | null; episodes: number }[];
  ideas: { open: number; dormant: number };
  activity: (ActivityItem & { episode_id: number | null })[];
}

export default function ProjectDetail() {
  const id = Number(useParams().id);
  const q = useQuery({ queryKey: ['project', id], queryFn: () => api.get<ProjectData>(`/projects/${id}`) });
  const bn = useQuery({ queryKey: ['bottleneck', id], queryFn: () => api.get<Bottleneck>(`/bottleneck?projectId=${id}`) });
  const [editing, setEditing] = useState(false);
  const [seriesDlg, setSeriesDlg] = useState<SeriesRow | null | 'new'>(null);
  const [tab, setTab] = useState<'production' | 'blocked' | 'ready'>('production');
  const ui = useGlobalUI();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const archive = useAction((archived: boolean) => api.patch(`/projects/${id}`, { archived }), { success: (_r, a) => (a ? 'Project archived' : 'Project restored') });
  const del = useAction(() => api.del(`/projects/${id}`), { onDone: () => (toast.success('Project moved to trash'), navigate('/projects')) });

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  if (!d)
    return (
      <PageShell>
        <Skeleton className="mb-4 h-24" />
        <Skeleton className="h-96" />
      </PageShell>
    );
  const p = d.project;
  const s = d.stats;
  const remaining = s.target ? Math.max(0, s.target - s.total) : null;

  return (
    <PageShell>
      <header className="mb-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-ui-sm text-ink-3">
              <Link to="/projects" className="hover:text-ink">
                Projects
              </Link>
              <span>/</span>
              <span className="font-mono">{p.code}</span>
              <span className={cx('rounded px-1.5 text-caption', p.status === 'ACTIVE' ? 'bg-accent-subtle text-accent-text' : 'bg-hover text-ink-2')}>{p.archived_at ? 'Archived' : titleCase(p.status)}</span>
            </div>
            <h1 className="mt-1 flex items-center gap-2.5 text-heading font-semibold">
              <ProjectDot color={p.color} className="size-3" /> {p.name}
            </h1>
            {p.description && <p className="mt-1 max-w-3xl text-ui text-ink-2 text-pretty">{p.description}</p>}
            {p.goal && (
              <p className="mt-1 max-w-3xl text-ui text-ink-2">
                <span className="text-ink-3">Goal: </span>
                {p.goal}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/board?project=${id}`}>
              <Button icon={<Columns3 className="size-3.5" />}>Board</Button>
            </Link>
            <Link to={`/episodes?project=${id}`}>
              <Button icon={<ListVideo className="size-3.5" />}>All episodes</Button>
            </Link>
            <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => ui.newEpisode({ projectId: id })}>
              Episode
            </Button>
            <Popover
              align="end"
              trigger={({ toggle }) => (
                <Button variant="ghost" aria-label="More" onClick={toggle}>
                  <MoreHorizontal className="size-4" />
                </Button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem icon={<Pencil />} onClick={() => (close(), setEditing(true))}>
                    Edit project
                  </MenuItem>
                  <MenuItem icon={<Lightbulb />} onClick={() => (close(), ui.newIdea({ projectId: id }))}>
                    Capture idea for this project
                  </MenuItem>
                  <MenuItem icon={p.archived_at ? <ArchiveRestore /> : <Archive />} onClick={() => (close(), archive.mutate(!p.archived_at))}>
                    {p.archived_at ? 'Restore project' : 'Archive project'}
                  </MenuItem>
                  <MenuItem
                    icon={<Trash2 />}
                    danger
                    onClick={async () => {
                      close();
                      if (await confirm.ask(`Move “${p.name}” to the trash?`, s.total ? `It still has ${s.total} episodes — you’ll need to move or delete them first. Archiving is usually what you want.` : 'You can restore it from Archive & trash.', 'Move to trash')) del.mutate(undefined);
                    }}
                  >
                    Move to trash…
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
        </div>
      </header>

      <section className="mb-5 rounded-lg border border-line bg-surface p-5 shadow-card">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          <Big label="Target" value={s.target} />
          <Big label="Created" value={s.total} />
          <Big label="Published" value={s.published} />
          <Big label="Scheduled" value={s.scheduled} />
          <Big label="Ready" value={s.ready} />
          <Big label="In production" value={s.inProduction} />
          <Big label="Blocked" value={s.blocked} tone={s.blocked ? 'text-blocked-text' : undefined} />
          <Big label="Not created yet" value={remaining} />
        </div>
        <ProgressBar stats={s} height="h-4" className="mt-5" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <ProgressNumbers stats={s} />
          <ProgressLegend />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-5">
          <Panel title={`Series (${d.series.length})`} action={<Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setSeriesDlg('new')}>New series</Button>} bodyClass="px-0 pb-1">
            {d.series.length === 0 ? (
              <p className="px-4 pb-3 text-ui-sm text-ink-3">No series yet. Series group episodes by theme — e.g. Faith, Power, Family.</p>
            ) : (
              <div className="divide-y divide-line">
                {d.series.map((sr) => (
                  <div key={sr.id} className={cx('grid grid-cols-1 items-center gap-x-4 gap-y-1 px-4 py-2.5 hover:bg-hover sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]', sr.archived_at && 'opacity-60')}>
                    <Link to={`/series/${sr.id}`} className="truncate text-ui font-medium hover:underline">
                      {sr.title}
                    </Link>
                    <ProgressBar stats={sr.stats} />
                    <span className="tabular whitespace-nowrap text-caption text-ink-3">
                      {num(sr.stats.published)} pub · {num(sr.stats.total)}
                      {sr.target_count ? ` / ${num(sr.target_count)}` : ''}
                      <button className="ml-2 rounded p-0.5 hover:text-ink" aria-label={`Edit ${sr.title}`} onClick={() => setSeriesDlg(sr)}>
                        <Pencil className="inline size-3" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Episodes">
            <Tabs
              className="-mx-4 mb-2 px-2"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'production', label: 'In production', count: s.inProduction },
                { value: 'blocked', label: 'Blocked', count: s.blocked },
                { value: 'ready', label: 'Ready', count: s.ready },
              ]}
            />
            <EpisodeList items={tab === 'production' ? d.inProduction : tab === 'blocked' ? d.blocked : d.ready} empty={<p className="py-6 text-center text-ui-sm text-ink-3">None.</p>} />
            <Link to={`/episodes?project=${id}${tab === 'blocked' ? '&blocked=1' : tab === 'ready' ? '&phase=READY' : '&phase=RESEARCH,SCRIPT,VOICE,VISUAL,EDIT,QC'}`} className="mt-2 inline-block text-ui-sm text-accent-text hover:underline">
              Open in library
            </Link>
          </Panel>
        </div>
        <div className="grid min-w-0 content-start gap-5">
          {bn.data && (
            <Panel title={<span>Bottleneck{bn.data.stage && <span className="ml-2 rounded bg-accent-subtle px-1.5 text-caption font-semibold text-accent-text">{STAGE_META[bn.data.stage].label}</span>}</span>}>
              <p className="mb-3 text-ui-sm text-ink-2">{bn.data.explanation}</p>
              <FlowChart data={bn.data} compact />
            </Panel>
          )}
          <Panel title={`Sources (${d.sources.length})`} action={<Link to={`/sources?project=${id}`} className="text-ui-sm text-accent-text hover:underline">Source library</Link>}>
            {d.sources.length === 0 ? (
              <p className="text-ui-sm text-ink-3">No sources linked yet.</p>
            ) : (
              <ul className="grid gap-1">
                {d.sources.slice(0, 12).map((src) => (
                  <li key={src.id} className="flex items-center gap-2 text-ui-sm">
                    <Link to={`/sources/${src.id}`} className="min-w-0 flex-1 truncate hover:underline">
                      {src.title}
                    </Link>
                    <span className="text-caption text-ink-3">{titleCase(src.type)}</span>
                    <span className="tabular w-16 text-right text-caption text-ink-2">
                      {src.episodes}
                      {src.potential ? ` / ${src.potential}` : ''} ep
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 border-t border-line pt-2 text-ui-sm text-ink-2">
              <Link to={`/ideas?view=all&project=${id}`} className="hover:underline">
                {d.ideas.open} open ideas
              </Link>
              {d.ideas.dormant > 0 && (
                <>
                  {', '}
                  <Link to="/resurface" className="text-progress-text hover:underline">
                    {d.ideas.dormant} dormant
                  </Link>
                </>
              )}
            </div>
          </Panel>
          <Panel title="Recent activity">
            <ActivityFeed items={d.activity.slice(0, 12)} />
          </Panel>
        </div>
      </div>
      {confirm.node}
      <ProjectDialog open={editing} onClose={() => setEditing(false)} project={p} />
      <SeriesDialog open={!!seriesDlg} onClose={() => setSeriesDlg(null)} series={seriesDlg === 'new' ? null : seriesDlg} projectId={id} />
    </PageShell>
  );
}

function Big({ label, value, tone }: { label: string; value: number | null; tone?: string }) {
  return (
    <div>
      <div className="text-caption text-ink-3">{label}</div>
      <div className={cx('tabular text-heading font-semibold', tone)}>{value === null ? '—' : num(value)}</div>
    </div>
  );
}
