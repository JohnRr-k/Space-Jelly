import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, CalendarClock, CalendarDays, Copy, Flag, Layers, ListChecks, MoveRight, Radio, Shapes, Tag, Trash2, X, BookOpen, CalendarCheck } from 'lucide-react';
import { STAGES, STAGE_META, PHASES, PHASE_META, PLATFORMS, PLATFORM_LABEL, PRIORITY_LABEL, type Phase, type Stage, type StageStatus } from '../../shared/domain';
import { api } from '../lib/api';
import { useMeta, useRefresh, useUndo } from '../lib/hooks';
import { localDay, toLocalInput, fromLocalInput, num } from '../lib/format';
import type { Source, UndoPayload } from '../lib/types';
import { Button, Field, Input, MenuItem, Modal, Popover, Select, cx, useConfirm } from './ui';
import { TagInput } from './TagInput';
import { StatusIcon, STATUS_LABEL } from './status';
import { useToast } from './toast';

type BulkAction = Record<string, unknown> & { type: string };

export function BulkBar({ ids, total, onSelectAll, onClear, allSelected }: { ids: number[]; total: number; onSelectAll: () => void; onClear: () => void; allSelected: boolean }) {
  const meta = useMeta();
  const refresh = useRefresh();
  const toast = useToast();
  const undo = useUndo();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<null | 'schedule' | 'publish' | 'due' | 'tags' | 'untag' | 'source' | 'block'>(null);
  const [blockStage, setBlockStage] = useState<Stage>('VOICE');

  const run = async (action: BulkAction, label: string) => {
    setBusy(true);
    try {
      const r = await api.post<{ affected: number; warnings: string[]; undo: UndoPayload | null }>('/episodes/bulk', { ids, action });
      refresh();
      toast.show({
        tone: r.warnings.length ? 'warning' : 'success',
        message: `${label} — ${num(r.affected)} episode${r.affected === 1 ? '' : 's'}`,
        detail: r.warnings.join(' ') || undefined,
        action: r.undo ? { label: 'Undo', onClick: () => undo(r.undo!) } : undefined,
      });
      setDialog(null);
      if (action.type === 'delete' || action.type === 'archive' || action.type === 'unarchive') onClear();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const n = ids.length;
  const menu = (label: string, icon: ReactNode, children: (close: () => void) => ReactNode, cls?: string) => (
    <Popover
      className={cx('bottom-full mb-2 mt-0 max-h-[60vh] overflow-y-auto scroll-thin', cls)}
      trigger={({ toggle, open }) => (
        <Button size="sm" variant="ghost" onClick={toggle} className={cx('text-ink', open && 'bg-hover')} icon={icon} disabled={busy}>
          {label}
        </Button>
      )}
    >
      {children}
    </Popover>
  );

  return (
    <>
      <div className="animate-pop fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-fit flex-wrap items-center gap-1 rounded-xl border border-line bg-surface px-2 py-1.5 shadow-pop lg:left-64">
        <div className="flex items-center gap-2 pl-1.5 pr-2">
          <span className="tabular text-ui font-semibold">{num(n)} selected</span>
          {!allSelected && total > n && (
            <button className="text-ui-sm text-accent-text hover:underline" onClick={onSelectAll}>
              Select all {num(total)}
            </button>
          )}
        </div>
        <span className="h-5 w-px bg-line" />
        {menu('Stage', <ListChecks className="size-3.5" />, (close) => (
          <div className="w-72">
            <p className="px-2 pb-1 pt-1 text-caption text-ink-3">Set one stage on every selected episode. Other stages are untouched.</p>
            {STAGES.map((s) => (
              <div key={s} className="flex items-center gap-1 px-1 py-0.5">
                <span className="w-16 text-ui-sm text-ink-2">{STAGE_META[s].label}</span>
                {(['DONE', 'IN_PROGRESS', 'NOT_STARTED', 'SKIPPED'] as StageStatus[]).map((st) => (
                  <button
                    key={st}
                    title={`${STAGE_META[s].label} → ${STATUS_LABEL[st]}`}
                    className="grid size-7 place-items-center rounded hover:bg-hover"
                    onClick={() => {
                      close();
                      run({ type: 'setStage', stage: s, status: st }, `${STAGE_META[s].label} → ${STATUS_LABEL[st].toLowerCase()}`);
                    }}
                  >
                    <StatusIcon status={st} />
                  </button>
                ))}
                <button
                  title={`Block ${STAGE_META[s].label}…`}
                  className="grid size-7 place-items-center rounded hover:bg-hover"
                  onClick={() => {
                    close();
                    setBlockStage(s);
                    setDialog('block');
                  }}
                >
                  <StatusIcon status="BLOCKED" />
                </button>
              </div>
            ))}
          </div>
        ))}
        {menu('Move', <MoveRight className="size-3.5" />, (close) => (
          <>
            <p className="max-w-56 px-2 pb-1 pt-1 text-caption text-ink-3">Completes earlier stages and opens the target. Parallel work is kept.</p>
            {PHASES.filter((p) => p !== 'SCHEDULED').map((p) => (
              <MenuItem
                key={p}
                onClick={async () => {
                  close();
                  if ((p === 'READY' || p === 'PUBLISHED' || p === 'IDEA') && !(await confirm.ask(`Move ${n} episodes to ${PHASE_META[p].label}?`, p === 'IDEA' ? 'This resets every stage to not started. You can undo right after.' : 'Every earlier required stage will be marked done. You can undo right after.', 'Move', p === 'IDEA'))) return;
                  run({ type: 'move', phase: p as Phase }, `Moved to ${PHASE_META[p].label}`);
                }}
              >
                {PHASE_META[p].label}
              </MenuItem>
            ))}
          </>
        ))}
        {menu('Priority', <Flag className="size-3.5" />, (close) =>
          [0, 1, 2, 3].map((p) => (
            <MenuItem key={p} onClick={() => (close(), run({ type: 'priority', priority: p }, `Priority → ${PRIORITY_LABEL[p]}`))}>
              {PRIORITY_LABEL[p]}
            </MenuItem>
          )),
        )}
        {menu('Series', <Layers className="size-3.5" />, (close) => (
          <div className="w-64">
            <MenuItem onClick={() => (close(), run({ type: 'series', seriesId: null }, 'Series cleared'))}>No series</MenuItem>
            {meta.data?.projects.map((p) => {
              const ss = meta.data!.series.filter((s) => s.projectId === p.id && !s.archivedAt);
              if (!ss.length) return null;
              return (
                <div key={p.id}>
                  <div className="px-2 pt-2 pb-0.5 text-caption text-ink-3">{p.name}</div>
                  {ss.map((s) => (
                    <MenuItem key={s.id} onClick={() => (close(), run({ type: 'series', seriesId: s.id }, `Series → ${s.title}`))}>
                      {s.title}
                    </MenuItem>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
        {menu('More', <Shapes className="size-3.5" />, (close) => (
          <div className="w-56">
            <MenuItem icon={<CalendarCheck />} onClick={() => (close(), run({ type: 'today' }, 'Added to today’s queue'))}>
              Add to today’s queue
            </MenuItem>
            <MenuItem icon={<CalendarClock />} onClick={() => (close(), setDialog('schedule'))}>
              Schedule…
            </MenuItem>
            <MenuItem icon={<Radio />} onClick={() => (close(), setDialog('publish'))}>
              Mark published…
            </MenuItem>
            <MenuItem icon={<CalendarDays />} onClick={() => (close(), setDialog('due'))}>
              Set due date…
            </MenuItem>
            <MenuItem icon={<Tag />} onClick={() => (close(), setDialog('tags'))}>
              Add tags…
            </MenuItem>
            <MenuItem icon={<Tag />} onClick={() => (close(), setDialog('untag'))}>
              Remove tags…
            </MenuItem>
            <MenuItem icon={<BookOpen />} onClick={() => (close(), setDialog('source'))}>
              Attach source…
            </MenuItem>
            <div className="my-1 h-px bg-line" />
            <div className="px-2 pb-0.5 text-caption text-ink-3">Content type</div>
            {meta.data?.contentTypes
              .filter((c) => !c.archivedAt)
              .map((c) => (
                <MenuItem key={c.id} onClick={() => (close(), run({ type: 'contentType', contentTypeId: c.id }, `Type → ${c.name}`))}>
                  {c.name}
                </MenuItem>
              ))}
            <div className="my-1 h-px bg-line" />
            <MenuItem icon={<Copy />} onClick={() => (close(), run({ type: 'duplicate' }, 'Duplicated as variants'))} disabled={n > 50}>
              Duplicate{n > 50 ? ' (max 50)' : ''}
            </MenuItem>
            <MenuItem icon={<Archive />} onClick={() => (close(), run({ type: 'archive' }, 'Archived'))}>
              Archive
            </MenuItem>
            <MenuItem icon={<Archive />} onClick={() => (close(), run({ type: 'unarchive' }, 'Restored from archive'))}>
              Unarchive
            </MenuItem>
            <MenuItem
              icon={<Trash2 />}
              danger
              onClick={async () => {
                close();
                if (await confirm.ask(`Move ${n} episode${n > 1 ? 's' : ''} to the trash?`, 'They disappear from every view but can be restored from Archive & trash. Nothing is permanently deleted.', 'Move to trash')) run({ type: 'delete' }, 'Moved to trash');
              }}
            >
              Move to trash…
            </MenuItem>
          </div>
        ))}
        <span className="h-5 w-px bg-line" />
        <button className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink" aria-label="Clear selection" title="Clear selection (Esc)" onClick={onClear}>
          <X className="size-4" />
        </button>
      </div>
      {confirm.node}
      <ScheduleDialog open={dialog === 'schedule' || dialog === 'publish'} publishNow={dialog === 'publish'} n={n} busy={busy} onClose={() => setDialog(null)} onSubmit={(a, label) => run(a, label)} />
      <SimpleDialog open={dialog === 'due'} title={`Due date for ${n} episodes`} busy={busy} onClose={() => setDialog(null)} initial={localDay()} input="date" onSubmit={(v) => run({ type: 'dueDate', dueDate: v || null }, v ? `Due → ${v}` : 'Due date cleared')} allowEmpty />
      <TagsDialog open={dialog === 'tags' || dialog === 'untag'} remove={dialog === 'untag'} n={n} busy={busy} onClose={() => setDialog(null)} onSubmit={(tags) => run({ type: dialog === 'untag' ? 'removeTags' : 'addTags', tags }, dialog === 'untag' ? 'Tags removed' : 'Tagged')} />
      <SourceDialog open={dialog === 'source'} n={n} busy={busy} onClose={() => setDialog(null)} onSubmit={(sourceId, title) => run({ type: 'addSource', sourceId }, `Source “${title}” attached`)} />
      <SimpleDialog open={dialog === 'block'} title={`Block ${STAGE_META[blockStage].label} on ${n} episodes`} busy={busy} onClose={() => setDialog(null)} initial="" input="text" placeholder="Why is it blocked? (shown on every card)" onSubmit={(v) => run({ type: 'setStage', stage: blockStage, status: 'BLOCKED', note: v }, `${STAGE_META[blockStage].label} blocked`)} />
    </>
  );
}

function SimpleDialog({ open, title, onClose, onSubmit, initial, input, placeholder, busy, allowEmpty }: { open: boolean; title: string; onClose: () => void; onSubmit: (v: string) => void; initial: string; input: 'date' | 'text'; placeholder?: string; busy: boolean; allowEmpty?: boolean }) {
  const [v, setV] = useState(initial);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-sm"
      footer={
        <>
          {allowEmpty && <Button onClick={() => onSubmit('')}>Clear</Button>}
          <Button variant="primary" loading={busy} onClick={() => onSubmit(v)} disabled={!allowEmpty && !v.trim()}>
            Apply
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(v);
        }}
      >
        <Input type={input} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
      </form>
    </Modal>
  );
}

function TagsDialog({ open, remove, n, onClose, onSubmit, busy }: { open: boolean; remove: boolean; n: number; onClose: () => void; onSubmit: (t: string[]) => void; busy: boolean }) {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${remove ? 'Remove tags from' : 'Add tags to'} ${n} episodes`}
      width="max-w-md"
      footer={
        <Button variant="primary" loading={busy} disabled={!tags.length} onClick={() => onSubmit(tags)}>
          {remove ? 'Remove' : 'Add'} {tags.length || ''} tag{tags.length === 1 ? '' : 's'}
        </Button>
      }
    >
      <TagInput value={tags} onChange={setTags} />
    </Modal>
  );
}

function SourceDialog({ open, n, onClose, onSubmit, busy }: { open: boolean; n: number; onClose: () => void; onSubmit: (id: number, title: string) => void; busy: boolean }) {
  const sources = useQuery({ queryKey: ['sources', 'all'], queryFn: () => api.get<Source[]>('/sources'), enabled: open });
  const [id, setId] = useState<number | null>(null);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Attach a source to ${n} episodes`}
      width="max-w-md"
      footer={
        <Button variant="primary" loading={busy} disabled={!id} onClick={() => id && onSubmit(id, sources.data?.find((s) => s.id === id)?.title ?? '')}>
          Attach source
        </Button>
      }
    >
      <Select value={id ?? ''} onChange={(e) => setId(Number(e.target.value) || null)}>
        <option value="">Choose a source…</option>
        {sources.data?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
            {s.author ? ` — ${s.author}` : ''}
          </option>
        ))}
      </Select>
    </Modal>
  );
}

export function ScheduleDialog({ open, publishNow, n, onClose, onSubmit, busy }: { open: boolean; publishNow: boolean; n: number; onClose: () => void; onSubmit: (a: BulkAction, label: string) => void; busy: boolean }) {
  const meta = useMeta();
  const tomorrow9 = new Date();
  tomorrow9.setDate(tomorrow9.getDate() + 1);
  tomorrow9.setHours(9, 0, 0, 0);
  const [platform, setPlatform] = useState<string>('INSTAGRAM');
  const [start, setStart] = useState(toLocalInput(tomorrow9.toISOString()));
  const [perDay, setPerDay] = useState<number>(Number(meta.data?.settings.daily_target ?? 10));
  const interval = Math.max(0, Math.round((12 * 60) / Math.max(1, perDay)));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={publishNow ? `Mark ${n} episodes as published` : `Schedule ${n} episodes`}
      width="max-w-md"
      footer={
        <Button
          variant="primary"
          loading={busy}
          onClick={() =>
            publishNow
              ? onSubmit({ type: 'publishNow', platform, account: meta.data?.settings.default_account }, `Published on ${PLATFORM_LABEL[platform as never]}`)
              : onSubmit({ type: 'schedule', platform, startAt: fromLocalInput(start), intervalMinutes: interval, account: meta.data?.settings.default_account }, `Scheduled on ${PLATFORM_LABEL[platform as never]}`)
          }
        >
          {publishNow ? 'Mark published' : 'Schedule'}
        </Button>
      }
    >
      <div className="grid gap-3">
        <Field label="Platform">
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        {!publishNow && (
          <>
            <Field label="First post at">
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Posts per day" hint={`Spaced every ${Math.floor(interval / 60)}h ${interval % 60}m across a 12-hour window, in the selection’s order.`}>
              <Input type="number" min={1} max={48} value={perDay} onChange={(e) => setPerDay(Number(e.target.value) || 1)} />
            </Field>
          </>
        )}
        {publishNow && <p className="text-ui-sm text-ink-2">Creates a published record (now) for each episode, or confirms its existing scheduled post on that platform.</p>}
      </div>
    </Modal>
  );
}
