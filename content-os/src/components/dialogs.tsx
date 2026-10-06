import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { PRIORITY_LABEL } from '../../shared/domain';
import { api } from '../lib/api';
import { useAction, useDebounced, useLocalState, useMeta } from '../lib/hooks';
import type { EpisodeListItem, Source } from '../lib/types';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';
import { TagInput } from './TagInput';
import { Code, PhaseBadge, ProjectDot } from './status';
import { useToast } from './toast';

export interface NewEpisodeDefaults {
  projectId?: number;
  seriesId?: number | null;
  sourceId?: number;
  title?: string;
}

export function ProjectSelect({ value, onChange, allowNone, noneLabel = 'No project', id }: { value: number | null | undefined; onChange: (id: number | null) => void; allowNone?: boolean; noneLabel?: string; id?: string }) {
  const meta = useMeta();
  return (
    <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      {allowNone && <option value="">{noneLabel}</option>}
      {!allowNone && !value && <option value="">Choose a project…</option>}
      {meta.data?.projects
        .filter((p) => !p.archivedAt || p.id === value)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </Select>
  );
}

export function SeriesSelect({ projectId, value, onChange, id }: { projectId: number | null | undefined; value: number | null | undefined; onChange: (id: number | null) => void; id?: string }) {
  const meta = useMeta();
  const options = meta.data?.series.filter((s) => s.projectId === projectId && (!s.archivedAt || s.id === value)) ?? [];
  return (
    <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} disabled={!projectId}>
      <option value="">No series</option>
      {options.map((s) => (
        <option key={s.id} value={s.id}>
          {s.title}
        </option>
      ))}
    </Select>
  );
}

export function PrioritySelect({ value, onChange, id }: { value: number; onChange: (p: number) => void; id?: string }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {[0, 1, 2, 3].map((p) => (
        <option key={p} value={p}>
          {PRIORITY_LABEL[p]}
        </option>
      ))}
    </Select>
  );
}

/** Shows possible duplicates while typing — "Do I already have an episode about this?" */
export function SimilarHint({ text, excludeId }: { text: string; excludeId?: number }) {
  const q = useDebounced(text.trim(), 350);
  const similar = useQuery({
    queryKey: ['similar-text', q],
    queryFn: () => api.post<(EpisodeListItem & { similarity: number })[]>('/similar', { text: q, limit: 4 }),
    enabled: q.length >= 8,
    staleTime: 60_000,
  });
  const items = (similar.data ?? []).filter((x) => x.id !== excludeId && x.similarity >= 55);
  if (!items.length) return null;
  return (
    <div className="rounded-md border border-progress/40 bg-progress-bg/60 px-3 py-2">
      <p className="flex items-center gap-1.5 text-ui-sm font-medium text-progress-text">
        <AlertTriangle className="size-3.5" /> You may already have this
      </p>
      <ul className="mt-1 space-y-0.5">
        {items.map((e) => (
          <li key={e.id} className="flex items-center gap-2 text-ui-sm">
            <Code>{e.code}</Code>
            <a href={`/episodes/${e.id}`} target="_blank" rel="noreferrer" className="min-w-0 truncate text-ink hover:underline">
              {e.title}
            </a>
            <PhaseBadge phase={e.phase} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NewEpisodeDialog({ open, onClose, defaults }: { open: boolean; onClose: () => void; defaults: NewEpisodeDefaults }) {
  const meta = useMeta();
  const navigate = useNavigate();
  const toast = useToast();
  const [lastProject, setLastProject] = useLocalState<number | null>('last-project', null);
  const blank = () => ({
    title: defaults.title ?? '',
    projectId: defaults.projectId ?? lastProject ?? meta.data?.projects[0]?.id ?? null,
    seriesId: defaults.seriesId ?? null,
    contentTypeId: null as number | null,
    priority: 2,
    dueDate: '',
    coreIdea: '',
    hook: '',
    tags: [] as string[],
    sourceId: defaults.sourceId ?? null as number | null,
  });
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setF(blank());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const sources = useQuery({ queryKey: ['sources', 'all'], queryFn: () => api.get<Source[]>('/sources'), enabled: open, staleTime: 30_000 });
  const project = meta.data?.projects.find((p) => p.id === f.projectId);
  const effectiveType = f.contentTypeId ?? project?.defaultContentTypeId ?? meta.data?.contentTypes[0]?.id ?? null;
  const sortedSources = useMemo(() => [...(sources.data ?? [])].sort((a, b) => Number(b.project_id === f.projectId) - Number(a.project_id === f.projectId) || a.title.localeCompare(b.title)), [sources.data, f.projectId]);

  const create = useAction(
    (another: boolean) =>
      api
        .post<{ id: number }>('/episodes', {
          projectId: f.projectId,
          seriesId: f.seriesId,
          contentTypeId: effectiveType,
          title: f.title.trim(),
          priority: f.priority,
          dueDate: f.dueDate || null,
          coreIdea: f.coreIdea,
          hook: f.hook,
          tags: f.tags,
          sourceIds: f.sourceId ? [f.sourceId] : [],
        })
        .then((r) => ({ ...r, another })),
    {
      onDone: (r) => {
        setLastProject(f.projectId);
        if (r.another) {
          toast.success('Episode created', { action: { label: 'Open', onClick: () => navigate(`/episodes/${r.id}`) } });
          setF((prev) => ({ ...blank(), projectId: prev.projectId, seriesId: prev.seriesId, contentTypeId: prev.contentTypeId, tags: prev.tags, sourceId: prev.sourceId }));
        } else {
          onClose();
          navigate(`/episodes/${r.id}`);
        }
      },
    },
  );

  const submit = (another = false) => {
    if (!f.title.trim()) return setError('Give the episode a working title.');
    if (!f.projectId) return setError('Choose a project.');
    setError(null);
    create.mutate(another);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New episode"
      width="max-w-xl"
      footer={
        <>
          <Button onClick={() => submit(true)} disabled={create.isPending}>
            Create & add another
          </Button>
          <Button variant="primary" onClick={() => submit(false)} loading={create.isPending}>
            Create episode
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <Field label="Working title" error={error}>
          <Input data-autofocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Why Lot’s wife looked back" aria-invalid={!!error} />
        </Field>
        <SimilarHint text={`${f.title} ${f.coreIdea}`} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Project">
            <ProjectSelect value={f.projectId} onChange={(id) => setF({ ...f, projectId: id, seriesId: null, contentTypeId: null })} />
          </Field>
          <Field label="Series">
            <SeriesSelect projectId={f.projectId} value={f.seriesId} onChange={(id) => setF({ ...f, seriesId: id })} />
          </Field>
          <Field label="Content type" hint={project?.defaultContentTypeId && !f.contentTypeId ? 'Project default' : undefined}>
            <Select value={effectiveType ?? ''} onChange={(e) => setF({ ...f, contentTypeId: Number(e.target.value) })}>
              {meta.data?.contentTypes
                .filter((c) => !c.archivedAt)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <PrioritySelect value={f.priority} onChange={(p) => setF({ ...f, priority: p })} />
            </Field>
            <Field label="Due">
              <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </Field>
          </div>
        </div>
        <Field label="Core idea" hint="The one sentence this episode exists to deliver.">
          <Textarea rows={2} value={f.coreIdea} onChange={(e) => setF({ ...f, coreIdea: e.target.value })} />
        </Field>
        <Field label="Hook">
          <Input value={f.hook} onChange={(e) => setF({ ...f, hook: e.target.value })} placeholder="The first line the viewer hears" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tags">
            <TagInput value={f.tags} onChange={(tags) => setF({ ...f, tags })} />
          </Field>
          <Field label="Source">
            <Select value={f.sourceId ?? ''} onChange={(e) => setF({ ...f, sourceId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">None yet</option>
              {sortedSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                  {s.author ? ` — ${s.author}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function QuickIdeaDialog({ open, onClose, defaults }: { open: boolean; onClose: () => void; defaults?: { projectId?: number | null; sourceId?: number | null } }) {
  const [lastProject] = useLocalState<number | null>('last-project', null);
  const blank = () => ({ title: '', thought: '', projectId: defaults?.projectId ?? lastProject ?? null, tags: [] as string[], priority: 2 });
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setF(blank());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = useAction(() => api.post('/ideas', { ...f, title: f.title.trim(), sourceId: defaults?.sourceId ?? null }), { success: 'Idea captured', onDone: onClose });
  const submit = () => {
    if (!f.title.trim()) return setError('Write at least a few words.');
    save.mutate(undefined);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Capture an idea"
      footer={
        <>
          <span className="mr-auto self-center text-caption text-ink-3">Ctrl + Enter to save</span>
          <Button variant="primary" onClick={submit} loading={save.isPending}>
            Save idea
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      >
        <Field label="Idea" error={error}>
          <Input data-autofocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="One line. You can develop it later." />
        </Field>
        <Field label="Thought (optional)">
          <Textarea rows={3} value={f.thought} onChange={(e) => setF({ ...f, thought: e.target.value })} placeholder="Why it matters, an angle, a reference…" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
          <Field label="Project">
            <ProjectSelect value={f.projectId} onChange={(id) => setF({ ...f, projectId: id })} allowNone noneLabel="Unassigned" />
          </Field>
          <Field label="Priority">
            <PrioritySelect value={f.priority} onChange={(p) => setF({ ...f, priority: p })} />
          </Field>
        </div>
        <Field label="Tags">
          <TagInput value={f.tags} onChange={(tags) => setF({ ...f, tags })} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export { ProjectDot };
