import type { EpisodeQuery } from '../../shared/api';
import { PHASES, STAGES, type Phase, type Stage } from '../../shared/domain';

/** Built-in views, addressable by slug in the URL (/episodes?view=ready). Mirrors server SYSTEM_VIEWS. */
export const VIEW_SLUGS: { slug: string; name: string; query: EpisodeQuery }[] = [
  { slug: 'all', name: 'All episodes', query: {} },
  { slug: 'ready', name: 'Ready to post', query: { phases: ['READY'], sort: 'priority' } },
  { slug: 'voice', name: 'Waiting for voice', query: { waitingFor: ['VOICE'], sort: 'priority' } },
  { slug: 'edit', name: 'Waiting for edit', query: { waitingFor: ['EDIT'], sort: 'priority' } },
  { slug: 'blocked', name: 'Blocked', query: { blocked: true, sort: 'progress' } },
  { slug: 'scheduled', name: 'Scheduled', query: { phases: ['SCHEDULED'], sort: 'scheduled' } },
  { slug: 'published', name: 'Published', query: { phases: ['PUBLISHED'], sort: 'published' } },
  { slug: 'week', name: 'Due this week', query: { due: 'week', sort: 'due' } },
  { slug: 'high', name: 'High priority', query: { priorities: [0, 1], published: false, sort: 'priority' } },
  { slug: 'stalled', name: 'Stalled 14d+', query: { staleDays: 14, phases: ['RESEARCH', 'SCRIPT', 'VOICE', 'VISUAL', 'EDIT', 'QC'], sort: 'progress' } },
  { slug: 'unstarted', name: 'Unstarted', query: { phases: ['IDEA'], sort: 'created', dir: 'asc' } },
];

const nums = (v: string | null) => (v ? v.split(',').map(Number).filter((n) => Number.isFinite(n)) : undefined);
const strs = (v: string | null) => (v ? v.split(',').filter(Boolean) : undefined);

/** URL is the source of truth for library state, so any view can be linked and restored. */
export function queryFromParams(p: URLSearchParams, customViews: { id: number; query: EpisodeQuery }[] = []): EpisodeQuery {
  const view = p.get('view');
  let base: EpisodeQuery = {};
  if (view?.startsWith('v')) base = customViews.find((v) => `v${v.id}` === view)?.query ?? {};
  else if (view) base = VIEW_SLUGS.find((v) => v.slug === view)?.query ?? {};
  const q: EpisodeQuery = { ...base };
  const set = <K extends keyof EpisodeQuery>(k: K, v: EpisodeQuery[K] | undefined) => {
    if (v !== undefined && !(Array.isArray(v) && !v.length)) q[k] = v;
  };
  set('q', p.get('q') ?? undefined);
  set('projectIds', nums(p.get('project')));
  set('seriesIds', nums(p.get('series')));
  set('contentTypeIds', nums(p.get('type')));
  set('phases', strs(p.get('phase'))?.filter((x) => PHASES.includes(x as Phase)) as Phase[]);
  set('waitingFor', strs(p.get('waitingFor'))?.filter((x) => STAGES.includes(x as Stage)) as Stage[]);
  set('priorities', nums(p.get('priority')));
  set('tags', strs(p.get('tags')));
  if (p.get('source')) q.sourceId = Number(p.get('source'));
  if (p.get('blocked')) q.blocked = p.get('blocked') === '1';
  if (p.get('published')) q.published = p.get('published') === '1';
  set('due', (p.get('due') as EpisodeQuery['due']) ?? undefined);
  if (p.get('stale')) q.staleDays = Number(p.get('stale'));
  if (p.get('created')) q.createdWithinDays = Number(p.get('created'));
  if (p.get('updated')) q.updatedWithinDays = Number(p.get('updated'));
  set('archived', (p.get('archived') as EpisodeQuery['archived']) ?? undefined);
  set('sort', (p.get('sort') as EpisodeQuery['sort']) ?? undefined);
  set('dir', (p.get('dir') as EpisodeQuery['dir']) ?? undefined);
  set('group', (p.get('group') as EpisodeQuery['group']) ?? undefined);
  return q;
}

/** Keys that are "filters" (not presentation) — used for active-filter chips and saving views. */
export const FILTER_PARAMS = ['q', 'project', 'series', 'type', 'phase', 'waitingFor', 'priority', 'tags', 'source', 'blocked', 'published', 'due', 'stale', 'created', 'updated', 'archived'] as const;

export function paramsFromQuery(q: EpisodeQuery): Record<string, string> {
  const out: Record<string, string> = {};
  if (q.q) out.q = q.q;
  if (q.projectIds?.length) out.project = q.projectIds.join(',');
  if (q.seriesIds?.length) out.series = q.seriesIds.join(',');
  if (q.contentTypeIds?.length) out.type = q.contentTypeIds.join(',');
  if (q.phases?.length) out.phase = q.phases.join(',');
  if (q.waitingFor?.length) out.waitingFor = q.waitingFor.join(',');
  if (q.priorities?.length) out.priority = q.priorities.join(',');
  if (q.tags?.length) out.tags = q.tags.join(',');
  if (q.sourceId) out.source = String(q.sourceId);
  if (q.blocked !== undefined) out.blocked = q.blocked ? '1' : '0';
  if (q.published !== undefined) out.published = q.published ? '1' : '0';
  if (q.due) out.due = q.due;
  if (q.staleDays) out.stale = String(q.staleDays);
  if (q.createdWithinDays) out.created = String(q.createdWithinDays);
  if (q.updatedWithinDays) out.updated = String(q.updatedWithinDays);
  if (q.archived && q.archived !== 'exclude') out.archived = q.archived;
  if (q.sort) out.sort = q.sort;
  if (q.dir) out.dir = q.dir;
  if (q.group && q.group !== 'none') out.group = q.group;
  return out;
}
