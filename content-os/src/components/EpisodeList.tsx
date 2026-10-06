import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { EpisodeListItem } from '../lib/types';
import { Code, Due, NextStage, PhaseBadge, PriorityMark, ProjectDot, Readiness, StageStrip } from './status';
import { cx, Empty } from './ui';

/** Compact, non-virtualised list for panels (≤ ~50 rows). The library uses the virtualised table. */
export function EpisodeList({
  items,
  empty,
  showStrip = true,
  showNext = true,
  right,
  dense,
}: {
  items: EpisodeListItem[];
  empty?: ReactNode;
  showStrip?: boolean;
  showNext?: boolean;
  right?: (e: EpisodeListItem) => ReactNode;
  dense?: boolean;
}) {
  if (!items.length) return <>{empty ?? <Empty compact title="Nothing here" />}</>;
  return (
    <ul className="-mx-2 divide-y divide-line">
      {items.map((e) => (
        <li key={e.id} className="group relative flex items-center gap-3 rounded-md px-2 hover:bg-hover">
          <div className={cx('flex min-w-0 flex-1 items-center gap-2.5', dense ? 'py-1.5' : 'py-2')}>
            <ProjectDot color={e.projectColor} />
            <Code className="w-14 shrink-0">{e.code}</Code>
            <div className="min-w-0 flex-1">
              <Link to={`/episodes/${e.id}`} className="block truncate text-ui text-ink after:absolute after:inset-0" title={e.title}>
                {e.title}
              </Link>
              {showNext && (
                <div className="flex min-w-0 items-center gap-2">
                  {e.phase !== 'PUBLISHED' && e.phase !== 'READY' && e.phase !== 'SCHEDULED' && (
                    <NextStage stage={e.nextStage} actionable={e.actionable} blocked={e.blocked} note={e.blockedNote} />
                  )}
                  {e.seriesTitle && <span className="hidden truncate text-caption text-ink-3 sm:inline">{e.seriesTitle}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-3">
            <PriorityMark priority={e.priority} />
            <Due date={e.phase === 'PUBLISHED' ? null : e.dueDate} />
            {showStrip && <StageStrip stages={e.stages} contentTypeId={e.contentTypeId} className={right ? "hidden 2xl:flex" : "hidden md:flex"} />}
            {right ? right(e) : <PhaseBadge phase={e.phase} blocked={e.blocked} />}
            <span className="hidden sm:inline">
              <Readiness value={e.readiness} compact />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
