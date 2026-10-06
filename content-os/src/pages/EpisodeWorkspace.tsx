import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, CalendarCheck, ChevronRight, Copy, MoreHorizontal, MoveRight, Trash2, Check, Plus, X } from 'lucide-react';
import { PHASES, PHASE_META, STAGE_META, formatDuration, type Phase } from '../../shared/domain';
import { api } from '../lib/api';
import { useAction, useMeta, useMoveEpisode, useRefresh } from '../lib/hooks';
import type { EpisodeDetail } from '../lib/types';
import { relative, shortDate } from '../lib/format';
import { Button, ErrorState, Field, Input, MenuItem, Popover, Select, Skeleton, Tabs, Textarea, cx, useConfirm } from '../components/ui';
import { PhaseBadge, PriorityMark, ProjectDot, Code } from '../components/status';
import { StagePanel } from '../components/workspace/StagePanel';
import { AssetsTab } from '../components/workspace/AssetsTab';
import { PublishingTab } from '../components/workspace/PublishingTab';
import { LineageTab, RelatedTab } from '../components/workspace/LineageTab';
import { ActivityFeed } from './Dashboard';
import { PrioritySelect, SeriesSelect, ProjectSelect } from '../components/dialogs';
import { TagInput } from '../components/TagInput';
import { useToast } from '../components/toast';
import { PageShell } from '../components/Layout';
import { ScheduleDialog } from '../components/BulkBar';

type Tab = 'overview' | 'script' | 'assets' | 'publishing' | 'lineage' | 'related' | 'activity';

export default function EpisodeWorkspace() {
  const { id } = useParams();
  const epId = Number(id);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';
  const q = useQuery({ queryKey: ['episode', epId], queryFn: () => api.get<EpisodeDetail>(`/episodes/${epId}`), enabled: Number.isFinite(epId) });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  if (!d)
    return (
      <PageShell>
        <div className="grid gap-4" aria-busy="true">
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
          <Skeleton className="h-80" />
        </div>
      </PageShell>
    );
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === 'overview') next.delete('tab');
    else next.set('tab', t);
    setParams(next, { replace: true });
  };
  return (
    <PageShell>
      <Header d={d} />
      <div className="mt-5">
        <StagePanel d={d} />
      </div>
      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Tabs
            value={tab}
            onChange={setTab}
            className="mb-4"
            tabs={[
              { value: 'overview', label: 'Overview' },
              { value: 'script', label: 'Script' },
              { value: 'assets', label: 'Assets', count: d.assets.length },
              { value: 'publishing', label: 'Publishing', count: d.publications.length },
              { value: 'lineage', label: 'Lineage & research', count: d.sources.length + d.insights.length || null },
              { value: 'related', label: 'Related', count: d.related.length || null },
              { value: 'activity', label: 'Activity' },
            ]}
          />
          {tab === 'overview' && <Overview d={d} />}
          {tab === 'script' && <ScriptTab d={d} />}
          {tab === 'assets' && <AssetsTab d={d} />}
          {tab === 'publishing' && <PublishingTab d={d} />}
          {tab === 'lineage' && <LineageTab d={d} />}
          {tab === 'related' && <RelatedTab d={d} />}
          {tab === 'activity' && <ActivityFeed items={d.activity} />}
        </div>
        <Rail d={d} />
      </div>
    </PageShell>
  );
}

// ------------------------------------------------------------------ autosave
function usePatch(id: number) {
  const refresh = useRefresh();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await api.patch(`/episodes/${id}`, patch);
      refresh();
      return true;
    } catch (e) {
      toast.error(e);
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { save, saving };
}

function AutoField({ id, field, value, label, multiline, rows = 3, placeholder, hint, className }: { id: number; field: string; value: string; label?: string; multiline?: boolean; rows?: number; placeholder?: string; hint?: string; className?: string }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(false);
  const { save, saving } = usePatch(id);
  useEffect(() => setV(value), [value]);
  const commit = async () => {
    if (v === value) return;
    if (await save({ [field]: v })) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };
  const status = saving ? 'Saving…' : saved ? 'Saved' : null;
  const input = multiline ? (
    <Textarea rows={rows} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder} className={className} />
  ) : (
    <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} placeholder={placeholder} className={className} />
  );
  if (!label) return input;
  return (
    <Field
      label={label}
      hint={
        <span className="flex justify-between gap-2">
          <span>{hint}</span>
          <span className="text-accent-text">{status}</span>
        </span>
      }
    >
      {input}
    </Field>
  );
}

// ------------------------------------------------------------------ header
function Header({ d }: { d: EpisodeDetail }) {
  const e = d.episode;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const move = useMoveEpisode();
  const [title, setTitle] = useState(e.title);
  const [scheduling, setScheduling] = useState(false);
  const { save } = usePatch(e.id);
  useEffect(() => setTitle(e.title), [e.title]);
  const archive = useAction(() => api.post(`/episodes/${e.id}/archive`, { archived: !e.archived_at }), { success: e.archived_at ? 'Restored from archive' : 'Archived — still searchable' });
  const duplicate = useAction(() => api.post<{ id: number }>(`/episodes/${e.id}/duplicate`), { onDone: (r) => (toast.success('Variant created'), navigate(`/episodes/${r.id}`)) });
  const del = useAction(() => api.del(`/episodes/${e.id}`), { onDone: () => (toast.success('Moved to trash — restore it from Archive & trash'), navigate('/episodes')) });
  const queue = useAction(() => api.post('/today/queue', { episodeIds: [e.id] }), { success: 'Added to today’s queue' });
  const rd = d.readiness;
  const blockedRow = d.stages.find((s) => s.status === 'BLOCKED');

  return (
    <header>
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-ui-sm text-ink-3">
        <Link to={`/projects/${d.project.id}`} className="inline-flex items-center gap-1.5 hover:text-ink">
          <ProjectDot color={d.project.color} /> {d.project.name}
        </Link>
        {d.series && (
          <>
            <ChevronRight className="size-3.5" />
            <Link to={`/series/${d.series.id}`} className="hover:text-ink">
              {d.series.title}
            </Link>
          </>
        )}
        <ChevronRight className="size-3.5" />
        <Code>{e.code}</Code>
        {e.archived_at && <span className="ml-2 rounded bg-hover px-1.5 text-caption">Archived</span>}
        {e.deleted_at && <span className="ml-2 rounded bg-blocked-bg px-1.5 text-caption text-blocked-text">In trash</span>}
      </nav>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <input
            aria-label="Episode title"
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            onBlur={() => title.trim() && title !== e.title && save({ title })}
            onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
            className="-mx-1 w-full rounded bg-transparent px-1 text-[1.625rem] leading-tight font-semibold tracking-tight text-ink outline-none hover:bg-hover focus:bg-hover"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-ui-sm text-ink-2">
            <PhaseBadge phase={rd.phase} blocked={rd.blocked} />
            <span>{d.contentType.name}</span>
            {e.target_duration_sec ? <span>{formatDuration(e.target_duration_sec)}</span> : null}
            <PriorityMark priority={e.priority} showLabel />
            <span className="text-ink-3">Updated {relative(e.updated_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="tabular text-display font-semibold">{rd.readiness}%</div>
            <div className="text-caption text-ink-3">readiness</div>
          </div>
          <div className="min-w-36 max-w-56">
            <div className="text-caption text-ink-3">{rd.blocked ? 'Blocked at' : rd.phase === 'PUBLISHED' ? 'Status' : rd.ready ? 'Next' : 'Current blocker'}</div>
            <div className={cx('text-ui font-semibold', rd.blocked ? 'text-blocked-text' : 'text-ink')}>
              {rd.blocked ? STAGE_META[rd.blockedStages[0]].label : rd.phase === 'PUBLISHED' ? 'Published' : rd.phase === 'SCHEDULED' ? 'Scheduled' : rd.ready ? 'Ready to publish' : rd.nextStage ? STAGE_META[rd.nextStage].label : '—'}
            </div>
            {blockedRow?.note && <div className="truncate text-caption text-blocked-text" title={blockedRow.note}>{blockedRow.note}</div>}
            {!rd.blocked && rd.actionable.length > 1 && <div className="truncate text-caption text-ink-3">Can work on: {rd.actionable.map((s) => STAGE_META[s].label).join(', ')}</div>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {rd.ready && rd.phase === 'READY' && (
          <>
            <Button variant="primary" size="sm" onClick={() => move.mutate({ episodeId: e.id, phase: 'PUBLISHED', title: e.title })}>
              Mark published now
            </Button>
            <Button size="sm" onClick={() => setScheduling(true)}>
              Schedule…
            </Button>
          </>
        )}
        <Button size="sm" icon={<CalendarCheck className="size-3.5" />} onClick={() => queue.mutate(undefined)}>
          Add to today
        </Button>
        <Popover
          trigger={({ toggle }) => (
            <Button size="sm" icon={<MoveRight className="size-3.5" />} onClick={toggle}>
              Move to
            </Button>
          )}
        >
          {(close) => (
            <>
              <p className="max-w-56 px-2 pb-1 pt-1 text-caption text-ink-3">Updates the right stages; parallel progress is kept. Undo is available.</p>
              {PHASES.filter((p) => p !== rd.phase).map((p) => (
                <MenuItem
                  key={p}
                  onClick={() => {
                    close();
                    if (p === 'SCHEDULED') setScheduling(true);
                    else move.mutate({ episodeId: e.id, phase: p as Phase, title: e.title });
                  }}
                >
                  {PHASE_META[p].label}
                </MenuItem>
              ))}
            </>
          )}
        </Popover>
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
              <MenuItem icon={<Copy />} onClick={() => (close(), duplicate.mutate(undefined))}>
                Duplicate as variant
              </MenuItem>
              <MenuItem icon={e.archived_at ? <ArchiveRestore /> : <Archive />} onClick={() => (close(), archive.mutate(undefined))}>
                {e.archived_at ? 'Restore from archive' : 'Archive'}
              </MenuItem>
              <MenuItem
                icon={<Trash2 />}
                danger
                onClick={async () => {
                  close();
                  if (await confirm.ask('Move this episode to the trash?', 'It disappears from views but stays restorable from Archive & trash. Assets and publications are kept with it.', 'Move to trash')) del.mutate(undefined);
                }}
              >
                Move to trash…
              </MenuItem>
            </>
          )}
        </Popover>
      </div>
      {confirm.node}
      <SingleSchedule open={scheduling} onClose={() => setScheduling(false)} episodeId={e.id} />
    </header>
  );
}

function SingleSchedule({ open, onClose, episodeId }: { open: boolean; onClose: () => void; episodeId: number }) {
  const refresh = useRefresh();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <ScheduleDialog
      open={open}
      publishNow={false}
      n={1}
      busy={busy}
      onClose={onClose}
      onSubmit={async (a) => {
        setBusy(true);
        try {
          await api.post('/episodes/bulk', { ids: [episodeId], action: a });
          toast.success('Scheduled');
          refresh();
          onClose();
        } catch (err) {
          toast.error(err);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

// ------------------------------------------------------------------ tabs
function Overview({ d }: { d: EpisodeDetail }) {
  const e = d.episode;
  return (
    <div className="grid gap-4">
      <AutoField id={e.id} field="coreIdea" label="Core idea" value={e.core_idea} multiline rows={2} hint="The one sentence this episode exists to deliver." />
      <AutoField id={e.id} field="hook" label="Hook" value={e.hook} placeholder="The first line the viewer hears" />
      <AutoField id={e.id} field="description" label="Description" value={e.description} multiline rows={3} />
      <AutoField id={e.id} field="notes" label="Notes" value={e.notes} multiline rows={4} hint="Research notes, visual direction, references — anything." />
      {d.idea && (
        <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-ui-sm">
          <span className="text-ink-3">Started as an idea {relative(d.idea.created_at)}: </span>
          <Link to={`/ideas?open=${d.idea.id}`} className="font-medium hover:underline">
            {d.idea.title}
          </Link>
        </div>
      )}
    </div>
  );
}

function ScriptTab({ d }: { d: EpisodeDetail }) {
  const e = d.episode;
  const [v, setV] = useState(e.script);
  const { save, saving } = usePatch(e.id);
  const dirty = v !== e.script;
  const lastSaved = useRef(e.script);
  useEffect(() => {
    if (e.script !== lastSaved.current) {
      setV(e.script);
      lastSaved.current = e.script;
    }
  }, [e.script]);
  const words = v.trim() ? v.trim().split(/\s+/).length : 0;
  const secs = Math.round((words / 150) * 60); // ~150 wpm narration
  const target = e.target_duration_sec;
  const delta = target ? secs - target : 0;
  const commit = async () => {
    if (!dirty) return;
    if (await save({ script: v })) lastSaved.current = v;
  };
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-ui-sm text-ink-2">
        <span className="tabular">{words} words</span>
        <span className="tabular">≈ {formatDuration(secs)} spoken</span>
        {target ? (
          <span className={cx('tabular', Math.abs(delta) > target * 0.15 ? 'text-progress-text' : 'text-done-text')}>
            target {formatDuration(target)} ({delta > 0 ? '+' : ''}
            {delta}s)
          </span>
        ) : null}
        <span className="ml-auto text-caption text-ink-3">{saving ? 'Saving…' : dirty ? 'Unsaved — saves when you click away' : 'Saved'}</span>
        <Button size="sm" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} onClick={commit}>
          Save script
        </Button>
      </div>
      <Textarea
        value={v}
        onChange={(ev) => setV(ev.target.value)}
        onBlur={commit}
        onKeyDown={(ev) => {
          if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') {
            ev.preventDefault();
            commit();
          }
        }}
        rows={22}
        className="font-[inherit] text-body leading-relaxed"
        placeholder="Write the script here. Ctrl+S saves."
      />
      {d.stages.find((s) => s.stage === 'SCRIPT')?.status !== 'DONE' && words > 30 && (
        <p className="mt-2 text-ui-sm text-ink-3">When the script is final, mark the Script stage done above — voice and visual become workable.</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ right rail
function Rail({ d }: { d: EpisodeDetail }) {
  const e = d.episode;
  const meta = useMeta();
  const { save } = usePatch(e.id);
  const confirm = useConfirm();
  const [taskText, setTaskText] = useState('');
  const addTask = useAction((title: string) => api.post(`/episodes/${e.id}/tasks`, { title }), { onDone: () => setTaskText('') });
  const toggleTask = useAction((t: { id: number; done: boolean }) => api.patch(`/tasks/${t.id}`, { done: t.done }));
  const delTask = useAction((id: number) => api.del(`/tasks/${id}`));
  const [moveProject, setMoveProject] = useState<number | null>(null);

  return (
    <aside className="grid content-start gap-4">
      <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-3 text-ui font-semibold">Details</h2>
        <div className="grid gap-3">
          <Field label="Series">
            <SeriesSelect projectId={e.project_id} value={e.series_id} onChange={(id) => save({ seriesId: id })} />
          </Field>
          <Field label="Content type" hint="Changes which stages are required">
            <Select
              value={e.content_type_id}
              onChange={async (ev) => {
                const id = Number(ev.target.value);
                const ct = meta.data?.contentTypes.find((c) => c.id === id);
                if (await confirm.ask(`Switch to ${ct?.name}?`, 'Readiness is recalculated with that type’s required stages. Existing stage progress is kept.', 'Switch', false)) save({ contentTypeId: id });
              }}
            >
              {meta.data?.contentTypes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <PrioritySelect value={e.priority} onChange={(p) => save({ priority: p })} />
            </Field>
            <Field label="Due">
              <Input type="date" value={e.due_date ?? ''} onChange={(ev) => save({ dueDate: ev.target.value || null })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Episode #">
              <Input type="number" min={1} defaultValue={e.number ?? ''} key={e.number} onBlur={(ev) => Number(ev.target.value) !== e.number && ev.target.value && save({ number: Number(ev.target.value) })} />
            </Field>
            <Field label="Duration (s)">
              <Input type="number" min={0} defaultValue={e.target_duration_sec ?? ''} key={e.target_duration_sec} onBlur={(ev) => save({ targetDurationSec: ev.target.value ? Number(ev.target.value) : null })} />
            </Field>
          </div>
          <Field label="Tags">
            <TagInput value={e.tags} onChange={(tags) => save({ tags })} />
          </Field>
          <details className="text-ui-sm">
            <summary className="cursor-pointer text-ink-3 hover:text-ink">Move to another project…</summary>
            <div className="mt-2 flex gap-2">
              <ProjectSelect value={moveProject ?? e.project_id} onChange={setMoveProject} />
              <Button size="sm" disabled={!moveProject || moveProject === e.project_id} onClick={async () => {
                if (moveProject && (await confirm.ask('Move episode to another project?', 'It gets the next free episode number there and leaves its current series.', 'Move', false))) save({ projectId: moveProject });
              }}>
                Move
              </Button>
            </div>
          </details>
          <dl className="grid grid-cols-2 gap-y-1 text-caption text-ink-3">
            <dt>Created</dt>
            <dd className="text-right">{shortDate(e.created_at)}</dd>
            <dt>Last progress</dt>
            <dd className="text-right">{relative(e.progress_at)}</dd>
          </dl>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-2 text-ui font-semibold">Checklist</h2>
        <ul className="grid gap-0.5">
          {d.tasks.map((t) => (
            <li key={t.id} className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-hover">
              <button
                role="checkbox"
                aria-checked={!!t.done}
                onClick={() => toggleTask.mutate({ id: t.id, done: !t.done })}
                className={cx('grid size-4 shrink-0 place-items-center rounded border', t.done ? 'border-done bg-done text-white' : 'border-line-strong')}
              >
                {t.done ? <Check className="size-3" strokeWidth={3} /> : null}
              </button>
              <span className={cx('flex-1 text-ui-sm', !!t.done && 'text-ink-3 line-through')}>{t.title}</span>
              <button className="hidden rounded p-0.5 text-ink-3 hover:text-ink group-hover:block" aria-label="Delete item" onClick={() => delTask.mutate(t.id)}>
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-1"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (taskText.trim()) addTask.mutate(taskText.trim());
          }}
        >
          <Input value={taskText} onChange={(ev) => setTaskText(ev.target.value)} placeholder="Add a checklist item" className="h-7 text-ui-sm" />
          <Button size="sm" type="submit" aria-label="Add item" disabled={!taskText.trim()}>
            <Plus className="size-3.5" />
          </Button>
        </form>
      </section>
      <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-3 text-ui font-semibold">Recent changes</h2>
        <ActivityFeed items={d.activity.slice(0, 8)} />
      </section>
      {confirm.node}
    </aside>
  );
}
