/** Ideas, sources, insights and people — the "content brain" side of the system. */
import { nowIso, daysAgoIso } from '../time';
import { db, tx, notFound, invalid, logActivity, setTags, tagsFor, buildUpdate, settingNum } from './core';
import { createEpisode, episodeItems, ftsQuery } from './episodes';
import { createSeries } from './projects';

// =============================================================== ideas

interface IdeaRow {
  id: number;
  title: string;
  thought: string;
  project_id: number | null;
  series_id: number | null;
  source_id: number | null;
  insight_id: number | null;
  priority: number;
  status: string;
  touched_at: string;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

function ideaRow(id: number): IdeaRow {
  const r = db().prepare('SELECT * FROM ideas WHERE id = ?').get(id) as IdeaRow | undefined;
  if (!r || r.deleted_at) throw notFound('Idea', id);
  return r;
}

export type IdeaView = 'inbox' | 'dormant' | 'recent' | 'developing' | 'converted' | 'parked' | 'all';

export function listIdeas(opts: { view?: IdeaView; q?: string; projectId?: number; limit?: number; offset?: number }) {
  const d = db();
  const where = ['i.deleted_at IS NULL'];
  const params: unknown[] = [];
  const dormantBefore = daysAgoIso(settingNum('dormant_idea_days'));
  let order = 'i.created_at DESC';
  switch (opts.view ?? 'inbox') {
    case 'inbox':
      where.push(`i.status = 'INBOX'`, 'i.archived_at IS NULL');
      order = 'i.priority, i.created_at DESC';
      break;
    case 'dormant':
      where.push(`i.status IN ('INBOX','DEVELOPING','PARKED')`, 'i.archived_at IS NULL', 'i.touched_at < ?', `(i.snoozed_until IS NULL OR i.snoozed_until < ?)`);
      params.push(dormantBefore, nowIso());
      order = 'i.touched_at ASC';
      break;
    case 'recent':
      where.push(`i.status <> 'DISCARDED'`, 'i.created_at >= ?');
      params.push(daysAgoIso(14));
      break;
    case 'developing':
      where.push(`i.status = 'DEVELOPING'`, 'i.archived_at IS NULL');
      order = 'i.touched_at DESC';
      break;
    case 'converted':
      where.push(`i.status = 'CONVERTED'`);
      order = 'i.updated_at DESC';
      break;
    case 'parked':
      where.push(`(i.status IN ('PARKED','DISCARDED') OR i.archived_at IS NOT NULL)`);
      order = 'i.updated_at DESC';
      break;
    case 'all':
      break;
  }
  if (opts.projectId) {
    where.push('i.project_id = ?');
    params.push(opts.projectId);
  }
  if (opts.q?.trim()) {
    const fts = ftsQuery(opts.q);
    if (fts) {
      where.push(`i.id IN (SELECT ref_id FROM search_index WHERE search_index MATCH ? AND kind = 'idea')`);
      params.push(fts);
    }
  }
  const total = (d.prepare(`SELECT count(*) AS c FROM ideas i WHERE ${where.join(' AND ')}`).get(...params) as { c: number }).c;
  const rows = d
    .prepare(
      `SELECT i.*, p.name AS project_name, p.code AS project_code, p.color AS project_color, s.title AS source_title, sr.title AS series_title,
         (SELECT count(*) FROM episodes e WHERE e.idea_id = i.id AND e.deleted_at IS NULL) AS episode_count
       FROM ideas i LEFT JOIN projects p ON p.id = i.project_id LEFT JOIN sources s ON s.id = i.source_id LEFT JOIN series sr ON sr.id = i.series_id
       WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`,
    )
    .all(...params, Math.min(opts.limit ?? 100, 500), opts.offset ?? 0) as (IdeaRow & Record<string, unknown>)[];
  const tags = tagsFor('idea_tags', rows.map((r) => r.id));
  const counts = d
    .prepare(
      `SELECT sum(status = 'INBOX' AND archived_at IS NULL) AS inbox,
              sum(status IN ('INBOX','DEVELOPING','PARKED') AND archived_at IS NULL AND touched_at < ? AND (snoozed_until IS NULL OR snoozed_until < ?)) AS dormant,
              sum(status <> 'DISCARDED' AND created_at >= ?) AS recent,
              sum(status = 'DEVELOPING' AND archived_at IS NULL) AS developing,
              sum(status = 'CONVERTED') AS converted,
              sum(status IN ('PARKED','DISCARDED') OR archived_at IS NOT NULL) AS parked,
              count(*) AS "all"
       FROM ideas WHERE deleted_at IS NULL`,
    )
    .get(dormantBefore, nowIso(), daysAgoIso(14));
  return { items: rows.map((r) => ({ ...r, tags: tags.get(r.id) ?? [] })), total, counts };
}

export function getIdea(id: number) {
  const d = db();
  const i = ideaRow(id);
  const episodes = episodeItems((d.prepare('SELECT id FROM episodes WHERE idea_id = ? AND deleted_at IS NULL').all(id) as { id: number }[]).map((r) => r.id));
  const series = d.prepare('SELECT id, title FROM series WHERE idea_id = ? AND deleted_at IS NULL').all(id);
  const source = i.source_id ? d.prepare('SELECT id, title, type, author FROM sources WHERE id = ?').get(i.source_id) : null;
  const insight = i.insight_id ? d.prepare('SELECT id, statement FROM insights WHERE id = ?').get(i.insight_id) : null;
  return { idea: { ...i, tags: tagsFor('idea_tags', [id]).get(id) ?? [] }, episodes, series, source, insight };
}

export interface IdeaInput {
  title: string;
  thought?: string;
  projectId?: number | null;
  seriesId?: number | null;
  sourceId?: number | null;
  insightId?: number | null;
  priority?: number;
  status?: string;
  tags?: string[];
}

export function createIdea(input: IdeaInput) {
  return tx(() => {
    if (!input.title.trim()) throw invalid('An idea needs at least a title.');
    const id = Number(
      db()
        .prepare('INSERT INTO ideas (title, thought, project_id, series_id, source_id, insight_id, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(input.title.trim(), input.thought ?? '', input.projectId ?? null, input.seriesId ?? null, input.sourceId ?? null, input.insightId ?? null, input.priority ?? 2, input.status ?? 'INBOX')
        .lastInsertRowid,
    );
    if (input.tags?.length) setTags('idea_tags', id, input.tags);
    logActivity({ action: 'created', entityType: 'idea', entityId: id, projectId: input.projectId ?? null, summary: `Captured idea “${input.title.trim()}”` });
    return id;
  });
}

export function updateIdea(id: number, patch: Partial<IdeaInput> & { archived?: boolean; snoozeDays?: number | null; touch?: boolean }) {
  return tx(() => {
    const before = ideaRow(id);
    const p: Record<string, unknown> = { ...patch };
    const { sets, vals } = buildUpdate(p, {
      title: 'title',
      thought: 'thought',
      projectId: 'project_id',
      seriesId: 'series_id',
      sourceId: 'source_id',
      insightId: 'insight_id',
      priority: 'priority',
      status: 'status',
    });
    // Any deliberate edit counts as "touching" the idea.
    sets.push('touched_at = ?');
    vals.push(nowIso());
    if (patch.archived !== undefined) {
      sets.push('archived_at = ?');
      vals.push(patch.archived ? nowIso() : null);
    }
    if (patch.snoozeDays !== undefined) {
      sets.push('snoozed_until = ?');
      vals.push(patch.snoozeDays ? new Date(Date.now() + patch.snoozeDays * 86_400_000).toISOString() : null);
    }
    db().prepare(`UPDATE ideas SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), id);
    if (patch.tags) setTags('idea_tags', id, patch.tags);
    if (patch.status && patch.status !== before.status) {
      logActivity({ action: 'updated', entityType: 'idea', entityId: id, projectId: before.project_id, summary: `Idea “${before.title}” → ${patch.status.toLowerCase()}` });
    }
  });
}

export function deleteIdea(id: number) {
  const i = ideaRow(id);
  db().prepare('UPDATE ideas SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
  logActivity({ action: 'deleted', entityType: 'idea', entityId: id, summary: `Moved idea “${i.title}” to trash` });
}

export function convertIdeaToEpisode(id: number, opts: { projectId?: number; seriesId?: number | null; contentTypeId?: number | null; title?: string }) {
  return tx(() => {
    const i = ideaRow(id);
    const projectId = opts.projectId ?? i.project_id;
    if (!projectId) throw invalid('Pick a project for the new episode.');
    const episodeId = createEpisode(
      {
        projectId,
        seriesId: opts.seriesId ?? i.series_id ?? null,
        contentTypeId: opts.contentTypeId ?? null,
        ideaId: id,
        title: opts.title?.trim() || i.title,
        coreIdea: i.thought,
        priority: i.priority,
        tags: tagsFor('idea_tags', [id]).get(id) ?? [],
        sourceIds: i.source_id ? [i.source_id] : [],
        insightIds: i.insight_id ? [i.insight_id] : [],
      },
      { log: false },
    );
    db().prepare(`UPDATE ideas SET status = 'CONVERTED', project_id = ?, touched_at = ?, updated_at = ? WHERE id = ?`).run(projectId, nowIso(), nowIso(), id);
    logActivity({ action: 'converted', entityType: 'idea', entityId: id, episodeId, projectId, summary: `Idea “${i.title}” became an episode` });
    return episodeId;
  });
}

export function convertIdeaToSeries(id: number, opts: { projectId?: number; title?: string }) {
  return tx(() => {
    const i = ideaRow(id);
    const projectId = opts.projectId ?? i.project_id;
    if (!projectId) throw invalid('Pick a project for the new series.');
    const seriesId = createSeries({ projectId, title: opts.title?.trim() || i.title, description: i.thought, ideaId: id, tags: tagsFor('idea_tags', [id]).get(id) ?? [] });
    db().prepare(`UPDATE ideas SET status = 'CONVERTED', project_id = ?, series_id = ?, touched_at = ?, updated_at = ? WHERE id = ?`).run(projectId, seriesId, nowIso(), nowIso(), id);
    return seriesId;
  });
}

// =============================================================== sources

interface SourceRow {
  id: number;
  title: string;
  type: string;
  author: string;
  person_id: number | null;
  project_id: number | null;
  description: string;
  citation: string;
  url: string;
  year: number | null;
  status: string;
  potential: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

function sourceRow(id: number): SourceRow {
  const r = db().prepare('SELECT * FROM sources WHERE id = ?').get(id) as SourceRow | undefined;
  if (!r || r.deleted_at) throw notFound('Source', id);
  return r;
}

const SOURCE_COUNTS = `
  (SELECT count(*) FROM episode_sources x JOIN episodes e ON e.id = x.episode_id AND e.deleted_at IS NULL WHERE x.source_id = s.id) AS episode_count,
  (SELECT count(*) FROM episode_sources x JOIN episodes e ON e.id = x.episode_id AND e.deleted_at IS NULL WHERE x.source_id = s.id AND e.phase = 'PUBLISHED') AS published_count,
  (SELECT count(*) FROM insights n WHERE n.source_id = s.id AND n.deleted_at IS NULL) AS insight_count,
  (SELECT count(*) FROM ideas i WHERE i.source_id = s.id AND i.deleted_at IS NULL) AS idea_count`;

export function listSources(opts: { q?: string; type?: string; status?: string; projectId?: number; archived?: boolean; sort?: string }) {
  const d = db();
  const where = ['s.deleted_at IS NULL', opts.archived ? 's.archived_at IS NOT NULL' : 's.archived_at IS NULL'];
  const params: unknown[] = [];
  if (opts.type) {
    where.push('s.type = ?');
    params.push(opts.type);
  }
  if (opts.status) {
    where.push('s.status = ?');
    params.push(opts.status);
  }
  if (opts.projectId) {
    where.push('(s.project_id = ? OR s.id IN (SELECT x.source_id FROM episode_sources x JOIN episodes e ON e.id = x.episode_id WHERE e.project_id = ?))');
    params.push(opts.projectId, opts.projectId);
  }
  if (opts.q?.trim()) {
    const fts = ftsQuery(opts.q);
    if (fts) {
      where.push(`(s.id IN (SELECT ref_id FROM search_index WHERE search_index MATCH ? AND kind = 'source') OR s.person_id IN (SELECT ref_id FROM search_index WHERE search_index MATCH ? AND kind = 'person'))`);
      params.push(fts, fts);
    }
  }
  const order = opts.sort === 'episodes' ? 'episode_count DESC' : opts.sort === 'recent' ? 's.updated_at DESC' : 's.title COLLATE NOCASE';
  const rows = d
    .prepare(
      `SELECT s.*, pe.name AS person_name, p.name AS project_name, p.color AS project_color, ${SOURCE_COUNTS}
       FROM sources s LEFT JOIN people pe ON pe.id = s.person_id LEFT JOIN projects p ON p.id = s.project_id
       WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 1000`,
    )
    .all(...params) as (SourceRow & Record<string, unknown>)[];
  const tags = tagsFor('source_tags', rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, tags: tags.get(r.id) ?? [] }));
}

export function getSource(id: number) {
  const d = db();
  const s = sourceRow(id);
  const counts = d.prepare(`SELECT ${SOURCE_COUNTS} FROM sources s WHERE s.id = ?`).get(id);
  const person = s.person_id ? d.prepare('SELECT * FROM people WHERE id = ?').get(s.person_id) : null;
  const insights = d
    .prepare(
      `SELECT n.*, (SELECT count(*) FROM episode_insights x JOIN episodes e ON e.id = x.episode_id AND e.deleted_at IS NULL WHERE x.insight_id = n.id) AS episode_count,
         (SELECT count(*) FROM ideas i WHERE i.insight_id = n.id AND i.deleted_at IS NULL) AS idea_count
       FROM insights n WHERE n.source_id = ? AND n.deleted_at IS NULL ORDER BY n.created_at`,
    )
    .all(id);
  const ideas = d
    .prepare(
      `SELECT i.id, i.title, i.status, i.touched_at, i.created_at, i.insight_id,
         (SELECT count(*) FROM episodes e WHERE e.idea_id = i.id AND e.deleted_at IS NULL) AS episode_count
       FROM ideas i WHERE i.source_id = ? AND i.deleted_at IS NULL ORDER BY i.created_at DESC`,
    )
    .all(id);
  const episodeIds = (
    d
      .prepare(
        `SELECT DISTINCT e.id FROM episodes e WHERE e.deleted_at IS NULL AND (
           e.id IN (SELECT episode_id FROM episode_sources WHERE source_id = ?)
           OR e.id IN (SELECT x.episode_id FROM episode_insights x JOIN insights n ON n.id = x.insight_id WHERE n.source_id = ?)
           OR e.idea_id IN (SELECT id FROM ideas WHERE source_id = ?))
         ORDER BY e.project_id, e.number LIMIT 500`,
      )
      .all(id, id, id) as { id: number }[]
  ).map((r) => r.id);
  const episodes = episodeItems(episodeIds);
  const phases: Record<string, number> = {};
  for (const e of episodes) phases[e.phase] = (phases[e.phase] ?? 0) + 1;
  return { source: { ...s, tags: tagsFor('source_tags', [id]).get(id) ?? [] }, counts, person, insights, ideas, episodes, phases };
}

export interface SourceInput {
  title: string;
  type: string;
  author?: string;
  personId?: number | null;
  projectId?: number | null;
  description?: string;
  citation?: string;
  url?: string;
  year?: number | null;
  status?: string;
  potential?: number | null;
  notes?: string;
  tags?: string[];
}
const SOURCE_COLUMNS = {
  title: 'title',
  type: 'type',
  author: 'author',
  personId: 'person_id',
  projectId: 'project_id',
  description: 'description',
  citation: 'citation',
  url: 'url',
  year: 'year',
  status: 'status',
  potential: 'potential',
  notes: 'notes',
};

export function createSource(input: SourceInput) {
  return tx(() => {
    if (!input.title.trim()) throw invalid('Title is required.');
    const id = Number(
      db()
        .prepare(
          `INSERT INTO sources (title, type, author, person_id, project_id, description, citation, url, year, status, potential, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.title.trim(),
          input.type,
          input.author ?? '',
          input.personId ?? null,
          input.projectId ?? null,
          input.description ?? '',
          input.citation ?? '',
          input.url ?? '',
          input.year ?? null,
          input.status ?? 'QUEUED',
          input.potential ?? null,
          input.notes ?? '',
        ).lastInsertRowid,
    );
    if (input.tags?.length) setTags('source_tags', id, input.tags);
    logActivity({ action: 'created', entityType: 'source', entityId: id, projectId: input.projectId ?? null, summary: `Added source “${input.title.trim()}”` });
    return id;
  });
}

export function updateSource(id: number, patch: Partial<SourceInput> & { archived?: boolean }) {
  return tx(() => {
    const before = sourceRow(id);
    const { sets, vals } = buildUpdate(patch as Record<string, unknown>, SOURCE_COLUMNS);
    if (patch.archived !== undefined) {
      sets.push('archived_at = ?');
      vals.push(patch.archived ? nowIso() : null);
    }
    if (sets.length) db().prepare(`UPDATE sources SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), id);
    if (patch.tags) setTags('source_tags', id, patch.tags);
    if (patch.status && patch.status !== before.status) {
      logActivity({ action: 'updated', entityType: 'source', entityId: id, projectId: before.project_id, summary: `Source “${before.title}” → ${patch.status.toLowerCase().replace('_', ' ')}` });
    }
  });
}

export function deleteSource(id: number) {
  const s = sourceRow(id);
  db().prepare('UPDATE sources SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
  logActivity({ action: 'deleted', entityType: 'source', entityId: id, summary: `Moved source “${s.title}” to trash` });
}

// =============================================================== insights

export function createInsight(input: { sourceId?: number | null; projectId?: number | null; statement: string; detail?: string; locator?: string }) {
  if (!input.statement.trim()) throw invalid('An insight needs a statement.');
  if (input.sourceId) sourceRow(input.sourceId);
  const id = Number(
    db()
      .prepare('INSERT INTO insights (source_id, project_id, statement, detail, locator) VALUES (?, ?, ?, ?, ?)')
      .run(input.sourceId ?? null, input.projectId ?? null, input.statement.trim(), input.detail ?? '', input.locator ?? '').lastInsertRowid,
  );
  if (input.sourceId) db().prepare(`UPDATE sources SET status = CASE WHEN status = 'QUEUED' THEN 'IN_PROGRESS' ELSE status END, updated_at = ? WHERE id = ?`).run(nowIso(), input.sourceId);
  logActivity({ action: 'created', entityType: 'insight', entityId: id, summary: `Insight captured: “${input.statement.trim().slice(0, 80)}”` });
  return id;
}
export function updateInsight(id: number, patch: { statement?: string; detail?: string; locator?: string; projectId?: number | null }) {
  const r = db().prepare('SELECT id FROM insights WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!r) throw notFound('Insight', id);
  const { sets, vals } = buildUpdate(patch as Record<string, unknown>, { statement: 'statement', detail: 'detail', locator: 'locator', projectId: 'project_id' });
  if (sets.length) db().prepare(`UPDATE insights SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), id);
}
export function deleteInsight(id: number) {
  db().prepare('UPDATE insights SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
}
export function ideaFromInsight(id: number, opts: { projectId?: number | null; title?: string }) {
  const n = db().prepare('SELECT * FROM insights WHERE id = ? AND deleted_at IS NULL').get(id) as { id: number; statement: string; detail: string; source_id: number | null; project_id: number | null } | undefined;
  if (!n) throw notFound('Insight', id);
  return createIdea({
    title: opts.title?.trim() || n.statement.slice(0, 120),
    thought: n.detail || n.statement,
    projectId: opts.projectId ?? n.project_id,
    sourceId: n.source_id,
    insightId: n.id,
  });
}

// =============================================================== people

export function listPeople(q?: string) {
  const where = ['pe.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (q?.trim()) {
    where.push('pe.name LIKE ?');
    params.push(`%${q.trim()}%`);
  }
  return db()
    .prepare(
      `SELECT pe.*, (SELECT count(*) FROM sources s WHERE s.person_id = pe.id AND s.deleted_at IS NULL) AS source_count,
         (SELECT count(DISTINCT x.episode_id) FROM sources s JOIN episode_sources x ON x.source_id = s.id JOIN episodes e ON e.id = x.episode_id AND e.deleted_at IS NULL WHERE s.person_id = pe.id) AS episode_count
       FROM people pe WHERE ${where.join(' AND ')} ORDER BY pe.name LIMIT 500`,
    )
    .all(...params);
}
export function createPerson(input: { name: string; kind?: string; bio?: string }) {
  if (!input.name.trim()) throw invalid('Name is required.');
  return Number(db().prepare('INSERT INTO people (name, kind, bio) VALUES (?, ?, ?)').run(input.name.trim(), input.kind ?? 'THINKER', input.bio ?? '').lastInsertRowid);
}
export function updatePerson(id: number, patch: { name?: string; kind?: string; bio?: string; notes?: string }) {
  const { sets, vals } = buildUpdate(patch as Record<string, unknown>, { name: 'name', kind: 'kind', bio: 'bio', notes: 'notes' });
  if (sets.length) db().prepare(`UPDATE people SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), id);
}
