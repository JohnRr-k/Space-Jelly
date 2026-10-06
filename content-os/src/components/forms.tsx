import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROJECT_STATUSES, SOURCE_STATUSES, SOURCE_TYPES } from '../../shared/domain';
import { api } from '../lib/api';
import { useAction, useMeta } from '../lib/hooks';
import type { ProjectRow, SeriesRow, Source } from '../lib/types';
import { titleCase } from '../lib/format';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';
import { TagInput } from './TagInput';
import { ProjectSelect } from './dialogs';

const COLORS = ['#3d6b5c', '#8a5a3d', '#4a5a8a', '#9e4a3d', '#5a4a8a', '#3d7a8a', '#7a6a3d', '#6a3d5a', '#3d5a3d', '#5a5a5a'];

export function ProjectDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project?: ProjectRow | null }) {
  const meta = useMeta();
  const navigate = useNavigate();
  const init = () => ({
    name: project?.name ?? '',
    code: project?.code ?? '',
    description: project?.description ?? '',
    goal: project?.goal ?? '',
    status: project?.status ?? 'ACTIVE',
    targetCount: project?.target_count ?? null,
    color: project?.color ?? COLORS[(meta.data?.projects.length ?? 0) % COLORS.length],
    defaultContentTypeId: project?.default_content_type_id ?? meta.data?.contentTypes[0]?.id ?? null,
    notes: project?.notes ?? '',
    tags: project?.tags ?? [],
  });
  const [f, setF] = useState(init);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setF(init());
  }
  const save = useAction(() => (project ? api.patch(`/projects/${project.id}`, f) : api.post<{ id: number }>('/projects', f)), {
    success: project ? 'Project saved' : 'Project created',
    onDone: (r) => {
      onClose();
      if (!project && r && typeof r === 'object' && 'id' in r) navigate(`/projects/${(r as { id: number }).id}`);
    },
  });
  const suggestCode = (name: string) =>
    name
      .split(/\s+/)
      .filter((w) => /^[a-z0-9]/i.test(w))
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      width="max-w-xl"
      footer={
        <Button variant="primary" loading={save.isPending} disabled={!f.name.trim() || !f.code.trim()} onClick={() => save.mutate(undefined)}>
          {project ? 'Save project' : 'Create project'}
        </Button>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Name">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, code: project || f.code ? f.code : suggestCode(e.target.value) })} placeholder="e.g. Human Failure Archive" />
          </Field>
          <Field label="Code" hint="Episode prefix">
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) })} placeholder="HFA" spellCheck={false} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Goal" hint="What does “done” look like for this project?">
          <Input value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Target episodes">
            <Input type="number" min={0} value={f.targetCount ?? ''} onChange={(e) => setF({ ...f, targetCount: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default format">
            <Select value={f.defaultContentTypeId ?? ''} onChange={(e) => setF({ ...f, defaultContentTypeId: Number(e.target.value) || null })}>
              {meta.data?.contentTypes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Color">
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={f.color === c} onClick={() => setF({ ...f, color: c })} className="size-6 rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink" style={{ background: c }} />
            ))}
          </div>
        </Field>
        <Field label="Tags">
          <TagInput value={f.tags} onChange={(tags) => setF({ ...f, tags })} />
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function SeriesDialog({ open, onClose, series, projectId }: { open: boolean; onClose: () => void; series?: SeriesRow | null; projectId?: number }) {
  const init = () => ({ projectId: series?.project_id ?? projectId ?? null, title: series?.title ?? '', description: series?.description ?? '', targetCount: series?.target_count ?? null, notes: series?.notes ?? '', tags: series?.tags ?? [] });
  const [f, setF] = useState(init);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setF(init());
  }
  const save = useAction(() => (series ? api.patch(`/series/${series.id}`, { ...f, projectId: undefined }) : api.post('/series', f)), { success: series ? 'Series saved' : 'Series created', onDone: onClose });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={series ? 'Edit series' : 'New series'}
      footer={
        <Button variant="primary" loading={save.isPending} disabled={!f.title.trim() || !f.projectId} onClick={() => save.mutate(undefined)}>
          {series ? 'Save series' : 'Create series'}
        </Button>
      }
    >
      <div className="grid gap-3">
        {!series && (
          <Field label="Project">
            <ProjectSelect value={f.projectId} onChange={(id) => setF({ ...f, projectId: id })} />
          </Field>
        )}
        <Field label="Title">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Redemption" />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Target episodes">
          <Input type="number" min={0} value={f.targetCount ?? ''} onChange={(e) => setF({ ...f, targetCount: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Tags" hint="Ideas sharing these tags are resurfaced for this series.">
          <TagInput value={f.tags} onChange={(tags) => setF({ ...f, tags })} />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function SourceDialog({ open, onClose, source }: { open: boolean; onClose: () => void; source?: Source | null }) {
  const navigate = useNavigate();
  const init = () => ({
    title: source?.title ?? '',
    type: source?.type ?? 'BOOK',
    author: source?.author ?? '',
    projectId: source?.project_id ?? null,
    description: source?.description ?? '',
    citation: source?.citation ?? '',
    url: source?.url ?? '',
    year: source?.year ?? null,
    status: source?.status ?? 'QUEUED',
    potential: source?.potential ?? null,
    notes: source?.notes ?? '',
    tags: source?.tags ?? [],
  });
  const [f, setF] = useState(init);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setF(init());
  }
  const save = useAction(() => (source ? api.patch(`/sources/${source.id}`, f) : api.post<{ id: number }>('/sources', f)), {
    success: source ? 'Source saved' : 'Source added',
    onDone: (r) => {
      onClose();
      if (!source && r && typeof r === 'object' && 'id' in r) navigate(`/sources/${(r as { id: number }).id}`);
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={source ? 'Edit source' : 'Add source'}
      width="max-w-xl"
      footer={
        <Button variant="primary" loading={save.isPending} disabled={!f.title.trim()} onClick={() => save.mutate(undefined)}>
          {source ? 'Save source' : 'Add source'}
        </Button>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-[1fr_9rem] gap-3">
          <Field label="Title">
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. The Psychology of Money" />
          </Field>
          <Field label="Type">
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Author / person">
            <Input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
          </Field>
          <Field label="Citation" hint="Chapters, verses, ISBN, episode #">
            <Input value={f.citation} onChange={(e) => setF({ ...f, citation: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Processing">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {SOURCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Potential episodes" hint="Your estimate">
            <Input type="number" min={0} value={f.potential ?? ''} onChange={(e) => setF({ ...f, potential: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Main project">
            <ProjectSelect value={f.projectId} onChange={(id) => setF({ ...f, projectId: id })} allowNone noneLabel="Any" />
          </Field>
        </div>
        <Field label="URL">
          <Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Tags">
          <TagInput value={f.tags} onChange={(tags) => setF({ ...f, tags })} />
        </Field>
      </div>
    </Modal>
  );
}
