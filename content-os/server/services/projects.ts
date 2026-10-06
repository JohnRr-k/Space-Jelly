import type { ProjectStats } from '../../shared/api';
import { nowIso } from '../db';
import { db, tx, notFound, invalid, conflict, logActivity, setTags, tagsFor, buildUpdate, placeholders } from './core';
import { episodeItems } from './episodes';

// =============================================================== stats

interface StatRow {
  key: number;
  total: number;
  idea: number;
  in_production: number;
  blocked: number;
  ready: number;
  scheduled: number;
  published: number;
  readiness_sum: number;
}

function statsBy(column: 'project_id' | 'series_id', ids?: number[]) {
  const where = ids?.length ? `AND ${column} IN (${placeholders(ids)})` : '';
  const rows = db()
    .prepare(
      `SELECT ${column} AS key, count(*) AS total,
         sum(phase = 'IDEA') AS idea,
         sum(phase IN ('RESEARCH','SCRIPT','VOICE','VISUAL','EDIT','QC')) AS in_production,
         sum(blocked) AS blocked,
         sum(phase = 'READY') AS ready,
         sum(phase = 'SCHEDULED') AS scheduled,
         sum(phase = 'PUBLISHED') AS published,
         sum(readiness) AS readiness_sum
       FROM episodes WHERE deleted_at IS NULL AND archived_at IS NULL AND ${column} IS NOT NULL ${where}
       GROUP BY ${column}`,
    )
    .all(...(ids ?? [])) as StatRow[];
  return new Map(rows.map((r) => [r.key, r]));
}

function toStats(r: StatRow | undefined, target: number | null, lastActivityAt: string | null): ProjectStats {
  const total = r?.total ?? 0;
  const denominator = Math.max(target ?? 0, total);
  return {
    total,
    idea: r?.idea ?? 0,
    inProduction: r?.in_production ?? 0,
    blocked: r?.blocked ?? 0,
    ready: r?.ready ?? 0,
    scheduled: r?.scheduled ?? 0,
    published: r?.published ?? 0,
    readinessSum: r?.readiness_sum ?? 0,
    target,
    coverage: target ? Math.min(1, total / target) : null,
    completion: denominator ? (r?.readiness_sum ?? 0) / (100 * denominator) : 0,
    lastActivityAt,
  };
}

// =============================================================== projects

interface ProjectRow {
  id: number;
  name: string;
  code: string;
  description: string;
  goal: string;
  status: string;
  target_count: number | null;
  color: string;
  default_content_type_id: number | null;
  notes: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

function projectRow(id: number): ProjectRow {
  const p = db().prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
  if (!p || p.deleted_at) throw notFound('Project', id);
  return p;
}

export function listProjects(includeArchived = false) {
  const d = db();
  const rows = d
    .prepare(`SELECT * FROM projects WHERE deleted_at IS NULL ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY sort_order, name`)
    .all() as ProjectRow[];
  const stats = statsBy('project_id');
  const last = new Map(
    (d.prepare('SELECT project_id, max(at) AS at FROM activity WHERE project_id IS NOT NULL GROUP BY project_id').all() as { project_id: number; at: string }[]).map((r) => [r.project_id, r.at]),
  );
  const seriesCounts = new Map(
    (d.prepare('SELECT project_id, count(*) AS c FROM series WHERE deleted_at IS NULL AND archived_at IS NULL GROUP BY project_id').all() as { project_id: number; c: number }[]).map((r) => [r.project_id, r.c]),
  );
  const tags = tagsFor('project_tags', rows.map((r) => r.id));
  return rows.map((p) => ({
    ...p,
    tags: tags.get(p.id) ?? [],
    seriesCount: seriesCounts.get(p.id) ?? 0,
    stats: toStats(stats.get(p.id), p.target_count, last.get(p.id) ?? null),
  }));
}

export function getProject(id: number) {
  const d = db();
  const p = projectRow(id);
  const stats = toStats(statsBy('project_id', [id]).get(id), p.target_count, (d.prepare('SELECT max(at) AS at FROM activity WHERE project_id = ?').get(id) as { at: string | null }).at);
  const series = listSeries({ projectId: id, includeArchived: true });
  const pick = (sql: string, limit = 12) =>
    episodeItems((d.prepare(`SELECT id FROM episodes WHERE project_id = ? AND deleted_at IS NULL AND archived_at IS NULL AND ${sql} LIMIT ${limit}`).all(id) as { id: number }[]).map((r) => r.id));
  const sources = d
    .prepare(
      `SELECT s.id, s.title, s.type, s.author, s.status, s.potential,
         (SELECT count(DISTINCT x.episode_id) FROM episode_sources x JOIN episodes e ON e.id = x.episode_id AND e.deleted_at IS NULL WHERE x.source_id = s.id AND e.project_id = ?) AS episodes
       FROM sources s
       WHERE s.deleted_at IS NULL AND (s.project_id = ? OR s.id IN (SELECT x.source_id FROM episode_sources x JOIN episodes e ON e.id = x.episode_id WHERE e.project_id = ?))
       ORDER BY episodes DESC, s.title LIMIT 40`,
    )
    .all(id, id, id);
  const ideas = d
    .prepare(`SELECT count(*) AS open, sum(touched_at < ?) AS dormant FROM ideas WHERE project_id = ? AND deleted_at IS NULL AND status IN ('INBOX','DEVELOPING','PARKED')`)
    .get(new Date(Date.now() - 30 * 86_400_000).toISOString(), id) as { open: number; dormant: number | null };
  const activity = d.prepare('SELECT * FROM activity WHERE project_id = ? ORDER BY at DESC LIMIT 25').all(id);
  return {
    project: { ...p, tags: tagsFor('project_tags', [id]).get(id) ?? [] },
    stats,
    series,
    blocked: pick('blocked = 1 ORDER BY priority, progress_at', 20),
    ready: pick(`phase = 'READY' ORDER BY priority, due_date IS NULL, due_date`, 20),
    inProduction: pick(`phase IN ('RESEARCH','SCRIPT','VOICE','VISUAL','EDIT','QC') AND blocked = 0 ORDER BY readiness DESC, priority`, 20),
    sources,
    ideas: { open: ideas.open, dormant: ideas.dormant ?? 0 },
    activity,
  };
}

export interface ProjectInput {
  name: string;
  code: string;
  description?: string;
  goal?: string;
  status?: string;
  targetCount?: number | null;
  color?: string;
  defaultContentTypeId?: number | null;
  notes?: string;
  tags?: string[];
}
const PROJECT_COLUMNS = {
  name: 'name',
  code: 'code',
  description: 'description',
  goal: 'goal',
  status: 'status',
  targetCount: 'target_count',
  color: 'color',
  defaultContentTypeId: 'default_content_type_id',
  notes: 'notes',
};

export function createProject(input: ProjectInput) {
  return tx(() => {
    const d = db();
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,8}$/.test(code)) throw invalid('Code must be 1–8 letters/numbers (used for episode codes like BIB-041).');
    if (d.prepare('SELECT 1 FROM projects WHERE code = ?').get(code)) throw conflict(`Code ${code} is already used by another project.`);
    const order = (d.prepare('SELECT coalesce(max(sort_order), 0) + 1 AS n FROM projects').get() as { n: number }).n;
    const id = Number(
      d
        .prepare(
          `INSERT INTO projects (name, code, description, goal, status, target_count, color, default_content_type_id, notes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(input.name.trim(), code, input.description ?? '', input.goal ?? '', input.status ?? 'ACTIVE', input.targetCount ?? null, input.color ?? '#3d6b5c', input.defaultContentTypeId ?? null, input.notes ?? '', order).lastInsertRowid,
    );
    if (input.tags) setTags('project_tags', id, input.tags);
    logActivity({ action: 'created', entityType: 'project', entityId: id, projectId: id, summary: `Created project “${input.name.trim()}”` });
    return id;
  });
}

export function updateProject(id: number, patch: Partial<ProjectInput> & { archived?: boolean }) {
  return tx(() => {
    const d = db();
    const before = projectRow(id);
    const p: Record<string, unknown> = { ...patch };
    if (typeof p.code === 'string') {
      p.code = (p.code as string).trim().toUpperCase();
      if (!/^[A-Z0-9]{1,8}$/.test(p.code as string)) throw invalid('Code must be 1–8 letters/numbers.');
      if (d.prepare('SELECT 1 FROM projects WHERE code = ? AND id <> ?').get(p.code, id)) throw conflict(`Code ${p.code} is already used.`);
    }
    if (typeof p.name === 'string' && !(p.name as string).trim()) throw invalid('Name cannot be empty.');
    const { sets, vals } = buildUpdate(p, PROJECT_COLUMNS);
    if (patch.archived !== undefined) {
      sets.push('archived_at = ?');
      vals.push(patch.archived ? nowIso() : null);
    }
    if (sets.length) d.prepare(`UPDATE projects SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), id);
    if (patch.tags) setTags('project_tags', id, patch.tags);
    if (patch.archived !== undefined) logActivity({ action: patch.archived ? 'archived' : 'unarchived', entityType: 'project', entityId: id, projectId: id, summary: `${patch.archived ? 'Archived' : 'Restored'} project “${before.name}”` });
    else if (patch.status && patch.status !== before.status) logActivity({ action: 'updated', entityType: 'project', entityId: id, projectId: id, summary: `${before.name}: status → ${patch.status.toLowerCase()}` });
    else if (patch.targetCount !== undefined && patch.targetCount !== before.target_count) logActivity({ action: 'updated', entityType: 'project', entityId: id, projectId: id, summary: `${before.name}: target → ${patch.targetCount ?? 'none'}` });
  });
}

export function deleteProject(id: number) {
  return tx(() => {
    const p = projectRow(id);
    const n = (db().prepare('SELECT count(*) AS c FROM episodes WHERE project_id = ? AND deleted_at IS NULL').get(id) as { c: number }).c;
    if (n) throw conflict(`“${p.name}” still has ${n} episode${n > 1 ? 's' : ''}. Archive the project instead, or move/delete its episodes first.`);
    db().prepare('UPDATE projects SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
    logActivity({ action: 'deleted', entityType: 'project', entityId: id, summary: `Moved project “${p.name}” to trash` });
  });
}

// =============================================================== series

interface SeriesRow {
  id: number;
  project_id: number;
  title: string;
  description: string;
  target_count: number | null;
  notes: string;
  idea_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

function seriesRow(id: number): SeriesRow {
  const s = db().prepare('SELECT * FROM series WHERE id = ?').get(id) as SeriesRow | undefined;
  if (!s || s.deleted_at) throw notFound('Series', id);
  return s;
}

export function listSeries(opts: { projectId?: number; includeArchived?: boolean } = {}) {
  const d = db();
  const where = ['s.deleted_at IS NULL', 'p.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (!opts.includeArchived) where.push('s.archived_at IS NULL');
  if (opts.projectId) {
    where.push('s.project_id = ?');
    params.push(opts.projectId);
  }
  const rows = d
    .prepare(
      `SELECT s.*, p.name AS project_name, p.code AS project_code, p.color AS project_color FROM series s JOIN projects p ON p.id = s.project_id
       WHERE ${where.join(' AND ')} ORDER BY p.sort_order, s.sort_order, s.title`,
    )
    .all(...params) as (SeriesRow & { project_name: string; project_code: string; project_color: string })[];
  const stats = statsBy('series_id', rows.map((r) => r.id));
  const tags = tagsFor('series_tags', rows.map((r) => r.id));
  return rows.map((s) => ({ ...s, tags: tags.get(s.id) ?? [], stats: toStats(stats.get(s.id), s.target_count, null) }));
}

export function getSeries(id: number) {
  const d = db();
  const s = seriesRow(id);
  const project = d.prepare('SELECT id, name, code, color FROM projects WHERE id = ?').get(s.project_id);
  const stats = toStats(statsBy('series_id', [id]).get(id), s.target_count, null);
  const sources = d
    .prepare(
      `SELECT src.id, src.title, src.type, src.author, count(DISTINCT x.episode_id) AS episodes FROM episode_sources x
       JOIN episodes e ON e.id = x.episode_id AND e.deleted_at IS NULL JOIN sources src ON src.id = x.source_id AND src.deleted_at IS NULL
       WHERE e.series_id = ? GROUP BY src.id ORDER BY episodes DESC LIMIT 30`,
    )
    .all(id);
  const tags = tagsFor('series_tags', [id]).get(id) ?? [];
  // Ideas attached to the series, or untouched ideas in the project that share a tag with it.
  const ideas = d
    .prepare(
      `SELECT i.id, i.title, i.status, i.touched_at, i.created_at FROM ideas i
       WHERE i.deleted_at IS NULL AND i.status IN ('INBOX','DEVELOPING','PARKED') AND (
         i.series_id = ? OR (i.project_id = ? AND EXISTS (
           SELECT 1 FROM idea_tags it JOIN series_tags st ON st.tag_id = it.tag_id WHERE it.idea_id = i.id AND st.series_id = ?)))
       ORDER BY i.touched_at LIMIT 20`,
    )
    .all(id, s.project_id, id);
  const activity = d
    .prepare(`SELECT a.* FROM activity a JOIN episodes e ON e.id = a.episode_id WHERE e.series_id = ? ORDER BY a.at DESC LIMIT 20`)
    .all(id);
  return { series: { ...s, tags }, project, stats, sources, ideas, activity };
}

export interface SeriesInput {
  projectId: number;
  title: string;
  description?: string;
  targetCount?: number | null;
  notes?: string;
  tags?: string[];
  ideaId?: number | null;
}

export function createSeries(input: SeriesInput) {
  return tx(() => {
    const d = db();
    projectRow(input.projectId);
    if (!input.title.trim()) throw invalid('Title is required.');
    const order = (d.prepare('SELECT coalesce(max(sort_order), 0) + 1 AS n FROM series WHERE project_id = ?').get(input.projectId) as { n: number }).n;
    const id = Number(
      d
        .prepare('INSERT INTO series (project_id, title, description, target_count, notes, idea_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(input.projectId, input.title.trim(), input.description ?? '', input.targetCount ?? null, input.notes ?? '', input.ideaId ?? null, order).lastInsertRowid,
    );
    if (input.tags) setTags('series_tags', id, input.tags);
    logActivity({ action: 'created', entityType: 'series', entityId: id, projectId: input.projectId, summary: `Created series “${input.title.trim()}”` });
    return id;
  });
}

export function updateSeries(id: number, patch: Partial<SeriesInput> & { archived?: boolean; sortOrder?: number }) {
  return tx(() => {
    const before = seriesRow(id);
    if (patch.projectId && patch.projectId !== before.project_id) throw invalid('Series cannot move between projects. Create a new series instead.');
    const { sets, vals } = buildUpdate(patch as Record<string, unknown>, { title: 'title', description: 'description', targetCount: 'target_count', notes: 'notes', sortOrder: 'sort_order' });
    if (patch.archived !== undefined) {
      sets.push('archived_at = ?');
      vals.push(patch.archived ? nowIso() : null);
    }
    if (sets.length) db().prepare(`UPDATE series SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), id);
    if (patch.tags) setTags('series_tags', id, patch.tags);
    if (patch.archived !== undefined) logActivity({ action: patch.archived ? 'archived' : 'unarchived', entityType: 'series', entityId: id, projectId: before.project_id, summary: `${patch.archived ? 'Archived' : 'Restored'} series “${before.title}”` });
  });
}

export function deleteSeries(id: number) {
  return tx(() => {
    const s = seriesRow(id);
    const n = (db().prepare('SELECT count(*) AS c FROM episodes WHERE series_id = ? AND deleted_at IS NULL').get(id) as { c: number }).c;
    if (n) throw conflict(`“${s.title}” still has ${n} episode${n > 1 ? 's' : ''}. Archive the series, or reassign its episodes first.`);
    db().prepare('UPDATE series SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
    logActivity({ action: 'deleted', entityType: 'series', entityId: id, projectId: s.project_id, summary: `Moved series “${s.title}” to trash` });
  });
}
