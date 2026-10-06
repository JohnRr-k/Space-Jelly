import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { STAGES, STAGE_META, PLATFORMS, PLATFORM_LABEL, type Stage, type StageMode } from '../../shared/domain';
import { api } from '../lib/api';
import { useAction, useMeta } from '../lib/hooks';
import type { ContentTypeDTO } from '../lib/types';
import { Button, Field, Input, Kbd, Modal, PageHeader, Panel, Skeleton, Textarea, cx, useConfirm } from '../components/ui';
import { PageShell } from '../components/Layout';
import { useRef } from 'react';
import { Download, Upload, RotateCcw } from 'lucide-react';
import { dataControls } from '../lib/dataControls';
import { relative } from '../lib/format';
import { useToast } from '../components/toast';

const MODE_CYCLE: StageMode[] = ['REQUIRED', 'OPTIONAL', 'NONE'];
const MODE_STYLE: Record<StageMode, string> = { REQUIRED: 'bg-accent text-accent-fg', OPTIONAL: 'bg-transparent text-ink-2 ring-1 ring-inset ring-line-strong', NONE: 'bg-transparent text-ink-3/50' };
const MODE_LABEL: Record<StageMode, string> = { REQUIRED: 'Req', OPTIONAL: 'Opt', NONE: '—' };

export default function SettingsPage() {
  const meta = useMeta();
  return (
    <PageShell>
      <PageHeader title="Settings" subtitle="Targets, thresholds and the production workflow for each content type." />
      {!meta.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5">
          <GeneralSettings settings={meta.data.settings} />
          <ContentTypes types={meta.data.contentTypes} />
          <DataPanel />
          <div className="grid gap-5 lg:grid-cols-2">
            <TagsPanel tags={meta.data.tags} />
            <Shortcuts />
          </div>
        </div>
      )}
    </PageShell>
  );
}

function GeneralSettings({ settings }: { settings: Record<string, string> }) {
  const [f, setF] = useState(settings);
  useEffect(() => setF(settings), [settings]);
  const save = useAction(() => api.patch('/settings', f), { success: 'Settings saved' });
  const fields: [string, string, string][] = [
    ['daily_target', 'Daily publishing target', 'Distinct episodes per day'],
    ['dormant_idea_days', 'Idea goes dormant after (days)', 'Untouched ideas resurface after this'],
    ['stuck_episode_days', 'Episode is stalled after (days)', 'No stage progress for this long'],
    ['quiet_project_days', 'Project is quiet after (days)', 'No activity for this long'],
    ['default_account', 'Default publishing account', 'Pre-filled on new publications'],
  ];
  return (
    <Panel title="Operating parameters" action={<Button size="sm" variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save</Button>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {fields.map(([k, label, hint]) => (
          <Field key={k} label={label} hint={hint}>
            <Input value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} inputMode={k === 'default_account' ? 'text' : 'numeric'} />
          </Field>
        ))}
      </div>
    </Panel>
  );
}

function ContentTypes({ types }: { types: ContentTypeDTO[] }) {
  const [editing, setEditing] = useState<ContentTypeDTO | 'new' | null>(null);
  const confirm = useConfirm();
  const setMode = useAction((a: { id: number; stage: Stage; mode: StageMode }) => api.patch(`/content-types/${a.id}`, { modes: { [a.stage]: a.mode } }), { success: 'Workflow updated — readiness recalculated' });
  return (
    <Panel
      title="Content types & workflows"
      action={
        <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setEditing('new')}>
          New type
        </Button>
      }
    >
      <p className="mb-3 max-w-3xl text-ui-sm text-ink-3">
        Required stages count toward readiness and gate “Ready”. Optional stages show up but never block. “—” removes the stage from that format entirely. Click a cell to cycle.
      </p>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[860px] text-ui-sm">
          <thead>
            <tr className="text-left text-caption text-ink-3">
              <th className="py-1.5 pr-3 font-medium">Type</th>
              {STAGES.map((s) => (
                <th key={s} className="px-0.5 py-1.5 text-center font-medium">
                  {STAGE_META[s].short}
                </th>
              ))}
              <th className="py-1.5 pl-3 text-right font-medium">Episodes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {types.map((ct) => (
              <tr key={ct.id} className={cx(ct.archivedAt && 'opacity-50')}>
                <td className="py-1.5 pr-3">
                  <button className="text-left font-medium hover:underline" onClick={() => setEditing(ct)}>
                    {ct.name}
                  </button>
                  <div className="text-caption text-ink-3">{ct.defaultPlatforms.map((p) => PLATFORM_LABEL[p as never] ?? p).join(', ')}</div>
                </td>
                {STAGES.map((s) => {
                  const m = ct.modes[s];
                  return (
                    <td key={s} className="px-0.5 py-1.5 text-center">
                      <button
                        title={`${STAGE_META[s].label}: ${m.toLowerCase()} — click to change`}
                        disabled={setMode.isPending}
                        onClick={async () => {
                          const next = MODE_CYCLE[(MODE_CYCLE.indexOf(m) + 1) % 3];
                          if (ct.episodeCount > 0 && !(await confirm.ask(`Change ${STAGE_META[s].label} to ${next.toLowerCase()} for ${ct.name}?`, `Readiness for ${ct.episodeCount} episodes will be recalculated. Stage data is not deleted.`, 'Change', false))) return;
                          setMode.mutate({ id: ct.id, stage: s, mode: next });
                        }}
                        className={cx('h-6 w-11 rounded text-caption font-medium transition-colors', MODE_STYLE[m])}
                      >
                        {MODE_LABEL[m]}
                      </button>
                    </td>
                  );
                })}
                <td className="tabular py-1.5 pl-3 text-right text-ink-2">{ct.episodeCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirm.node}
      <ContentTypeDialog value={editing} onClose={() => setEditing(null)} />
    </Panel>
  );
}

function ContentTypeDialog({ value, onClose }: { value: ContentTypeDTO | 'new' | null; onClose: () => void }) {
  const ct = value && value !== 'new' ? value : null;
  const [f, setF] = useState({ name: '', description: '', defaultDurationSec: '' as string, defaultPlatforms: ['INSTAGRAM'] as string[], checklist: '' });
  useEffect(() => {
    if (value) setF({ name: ct?.name ?? '', description: ct?.description ?? '', defaultDurationSec: ct?.defaultDurationSec ? String(ct.defaultDurationSec) : '', defaultPlatforms: ct?.defaultPlatforms ?? ['INSTAGRAM'], checklist: (ct?.checklist ?? []).join('\n') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const body = () => ({ name: f.name, description: f.description, defaultDurationSec: f.defaultDurationSec ? Number(f.defaultDurationSec) : null, defaultPlatforms: f.defaultPlatforms, checklist: f.checklist.split('\n').map((x) => x.trim()).filter(Boolean) });
  const save = useAction(() => (ct ? api.patch(`/content-types/${ct.id}`, body()) : api.post('/content-types', body())), { success: 'Content type saved', onDone: onClose });
  const archive = useAction(() => api.patch(`/content-types/${ct!.id}`, { archived: !ct!.archivedAt }), { success: 'Updated', onDone: onClose });
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={ct ? `Edit ${ct.name}` : 'New content type'}
      footer={
        <>
          {ct && (
            <Button className="mr-auto" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => archive.mutate(undefined)}>
              {ct.archivedAt ? 'Unarchive' : 'Archive'}
            </Button>
          )}
          <Button variant="primary" disabled={!f.name.trim()} loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Default duration (seconds)">
          <Input type="number" value={f.defaultDurationSec} onChange={(e) => setF({ ...f, defaultDurationSec: e.target.value })} />
        </Field>
        <Field label="Default platforms">
          <div className="flex flex-wrap gap-1">
            {PLATFORMS.map((p) => {
              const on = f.defaultPlatforms.includes(p);
              return (
                <button key={p} type="button" aria-pressed={on} onClick={() => setF({ ...f, defaultPlatforms: on ? f.defaultPlatforms.filter((x) => x !== p) : [...f.defaultPlatforms, p] })} className={cx('rounded-md border px-2 py-0.5 text-ui-sm', on ? 'border-accent bg-accent-subtle text-accent-text' : 'border-line-strong text-ink-2')}>
                  {PLATFORM_LABEL[p]}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Default checklist" hint="One item per line. Copied onto every new episode of this type.">
          <Textarea rows={4} value={f.checklist} onChange={(e) => setF({ ...f, checklist: e.target.value })} />
        </Field>
        {!ct && <p className="text-caption text-ink-3">New types start with every stage required — adjust the workflow in the table afterwards.</p>}
      </div>
    </Modal>
  );
}

function TagsPanel({ tags }: { tags: { id: number; name: string; count: number }[] }) {
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const rename = useAction(() => api.patch(`/tags/${renaming!.id}`, { name: renaming!.name }), { success: 'Tag renamed', onDone: () => setRenaming(null) });
  const del = useAction((id: number) => api.del(`/tags/${id}`), { success: 'Tag deleted' });
  return (
    <Panel title={`Tags (${tags.length})`}>
      <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto scroll-thin">
        {tags.map((t) => (
          <span key={t.id} className="group inline-flex items-center gap-1 rounded bg-hover py-0.5 pl-1.5 pr-1 text-ui-sm">
            <button onClick={() => setRenaming({ id: t.id, name: t.name })} className="hover:underline" title="Rename">
              #{t.name}
            </button>
            <span className="tabular text-caption text-ink-3">{t.count}</span>
            <button
              className="hidden text-ink-3 hover:text-blocked-text group-hover:inline"
              aria-label={`Delete tag ${t.name}`}
              onClick={async () => {
                if (await confirm.ask(`Delete #${t.name}?`, `It is removed from ${t.count} episodes and any ideas, sources or series that use it.`, 'Delete tag')) del.mutate(t.id);
              }}
            >
              <Trash2 className="size-3" />
            </button>
          </span>
        ))}
      </div>
      {confirm.node}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename tag" width="max-w-sm" footer={<Button variant="primary" onClick={() => rename.mutate(undefined)} loading={rename.isPending}>Rename</Button>}>
        <Input value={renaming?.name ?? ''} onChange={(e) => setRenaming(renaming && { ...renaming, name: e.target.value })} />
      </Modal>
    </Panel>
  );
}

function Shortcuts() {
  const rows: [string[], string][] = [
    [['Ctrl', 'K'], 'Command palette & global search'],
    [['/'], 'Search'],
    [['N'], 'New episode'],
    [['I'], 'Capture idea'],
    [['G', 'D'], 'Dashboard'],
    [['G', 'T'], 'Today'],
    [['G', 'E'], 'Episode library'],
    [['G', 'B'], 'Production board'],
    [['G', 'P'], 'Projects'],
    [['G', 'I'], 'Ideas'],
    [['G', 'S'], 'Sources'],
    [['G', 'R'], 'Resurface'],
    [['Shift', 'Click'], 'Select a range in the library'],
    [['Esc'], 'Clear selection / close'],
  ];
  return (
    <Panel title="Keyboard">
      <ul className="grid gap-1.5 text-ui-sm">
        {rows.map(([keys, label]) => (
          <li key={label} className="flex items-center justify-between gap-3">
            <span className="text-ink-2">{label}</span>
            <span className="flex gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function DataPanel() {
  const c = dataControls();
  const toast = useToast();
  const confirm = useConfirm();
  const file = useRef<HTMLInputElement>(null);
  const st = c.status?.();
  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      toast.error(e);
    }
  };
  return (
    <Panel title="Data & backup">
      {c.mode === 'standalone' ? (
        <div className="grid gap-1 text-ui-sm text-ink-2">
          <p>
            This single-file version keeps your whole database inside this browser (IndexedDB) and saves after every change
            {st?.lastSavedAt ? ` — last saved ${relative(st.lastSavedAt)}` : ''}. Clearing browser data or using another browser starts fresh, so export a backup regularly.
          </p>
          {st && !st.storageOk && <p className="text-blocked-text">This browser is blocking storage — changes are NOT being saved. Export your data before closing the page.</p>}
          {st?.persistent === false && <p className="text-ink-3">The browser may evict this data under storage pressure; exporting is your safety net.</p>}
          <p className="text-ink-3">Backups are standard SQLite files. They also work with the full server version: copy one to <code className="font-mono">content-os/data/content-os.db</code>.</p>
        </div>
      ) : (
        <p className="text-ui-sm text-ink-2">
          Your database is <code className="font-mono">content-os/data/content-os.db</code>. Download a copy any time; it can also be opened in the single-file version.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button icon={<Download className="size-3.5" />} onClick={() => run(c.exportDb)}>
          Download backup
        </Button>
        {c.importDb && (
          <>
            <input
              ref={file}
              type="file"
              accept=".sqlite,.db,.sqlite3,application/octet-stream"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f && (await confirm.ask('Replace all data with this backup?', 'A copy of your current data downloads first, so nothing is lost.', 'Import backup'))) run(() => c.importDb!(f));
              }}
            />
            <Button icon={<Upload className="size-3.5" />} onClick={() => file.current?.click()}>
              Restore from backup…
            </Button>
          </>
        )}
        {c.reset && (
          <>
            <Button
              variant="ghost"
              icon={<RotateCcw className="size-3.5" />}
              onClick={async () => {
                if (await confirm.ask('Start with an empty workspace?', 'Removes the demo content and everything you added. A backup of the current data downloads first.', 'Start empty')) run(() => c.reset!('empty'));
              }}
            >
              Start empty
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                if (await confirm.ask('Reload the demo universe?', 'Replaces all current data with the demo projects. A backup of the current data downloads first.', 'Reload demo')) run(() => c.reset!('demo'));
              }}
            >
              Reload demo data
            </Button>
          </>
        )}
      </div>
      {confirm.node}
    </Panel>
  );
}
