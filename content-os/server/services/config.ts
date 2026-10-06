import { STAGES, type Stage, type StageMode } from '../../shared/domain';
import type { ContentTypeDTO, EpisodeQuery } from '../../shared/api';
import { nowIso } from '../db';
import { db, tx, notFound, invalid, conflict, logActivity, getSettings } from './core';
import { recomputeEpisodes } from './episodes';

// =============================================================== content types

interface CTRow {
  id: number;
  key: string;
  name: string;
  description: string;
  default_duration_sec: number | null;
  default_platforms: string;
  checklist: string;
  color: string | null;
  archived_at: string | null;
  episode_count?: number;
}

let ctCache: Map<number, ContentTypeDTO> | null = null;
export const invalidateContentTypes = () => {
  ctCache = null;
};

function loadContentTypes() {
  if (ctCache) return ctCache;
  const d = db();
  const rows = d
    .prepare(
      `SELECT ct.*, (SELECT count(*) FROM episodes e WHERE e.content_type_id = ct.id AND e.deleted_at IS NULL) AS episode_count
       FROM content_types ct ORDER BY ct.sort_order, ct.name`,
    )
    .all() as CTRow[];
  const modes = d.prepare('SELECT content_type_id, stage, mode FROM content_type_stages').all() as { content_type_id: number; stage: Stage; mode: StageMode }[];
  const map = new Map<number, ContentTypeDTO>();
  for (const r of rows) {
    const m = {} as Record<Stage, StageMode>;
    for (const s of STAGES) m[s] = 'REQUIRED';
    map.set(r.id, {
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      defaultDurationSec: r.default_duration_sec,
      defaultPlatforms: r.default_platforms.split(',').filter(Boolean),
      checklist: safeJsonArray(r.checklist),
      color: r.color,
      modes: m,
      episodeCount: r.episode_count ?? 0,
      archivedAt: r.archived_at,
    });
  }
  for (const x of modes) map.get(x.content_type_id)?.modes && (map.get(x.content_type_id)!.modes[x.stage] = x.mode);
  ctCache = map;
  return map;
}

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function listContentTypes(): ContentTypeDTO[] {
  return [...loadContentTypes().values()];
}
export function contentTypeById(id: number): ContentTypeDTO {
  const ct = loadContentTypes().get(id);
  if (!ct) throw invalid(`Content type #${id} does not exist.`);
  return ct;
}
export function contentTypeModes(id: number) {
  return contentTypeById(id).modes;
}

export interface ContentTypeInput {
  key?: string;
  name: string;
  description?: string;
  defaultDurationSec?: number | null;
  defaultPlatforms?: string[];
  checklist?: string[];
  color?: string | null;
  modes?: Partial<Record<Stage, StageMode>>;
}

export function saveContentType(id: number | null, input: Partial<ContentTypeInput> & { archived?: boolean }) {
  const res = tx(() => {
    const d = db();
    let ctId = id;
    if (ctId === null) {
      if (!input.name?.trim()) throw invalid('Name is required.');
      const key = (input.key ?? input.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (d.prepare('SELECT 1 FROM content_types WHERE key = ?').get(key)) throw conflict(`A content type called “${input.name}” already exists.`);
      const order = (d.prepare('SELECT coalesce(max(sort_order), 0) + 1 AS n FROM content_types').get() as { n: number }).n;
      ctId = Number(d.prepare('INSERT INTO content_types (key, name, sort_order) VALUES (?, ?, ?)').run(key, input.name.trim(), order).lastInsertRowid);
      const ins = d.prepare('INSERT INTO content_type_stages (content_type_id, stage, mode) VALUES (?, ?, ?)');
      for (const s of STAGES) ins.run(ctId, s, input.modes?.[s] ?? 'REQUIRED');
    } else if (!d.prepare('SELECT 1 FROM content_types WHERE id = ?').get(ctId)) throw notFound('Content type', ctId);

    const sets: string[] = [];
    const vals: unknown[] = [];
    const set = (col: string, v: unknown) => {
      sets.push(`${col} = ?`);
      vals.push(v);
    };
    if (input.name !== undefined) set('name', input.name.trim());
    if (input.description !== undefined) set('description', input.description);
    if (input.defaultDurationSec !== undefined) set('default_duration_sec', input.defaultDurationSec);
    if (input.defaultPlatforms !== undefined) set('default_platforms', input.defaultPlatforms.join(','));
    if (input.checklist !== undefined) set('checklist', JSON.stringify(input.checklist.filter((x) => x.trim())));
    if (input.color !== undefined) set('color', input.color);
    if (input.archived !== undefined) set('archived_at', input.archived ? nowIso() : null);
    if (sets.length) d.prepare(`UPDATE content_types SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), ctId);

    let modesChanged = false;
    if (input.modes && id !== null) {
      const up = d.prepare('INSERT INTO content_type_stages (content_type_id, stage, mode) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET mode = excluded.mode');
      for (const [s, m] of Object.entries(input.modes)) {
        up.run(ctId, s, m);
        modesChanged = true;
      }
      if (!Object.values({ ...contentTypeModes(ctId), ...input.modes }).some((m) => m === 'REQUIRED')) {
        throw invalid('A content type needs at least one required stage.');
      }
    }
    return { ctId: ctId!, modesChanged };
  });
  invalidateContentTypes();
  if (res.modesChanged) {
    // Readiness depends on modes: recompute every episode of this type.
    const ids = (db().prepare('SELECT id FROM episodes WHERE content_type_id = ?').all(res.ctId) as { id: number }[]).map((r) => r.id);
    tx(() => recomputeEpisodes(ids));
    logActivity({ action: 'config', entityType: 'content_type', entityId: res.ctId, summary: `Workflow for “${contentTypeById(res.ctId).name}” changed — ${ids.length} episodes re-evaluated` });
  }
  return contentTypeById(res.ctId);
}

// =============================================================== saved views

export interface SavedView {
  id: number;
  name: string;
  query: EpisodeQuery;
  system: boolean;
}

export function listViews(): SavedView[] {
  return (db().prepare('SELECT * FROM saved_views ORDER BY sort_order, id').all() as { id: number; name: string; query: string; system: number }[]).map((r) => ({
    id: r.id,
    name: r.name,
    query: JSON.parse(r.query),
    system: !!r.system,
  }));
}
export function createView(name: string, query: EpisodeQuery) {
  const order = (db().prepare('SELECT coalesce(max(sort_order), 0) + 1 AS n FROM saved_views').get() as { n: number }).n;
  const clean = { ...query, limit: undefined, offset: undefined };
  return Number(db().prepare('INSERT INTO saved_views (name, query, sort_order) VALUES (?, ?, ?)').run(name.trim(), JSON.stringify(clean), order).lastInsertRowid);
}
export function updateView(id: number, patch: { name?: string; query?: EpisodeQuery }) {
  const v = db().prepare('SELECT * FROM saved_views WHERE id = ?').get(id);
  if (!v) throw notFound('View', id);
  if (patch.name) db().prepare('UPDATE saved_views SET name = ? WHERE id = ?').run(patch.name.trim(), id);
  if (patch.query) db().prepare('UPDATE saved_views SET query = ? WHERE id = ?').run(JSON.stringify({ ...patch.query, limit: undefined, offset: undefined }), id);
}
export function deleteView(id: number) {
  const v = db().prepare('SELECT system FROM saved_views WHERE id = ?').get(id) as { system: number } | undefined;
  if (!v) throw notFound('View', id);
  if (v.system) throw invalid('Built-in views cannot be deleted.');
  db().prepare('DELETE FROM saved_views WHERE id = ?').run(id);
}

export const SYSTEM_VIEWS: { name: string; query: EpisodeQuery }[] = [
  { name: 'Ready to post', query: { phases: ['READY'], sort: 'priority' } },
  { name: 'Waiting for voice', query: { waitingFor: ['VOICE'], sort: 'priority' } },
  { name: 'Waiting for edit', query: { waitingFor: ['EDIT'], sort: 'priority' } },
  { name: 'Blocked', query: { blocked: true, sort: 'progress' } },
  { name: 'Scheduled', query: { phases: ['SCHEDULED'], sort: 'scheduled' } },
  { name: 'Published', query: { phases: ['PUBLISHED'], sort: 'published' } },
  { name: 'Due this week', query: { due: 'week', sort: 'due' } },
  { name: 'High priority', query: { priorities: [0, 1], published: false, sort: 'priority' } },
  { name: 'Stalled 14d+', query: { staleDays: 14, phases: ['RESEARCH', 'SCRIPT', 'VOICE', 'VISUAL', 'EDIT', 'QC'], sort: 'progress' } },
  { name: 'Unstarted', query: { phases: ['IDEA'], sort: 'created', dir: 'asc' } },
];

// =============================================================== meta (bootstrap payload for the client)

export function getMeta() {
  const d = db();
  return {
    settings: getSettings(),
    contentTypes: listContentTypes(),
    projects: d
      .prepare('SELECT id, name, code, color, status, default_content_type_id AS defaultContentTypeId, archived_at AS archivedAt FROM projects WHERE deleted_at IS NULL ORDER BY sort_order, name')
      .all(),
    series: d
      .prepare('SELECT id, project_id AS projectId, title, archived_at AS archivedAt FROM series WHERE deleted_at IS NULL ORDER BY project_id, sort_order, title')
      .all(),
    tags: d
      .prepare('SELECT t.id, t.name, t.color, (SELECT count(*) FROM episode_tags x WHERE x.tag_id = t.id) AS count FROM tags t ORDER BY count DESC, t.name')
      .all(),
    views: listViews(),
  };
}
