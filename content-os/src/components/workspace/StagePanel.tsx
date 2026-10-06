import { useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { STAGES, STAGE_META, effectiveDeps, type Stage, type StageStatus } from '../../../shared/domain';
import type { EpisodeDetail } from '../../lib/types';
import { useStageChange } from '../../lib/hooks';
import { relative, shortDate } from '../../lib/format';
import { Button, Input, Modal, cx } from '../ui';
import { StatusIcon, STATUS_LABEL } from '../status';

const ORDER: StageStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'SKIPPED'];
const TONE: Record<StageStatus, string> = {
  DONE: 'border-done/40 bg-done-bg',
  IN_PROGRESS: 'border-progress/50 bg-progress-bg',
  BLOCKED: 'border-blocked/50 bg-blocked-bg',
  NOT_STARTED: 'border-line bg-surface',
  SKIPPED: 'border-dashed border-line-strong bg-surface',
};
const TEXT: Record<StageStatus, string> = {
  DONE: 'text-done-text',
  IN_PROGRESS: 'text-progress-text',
  BLOCKED: 'text-blocked-text',
  NOT_STARTED: 'text-ink-3',
  SKIPPED: 'text-skip-text',
};

/**
 * Every stage, independently. Parallel work is normal: a stage whose prerequisites aren't done is
 * marked "early" rather than locked.
 */
export function StagePanel({ d }: { d: EpisodeDetail }) {
  const change = useStageChange();
  const [blocking, setBlocking] = useState<Stage | null>(null);
  const [note, setNote] = useState('');
  const states = Object.fromEntries(d.stages.map((s) => [s.stage, s.status])) as Record<Stage, StageStatus>;
  const rows = new Map(d.stages.map((s) => [s.stage, s]));
  const set = (stage: Stage, status: StageStatus, n?: string) => change.mutate({ episodeId: d.episode.id, stage, status, note: n });

  const visible = STAGES.filter((s) => d.modes[s] !== 'NONE');
  return (
    <section aria-label="Production stages" className="rounded-lg border border-line bg-surface p-3 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-ui font-semibold">Production</h2>
        <p className="text-caption text-ink-3">Click a status to change it. Stages can progress in parallel.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {visible.map((s) => {
          const st = states[s] ?? 'NOT_STARTED';
          const row = rows.get(s);
          const deps = effectiveDeps(d.modes, s).filter((x) => states[x] !== 'DONE' && states[x] !== 'SKIPPED');
          const isNext = d.readiness.nextStage === s;
          const actionable = d.readiness.actionable.includes(s);
          return (
            <div key={s} className={cx('flex flex-col rounded-md border p-2.5 transition-colors', TONE[st], isNext && st !== 'BLOCKED' && 'ring-2 ring-accent/50')}>
              <div className="flex items-center gap-1.5">
                <StatusIcon status={st} />
                <span className="text-ui font-semibold text-ink">{STAGE_META[s].label}</span>
                {d.modes[s] === 'OPTIONAL' && <span className="text-caption text-ink-3">optional</span>}
                {isNext && st !== 'DONE' && <span className="ml-auto rounded bg-accent px-1 text-[10px] font-semibold text-accent-fg">NEXT</span>}
              </div>
              <div className={cx('mt-0.5 text-ui-sm font-medium', TEXT[st])}>{STATUS_LABEL[st]}</div>
              <div className="mt-0.5 min-h-4 text-caption text-ink-3">
                {st === 'BLOCKED' && row?.note ? (
                  <span className="text-blocked-text" title={row.note}>
                    {row.note}
                  </span>
                ) : st === 'DONE' && row?.completed_at ? (
                  <span title={shortDate(row.completed_at)}>Done {relative(row.completed_at)}</span>
                ) : deps.length && st !== 'SKIPPED' ? (
                  <span className="inline-flex items-center gap-1" title={`Usually after ${deps.map((x) => STAGE_META[x].label).join(' + ')}`}>
                    <Lock className="size-3" /> after {deps.map((x) => STAGE_META[x].label).join(' + ')}
                  </span>
                ) : actionable && st === 'NOT_STARTED' ? (
                  <span className="text-accent-text">Ready to start</span>
                ) : st === 'IN_PROGRESS' && row?.started_at ? (
                  <span>Started {relative(row.started_at)}</span>
                ) : null}
              </div>
              <div className="mt-2 flex gap-0.5" role="radiogroup" aria-label={`${STAGE_META[s].label} status`}>
                {ORDER.map((o) => (
                  <button
                    key={o}
                    role="radio"
                    aria-checked={st === o}
                    title={STATUS_LABEL[o]}
                    disabled={change.isPending}
                    onClick={() => {
                      if (o === st) return;
                      if (o === 'BLOCKED') {
                        setNote(row?.note ?? '');
                        setBlocking(s);
                      } else set(s, o);
                    }}
                    className={cx('grid h-6 flex-1 place-items-center rounded transition-colors', st === o ? 'bg-surface shadow-card ring-1 ring-line-strong' : 'hover:bg-surface/70')}
                  >
                    <StatusIcon status={o} className={st === o ? '' : 'opacity-60'} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {d.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-md bg-progress-bg/60 px-3 py-2">
          {d.warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-ui-sm text-progress-text">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={!!blocking}
        onClose={() => setBlocking(null)}
        title={`What is blocking ${blocking ? STAGE_META[blocking].label.toLowerCase() : ''}?`}
        width="max-w-md"
        footer={
          <Button
            variant="danger"
            onClick={() => {
              if (blocking) set(blocking, 'BLOCKED', note.trim());
              setBlocking(null);
            }}
          >
            Mark blocked
          </Button>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (blocking) set(blocking, 'BLOCKED', note.trim());
            setBlocking(null);
          }}
        >
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Waiting on licensed footage" />
          <p className="mt-2 text-caption text-ink-3">The reason shows up on the dashboard, board cards and the blocked view — make it specific enough to act on later.</p>
        </form>
      </Modal>
    </section>
  );
}
