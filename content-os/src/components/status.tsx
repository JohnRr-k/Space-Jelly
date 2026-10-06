import { Link } from 'react-router-dom';
import { Ban, Check, Circle, CircleDashed, Clock3, Minus } from 'lucide-react';
import { STAGES, STAGE_META, PHASE_META, PRIORITY_LABEL, type Phase, type Stage, type StageMode, type StageStatus } from '../../shared/domain';
import { cx } from './ui';
import { dueInfo } from '../lib/format';
import { useMeta } from '../lib/hooks';

export const STATUS_LABEL: Record<StageStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  SKIPPED: 'Skipped',
};

const CELL: Record<StageStatus, string> = {
  DONE: 'bg-done',
  IN_PROGRESS: 'bg-progress',
  BLOCKED: 'bg-blocked',
  NOT_STARTED: 'bg-none',
  SKIPPED: 'bg-none/50',
};

export function useModes(contentTypeId: number | null | undefined): Partial<Record<Stage, StageMode>> {
  const meta = useMeta();
  return meta.data?.contentTypes.find((c) => c.id === contentTypeId)?.modes ?? {};
}

/**
 * The production strip: one cell per stage, always in pipeline order so columns line up when
 * scanning a list. Stages a content type doesn't use render as a hairline.
 */
export function StageStrip({ stages, contentTypeId, size = 'sm', className }: { stages: Partial<Record<Stage, StageStatus>>; contentTypeId?: number; size?: 'sm' | 'md'; className?: string }) {
  const modes = useModes(contentTypeId);
  const summary = STAGES.filter((s) => modes[s] !== 'NONE')
    .map((s) => `${STAGE_META[s].label}: ${STATUS_LABEL[stages[s] ?? 'NOT_STARTED'].toLowerCase()}`)
    .join(', ');
  return (
    <div className={cx('flex items-center', size === 'sm' ? 'gap-[2px]' : 'gap-[3px]', className)} role="img" aria-label={summary} title={summary}>
      {STAGES.map((s) => {
        const st = stages[s] ?? 'NOT_STARTED';
        const none = modes[s] === 'NONE';
        const optional = modes[s] === 'OPTIONAL';
        return (
          <span
            key={s}
            className={cx(
              'rounded-[2px]',
              size === 'sm' ? 'h-3 w-[7px]' : 'h-4 w-2.5',
              none ? 'h-px bg-line-strong' : CELL[st],
              optional && !none && st === 'NOT_STARTED' && 'bg-transparent ring-1 ring-inset ring-line-strong',
              s === 'SCHEDULE' && (size === 'sm' ? 'ml-[3px]' : 'ml-1'),
            )}
          />
        );
      })}
    </div>
  );
}

export function StatusIcon({ status, className }: { status: StageStatus; className?: string }) {
  const c = cx('size-3.5 shrink-0', className);
  switch (status) {
    case 'DONE':
      return <Check className={cx(c, 'text-done')} strokeWidth={2.5} />;
    case 'IN_PROGRESS':
      return <Clock3 className={cx(c, 'text-progress')} strokeWidth={2.25} />;
    case 'BLOCKED':
      return <Ban className={cx(c, 'text-blocked')} strokeWidth={2.25} />;
    case 'SKIPPED':
      return <Minus className={cx(c, 'text-skip-text')} />;
    default:
      return <Circle className={cx(c, 'text-ink-3/60')} />;
  }
}

const PHASE_TONE: Record<Phase, string> = {
  IDEA: 'bg-hover text-ink-2',
  RESEARCH: 'bg-hover text-ink-2',
  SCRIPT: 'bg-hover text-ink-2',
  VOICE: 'bg-hover text-ink-2',
  VISUAL: 'bg-hover text-ink-2',
  EDIT: 'bg-hover text-ink-2',
  QC: 'bg-hover text-ink-2',
  READY: 'bg-done-bg text-done-text',
  SCHEDULED: 'bg-sched-bg text-sched-text',
  PUBLISHED: 'bg-ink text-surface',
};

export function PhaseBadge({ phase, blocked }: { phase: Phase; blocked?: boolean }) {
  if (blocked)
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-caption font-medium bg-blocked-bg text-blocked-text">
        <Ban className="size-3" /> Blocked
      </span>
    );
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded px-1.5 py-px text-caption font-medium', PHASE_TONE[phase])}>{PHASE_META[phase].label}</span>;
}

export function PriorityMark({ priority, showLabel }: { priority: number; showLabel?: boolean }) {
  if (priority >= 2 && !showLabel) return null;
  const tone = priority === 0 ? 'text-blocked-text' : priority === 1 ? 'text-progress-text' : 'text-ink-3';
  const bars = 4 - priority;
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap text-caption font-medium', tone)} title={`${PRIORITY_LABEL[priority]} priority`}>
      <span className="inline-flex items-end gap-px" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cx('w-[3px] rounded-[1px]', i < bars - 1 ? 'bg-current' : 'bg-current/25')} style={{ height: 5 + i * 2.5 }} />
        ))}
      </span>
      {(showLabel || priority < 2) && PRIORITY_LABEL[priority]}
    </span>
  );
}

export function Readiness({ value, compact }: { value: number; compact?: boolean }) {
  const tone = value >= 100 ? 'bg-done' : value >= 75 ? 'bg-done/80' : value >= 40 ? 'bg-progress' : 'bg-ink-3/50';
  return (
    <span className="inline-flex items-center gap-1.5" title={`${value}% production readiness`}>
      {!compact && (
        <span className="h-1.5 w-10 overflow-hidden rounded-full bg-hover">
          <span className={cx('block h-full rounded-full', tone)} style={{ width: `${value}%` }} />
        </span>
      )}
      <span className="tabular w-8 text-right text-caption text-ink-2">{value}%</span>
    </span>
  );
}

export function ProjectDot({ color, className }: { color: string; className?: string }) {
  return <span className={cx('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: color }} aria-hidden />;
}

export function Code({ children, className }: { children: string; className?: string }) {
  return <span className={cx('font-mono text-[11.5px] tabular text-ink-3 whitespace-nowrap', className)}>{children}</span>;
}

export function Tags({ tags, max = 3, linkable = true, nowrap }: { tags: string[]; max?: number; linkable?: boolean; nowrap?: boolean }) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);
  return (
    <span className={cx('inline-flex items-center gap-1', nowrap ? 'min-w-0 flex-nowrap overflow-hidden whitespace-nowrap' : 'flex-wrap')}>
      {shown.map((t) =>
        linkable ? (
          <Link key={t} to={`/episodes?tags=${encodeURIComponent(t)}`} className="rounded bg-hover px-1.5 text-caption text-ink-2 hover:bg-active hover:text-ink" onClick={(e) => e.stopPropagation()}>
            #{t}
          </Link>
        ) : (
          <span key={t} className="rounded bg-hover px-1.5 text-caption text-ink-2">
            #{t}
          </span>
        ),
      )}
      {tags.length > max && <span className="text-caption text-ink-3">+{tags.length - max}</span>}
    </span>
  );
}

export function Due({ date }: { date: string | null }) {
  const d = dueInfo(date);
  if (!d) return null;
  return (
    <span
      className={cx(
        'whitespace-nowrap text-caption tabular',
        d.tone === 'overdue' ? 'font-medium text-blocked-text' : d.tone === 'today' ? 'font-medium text-progress-text' : 'text-ink-3',
      )}
    >
      {d.label}
    </span>
  );
}

export function NextStage({ stage, actionable, blocked, note }: { stage: Stage | null; actionable?: Stage[]; blocked?: boolean; note?: string | null }) {
  if (blocked && note) return <span className="truncate text-caption text-blocked-text" title={note}>{note}</span>;
  if (!stage) return <span className="text-caption text-ink-3">—</span>;
  const parallel = (actionable ?? []).filter((s) => s !== stage && STAGE_META[s].phase === 'production');
  return (
    <span className="truncate text-caption text-ink-2">
      {STAGE_META[stage].label}
      {parallel.length > 0 && <span className="text-ink-3"> + {parallel.map((s) => STAGE_META[s].label).join(', ')}</span>}
    </span>
  );
}

export function StageLegend() {
  const items: [StageStatus, string][] = [
    ['DONE', 'Done'],
    ['IN_PROGRESS', 'In progress'],
    ['BLOCKED', 'Blocked'],
    ['NOT_STARTED', 'Not started'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-caption text-ink-3">
      {items.map(([s, l]) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className={cx('h-3 w-[7px] rounded-[2px]', CELL[s])} /> {l}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <CircleDashed className="size-3" /> Strip order: {STAGES.map((s) => STAGE_META[s].short).join(' ')}
      </span>
    </div>
  );
}
