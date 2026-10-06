import {
  STAGES,
  STAGE_META,
  PHASES,
  PHASE_META,
  PRIORITY_LABEL,
  computeReadiness,
  depsSatisfied,
  effectiveDeps,
  episodeCode,
  isPresent,
  planBoardMove,
  type Phase,
  type Stage,
  type StageModes,
  type StageStates,
  type StageStatus,
  STAGE_EVIDENCE,
  type Platform,
} from '../../shared/domain';
import type { EpisodeListItem, EpisodeListResult, EpisodeQuery } from '../../shared/api';
import { nowIso, localDay } from '../db';
import {
  db,
  tx,
  logActivity,
  notFound,
  invalid,
  conflict,
  placeholders,
  setTags,
  addTags,
  removeTags,
  tagsFor,
  buildUpdate,
} from './core';
import { contentTypeModes, contentTypeById } from './config';

// =============================================================== readiness cache

interface RecomputeRow {
  id: number;
  content_type_id: number;
  st: string | null;
  pubs: number;
  first_pub: string | null;
  sched: number;
  next_sched: string | null;
}

export function parseStages(st: string | null): StageStates {
  const out: StageStates = {};
  if (!st) return out;
  for (const pair of st.split(',')) {
    const [stage, status] = pair.split(':');
    out[stage as Stage] = status as StageStatus;
  }
  return out;
}

/** Recomputes the denormalised readiness columns. Called after any stage / publication / type change. */
export function recomputeEpisodes(ids: number[]) {
  const d = db();
  const upd = d.prepare(
    `UPDATE episodes SET phase = ?, readiness = ?, next_stage = ?, actionable = ?, blocked = ?, published_at = ?, scheduled_at = ? WHERE id = ?`,
  );
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const rows = d
      .prepare(
        `SELECT e.id, e.content_type_id,
           (SELECT group_concat(stage || ':' || status) FROM episode_stages WHERE episode_id = e.id) AS st,
           (SELECT count(*) FROM publications p WHERE p.episode_id = e.id AND p.deleted_at IS NULL AND p.status = 'PUBLISHED') AS pubs,
           (SELECT min(published_at) FROM publications p WHERE p.episode_id = e.id AND p.deleted_at IS NULL AND p.status = 'PUBLISHED') AS first_pub,
           (SELECT count(*) FROM publications p WHERE p.episode_id = e.id AND p.deleted_at IS NULL AND p.status = 'SCHEDULED') AS sched,
           (SELECT min(scheduled_at) FROM publications p WHERE p.episode_id = e.id AND p.deleted_at IS NULL AND p.status = 'SCHEDULED') AS next_sched
         FROM episodes e WHERE e.id IN (${placeholders(chunk)})`,
      )
      .all(...chunk) as RecomputeRow[];
    for (const r of rows) {
      const modes = contentTypeModes(r.content_type_id);
      const states = parseStages(r.st);
      const rd = computeReadiness({ modes, states, publishedCount: r.pubs, scheduledCount: r.sched });
      upd.run(
        rd.phase,
        rd.readiness,
        rd.nextStage,
        rd.actionable.length ? `,${rd.actionable.join(',')},` : '',
        rd.blocked ? 1 : 0,
        r.first_pub,
        r.next_sched,
        r.id,
      );
    }
  }
}

// =============================================================== list / query

const SORTS: Record<NonNullable<EpisodeQuery['sort']>, string[]> = {
  updated: ['e.updated_at'],
  created: ['e.created_at'],
  priority: ['e.priority'],
  readiness: ['e.readiness'],
  due: ["coalesce(e.due_date, '9999')"],
  number: ['p.code', 'e.number'],
  title: ['e.title COLLATE NOCASE'],
  progress: ['coalesce(e.progress_at, e.created_at)'],
  published: ["coalesce(e.published_at, '')"],
  scheduled: ["coalesce(e.scheduled_at, '9999')"],
};
const DEFAULT_DIR: Record<string, 'asc' | 'desc'> = {
  updated: 'desc',
  created: 'desc',
  priority: 'asc',
  readiness: 'desc',
  due: 'asc',
  number: 'asc',
  title: 'asc',
  progress: 'asc',
  published: 'desc',
  scheduled: 'asc',
};
const GROUPS: Record<string, { expr: string; label: string; order: string }> = {
  // `order` must be a single expression: it ranks both the rows and the group headers.
  project: { expr: 'p.id', label: 'p.name', order: '(p.sort_order * 100000 + p.id)' },
  series: { expr: 'coalesce(s.id, 0)', label: "coalesce(p.name || ' — ' || s.title, 'No series')", order: '(CASE WHEN s.id IS NULL THEN 1e12 ELSE p.sort_order * 1e6 + s.sort_order * 1000 + s.id END)' },
  phase: {
    expr: 'e.phase',
    label: 'e.phase',
    order: `CASE e.phase ${PHASES.map((p, i) => `WHEN '${p}' THEN ${i}`).join(' ')} END`,
  },
  priority: { expr: 'e.priority', label: 'e.priority', order: 'e.priority' },
  type: { expr: 'e.content_type_id', label: 'ct.name', order: '(ct.sort_order * 1000 + ct.id)' },
};

/** Turns a free-text query into a safe FTS5 prefix query. */
export function ftsQuery(q: string, mode: 'and' | 'or' = 'and') {
  const tokens = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t}"*`).join(mode === 'and' ? ' ' : ' OR ');
}

function buildWhere(q: EpisodeQuery) {
  const where: string[] = ['e.deleted_at IS NULL'];
  const params: unknown[] = [];
  const archived = q.archived ?? 'exclude';
  if (archived === 'exclude') where.push('e.archived_at IS NULL');
  if (archived === 'only') where.push('e.archived_at IS NOT NULL');

  const inList = (col: string, arr?: unknown[]) => {
    if (arr && arr.length) {
      where.push(`${col} IN (${placeholders(arr)})`);
      params.push(...arr);
    }
  };
  inList('e.project_id', q.projectIds);
  inList('e.series_id', q.seriesIds);
  inList('e.content_type_id', q.contentTypeIds);
  inList('e.phase', q.phases);
  inList('e.priority', q.priorities);

  if (q.waitingFor?.length) {
    where.push(`(${q.waitingFor.map(() => `e.actionable LIKE ?`).join(' OR ')})`);
    params.push(...q.waitingFor.map((s) => `%,${s},%`));
    where.push(`e.phase <> 'IDEA'`);
  }
  if (q.stageStatus) {
    where.push(`EXISTS (SELECT 1 FROM episode_stages es WHERE es.episode_id = e.id AND es.stage = ? AND es.status IN (${placeholders(q.stageStatus.statuses)}))`);
    params.push(q.stageStatus.stage, ...q.stageStatus.statuses);
  }
  if (q.tags?.length) {
    where.push(`EXISTS (SELECT 1 FROM episode_tags et JOIN tags t ON t.id = et.tag_id WHERE et.episode_id = e.id AND t.name IN (${placeholders(q.tags)}))`);
    params.push(...q.tags);
  }
  if (q.sourceId) {
    where.push('EXISTS (SELECT 1 FROM episode_sources x WHERE x.episode_id = e.id AND x.source_id = ?)');
    params.push(q.sourceId);
  }
  if (q.insightId) {
    where.push('EXISTS (SELECT 1 FROM episode_insights x WHERE x.episode_id = e.id AND x.insight_id = ?)');
    params.push(q.insightId);
  }
  if (q.ideaId) {
    where.push('e.idea_id = ?');
    params.push(q.ideaId);
  }
  if (q.blocked !== undefined) where.push(q.blocked ? 'e.blocked = 1' : 'e.blocked = 0');
  if (q.published !== undefined) where.push(q.published ? `e.phase = 'PUBLISHED'` : `e.phase <> 'PUBLISHED'`);
  const today = localDay();
  if (q.due === 'overdue') {
    where.push(`e.due_date < ? AND e.phase NOT IN ('PUBLISHED')`);
    params.push(today);
  } else if (q.due === 'today') {
    where.push('e.due_date = ?');
    params.push(today);
  } else if (q.due === 'week') {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    where.push('e.due_date >= ? AND e.due_date <= ?');
    params.push(today, localDay(end));
  } else if (q.due === 'none') where.push('e.due_date IS NULL');
  else if (q.due === 'any') where.push('e.due_date IS NOT NULL');

  const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  if (q.createdWithinDays) {
    where.push('e.created_at >= ?');
    params.push(since(q.createdWithinDays));
  }
  if (q.updatedWithinDays) {
    where.push('e.updated_at >= ?');
    params.push(since(q.updatedWithinDays));
  }
  if (q.staleDays) {
    where.push(`coalesce(e.progress_at, e.created_at) < ? AND e.phase NOT IN ('PUBLISHED','SCHEDULED')`);
    params.push(since(q.staleDays));
  }

  const text = q.q?.trim();
  if (text) {
    const code = text.match(/^([a-z]{1,8})[-\s#]?(\d{1,5})$/i);
    const fts = ftsQuery(text);
    const ors: string[] = [];
    if (code) {
      ors.push('(p.code = ? AND e.number = ?)');
      params.push(code[1], Number(code[2]));
    }
    if (/^\d{1,5}$/.test(text)) {
      ors.push('e.number = ?');
      params.push(Number(text));
    }
    if (fts) {
      ors.push(`e.id IN (SELECT ref_id FROM search_index WHERE search_index MATCH ? AND kind = 'episode')`);
      params.push(fts);
    }
    if (ors.length) where.push(`(${ors.join(' OR ')})`);
  }
  return { where: where.join(' AND '), params };
}

const LIST_FROM = `FROM episodes e
  JOIN projects p ON p.id = e.project_id
  LEFT JOIN series s ON s.id = e.series_id AND s.deleted_at IS NULL
  JOIN content_types ct ON ct.id = e.content_type_id`;

interface ListRow {
  id: number;
  number: number | null;
  title: string;
  project_id: number;
  project_name: string;
  project_code: string;
  project_color: string;
  series_id: number | null;
  series_title: string | null;
  content_type_id: number;
  content_type_name: string;
  priority: number;
  due_date: string | null;
  phase: Phase;
  readiness: number;
  next_stage: Stage | null;
  actionable: string;
  blocked: number;
  blocked_note: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  progress_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  st: string | null;
  group_key?: string;
}

const LIST_COLUMNS = `e.id, e.number, e.title, e.project_id, p.name AS project_name, p.code AS project_code, p.color AS project_color,
  s.id AS series_id, s.title AS series_title, e.content_type_id, ct.name AS content_type_name, e.priority, e.due_date,
  e.phase, e.readiness, e.next_stage, e.actionable, e.blocked,
  (SELECT stage || ': ' || note FROM episode_stages b WHERE b.episode_id = e.id AND b.status = 'BLOCKED' LIMIT 1) AS blocked_note,
  e.published_at, e.scheduled_at, e.progress_at, e.created_at, e.updated_at, e.archived_at,
  (SELECT group_concat(stage || ':' || status) FROM episode_stages WHERE episode_id = e.id) AS st`;

function toListItem(r: ListRow, tags: string[]): EpisodeListItem {
  return {
    id: r.id,
    number: r.number,
    code: episodeCode(r.project_code, r.number),
    title: r.title,
    projectId: r.project_id,
    projectName: r.project_name,
    projectCode: r.project_code,
    projectColor: r.project_color,
    seriesId: r.series_id,
    seriesTitle: r.series_title,
    contentTypeId: r.content_type_id,
    contentTypeName: r.content_type_name,
    priority: r.priority,
    dueDate: r.due_date,
    phase: r.phase,
    readiness: r.readiness,
    nextStage: r.next_stage,
    actionable: r.actionable ? (r.actionable.split(',').filter(Boolean) as Stage[]) : [],
    blocked: !!r.blocked,
    blockedNote: r.blocked_note,
    publishedAt: r.published_at,
    scheduledAt: r.scheduled_at,
    progressAt: r.progress_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
    stages: parseStages(r.st),
    tags,
    groupKey: r.group_key,
  };
}

export function listEpisodes(q: EpisodeQuery): EpisodeListResult {
  const d = db();
  const { where, params } = buildWhere(q);
  const limit = Math.min(Math.max(q.limit ?? 100, 1), 500);
  const offset = Math.max(q.offset ?? 0, 0);
  const sortKey = q.sort ?? 'updated';
  const dir = (q.dir ?? DEFAULT_DIR[sortKey]) === 'asc' ? 'ASC' : 'DESC';
  const group = q.group && q.group !== 'none' ? GROUPS[q.group] : null;
  const order = `${group ? `${group.order}, ` : ''}${SORTS[sortKey].map((c) => `${c} ${dir}`).join(', ')}, e.id DESC`;

  const total = (d.prepare(`SELECT count(*) AS c ${LIST_FROM} WHERE ${where}`).get(...params) as { c: number }).c;
  const rows = d
    .prepare(`SELECT ${LIST_COLUMNS}${group ? `, ${group.expr} AS group_key` : ''} ${LIST_FROM} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as ListRow[];
  const tags = tagsFor('episode_tags', rows.map((r) => r.id));
  const items = rows.map((r) => toListItem(r, tags.get(r.id) ?? []));

  let groups: EpisodeListResult['groups'];
  if (group) {
    const g = d
      .prepare(`SELECT ${group.expr} AS key, ${group.label} AS label, count(*) AS count ${LIST_FROM} WHERE ${where} GROUP BY ${group.expr} ORDER BY min(${group.order})`)
      .all(...params) as { key: string | number; label: string | number; count: number }[];
    groups = g.map((x) => ({
      key: String(x.key),
      label: q.group === 'phase' ? PHASE_META[x.label as Phase]?.label ?? String(x.label) : q.group === 'priority' ? PRIORITY_LABEL[Number(x.label)] : String(x.label),
      count: x.count,
    }));
    for (const it of items) it.groupKey = String(it.groupKey);
  }
  return { items, total, groups };
}

export function listEpisodeIds(q: EpisodeQuery): number[] {
  const { where, params } = buildWhere(q);
  return (db().prepare(`SELECT e.id ${LIST_FROM} WHERE ${where} LIMIT 20000`).all(...params) as { id: number }[]).map((r) => r.id);
}

export function episodeItems(ids: number[]): EpisodeListItem[] {
  if (!ids.length) return [];
  const rows = db()
    .prepare(`SELECT ${LIST_COLUMNS} ${LIST_FROM} WHERE e.id IN (${placeholders(ids)}) AND e.deleted_at IS NULL`)
    .all(...ids) as ListRow[];
  const tags = tagsFor('episode_tags', ids);
  const byId = new Map(rows.map((r) => [r.id, toListItem(r, tags.get(r.id) ?? [])]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as EpisodeListItem[];
}

// =============================================================== detail

export interface EpisodeRow {
  id: number;
  project_id: number;
  series_id: number | null;
  content_type_id: number;
  idea_id: number | null;
  number: number | null;
  title: string;
  description: string;
  core_idea: string;
  hook: string;
  script: string;
  target_duration_sec: number | null;
  priority: number;
  due_date: string | null;
  notes: string;
  phase: Phase;
  readiness: number;
  next_stage: Stage | null;
  blocked: number;
  published_at: string | null;
  scheduled_at: string | null;
  progress_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

export function episodeRow(id: number, includeDeleted = false): EpisodeRow {
  const row = db().prepare('SELECT * FROM episodes WHERE id = ?').get(id) as EpisodeRow | undefined;
  if (!row || (!includeDeleted && row.deleted_at)) throw notFound('Episode', id);
  return row;
}

function stageStates(id: number) {
  const rows = db()
    .prepare('SELECT stage, status, note, started_at, completed_at, updated_at FROM episode_stages WHERE episode_id = ?')
    .all(id) as { stage: Stage; status: StageStatus; note: string; started_at: string | null; completed_at: string | null; updated_at: string }[];
  const states: StageStates = {};
  for (const r of rows) states[r.stage] = r.status;
  return { rows, states };
}

export function getEpisode(id: number) {
  const d = db();
  const e = episodeRow(id, true);
  const project = d.prepare('SELECT id, name, code, color FROM projects WHERE id = ?').get(e.project_id) as { id: number; name: string; code: string; color: string };
  const series = e.series_id ? (d.prepare('SELECT id, title FROM series WHERE id = ? AND deleted_at IS NULL').get(e.series_id) as { id: number; title: string } | undefined) ?? null : null;
  const ct = contentTypeById(e.content_type_id);
  const modes = contentTypeModes(e.content_type_id);
  const { rows: stageRows, states } = stageStates(id);
  const counts = d
    .prepare(`SELECT sum(status = 'PUBLISHED') AS pubs, sum(status = 'SCHEDULED') AS sched FROM publications WHERE episode_id = ? AND deleted_at IS NULL`)
    .get(id) as { pubs: number | null; sched: number | null };
  const readiness = computeReadiness({ modes, states, publishedCount: counts.pubs ?? 0, scheduledCount: counts.sched ?? 0 });

  const assets = d
    .prepare(`SELECT * FROM assets WHERE episode_id = ? AND deleted_at IS NULL ORDER BY kind, name, version DESC`)
    .all(id) as Record<string, unknown>[];
  const publications = d
    .prepare(`SELECT * FROM publications WHERE episode_id = ? AND deleted_at IS NULL ORDER BY coalesce(published_at, scheduled_at, created_at) DESC`)
    .all(id) as Record<string, unknown>[];
  const metrics = publications.length
    ? (d
        .prepare(
          `SELECT m.* FROM publication_metrics m WHERE m.publication_id IN (${placeholders(publications)})
           AND m.captured_at = (SELECT max(captured_at) FROM publication_metrics x WHERE x.publication_id = m.publication_id)`,
        )
        .all(...publications.map((p) => p.id)) as Record<string, unknown>[])
    : [];
  const sources = d
    .prepare(
      `SELECT s.id, s.title, s.type, s.author, x.locator FROM episode_sources x JOIN sources s ON s.id = x.source_id
       WHERE x.episode_id = ? AND s.deleted_at IS NULL ORDER BY s.title`,
    )
    .all(id);
  const insights = d
    .prepare(
      `SELECT i.id, i.statement, i.locator, i.source_id, s.title AS source_title FROM episode_insights x
       JOIN insights i ON i.id = x.insight_id LEFT JOIN sources s ON s.id = i.source_id
       WHERE x.episode_id = ? AND i.deleted_at IS NULL`,
    )
    .all(id);
  const relRows = d
    .prepare(
      `SELECT to_id AS other, kind, 'out' AS dir FROM episode_relations WHERE from_id = ?
       UNION ALL SELECT from_id AS other, kind, 'in' AS dir FROM episode_relations WHERE to_id = ?`,
    )
    .all(id, id) as { other: number; kind: string; dir: 'in' | 'out' }[];
  const relItems = new Map(episodeItems(relRows.map((r) => r.other)).map((i) => [i.id, i]));
  const related = relRows.filter((r) => relItems.has(r.other)).map((r) => ({ kind: r.kind, dir: r.dir, episode: relItems.get(r.other)! }));
  const tasks = d.prepare('SELECT * FROM tasks WHERE episode_id = ? ORDER BY done, sort_order, id').all(id);
  const idea = e.idea_id
    ? (d
        .prepare(
          `SELECT i.id, i.title, i.thought, i.created_at, i.source_id, s.title AS source_title, i.insight_id, n.statement AS insight_statement
           FROM ideas i LEFT JOIN sources s ON s.id = i.source_id LEFT JOIN insights n ON n.id = i.insight_id WHERE i.id = ?`,
        )
        .get(e.idea_id) ?? null)
    : null;
  const activity = d.prepare('SELECT * FROM activity WHERE episode_id = ? ORDER BY at DESC LIMIT 40').all(id);
  const tags = tagsFor('episode_tags', [id]).get(id) ?? [];

  // Integrity warnings: soft signals, never blocking.
  const warnings: string[] = [];
  for (const s of STAGES) {
    if (!isPresent(modes, s)) continue;
    const st = states[s];
    if ((st === 'DONE' || st === 'IN_PROGRESS') && !depsSatisfied(modes, states, s)) {
      const missing = effectiveDeps(modes, s).filter((x) => states[x] !== 'DONE' && states[x] !== 'SKIPPED');
      warnings.push(`${STAGE_META[s].label} is ${st === 'DONE' ? 'done' : 'in progress'} before ${missing.map((m) => STAGE_META[m].label).join(' + ')}.`);
    }
    const evidence = STAGE_EVIDENCE[s];
    if (st === 'DONE' && evidence && !assets.some((a) => evidence.includes(a.kind as never) && a.status !== 'REJECTED')) {
      warnings.push(`${STAGE_META[s].label} is marked done but no ${evidence.map((k) => k.toLowerCase().replace('_', ' ')).join('/')} asset is attached.`);
    }
  }
  if (states.SCRIPT === 'DONE' && !e.script.trim() && !assets.some((a) => a.kind === 'SCRIPT_FILE')) warnings.push('Script is marked done but the script field is empty.');
  if (readiness.phase === 'PUBLISHED' && !counts.pubs) warnings.push('Marked published but no publication record exists — add one so you know where it went live.');

  return {
    episode: { ...e, code: episodeCode(project.code, e.number), tags },
    project,
    series,
    contentType: ct,
    modes,
    stages: stageRows,
    readiness,
    warnings,
    assets,
    publications: publications.map((p) => ({ ...p, metrics: metrics.find((m) => m.publication_id === p.id) ?? null })),
    sources,
    insights,
    related,
    tasks,
    idea,
    activity,
  };
}

// =============================================================== create / update

export interface EpisodeInput {
  projectId: number;
  seriesId?: number | null;
  contentTypeId?: number | null;
  ideaId?: number | null;
  number?: number | null;
  title: string;
  description?: string;
  coreIdea?: string;
  hook?: string;
  script?: string;
  targetDurationSec?: number | null;
  priority?: number;
  dueDate?: string | null;
  notes?: string;
  tags?: string[];
  sourceIds?: number[];
  insightIds?: number[];
  stages?: Partial<Record<Stage, StageStatus>>;
}

function nextNumber(projectId: number) {
  return (db().prepare('SELECT coalesce(max(number), 0) + 1 AS n FROM episodes WHERE project_id = ?').get(projectId) as { n: number }).n;
}

function assertProject(projectId: number) {
  const p = db().prepare('SELECT id, default_content_type_id, deleted_at FROM projects WHERE id = ?').get(projectId) as
    | { id: number; default_content_type_id: number | null; deleted_at: string | null }
    | undefined;
  if (!p || p.deleted_at) throw invalid(`Project #${projectId} does not exist.`);
  return p;
}
function assertSeries(seriesId: number) {
  const s = db().prepare('SELECT id, project_id, deleted_at FROM series WHERE id = ?').get(seriesId) as { id: number; project_id: number; deleted_at: string | null } | undefined;
  if (!s || s.deleted_at) throw invalid(`Series #${seriesId} does not exist.`);
  return s;
}

export function createEpisode(input: EpisodeInput, opts: { log?: boolean } = {}) {
  return tx(() => {
    const d = db();
    const project = assertProject(input.projectId);
    if (input.seriesId) {
      const s = assertSeries(input.seriesId);
      if (s.project_id !== input.projectId) throw invalid('That series belongs to a different project.');
    }
    const ctId = input.contentTypeId ?? project.default_content_type_id ?? (d.prepare('SELECT id FROM content_types WHERE archived_at IS NULL ORDER BY sort_order LIMIT 1').get() as { id: number }).id;
    const ct = contentTypeById(ctId);
    const number = input.number ?? nextNumber(input.projectId);
    if (d.prepare('SELECT 1 FROM episodes WHERE project_id = ? AND number = ?').get(input.projectId, number)) {
      throw conflict(`Episode number ${number} is already used in this project.`);
    }
    const now = nowIso();
    const id = Number(
      d
        .prepare(
          `INSERT INTO episodes (project_id, series_id, content_type_id, idea_id, number, title, description, core_idea, hook, script,
            target_duration_sec, priority, due_date, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.projectId,
          input.seriesId ?? null,
          ctId,
          input.ideaId ?? null,
          number,
          input.title.trim(),
          input.description ?? '',
          input.coreIdea ?? '',
          input.hook ?? '',
          input.script ?? '',
          input.targetDurationSec ?? ct.defaultDurationSec ?? null,
          input.priority ?? 2,
          input.dueDate ?? null,
          input.notes ?? '',
          now,
          now,
        ).lastInsertRowid,
    );
    const insStage = d.prepare('INSERT INTO episode_stages (episode_id, stage, status, started_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const s of STAGES) {
      const st = input.stages?.[s] ?? 'NOT_STARTED';
      insStage.run(id, s, st, st === 'NOT_STARTED' ? null : now, st === 'DONE' ? now : null, now);
    }
    if (input.stages && Object.values(input.stages).some((v) => v !== 'NOT_STARTED')) d.prepare('UPDATE episodes SET progress_at = ? WHERE id = ?').run(now, id);
    const insTask = d.prepare('INSERT INTO tasks (episode_id, title, sort_order) VALUES (?, ?, ?)');
    ct.checklist.forEach((t, i) => insTask.run(id, t, i));
    if (input.tags?.length) setTags('episode_tags', id, input.tags);
    for (const sid of input.sourceIds ?? []) d.prepare('INSERT OR IGNORE INTO episode_sources (episode_id, source_id) VALUES (?, ?)').run(id, sid);
    for (const iid of input.insightIds ?? []) d.prepare('INSERT OR IGNORE INTO episode_insights (episode_id, insight_id) VALUES (?, ?)').run(id, iid);
    recomputeEpisodes([id]);
    if (opts.log !== false) {
      logActivity({ action: 'created', entityType: 'episode', entityId: id, episodeId: id, projectId: input.projectId, summary: `Created episode “${input.title.trim()}”` });
    }
    return id;
  });
}

const EPISODE_COLUMNS: Record<string, string> = {
  title: 'title',
  description: 'description',
  coreIdea: 'core_idea',
  hook: 'hook',
  script: 'script',
  targetDurationSec: 'target_duration_sec',
  priority: 'priority',
  dueDate: 'due_date',
  notes: 'notes',
  seriesId: 'series_id',
  contentTypeId: 'content_type_id',
  number: 'number',
  projectId: 'project_id',
};

export type EpisodePatch = Partial<Omit<EpisodeInput, 'stages' | 'sourceIds' | 'insightIds'>>;

export function updateEpisode(id: number, patch: EpisodePatch) {
  return tx(() => {
    const d = db();
    const before = episodeRow(id);
    const p: Record<string, unknown> = { ...patch };
    if (typeof p.title === 'string') {
      p.title = (p.title as string).trim();
      if (!p.title) throw invalid('Title cannot be empty.');
    }
    if (p.projectId !== undefined && p.projectId !== before.project_id) {
      assertProject(p.projectId as number);
      if (p.number === undefined) p.number = nextNumber(p.projectId as number);
      if (p.seriesId === undefined) p.seriesId = null;
    }
    if (p.seriesId) {
      const s = assertSeries(p.seriesId as number);
      const targetProject = (p.projectId as number | undefined) ?? before.project_id;
      if (s.project_id !== targetProject) {
        // Assigning a series from another project moves the episode to that project.
        p.projectId = s.project_id;
        p.number = nextNumber(s.project_id);
      }
    }
    if (p.contentTypeId !== undefined) contentTypeById(p.contentTypeId as number);
    if (p.number !== undefined && p.number !== null) {
      const pid = (p.projectId as number | undefined) ?? before.project_id;
      const clash = d.prepare('SELECT id FROM episodes WHERE project_id = ? AND number = ? AND id <> ?').get(pid, p.number, id);
      if (clash) throw conflict(`Episode number ${p.number} is already used in this project.`);
    }
    const { sets, vals } = buildUpdate(p, EPISODE_COLUMNS);
    if (sets.length) {
      d.prepare(`UPDATE episodes SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), id);
    }
    if (patch.tags) setTags('episode_tags', id, patch.tags);
    if (p.contentTypeId !== undefined && p.contentTypeId !== before.content_type_id) recomputeEpisodes([id]);

    // Meaningful changes only.
    const after = episodeRow(id);
    const changes: string[] = [];
    if (after.priority !== before.priority) changes.push(`priority → ${PRIORITY_LABEL[after.priority]}`);
    if (after.due_date !== before.due_date) changes.push(after.due_date ? `due → ${after.due_date}` : 'due date cleared');
    if (after.series_id !== before.series_id) changes.push('series changed');
    if (after.project_id !== before.project_id) changes.push('moved to another project');
    if (after.content_type_id !== before.content_type_id) changes.push(`type → ${contentTypeById(after.content_type_id).name}`);
    if (after.title !== before.title) changes.push('renamed');
    if (after.script !== before.script && !before.script) changes.push('script added');
    if (changes.length) {
      logActivity({
        action: 'updated',
        entityType: 'episode',
        entityId: id,
        episodeId: id,
        projectId: after.project_id,
        summary: `${after.title}: ${changes.join(', ')}`,
      });
    }
    return id;
  });
}

// =============================================================== stages

export type StageChange = { stage: Stage; status: StageStatus; note?: string };
export type StageSnapshot = { episodeId: number; stages: { stage: Stage; status: StageStatus; note: string }[] }[];

/**
 * Sets stage statuses for one episode. Never rejects for dependency reasons (parallel work is
 * legitimate); instead returns warnings the UI can show.
 */
export function setStages(episodeId: number, changes: StageChange[], opts: { log?: boolean; summaryPrefix?: string } = {}) {
  const d = db();
  const e = episodeRow(episodeId);
  const modes = contentTypeModes(e.content_type_id);
  const { rows, states } = stageStates(episodeId);
  const before = new Map(rows.map((r) => [r.stage, r]));
  const now = nowIso();
  const upd = d.prepare(
    `UPDATE episode_stages SET status = ?, note = ?, started_at = ?, completed_at = ?, updated_at = ? WHERE episode_id = ? AND stage = ?`,
  );
  const applied: StageChange[] = [];
  const next: StageStates = { ...states };
  for (const c of changes) {
    const prev = before.get(c.stage);
    if (!prev) continue;
    const note = c.note ?? (c.status === 'BLOCKED' ? prev.note : c.status === prev.status ? prev.note : '');
    if (prev.status === c.status && note === prev.note) continue;
    const started = prev.started_at ?? (c.status !== 'NOT_STARTED' ? now : null);
    upd.run(c.status, note, c.status === 'NOT_STARTED' ? null : started, c.status === 'DONE' ? now : null, now, episodeId, c.stage);
    applied.push({ ...c, note });
    next[c.stage] = c.status;
  }
  const warnings: string[] = [];
  if (applied.length) {
    d.prepare('UPDATE episodes SET progress_at = ?, updated_at = ? WHERE id = ?').run(now, now, episodeId);
    recomputeEpisodes([episodeId]);
    for (const c of applied) {
      if ((c.status === 'DONE' || c.status === 'IN_PROGRESS') && isPresent(modes, c.stage) && !depsSatisfied(modes, next, c.stage)) {
        const missing = effectiveDeps(modes, c.stage).filter((x) => next[x] !== 'DONE' && next[x] !== 'SKIPPED');
        warnings.push(`${STAGE_META[c.stage].label} ${c.status === 'DONE' ? 'completed' : 'started'} before ${missing.map((m) => STAGE_META[m].label).join(' + ')} — fine for parallel work, just checking.`);
      }
    }
    if (opts.log !== false) {
      const label: Record<StageStatus, string> = { NOT_STARTED: 'reset', IN_PROGRESS: 'in progress', BLOCKED: 'blocked', DONE: 'done', SKIPPED: 'skipped' };
      const desc = applied.map((c) => `${STAGE_META[c.stage].label} ${label[c.status]}${c.status === 'BLOCKED' && c.note ? ` (${c.note})` : ''}`).join(', ');
      logActivity({
        action: applied.some((c) => c.status === 'BLOCKED') ? 'blocked' : 'stage',
        entityType: 'episode',
        entityId: episodeId,
        episodeId,
        projectId: e.project_id,
        summary: `${opts.summaryPrefix ?? ''}${e.title}: ${desc}`,
        data: applied,
      });
    }
  }
  const snapshot: StageSnapshot = [
    { episodeId, stages: applied.map((c) => ({ stage: c.stage, status: before.get(c.stage)!.status, note: before.get(c.stage)!.note })) },
  ];
  return { applied, warnings, snapshot };
}

export function restoreStages(snapshot: StageSnapshot, publicationIds: number[] = []) {
  return tx(() => {
    const ids: number[] = [];
    for (const s of snapshot) {
      if (!s.stages.length) continue;
      setStages(s.episodeId, s.stages, { log: false });
      ids.push(s.episodeId);
    }
    if (publicationIds.length) {
      const eps = db().prepare(`SELECT DISTINCT episode_id FROM publications WHERE id IN (${placeholders(publicationIds)})`).all(...publicationIds) as { episode_id: number }[];
      db().prepare(`DELETE FROM publications WHERE id IN (${placeholders(publicationIds)})`).run(...publicationIds);
      recomputeEpisodes(eps.map((e) => e.episode_id));
    }
    if (ids.length) {
      logActivity({ action: 'undo', entityType: 'episode', entityId: ids[0], episodeId: ids.length === 1 ? ids[0] : null, summary: `Undid a change on ${ids.length} episode${ids.length > 1 ? 's' : ''}` });
    }
    return { restored: ids.length };
  });
}

export interface MoveOptions {
  scheduledAt?: string;
  platform?: Platform;
  account?: string;
}

/** Board move: translates a column drop into stage changes (+ a publication for Scheduled/Published). */
export function moveEpisode(id: number, target: Phase, opts: MoveOptions = {}) {
  return tx(() => {
    const d = db();
    const e = episodeRow(id);
    const modes: StageModes = contentTypeModes(e.content_type_id);
    const { states } = stageStates(id);
    const plan = planBoardMove(modes, states, target);
    const changes: StageChange[] = Object.entries(plan).map(([stage, status]) => ({ stage: stage as Stage, status: status! }));
    const result = setStages(id, changes, { summaryPrefix: `Moved to ${PHASE_META[target].label} · ` });
    const createdPublications: number[] = [];
    const platform = opts.platform ?? (contentTypeById(e.content_type_id).defaultPlatforms[0] as Platform) ?? 'INSTAGRAM';
    if (target === 'SCHEDULED') {
      const existing = d.prepare(`SELECT id FROM publications WHERE episode_id = ? AND status = 'SCHEDULED' AND deleted_at IS NULL`).get(id);
      if (!existing) {
        if (!opts.scheduledAt) throw invalid('Pick a date and time to schedule this episode.');
        createdPublications.push(
          Number(
            d
              .prepare(`INSERT INTO publications (episode_id, platform, account, status, scheduled_at) VALUES (?, ?, ?, 'SCHEDULED', ?)`)
              .run(id, platform, opts.account ?? '', opts.scheduledAt).lastInsertRowid,
          ),
        );
      }
    }
    if (target === 'PUBLISHED') {
      const existing = d.prepare(`SELECT id FROM publications WHERE episode_id = ? AND status = 'PUBLISHED' AND deleted_at IS NULL`).get(id);
      if (!existing) {
        const sched = d.prepare(`SELECT id FROM publications WHERE episode_id = ? AND status = 'SCHEDULED' AND deleted_at IS NULL ORDER BY scheduled_at LIMIT 1`).get(id) as { id: number } | undefined;
        if (sched) {
          d.prepare(`UPDATE publications SET status = 'PUBLISHED', published_at = ?, updated_at = ? WHERE id = ?`).run(nowIso(), nowIso(), sched.id);
        } else {
          createdPublications.push(
            Number(
              d
                .prepare(`INSERT INTO publications (episode_id, platform, account, status, published_at) VALUES (?, ?, ?, 'PUBLISHED', ?)`)
                .run(id, platform, opts.account ?? '', nowIso()).lastInsertRowid,
            ),
          );
        }
        logActivity({ action: 'published', entityType: 'episode', entityId: id, episodeId: id, projectId: e.project_id, summary: `Published “${e.title}”` });
      }
    }
    if (target === 'READY' || (PHASES.indexOf(target) < PHASES.indexOf('READY'))) {
      // Moving out of release: scheduled publications go back to draft so they don't silently fire.
      const n = d.prepare(`UPDATE publications SET status = 'DRAFT', updated_at = ? WHERE episode_id = ? AND status = 'SCHEDULED' AND deleted_at IS NULL`).run(nowIso(), id).changes;
      if (n) result.warnings.push(`${n} scheduled publication${n > 1 ? 's were' : ' was'} moved back to draft.`);
    }
    recomputeEpisodes([id]);
    const after = episodeRow(id);
    return { phase: after.phase, warnings: result.warnings, undo: { snapshot: result.snapshot, publicationIds: createdPublications } };
  });
}

// =============================================================== lifecycle

export function archiveEpisodes(ids: number[], archived: boolean) {
  return tx(() => {
    const now = nowIso();
    const n = db()
      .prepare(`UPDATE episodes SET archived_at = ?, updated_at = ? WHERE id IN (${placeholders(ids)}) AND deleted_at IS NULL`)
      .run(archived ? now : null, now, ...ids).changes;
    logActivity({
      action: archived ? 'archived' : 'unarchived',
      entityType: 'episode',
      entityId: ids[0],
      episodeId: ids.length === 1 ? ids[0] : null,
      summary: `${archived ? 'Archived' : 'Restored from archive'} ${ids.length === 1 ? `“${episodeRow(ids[0]).title}”` : `${ids.length} episodes`}`,
    });
    return n;
  });
}

export function deleteEpisodes(ids: number[]) {
  return tx(() => {
    const now = nowIso();
    const n = db().prepare(`UPDATE episodes SET deleted_at = ?, updated_at = ? WHERE id IN (${placeholders(ids)}) AND deleted_at IS NULL`).run(now, now, ...ids).changes;
    db().prepare(`DELETE FROM today_queue WHERE episode_id IN (${placeholders(ids)})`).run(...ids);
    logActivity({ action: 'deleted', entityType: 'episode', entityId: ids[0], summary: `Moved ${n} episode${n === 1 ? '' : 's'} to trash` });
    return n;
  });
}

export function duplicateEpisode(id: number) {
  return tx(() => {
    const e = episodeRow(id);
    const tags = tagsFor('episode_tags', [id]).get(id) ?? [];
    const sourceIds = (db().prepare('SELECT source_id FROM episode_sources WHERE episode_id = ?').all(id) as { source_id: number }[]).map((r) => r.source_id);
    const insightIds = (db().prepare('SELECT insight_id FROM episode_insights WHERE episode_id = ?').all(id) as { insight_id: number }[]).map((r) => r.insight_id);
    const newId = createEpisode(
      {
        projectId: e.project_id,
        seriesId: e.series_id,
        contentTypeId: e.content_type_id,
        ideaId: e.idea_id,
        title: `${e.title} (variant)`,
        description: e.description,
        coreIdea: e.core_idea,
        hook: e.hook,
        script: e.script,
        targetDurationSec: e.target_duration_sec,
        priority: e.priority,
        notes: e.notes,
        tags,
        sourceIds,
        insightIds,
      },
      { log: false },
    );
    db().prepare(`INSERT OR IGNORE INTO episode_relations (from_id, to_id, kind) VALUES (?, ?, 'VARIANT')`).run(id, newId);
    logActivity({ action: 'created', entityType: 'episode', entityId: newId, episodeId: newId, projectId: e.project_id, summary: `Duplicated “${e.title}” as a variant` });
    return newId;
  });
}

// =============================================================== relations / lineage links

export function linkSources(episodeId: number, sourceIds: number[], locator = '') {
  return tx(() => {
    const e = episodeRow(episodeId);
    const ins = db().prepare('INSERT INTO episode_sources (episode_id, source_id, locator) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET locator = excluded.locator');
    for (const s of sourceIds) ins.run(episodeId, s, locator);
    const titles = (db().prepare(`SELECT title FROM sources WHERE id IN (${placeholders(sourceIds)})`).all(...sourceIds) as { title: string }[]).map((r) => r.title);
    logActivity({ action: 'linked', entityType: 'episode', entityId: episodeId, episodeId, projectId: e.project_id, summary: `${e.title}: source ${titles.join(', ')} attached` });
  });
}
export function unlinkSource(episodeId: number, sourceId: number) {
  db().prepare('DELETE FROM episode_sources WHERE episode_id = ? AND source_id = ?').run(episodeId, sourceId);
}
export function linkInsight(episodeId: number, insightId: number) {
  db().prepare('INSERT OR IGNORE INTO episode_insights (episode_id, insight_id) VALUES (?, ?)').run(episodeId, insightId);
}
export function unlinkInsight(episodeId: number, insightId: number) {
  db().prepare('DELETE FROM episode_insights WHERE episode_id = ? AND insight_id = ?').run(episodeId, insightId);
}
export function relate(fromId: number, toId: number, kind: string) {
  if (fromId === toId) throw invalid('An episode cannot be related to itself.');
  episodeRow(fromId);
  episodeRow(toId);
  db()
    .prepare('INSERT INTO episode_relations (from_id, to_id, kind) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET kind = excluded.kind')
    .run(fromId, toId, kind);
}
export function unrelate(a: number, b: number) {
  db().prepare('DELETE FROM episode_relations WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').run(a, b, b, a);
}

// =============================================================== tasks (checklist)

export function addTask(episodeId: number, title: string, stage: Stage | null = null) {
  episodeRow(episodeId);
  const max = (db().prepare('SELECT coalesce(max(sort_order), -1) + 1 AS n FROM tasks WHERE episode_id = ?').get(episodeId) as { n: number }).n;
  return Number(db().prepare('INSERT INTO tasks (episode_id, title, stage, sort_order) VALUES (?, ?, ?, ?)').run(episodeId, title.trim(), stage, max).lastInsertRowid);
}
export function updateTask(id: number, patch: { title?: string; done?: boolean }) {
  const t = db().prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!t) throw notFound('Task', id);
  if (patch.title !== undefined) db().prepare('UPDATE tasks SET title = ? WHERE id = ?').run(patch.title, id);
  if (patch.done !== undefined) db().prepare('UPDATE tasks SET done = ?, completed_at = ? WHERE id = ?').run(patch.done ? 1 : 0, patch.done ? nowIso() : null, id);
}
export function deleteTask(id: number) {
  db().prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

// =============================================================== bulk operations

export type BulkAction =
  | { type: 'setStage'; stage: Stage; status: StageStatus; note?: string }
  | { type: 'move'; phase: Phase }
  | { type: 'priority'; priority: number }
  | { type: 'series'; seriesId: number | null }
  | { type: 'contentType'; contentTypeId: number }
  | { type: 'dueDate'; dueDate: string | null }
  | { type: 'addTags'; tags: string[] }
  | { type: 'removeTags'; tags: string[] }
  | { type: 'addSource'; sourceId: number }
  | { type: 'archive' }
  | { type: 'unarchive' }
  | { type: 'delete' }
  | { type: 'duplicate' }
  | { type: 'today' }
  | { type: 'schedule'; platform: Platform; startAt: string; intervalMinutes: number; account?: string }
  | { type: 'publishNow'; platform: Platform; account?: string };

export function bulkEpisodes(ids: number[], action: BulkAction) {
  if (!ids.length) throw invalid('Select at least one episode.');
  if (ids.length > 5000) throw invalid('Bulk actions are limited to 5,000 episodes at a time.');
  return tx(() => {
    const d = db();
    const snapshot: StageSnapshot = [];
    const publicationIds: number[] = [];
    const warnings: string[] = [];
    let affected = 0;
    const now = nowIso();
    const touch = () => d.prepare(`UPDATE episodes SET updated_at = ? WHERE id IN (${placeholders(ids)})`).run(now, ...ids);
    const summary = (what: string) =>
      logActivity({ action: 'bulk', entityType: 'episode', entityId: ids[0], summary: `Bulk: ${what} on ${ids.length} episode${ids.length > 1 ? 's' : ''}`, data: { ids: ids.slice(0, 200), action } });

    switch (action.type) {
      case 'setStage': {
        for (const id of ids) {
          const r = setStages(id, [{ stage: action.stage, status: action.status, note: action.note }], { log: false });
          if (r.applied.length) affected++;
          snapshot.push(...r.snapshot);
        }
        summary(`${STAGE_META[action.stage].label} → ${action.status.toLowerCase().replace('_', ' ')}`);
        break;
      }
      case 'move': {
        if (action.phase === 'SCHEDULED') throw invalid('Use “Schedule” to give scheduled episodes a date.');
        for (const id of ids) {
          const e = episodeRow(id);
          const { states } = stageStates(id);
          const plan = planBoardMove(contentTypeModes(e.content_type_id), states, action.phase);
          const r = setStages(id, Object.entries(plan).map(([stage, status]) => ({ stage: stage as Stage, status: status! })), { log: false });
          snapshot.push(...r.snapshot);
          if (action.phase === 'PUBLISHED' && !d.prepare(`SELECT 1 FROM publications WHERE episode_id = ? AND status = 'PUBLISHED' AND deleted_at IS NULL`).get(id)) {
            const platform = (contentTypeById(e.content_type_id).defaultPlatforms[0] as Platform) ?? 'INSTAGRAM';
            publicationIds.push(Number(d.prepare(`INSERT INTO publications (episode_id, platform, status, published_at) VALUES (?, ?, 'PUBLISHED', ?)`).run(id, platform, now).lastInsertRowid));
          }
          if (r.applied.length) affected++;
        }
        recomputeEpisodes(ids);
        summary(`moved to ${PHASE_META[action.phase].label}`);
        break;
      }
      case 'priority':
        affected = d.prepare(`UPDATE episodes SET priority = ?, updated_at = ? WHERE id IN (${placeholders(ids)})`).run(action.priority, now, ...ids).changes;
        summary(`priority → ${PRIORITY_LABEL[action.priority]}`);
        break;
      case 'series': {
        if (action.seriesId) {
          const s = assertSeries(action.seriesId);
          const other = d.prepare(`SELECT id FROM episodes WHERE id IN (${placeholders(ids)}) AND project_id <> ?`).all(...ids, s.project_id) as { id: number }[];
          for (const o of other) updateEpisode(o.id, { seriesId: action.seriesId });
          if (other.length) warnings.push(`${other.length} episode${other.length > 1 ? 's were' : ' was'} moved into the series' project.`);
        }
        affected = d.prepare(`UPDATE episodes SET series_id = ?, updated_at = ? WHERE id IN (${placeholders(ids)})`).run(action.seriesId, now, ...ids).changes;
        summary(action.seriesId ? 'series assigned' : 'series cleared');
        break;
      }
      case 'contentType':
        contentTypeById(action.contentTypeId);
        affected = d.prepare(`UPDATE episodes SET content_type_id = ?, updated_at = ? WHERE id IN (${placeholders(ids)})`).run(action.contentTypeId, now, ...ids).changes;
        recomputeEpisodes(ids);
        summary(`type → ${contentTypeById(action.contentTypeId).name}`);
        break;
      case 'dueDate':
        affected = d.prepare(`UPDATE episodes SET due_date = ?, updated_at = ? WHERE id IN (${placeholders(ids)})`).run(action.dueDate, now, ...ids).changes;
        summary(action.dueDate ? `due → ${action.dueDate}` : 'due date cleared');
        break;
      case 'addTags':
        addTags('episode_tags', ids, action.tags);
        touch();
        affected = ids.length;
        summary(`tagged ${action.tags.map((t) => `#${t}`).join(' ')}`);
        break;
      case 'removeTags':
        removeTags('episode_tags', ids, action.tags);
        touch();
        affected = ids.length;
        summary(`untagged ${action.tags.map((t) => `#${t}`).join(' ')}`);
        break;
      case 'addSource': {
        const src = d.prepare('SELECT title FROM sources WHERE id = ? AND deleted_at IS NULL').get(action.sourceId) as { title: string } | undefined;
        if (!src) throw invalid('That source does not exist.');
        const ins = d.prepare('INSERT OR IGNORE INTO episode_sources (episode_id, source_id) VALUES (?, ?)');
        for (const id of ids) affected += ins.run(id, action.sourceId).changes;
        touch();
        summary(`source “${src.title}” attached`);
        break;
      }
      case 'archive':
        affected = archiveEpisodes(ids, true);
        break;
      case 'unarchive':
        affected = archiveEpisodes(ids, false);
        break;
      case 'delete':
        affected = deleteEpisodes(ids);
        break;
      case 'duplicate':
        for (const id of ids) duplicateEpisode(id);
        affected = ids.length;
        break;
      case 'today': {
        const day = localDay();
        const max = (d.prepare('SELECT coalesce(max(position), -1) AS m FROM today_queue WHERE day = ?').get(day) as { m: number }).m;
        const ins = d.prepare('INSERT OR IGNORE INTO today_queue (day, episode_id, position) VALUES (?, ?, ?)');
        ids.forEach((id, i) => (affected += ins.run(day, id, max + 1 + i).changes));
        break;
      }
      case 'schedule': {
        const start = new Date(action.startAt).getTime();
        if (!Number.isFinite(start)) throw invalid('Invalid start date.');
        const ins = d.prepare(`INSERT INTO publications (episode_id, platform, account, status, scheduled_at) VALUES (?, ?, ?, 'SCHEDULED', ?)`);
        const notReady: number[] = [];
        ids.forEach((id, i) => {
          const e = episodeRow(id);
          if (e.phase !== 'READY' && e.phase !== 'SCHEDULED') notReady.push(id);
          const at = new Date(start + i * action.intervalMinutes * 60_000).toISOString();
          publicationIds.push(Number(ins.run(id, action.platform, action.account ?? '', at).lastInsertRowid));
          const r = setStages(id, [{ stage: 'SCHEDULE', status: 'DONE' }], { log: false });
          snapshot.push(...r.snapshot);
          affected++;
        });
        recomputeEpisodes(ids);
        if (notReady.length) warnings.push(`${notReady.length} of these episode${notReady.length > 1 ? 's are' : ' is'} not production-ready yet — they were scheduled anyway.`);
        summary(`scheduled on ${action.platform.toLowerCase()} every ${action.intervalMinutes} min`);
        break;
      }
      case 'publishNow': {
        const ins = d.prepare(`INSERT INTO publications (episode_id, platform, account, status, published_at) VALUES (?, ?, ?, 'PUBLISHED', ?)`);
        for (const id of ids) {
          const sched = d.prepare(`SELECT id FROM publications WHERE episode_id = ? AND status = 'SCHEDULED' AND platform = ? AND deleted_at IS NULL ORDER BY scheduled_at LIMIT 1`).get(id, action.platform) as { id: number } | undefined;
          if (sched) d.prepare(`UPDATE publications SET status = 'PUBLISHED', published_at = ?, updated_at = ? WHERE id = ?`).run(now, now, sched.id);
          else publicationIds.push(Number(ins.run(id, action.platform, action.account ?? '', now).lastInsertRowid));
          const r = setStages(id, [{ stage: 'PUBLISH', status: 'DONE' }], { log: false });
          snapshot.push(...r.snapshot);
          affected++;
        }
        recomputeEpisodes(ids);
        summary(`published on ${action.platform.toLowerCase()}`);
        break;
      }
    }
    const undoable = snapshot.some((s) => s.stages.length) || publicationIds.length > 0;
    return { affected, warnings, undo: undoable ? { snapshot, publicationIds } : null };
  });
}
