import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ExternalLink, Lightbulb, Pencil, Plus, Quote, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { PHASES, PHASE_META, SOURCE_STATUSES } from '../../shared/domain';
import { api } from '../lib/api';
import { useAction } from '../lib/hooks';
import type { EpisodeListItem, Source } from '../lib/types';
import { num, relative, titleCase } from '../lib/format';
import { Button, ErrorState, Input, Panel, Select, Skeleton, Textarea, cx, useConfirm } from '../components/ui';
import { EpisodeList } from '../components/EpisodeList';
import { SourceDialog } from '../components/forms';
import { PageShell, useGlobalUI } from '../components/Layout';
import { useToast } from '../components/toast';

interface Insight {
  id: number;
  statement: string;
  detail: string;
  locator: string;
  episode_count: number;
  idea_count: number;
  created_at: string;
}
interface SourceData {
  source: Source;
  counts: { episode_count: number; published_count: number; insight_count: number; idea_count: number };
  person: { id: number; name: string; kind: string; bio: string } | null;
  insights: Insight[];
  ideas: { id: number; title: string; status: string; touched_at: string; created_at: string; insight_id: number | null; episode_count: number }[];
  episodes: EpisodeListItem[];
  phases: Record<string, number>;
}

export default function SourceDetail() {
  const id = Number(useParams().id);
  const q = useQuery({ queryKey: ['source', id], queryFn: () => api.get<SourceData>(`/sources/${id}`) });
  const [editing, setEditing] = useState(false);
  const ui = useGlobalUI();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const setStatus = useAction((status: string) => api.patch(`/sources/${id}`, { status }), { success: 'Processing status updated' });
  const archive = useAction((archived: boolean) => api.patch(`/sources/${id}`, { archived }), { success: (_r, a) => (a ? 'Source archived' : 'Source restored') });
  const del = useAction(() => api.del(`/sources/${id}`), { onDone: () => (toast.success('Source moved to trash'), navigate('/sources')) });

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return <Skeleton className="h-96" />;
  const s = d.source;
  const funnel = [
    { label: 'Insights', value: d.counts.insight_count },
    { label: 'Ideas', value: d.counts.idea_count },
    { label: 'Episodes', value: d.counts.episode_count, sub: s.potential ? `of ~${s.potential} potential` : undefined },
    { label: 'Published', value: d.counts.published_count },
  ];

  return (
    <PageShell>
      <header className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link to="/sources" className="text-ui-sm text-ink-3 hover:text-ink">
            Source library
          </Link>
          <h1 className="mt-1 text-heading font-semibold">{s.title}</h1>
          <p className="mt-1 text-ui text-ink-2">
            {titleCase(s.type)}
            {s.author && ` by ${s.author}`}
            {s.citation && ` — ${s.citation}`}
            {s.year ? ` (${s.year})` : ''}
          </p>
          {s.description && <p className="mt-1 max-w-3xl text-ui-sm text-ink-2">{s.description}</p>}
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-ui-sm text-accent-text hover:underline">
              {s.url} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={s.status} onChange={(e) => setStatus.mutate(e.target.value)} className="w-auto" aria-label="Processing status">
            {SOURCE_STATUSES.map((st) => (
              <option key={st} value={st}>
                {titleCase(st)}
              </option>
            ))}
          </Select>
          <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => ui.newEpisode({ sourceId: id, projectId: s.project_id ?? undefined })}>
            Episode from source
          </Button>
          <Button icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" aria-label={s.archived_at ? 'Restore' : 'Archive'} onClick={() => archive.mutate(!s.archived_at)}>
            {s.archived_at ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            aria-label="Move to trash"
            onClick={async () => {
              if (await confirm.ask(`Move “${s.title}” to the trash?`, 'Episodes keep existing; only the source record is hidden. Restorable from Archive & trash.', 'Move to trash')) del.mutate(undefined);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </header>

      <section aria-label="Lineage" className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card sm:grid-cols-4">
        {funnel.map((f, i) => (
          <div key={f.label} className="relative bg-surface px-4 py-3">
            <div className="text-caption text-ink-3">{f.label}</div>
            <div className="tabular text-display font-semibold">{num(f.value)}</div>
            {f.sub && <div className="text-caption text-ink-3">{f.sub}</div>}
            {i < funnel.length - 1 && <ArrowRight className="absolute right-3 top-1/2 hidden size-4 -translate-y-1/2 text-ink-3/50 sm:block" />}
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid min-w-0 content-start gap-5">
          <InsightsPanel sourceId={id} insights={d.insights} projectId={s.project_id} />
          <Panel title={`Ideas from this source (${d.ideas.length})`} action={<Button size="sm" variant="ghost" icon={<Lightbulb className="size-3.5" />} onClick={() => ui.newIdea({ sourceId: id, projectId: s.project_id })}>Capture</Button>}>
            {d.ideas.length === 0 ? (
              <p className="text-ui-sm text-ink-3">No ideas extracted yet.</p>
            ) : (
              <ul className="grid gap-1.5">
                {d.ideas.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-ui-sm">
                    <Link to={`/ideas?open=${i.id}`} className="min-w-0 flex-1 truncate hover:underline">
                      {i.title}
                    </Link>
                    <span className={cx('rounded px-1.5 text-caption', i.status === 'CONVERTED' ? 'bg-done-bg text-done-text' : 'bg-hover text-ink-2')}>{titleCase(i.status)}</span>
                    <span className="w-20 text-right text-caption text-ink-3">{relative(i.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <Panel title={`Content produced (${d.episodes.length})`} action={<Link to={`/episodes?source=${id}`} className="text-ui-sm text-accent-text hover:underline">Open in library</Link>}>
          {d.episodes.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-ui-sm">
              {PHASES.filter((p) => d.phases[p]).map((p) => (
                <span key={p}>
                  <span className="text-ink-3">{PHASE_META[p].label} </span>
                  <b className="tabular font-medium">{d.phases[p]}</b>
                </span>
              ))}
            </div>
          )}
          <EpisodeList items={d.episodes} empty={<p className="py-6 text-center text-ui-sm text-ink-3">Nothing produced from this source yet.</p>} />
        </Panel>
      </div>
      {confirm.node}
      <SourceDialog open={editing} onClose={() => setEditing(false)} source={s} />
    </PageShell>
  );
}

function InsightsPanel({ sourceId, insights, projectId }: { sourceId: number; insights: Insight[]; projectId: number | null }) {
  const [statement, setStatement] = useState('');
  const [locator, setLocator] = useState('');
  const [detail, setDetail] = useState('');
  const add = useAction(() => api.post(`/sources/${sourceId}/insights`, { statement, locator, detail }), { success: 'Insight captured', onDone: () => (setStatement(''), setLocator(''), setDetail('')) });
  const toIdea = useAction((iid: number) => api.post(`/insights/${iid}/idea`, { projectId }), { success: 'Idea created in the inbox' });
  const del = useAction((iid: number) => api.del(`/insights/${iid}`), { success: 'Insight removed' });
  return (
    <Panel title={`Insights (${insights.length})`}>
      <p className="mb-3 text-ui-sm text-ink-3">An insight is research, not content. One insight can seed several episode ideas.</p>
      <form
        className="mb-3 grid gap-2 rounded-md border border-line bg-surface-2 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (statement.trim()) add.mutate(undefined);
        }}
      >
        <Textarea rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Capture an insight from this source…" />
        {statement && <Textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Supporting detail or quote (optional)" />}
        <div className="flex gap-2">
          <Input value={locator} onChange={(e) => setLocator(e.target.value)} placeholder="Page / chapter / verse / timestamp" className="flex-1" />
          <Button type="submit" variant="primary" disabled={!statement.trim()} loading={add.isPending}>
            Add
          </Button>
        </div>
      </form>
      <ul className="grid gap-2">
        {insights.map((i) => (
          <li key={i.id} className="group rounded-md border-l-2 border-accent/50 bg-surface-2 px-3 py-2">
            <div className="flex items-start gap-2">
              <Quote className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
              <p className="flex-1 text-ui text-ink">{i.statement}</p>
            </div>
            {i.detail && <p className="mt-1 pl-5 text-ui-sm text-ink-2">{i.detail}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-3 pl-5 text-caption text-ink-3">
              {i.locator && <span>{i.locator}</span>}
              <span className={cx(i.episode_count + i.idea_count === 0 && 'text-progress-text')}>{i.episode_count + i.idea_count === 0 ? 'Never used' : `${i.idea_count} idea${i.idea_count === 1 ? '' : 's'}, ${i.episode_count} episode${i.episode_count === 1 ? '' : 's'}`}</span>
              <button className="text-accent-text hover:underline" onClick={() => toIdea.mutate(i.id)}>
                Make idea
              </button>
              <button className="ml-auto hidden hover:text-blocked-text group-hover:inline" aria-label="Remove insight" onClick={() => del.mutate(i.id)}>
                <Trash2 className="size-3" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
