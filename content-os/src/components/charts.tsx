import { Link } from 'react-router-dom';
import { STAGE_META } from '../../shared/domain';
import type { Bottleneck, ProjectStats } from '../lib/types';
import { num, pct } from '../lib/format';
import { cx } from './ui';

/** Ordinal progress, so one hue: darker = further along. Order is fixed. */
export const PROGRESS_SEGMENTS = [
  { key: 'published', label: 'Published', cls: 'bg-seq-5' },
  { key: 'scheduled', label: 'Scheduled', cls: 'bg-seq-4' },
  { key: 'ready', label: 'Ready', cls: 'bg-seq-3' },
  { key: 'inProduction', label: 'In production', cls: 'bg-seq-2' },
  { key: 'idea', label: 'Planned', cls: 'bg-seq-1' },
] as const;

/**
 * Stacked progress bar against the project target. The empty track is the part of the
 * target that doesn't exist as episodes yet — which is the honest "how far" picture.
 */
export function ProgressBar({ stats, height = 'h-2.5', className }: { stats: ProjectStats; height?: string; className?: string }) {
  const denom = Math.max(stats.target ?? 0, stats.total, 1);
  return (
    <div className={cx('flex w-full gap-[2px] overflow-hidden rounded bg-track', height, className)} role="img" aria-label={progressSummary(stats)}>
      {PROGRESS_SEGMENTS.map((s) => {
        const v = stats[s.key];
        if (!v) return null;
        return <div key={s.key} className={cx(s.cls, 'h-full first:rounded-l last:rounded-r')} style={{ width: `${(v / denom) * 100}%` }} title={`${s.label}: ${num(v)}`} />;
      })}
    </div>
  );
}

export function progressSummary(s: ProjectStats) {
  return `${num(s.published)} published, ${num(s.scheduled)} scheduled, ${num(s.ready)} ready, ${num(s.inProduction)} in production, ${num(s.idea)} planned${s.target ? ` of a ${num(s.target)} target` : ''}`;
}

export function ProgressLegend({ className }: { className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-3', className)}>
      {PROGRESS_SEGMENTS.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className={cx('size-2.5 rounded-[3px]', s.cls)} />
          {s.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] bg-track ring-1 ring-inset ring-line" />
        Not created yet
      </span>
    </div>
  );
}

/** Coverage vs production completion: two different truths about "how far". */
export function ProgressNumbers({ stats }: { stats: ProjectStats }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-ui-sm">
      <span title="Episodes that exist (any stage) ÷ target">
        <span className="text-ink-3">Coverage </span>
        <span className="tabular font-medium text-ink">{stats.coverage === null ? '—' : pct(stats.coverage, stats.coverage < 0.1 ? 1 : 0)}</span>
      </span>
      <span title="Effort-weighted production readiness across the whole target">
        <span className="text-ink-3">Completion </span>
        <span className="tabular font-medium text-ink">{pct(stats.completion, stats.completion < 0.1 ? 1 : 0)}</span>
      </span>
      <span>
        <span className="text-ink-3">Published </span>
        <span className="tabular font-medium text-ink">
          {num(stats.published)}
          {stats.target ? <span className="font-normal text-ink-3"> / {num(stats.target)}</span> : null}
        </span>
      </span>
    </div>
  );
}

/**
 * Pipeline flow: queue at each production station. Single measure → single hue; the bottleneck
 * row is emphasised, everything else recedes.
 */
export function FlowChart({ data, compact }: { data: Bottleneck; compact?: boolean }) {
  const flows = data.flows;
  const max = Math.max(1, ...flows.map((f) => f.waiting + f.inProgress));
  return (
    <div className="grid gap-1" role="table" aria-label="Work queued at each stage">
      <div role="row" className="grid grid-cols-[4.5rem_1fr_2.5rem_3.5rem] items-center gap-2 pb-1 text-caption text-ink-3">
        <span role="columnheader">Stage</span>
        <span role="columnheader" className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-ink-3/60" />
            not started
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-ink-3/25" />
            in progress
          </span>
        </span>
        <span role="columnheader" className="text-right">Queue</span>
        <span role="columnheader" className="text-right" title="Days to clear at the last 14 days' pace">
          Clears
        </span>
      </div>
      {flows.map((f) => {
        const hot = f.stage === data.stage;
        const q = f.waiting + f.inProgress;
        if (compact && q === 0 && !hot) return null;
        return (
          <Link
            role="row"
            key={f.stage}
            to={`/episodes?waitingFor=${f.stage}`}
            className={cx('group grid grid-cols-[4.5rem_1fr_2.5rem_3.5rem] items-center gap-2 rounded px-1 -mx-1 py-0.5 hover:bg-hover')}
            title={`${STAGE_META[f.stage].label}: ${f.waiting} not started, ${f.inProgress} in progress, ${f.blocked} blocked · ${f.done14d} completed in the last 14 days`}
          >
            <span role="cell" className={cx('text-ui-sm', hot ? 'font-semibold text-ink' : 'text-ink-2')}>
              {STAGE_META[f.stage].label}
            </span>
            <span role="cell" className="flex h-3 items-center gap-[2px]">
              {f.waiting > 0 && <span className={cx('h-full rounded-l-[3px]', f.inProgress ? '' : 'rounded-r-[3px]', hot ? 'bg-accent' : 'bg-ink-3/60')} style={{ width: `${(f.waiting / max) * 100}%` }} />}
              {f.inProgress > 0 && <span className={cx('h-full rounded-r-[3px]', f.waiting ? '' : 'rounded-l-[3px]', hot ? 'bg-accent/40' : 'bg-ink-3/25')} style={{ width: `${(f.inProgress / max) * 100}%` }} />}
            </span>
            <span role="cell" className={cx('tabular text-right text-ui-sm', hot ? 'font-semibold text-ink' : 'text-ink-2')}>
              {q}
            </span>
            <span role="cell" className="tabular text-right text-caption text-ink-3">
              {q === 0 ? '—' : f.clearDays === null ? 'stalled' : `${f.clearDays}d`}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** Daily target meter. */
export function TargetMeter({ done, target }: { done: number; target: number }) {
  const cells = Math.max(target, done);
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`${done} of ${target} published today`}>
      {Array.from({ length: Math.min(cells, 40) }).map((_, i) => (
        <span key={i} className={cx('h-2.5 flex-1 rounded-[3px]', i < done ? (i < target ? 'bg-accent' : 'bg-accent/60') : 'bg-track')} />
      ))}
    </div>
  );
}
