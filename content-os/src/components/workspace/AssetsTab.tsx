import { useMemo, useRef, useState } from 'react';
import { ExternalLink, FileAudio, FileImage, FileText, FileVideo, Paperclip, Plus, Trash2, Upload, Copy } from 'lucide-react';
import { ASSET_KINDS, ASSET_STATUSES, STAGES, STAGE_META, type Stage } from '../../../shared/domain';
import { api } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import type { Asset, EpisodeDetail } from '../../lib/types';
import { relative, titleCase } from '../../lib/format';
import { Button, Empty, Field, IconButton, Input, Modal, Select, cx, useConfirm } from '../ui';
import { useToast } from '../toast';

const KIND_ICON: Record<string, typeof FileText> = { VOICEOVER: FileAudio, AUDIO: FileAudio, VIDEO: FileVideo, ANIMATION: FileVideo, EXPORT: FileVideo, IMAGE: FileImage, COVER: FileImage, THUMBNAIL: FileImage };
const DEFAULT_STAGE: Record<string, Stage> = { VOICEOVER: 'VOICE', AUDIO: 'VOICE', ANIMATION: 'VISUAL', IMAGE: 'VISUAL', VIDEO: 'VISUAL', EXPORT: 'EDIT', COVER: 'COVER', THUMBNAIL: 'COVER', SCRIPT_FILE: 'SCRIPT', REFERENCE: 'RESEARCH', PDF: 'RESEARCH' };
const STATUS_TONE: Record<string, string> = { FINAL: 'bg-done-bg text-done-text', APPROVED: 'bg-done-bg text-done-text', IN_REVIEW: 'bg-progress-bg text-progress-text', REJECTED: 'bg-blocked-bg text-blocked-text line-through', DRAFT: 'bg-hover text-ink-2' };

/** Assets grouped by production stage; versions of the same asset stack newest-first. */
export function AssetsTab({ d }: { d: EpisodeDetail }) {
  const [adding, setAdding] = useState<{ kind?: string; name?: string; stage?: Stage | null } | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const update = useAction((a: { id: number; patch: Record<string, unknown> }) => api.patch(`/assets/${a.id}`, a.patch));
  const remove = useAction((id: number) => api.del(`/assets/${id}`), { success: 'Asset removed' });

  const groups = useMemo(() => {
    const byStage = new Map<string, Map<string, Asset[]>>();
    for (const a of d.assets) {
      const st = a.stage ?? 'OTHER';
      const m = byStage.get(st) ?? new Map<string, Asset[]>();
      const key = `${a.kind}:${a.name}`;
      m.set(key, [...(m.get(key) ?? []), a]);
      byStage.set(st, m);
    }
    return [...STAGES, 'OTHER'].filter((s) => byStage.has(s)).map((s) => ({ stage: s, items: [...byStage.get(s)!.values()] }));
  }, [d.assets]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-ui-sm text-ink-3">Files live where you keep them — store a path or URL, or upload into the app’s data folder. New versions never overwrite old ones.</p>
        <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setAdding({})}>
          Add asset
        </Button>
      </div>
      {groups.length === 0 ? (
        <Empty compact icon={<Paperclip className="size-5" />} title="No assets yet" action={<Button onClick={() => setAdding({})}>Attach the first file</Button>}>
          Voiceovers, visuals, exports and covers attach here, grouped by the stage they belong to.
        </Empty>
      ) : (
        <div className="grid gap-4">
          {groups.map((g) => (
            <div key={g.stage}>
              <h3 className="mb-1.5 text-ui-sm font-semibold text-ink-2">{g.stage === 'OTHER' ? 'Other' : STAGE_META[g.stage as Stage].label}</h3>
              <div className="divide-y divide-line rounded-md border border-line">
                {g.items.map((versions) => {
                  const [latest, ...older] = versions;
                  const Icon = KIND_ICON[latest.kind] ?? FileText;
                  return (
                    <div key={`${latest.kind}${latest.name}`} className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="size-4 shrink-0 text-ink-3" />
                        <span className="text-ui font-medium">{latest.name}</span>
                        <span className="tabular rounded bg-hover px-1 text-caption text-ink-2">v{latest.version}</span>
                        {latest.label && <span className="text-caption text-ink-3">{latest.label}</span>}
                        <span className="text-caption text-ink-3">{titleCase(latest.kind)}</span>
                        <span className="ml-auto flex items-center gap-1">
                          <Select
                            aria-label="Asset status"
                            value={latest.status}
                            onChange={(e) => update.mutate({ id: latest.id, patch: { status: e.target.value } })}
                            className={cx('h-6 w-auto border-transparent px-1.5 text-caption font-medium', STATUS_TONE[latest.status])}
                          >
                            {ASSET_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {titleCase(s)}
                              </option>
                            ))}
                          </Select>
                          <IconButton label="Upload new version" onClick={() => setAdding({ kind: latest.kind, name: latest.name, stage: latest.stage })}>
                            <Upload className="size-3.5" />
                          </IconButton>
                          <IconButton
                            label="Remove"
                            onClick={async () => {
                              if (await confirm.ask(`Remove ${latest.name} v${latest.version}?`, 'The record is hidden; files on disk are never deleted.', 'Remove')) remove.mutate(latest.id);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        </span>
                      </div>
                      <FileRef asset={latest} onCopy={() => toast.success('Path copied')} />
                      {older.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-caption text-ink-3 hover:text-ink">{older.length} earlier version{older.length > 1 ? 's' : ''}</summary>
                          <ul className="mt-1 space-y-0.5 pl-6">
                            {older.map((o) => (
                              <li key={o.id} className="flex items-center gap-2 text-caption text-ink-3">
                                <span className="tabular">v{o.version}</span>
                                <span className={cx('rounded px-1', STATUS_TONE[o.status])}>{titleCase(o.status)}</span>
                                <span className="truncate font-mono">{o.file_ref || '—'}</span>
                                <span>{relative(o.created_at)}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {confirm.node}
      <AddAssetDialog episodeId={d.episode.id} initial={adding} onClose={() => setAdding(null)} />
    </div>
  );
}

function FileRef({ asset, onCopy }: { asset: Asset; onCopy: () => void }) {
  if (!asset.file_ref) return <p className="mt-0.5 pl-6 text-caption text-ink-3">No file reference</p>;
  const isLink = asset.file_ref.startsWith('http') || asset.file_ref.startsWith('/files/');
  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1 pl-6 text-caption text-ink-3">
      {isLink ? (
        <a href={asset.file_ref} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate font-mono hover:text-accent-text hover:underline">
          <span className="truncate">{asset.file_ref}</span> <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <span className="truncate font-mono" title={asset.file_ref}>
          {asset.file_ref}
        </span>
      )}
      <button
        aria-label="Copy path"
        className="rounded p-0.5 hover:text-ink"
        onClick={() => {
          navigator.clipboard?.writeText(asset.file_ref).then(onCopy, () => {});
        }}
      >
        <Copy className="size-3" />
      </button>
      <span className="ml-2 whitespace-nowrap">{relative(asset.created_at)}</span>
    </div>
  );
}

function AddAssetDialog({ episodeId, initial, onClose }: { episodeId: number; initial: { kind?: string; name?: string; stage?: Stage | null } | null; onClose: () => void }) {
  const open = !!initial;
  const [kind, setKind] = useState('VOICEOVER');
  const [name, setName] = useState('');
  const [stage, setStage] = useState<string>('');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [fileRef, setFileRef] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [lastInit, setLastInit] = useState<typeof initial>(null);
  if (initial !== lastInit) {
    setLastInit(initial);
    if (initial) {
      const k = initial.kind ?? 'VOICEOVER';
      setKind(k);
      setName(initial.name ?? '');
      setStage(initial.stage ?? DEFAULT_STAGE[k] ?? '');
      setLabel('');
      setStatus('DRAFT');
      setFileRef('');
      setFile(null);
    }
  }
  const save = useAction(
    async () => {
      const form = new FormData();
      form.set('kind', kind);
      form.set('name', name || file?.name || '');
      if (stage) form.set('stage', stage);
      if (label) form.set('label', label);
      form.set('status', status);
      if (fileRef) form.set('fileRef', fileRef);
      if (file) form.set('file', file);
      return api.upload(`/episodes/${episodeId}/assets`, form);
    },
    { success: initial?.name ? 'New version attached' : 'Asset attached', onDone: onClose },
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.name ? `New version of ${initial.name}` : 'Add asset'}
      footer={
        <Button variant="primary" loading={save.isPending} disabled={!name.trim() && !file} onClick={() => save.mutate(undefined)}>
          Attach
        </Button>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select
              value={kind}
              disabled={!!initial?.name}
              onChange={(e) => {
                setKind(e.target.value);
                setStage(DEFAULT_STAGE[e.target.value] ?? stage);
              }}
            >
              {ASSET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {titleCase(k)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stage">
            <Select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">—</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Name" hint="Versions are grouped by kind + name, e.g. “vo”, “visual”, “master export”.">
          <Input value={name} disabled={!!initial?.name} onChange={(e) => setName(e.target.value)} placeholder="vo" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Label (optional)">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="final, alt cut…" />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Path or URL" hint="Where the file lives: D:/GrowMindset/…, a Drive link, a Frame.io review link…">
          <Input value={fileRef} onChange={(e) => setFileRef(e.target.value)} placeholder="D:/GrowMindset/BIB/BIB-041/vo_v2.wav" />
        </Field>
        <div className="flex items-center gap-2">
          <input ref={fileInput} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button size="sm" icon={<Upload className="size-3.5" />} onClick={() => fileInput.current?.click()}>
            {file ? 'Change file' : 'Or upload a file'}
          </Button>
          {file && <span className="truncate text-ui-sm text-ink-2">{file.name}</span>}
        </div>
      </div>
    </Modal>
  );
}
