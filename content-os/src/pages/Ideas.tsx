import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightCircle, BookOpen, Clock, Layers, Lightbulb, MoreHorizontal, PauseCircle, Search, Sparkles, Trash2, XCircle, Archive } from 'lucide-react';
import { PRIORITY_LABEL } from '../../shared/domain';
import { api } from '../lib/api';
import { useAction, useDebounced, useLocalState, useMeta } from '../lib/hooks';
import type { EpisodeListItem, Idea } from '../lib/types';
import { daysSince, relative, shortDate, titleCase } from '../lib/format';
import { Button, Empty, ErrorState, Field, Input, MenuItem, Modal, Popover, Select, Skeleton, Tabs, Textarea, cx, useConfirm } from '../components/ui';
import { PrioritySelect, ProjectSelect, SeriesSelect } from '../components/dialogs';
import { TagInput } from '../components/TagInput';
import { ProjectDot, PriorityMark, Tags } from '../components/status';
import { EpisodeList } from '../components/EpisodeList';
import { PageShell } from '../components/Layout';
import { useToast } from '../components/toast';

type View = 'inbox' | 'dormant' | 'recent' | 'developing' | 'converted' | 'parked' | 'all';
interface IdeasData {
  items: (Idea & { episode_count: number })[];
  total: number;
  counts: Record<View, number | null>;
}

export default function Ideas() {
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) ?? 'inbox';
  const projectId = params.get('project') ? Number(params.get('project')) : undefined;
  const openId = params.get('open') ? Number(params.get('open')) : null;
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 200);
  const list = useQuery({
    queryKey: ['ideas', view, dq, projectId],
    queryFn: () => api.get<IdeasData>(`/ideas?view=${view}&limit=300${dq ? `&q=${encodeURIComponent(dq)}` : ''}${projectId ? `&projectId=${projectId}` : ''}`),
    placeholderData: (p) => p,
  });
  const meta = useMeta();
  const [convert, setConvert] = useState<{ idea: Idea; to: 'episode' | 'series' } | null>(null);
  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const c = list.data?.counts;

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading font-semibold">Idea inbox</h1>
          <p className="mt-0.5 text-ui text-ink-2">Capture in seconds. Process later into episodes, series or research.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/resurface">
            <Button icon={<Sparkles className="size-3.5" />}>Resurface</Button>
          </Link>
        </div>
      </div>
      <QuickCapture projectId={projectId} />
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Tabs
          className="min-w-0 flex-1"
          value={view}
          onChange={(v) => setParam('view', v === 'inbox' ? null : v)}
          tabs={[
            { value: 'inbox', label: 'Unprocessed', count: c?.inbox ?? null },
            { value: 'dormant', label: 'Dormant', count: c?.dormant ?? null },
            { value: 'recent', label: 'Recent', count: c?.recent ?? null },
            { value: 'developing', label: 'Developing', count: c?.developing ?? null },
            { value: 'converted', label: 'Converted', count: c?.converted ?? null },
            { value: 'parked', label: 'Parked & archived', count: c?.parked ?? null },
            { value: 'all', label: 'All', count: c?.all ?? null },
          ]}
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ideas" className="w-48 pl-8" />
        </div>
        <Select value={projectId ?? ''} onChange={(e) => setParam('project', e.target.value || null)} className="w-auto" aria-label="Project">
          <option value="">All projects</option>
          {meta.data?.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      {view === 'dormant' && <p className="mt-2 text-ui-sm text-ink-3">Ideas nobody has touched for {meta.data?.settings.dormant_idea_days ?? 30}+ days. Develop, park or discard — don’t let them silently rot.</p>}
      <div className="mt-3">
        {list.error ? (
          <ErrorState error={list.error} />
        ) : !list.data ? (
          <Skeleton className="h-80" />
        ) : list.data.items.length === 0 ? (
          <Empty icon={<Lightbulb className="size-6" />} title={view === 'inbox' ? 'Inbox zero' : 'No ideas here'}>
            {view === 'inbox' ? 'Every idea has been processed. Capture new ones above or press I anywhere.' : 'Try another tab.'}
          </Empty>
        ) : (
          <ul className="grid gap-2">
            {list.data.items.map((i) => (
              <IdeaRow key={i.id} idea={i} onOpen={() => setParam('open', String(i.id))} onConvert={(to) => setConvert({ idea: i, to })} />
            ))}
          </ul>
        )}
      </div>
      <ConvertDialog value={convert} onClose={() => setConvert(null)} />
      <IdeaDetail id={openId} onClose={() => setParam('open', null)} onConvert={(idea, to) => setConvert({ idea, to })} />
    </PageShell>
  );
}

function QuickCapture({ projectId }: { projectId?: number }) {
  const [lastProject, setLastProject] = useLocalState<number | null>('last-project', null);
  const [title, setTitle] = useState('');
  const [project, setProject] = useState<number | null>(projectId ?? lastProject);
  const save = useAction(() => api.post('/ideas', { title: title.trim(), projectId: project }), {
    success: 'Captured',
    onDone: () => {
      setTitle('');
      if (project) setLastProject(project);
    },
  });
  return (
    <form
      className="flex flex-wrap gap-2 rounded-lg border border-line bg-surface p-2 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) save.mutate(undefined);
      }}
    >
      <Lightbulb className="ml-1 mt-2 size-4 text-ink-3" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New idea — type and press Enter" className="h-8 min-w-60 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3" aria-label="New idea" />
      <div className="w-52">
        <ProjectSelect value={project} onChange={setProject} allowNone noneLabel="No project" />
      </div>
      <Button type="submit" variant="primary" loading={save.isPending} disabled={!title.trim()}>
        Capture
      </Button>
    </form>
  );
}

function IdeaRow({ idea: i, onOpen, onConvert }: { idea: Idea & { episode_count: number }; onOpen: () => void; onConvert: (to: 'episode' | 'series') => void }) {
  const update = useAction((patch: Record<string, unknown>) => api.patch(`/ideas/${i.id}`, patch), { success: (_r, p) => (p.snoozeDays ? `Snoozed for ${p.snoozeDays} days` : p.status ? `Marked ${String(p.status).toLowerCase()}` : p.archived ? 'Archived' : 'Kept — marked as reviewed') });
  const confirm = useConfirm();
  const del = useAction(() => api.del(`/ideas/${i.id}`), { success: 'Moved to trash' });
  const untouched = daysSince(i.touched_at) ?? 0;
  const age = daysSince(i.created_at) ?? 0;
  const open = i.status !== 'CONVERTED' && i.status !== 'DISCARDED';
  return (
    <li className="group rounded-lg border border-line bg-surface px-4 py-3 shadow-card hover:border-line-strong">
      <div className="flex flex-wrap items-start gap-3">
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <span className="block text-ui font-medium text-ink group-hover:underline">{i.title}</span>
          {i.thought && <span className="mt-0.5 block line-clamp-2 text-ui-sm text-ink-2">{i.thought}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-3">
            {i.project_name && (
              <span className="inline-flex items-center gap-1">
                <ProjectDot color={i.project_color ?? '#888'} /> {i.project_name}
              </span>
            )}
            {i.series_title && <span>{i.series_title}</span>}
            {i.source_title && (
              <span className="inline-flex items-center gap-1">
                <BookOpen className="size-3" /> {i.source_title}
              </span>
            )}
            <span className={cx(untouched > 60 && open && 'text-progress-text')} title={`Created ${shortDate(i.created_at)}`}>
              {age === 0 ? 'today' : `${age}d old`}
              {untouched !== age && open ? `, touched ${untouched}d ago` : ''}
            </span>
            {i.status !== 'INBOX' && <span className="rounded bg-hover px-1.5 text-ink-2">{titleCase(i.status)}</span>}
            {i.episode_count > 0 && <span className="text-done-text">{i.episode_count} episode{i.episode_count > 1 ? 's' : ''}</span>}
            <PriorityMark priority={i.priority} />
            <Tags tags={i.tags} max={3} linkable={false} />
          </span>
        </button>
        {open && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="primary" icon={<ArrowRightCircle className="size-3.5" />} onClick={() => onConvert('episode')}>
              Episode
            </Button>
            <Popover
              align="end"
              trigger={({ toggle }) => (
                <Button size="sm" variant="ghost" aria-label="More actions" onClick={toggle}>
                  <MoreHorizontal className="size-4" />
                </Button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem icon={<Layers />} onClick={() => (close(), onConvert('series'))}>
                    Turn into a series
                  </MenuItem>
                  <MenuItem icon={<Search />} onClick={() => (close(), update.mutate({ status: 'DEVELOPING' }))}>
                    Mark as research topic
                  </MenuItem>
                  <MenuItem icon={<Sparkles />} onClick={() => (close(), update.mutate({ touch: true }))}>
                    Keep — still relevant
                  </MenuItem>
                  <MenuItem icon={<Clock />} onClick={() => (close(), update.mutate({ snoozeDays: 30 }))}>
                    Snooze 30 days
                  </MenuItem>
                  <MenuItem icon={<PauseCircle />} onClick={() => (close(), update.mutate({ status: 'PARKED' }))}>
                    Park
                  </MenuItem>
                  <MenuItem icon={<XCircle />} onClick={() => (close(), update.mutate({ status: 'DISCARDED' }))}>
                    Discard (keeps it searchable)
                  </MenuItem>
                  <MenuItem icon={<Archive />} onClick={() => (close(), update.mutate({ archived: true }))}>
                    Archive
                  </MenuItem>
                  <MenuItem
                    icon={<Trash2 />}
                    danger
                    onClick={async () => {
                      close();
                      if (await confirm.ask('Move this idea to the trash?', 'You can restore it from Archive & trash.', 'Move to trash')) del.mutate(undefined);
                    }}
                  >
                    Move to trash…
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
        )}
      </div>
      {confirm.node}
    </li>
  );
}

function ConvertDialog({ value, onClose }: { value: { idea: Idea; to: 'episode' | 'series' } | null; onClose: () => void }) {
  const meta = useMeta();
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useState<{ projectId: number | null; seriesId: number | null; contentTypeId: number | null; title: string }>({ projectId: null, seriesId: null, contentTypeId: null, title: '' });
  useEffect(() => {
    if (value) setF({ projectId: value.idea.project_id, seriesId: value.idea.series_id, contentTypeId: null, title: value.idea.title });
  }, [value]);
  const save = useAction(() => api.post<{ episodeId?: number; seriesId?: number }>(`/ideas/${value!.idea.id}/convert`, { to: value!.to, ...f, projectId: f.projectId ?? undefined }), {
    onDone: (r) => {
      onClose();
      if (r.episodeId) {
        toast.success('Episode created from idea — lineage recorded');
        navigate(`/episodes/${r.episodeId}`);
      } else if (r.seriesId) {
        toast.success('Series created');
        navigate(`/series/${r.seriesId}`);
      }
    },
  });
  const project = meta.data?.projects.find((p) => p.id === f.projectId);
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={value?.to === 'series' ? 'Turn idea into a series' : 'Turn idea into an episode'}
      footer={
        <Button variant="primary" loading={save.isPending} disabled={!f.projectId || !f.title.trim()} onClick={() => save.mutate(undefined)}>
          Create {value?.to}
        </Button>
      }
    >
      <div className="grid gap-3">
        <Field label="Title">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Project">
          <ProjectSelect value={f.projectId} onChange={(id) => setF({ ...f, projectId: id, seriesId: null })} />
        </Field>
        {value?.to === 'episode' && (
          <>
            <Field label="Series">
              <SeriesSelect projectId={f.projectId} value={f.seriesId} onChange={(id) => setF({ ...f, seriesId: id })} />
            </Field>
            <Field label="Content type">
              <Select value={f.contentTypeId ?? project?.defaultContentTypeId ?? ''} onChange={(e) => setF({ ...f, contentTypeId: Number(e.target.value) })}>
                {meta.data?.contentTypes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-caption text-ink-3">The idea’s thought becomes the core idea; its tags, source and insight carry over so you can always trace where the episode came from.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

interface IdeaDetailData {
  idea: Idea;
  episodes: EpisodeListItem[];
  series: { id: number; title: string }[];
  source: { id: number; title: string; type: string; author: string } | null;
  insight: { id: number; statement: string } | null;
}

function IdeaDetail({ id, onClose, onConvert }: { id: number | null; onClose: () => void; onConvert: (idea: Idea, to: 'episode' | 'series') => void }) {
  const q = useQuery({ queryKey: ['idea', id], queryFn: () => api.get<IdeaDetailData>(`/ideas/${id}`), enabled: !!id });
  const [f, setF] = useState<{ title: string; thought: string; projectId: number | null; priority: number; tags: string[] } | null>(null);
  useEffect(() => {
    if (q.data) setF({ title: q.data.idea.title, thought: q.data.idea.thought, projectId: q.data.idea.project_id, priority: q.data.idea.priority, tags: q.data.idea.tags });
  }, [q.data]);
  const save = useAction(() => api.patch(`/ideas/${id}`, f!), { success: 'Idea saved', onDone: onClose });
  const d = q.data;
  return (
    <Modal
      open={!!id}
      onClose={onClose}
      title="Idea"
      width="max-w-xl"
      footer={
        d && (
          <>
            {d.idea.status !== 'CONVERTED' && (
              <Button className="mr-auto" onClick={() => (onClose(), onConvert(d.idea, 'episode'))}>
                Turn into episode
              </Button>
            )}
            <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)} disabled={!f?.title.trim()}>
              Save
            </Button>
          </>
        )
      }
    >
      {q.error ? (
        <ErrorState error={q.error} />
      ) : !d || !f ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-3">
          <p className="text-caption text-ink-3">
            {titleCase(d.idea.status)} — created {relative(d.idea.created_at)} ({shortDate(d.idea.created_at)}), last touched {relative(d.idea.touched_at)}
          </p>
          <Field label="Idea">
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Thought">
            <Textarea rows={5} value={f.thought} onChange={(e) => setF({ ...f, thought: e.target.value })} />
          </Field>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <Field label="Project">
              <ProjectSelect value={f.projectId} onChange={(pid) => setF({ ...f, projectId: pid })} allowNone noneLabel="Unassigned" />
            </Field>
            <Field label="Priority">
              <PrioritySelect value={f.priority} onChange={(p) => setF({ ...f, priority: p })} />
            </Field>
          </div>
          <Field label="Tags">
            <TagInput value={f.tags} onChange={(tags) => setF({ ...f, tags })} />
          </Field>
          {(d.source || d.insight) && (
            <div className="rounded-md bg-surface-2 px-3 py-2 text-ui-sm">
              {d.source && (
                <p>
                  <span className="text-ink-3">From source: </span>
                  <Link to={`/sources/${d.source.id}`} className="font-medium hover:underline" onClick={onClose}>
                    {d.source.title}
                  </Link>
                </p>
              )}
              {d.insight && <p className="mt-1 text-ink-2">“{d.insight.statement}”</p>}
            </div>
          )}
          {d.episodes.length > 0 && (
            <div>
              <h3 className="mb-1 text-ui-sm font-semibold text-ink-2">Became</h3>
              <EpisodeList items={d.episodes} dense showStrip={false} />
            </div>
          )}
          {d.series.length > 0 && (
            <p className="text-ui-sm">
              <span className="text-ink-3">Became series: </span>
              {d.series.map((s) => (
                <Link key={s.id} to={`/series/${s.id}`} className="font-medium hover:underline" onClick={onClose}>
                  {s.title}
                </Link>
              ))}
            </p>
          )}
          <p className="text-caption text-ink-3">Priority: {PRIORITY_LABEL[f.priority]}</p>
        </div>
      )}
    </Modal>
  );
}
