/**
 * REST API. Every mutation the UI performs is available here, so automation agents
 * (research → script → voice → visual pipelines) can drive the same workflow.
 * Send `X-Actor: automation:<name>` to attribute changes in the activity feed.
 */
import { Hono, type Context } from 'hono';
import { z, ZodError } from 'zod';
import { STAGES, STAGE_STATUSES, PHASES, PLATFORMS, PUBLICATION_STATUSES, ASSET_KINDS, ASSET_STATUSES, SOURCE_TYPES, SOURCE_STATUSES, IDEA_STATUSES, PROJECT_STATUSES, RELATION_KINDS, STAGE_MODES } from '../shared/domain';
import { HttpError, withActor, updateSettings, db } from './services/core';
import * as E from './services/episodes';
import * as C from './services/config';
import * as P from './services/projects';
import * as L from './services/library';
import * as Pub from './services/publishing';
import * as I from './services/intelligence';

const api = new Hono();

// ---------------------------------------------------------------- middleware
api.use('*', async (c, next) => {
  const actor = c.req.header('x-actor')?.slice(0, 64) || 'you';
  await withActor(actor, next);
});

api.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, detail: err.detail }, err.status as 400);
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`);
    return c.json({ error: `Invalid input — ${issues[0]}`, detail: issues }, 400);
  }
  const msg = String((err as Error)?.message ?? err);
  if (msg.includes('UNIQUE constraint failed')) return c.json({ error: 'That would create a duplicate record.', detail: msg }, 409);
  if (msg.includes('FOREIGN KEY constraint failed')) return c.json({ error: 'A referenced record does not exist (or is still in use).', detail: msg }, 409);
  if (msg.includes('CHECK constraint failed')) return c.json({ error: 'A value is not allowed for that field.', detail: msg }, 400);
  if (msg.includes('fts5: syntax error')) return c.json({ error: 'Could not understand that search query.' }, 400);
  console.error(err);
  return c.json({ error: 'Something went wrong on the server. Your data was not changed.', detail: msg }, 500);
});

// ---------------------------------------------------------------- helpers
const id = (c: Context, name = 'id') => {
  const n = Number(c.req.param(name));
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name}`);
  return n;
};
const body = async <T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
  return schema.parse(raw);
};
const ok = (c: Context, data: unknown = { ok: true }) => c.json(data);

// ---------------------------------------------------------------- zod schemas
const zStage = z.enum(STAGES);
const zStatus = z.enum(STAGE_STATUSES);
const zPhase = z.enum(PHASES);
const zPlatform = z.enum(PLATFORMS);
const zPriority = z.number().int().min(0).max(3);
const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const zIso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'expected a date/time');
const zTags = z.array(z.string().min(1).max(64)).max(50);
const zIds = z.array(z.number().int().positive()).min(1).max(5000);
const nullableId = z.number().int().positive().nullable();

const zQuery = z.object({
  q: z.string().max(200).optional(),
  projectIds: z.array(z.number().int()).optional(),
  seriesIds: z.array(z.number().int()).optional(),
  contentTypeIds: z.array(z.number().int()).optional(),
  phases: z.array(zPhase).optional(),
  waitingFor: z.array(zStage).optional(),
  stageStatus: z.object({ stage: zStage, statuses: z.array(zStatus).min(1) }).optional(),
  priorities: z.array(zPriority).optional(),
  tags: z.array(z.string()).optional(),
  sourceId: z.number().int().optional(),
  insightId: z.number().int().optional(),
  ideaId: z.number().int().optional(),
  blocked: z.boolean().optional(),
  published: z.boolean().optional(),
  due: z.enum(['overdue', 'today', 'week', 'none', 'any']).optional(),
  createdWithinDays: z.number().int().positive().optional(),
  updatedWithinDays: z.number().int().positive().optional(),
  staleDays: z.number().int().positive().optional(),
  archived: z.enum(['exclude', 'only', 'include']).optional(),
  sort: z.enum(['updated', 'created', 'priority', 'readiness', 'due', 'number', 'title', 'progress', 'published', 'scheduled']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  group: z.enum(['none', 'project', 'series', 'phase', 'priority', 'type']).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

const zEpisodeBase = {
  seriesId: nullableId.optional(),
  contentTypeId: z.number().int().positive().nullable().optional(),
  number: z.number().int().positive().nullable().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional(),
  coreIdea: z.string().max(20000).optional(),
  hook: z.string().max(5000).optional(),
  script: z.string().max(200000).optional(),
  targetDurationSec: z.number().int().min(0).max(36000).nullable().optional(),
  priority: zPriority.optional(),
  dueDate: zDate.nullable().optional(),
  notes: z.string().max(50000).optional(),
  tags: zTags.optional(),
};
const zEpisodeCreate = z.object({
  projectId: z.number().int().positive(),
  ideaId: nullableId.optional(),
  sourceIds: z.array(z.number().int().positive()).optional(),
  insightIds: z.array(z.number().int().positive()).optional(),
  stages: z.partialRecord(zStage, zStatus).optional(),
  ...zEpisodeBase,
});
const zEpisodePatch = z.object({ projectId: z.number().int().positive().optional(), ...zEpisodeBase, title: zEpisodeBase.title.optional() });

const zBulkAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setStage'), stage: zStage, status: zStatus, note: z.string().max(500).optional() }),
  z.object({ type: z.literal('move'), phase: zPhase }),
  z.object({ type: z.literal('priority'), priority: zPriority }),
  z.object({ type: z.literal('series'), seriesId: nullableId }),
  z.object({ type: z.literal('contentType'), contentTypeId: z.number().int().positive() }),
  z.object({ type: z.literal('dueDate'), dueDate: zDate.nullable() }),
  z.object({ type: z.literal('addTags'), tags: zTags.min(1) }),
  z.object({ type: z.literal('removeTags'), tags: zTags.min(1) }),
  z.object({ type: z.literal('addSource'), sourceId: z.number().int().positive() }),
  z.object({ type: z.literal('archive') }),
  z.object({ type: z.literal('unarchive') }),
  z.object({ type: z.literal('delete') }),
  z.object({ type: z.literal('duplicate') }),
  z.object({ type: z.literal('today') }),
  z.object({ type: z.literal('schedule'), platform: zPlatform, startAt: zIso, intervalMinutes: z.number().int().min(0).max(10080), account: z.string().max(100).optional() }),
  z.object({ type: z.literal('publishNow'), platform: zPlatform, account: z.string().max(100).optional() }),
]);

const zSnapshot = z.array(z.object({ episodeId: z.number().int(), stages: z.array(z.object({ stage: zStage, status: zStatus, note: z.string() })) }));

// ================================================================ meta / settings / config
api.get('/meta', (c) => ok(c, C.getMeta()));
api.patch('/settings', async (c) => ok(c, updateSettings(await body(c, z.record(z.string(), z.string().max(200))))));

api.get('/content-types', (c) => ok(c, C.listContentTypes()));
const zCT = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
  defaultDurationSec: z.number().int().min(0).nullable().optional(),
  defaultPlatforms: z.array(zPlatform).optional(),
  checklist: z.array(z.string().max(200)).max(50).optional(),
  color: z.string().max(20).nullable().optional(),
  modes: z.partialRecord(zStage, z.enum(STAGE_MODES)).optional(),
  archived: z.boolean().optional(),
});
api.post('/content-types', async (c) => ok(c, C.saveContentType(null, await body(c, zCT))));
api.patch('/content-types/:id', async (c) => ok(c, C.saveContentType(id(c), await body(c, zCT.partial()))));

api.get('/views', (c) => ok(c, C.listViews()));
api.post('/views', async (c) => {
  const b = await body(c, z.object({ name: z.string().min(1).max(60), query: zQuery }));
  return ok(c, { id: C.createView(b.name, b.query) });
});
api.patch('/views/:id', async (c) => {
  C.updateView(id(c), await body(c, z.object({ name: z.string().min(1).max(60).optional(), query: zQuery.optional() })));
  return ok(c);
});
api.delete('/views/:id', (c) => {
  C.deleteView(id(c));
  return ok(c);
});

api.patch('/tags/:id', async (c) => {
  const b = await body(c, z.object({ name: z.string().min(1).max(48).optional(), color: z.string().max(20).nullable().optional() }));
  if (b.name) db().prepare('UPDATE tags SET name = ? WHERE id = ?').run(b.name.trim().toLowerCase(), id(c));
  if (b.color !== undefined) db().prepare('UPDATE tags SET color = ? WHERE id = ?').run(b.color, id(c));
  return ok(c);
});
api.delete('/tags/:id', (c) => {
  db().prepare('DELETE FROM tags WHERE id = ?').run(id(c));
  return ok(c);
});

// ================================================================ dashboard / today / intelligence
api.get('/dashboard', (c) => ok(c, I.dashboard()));
api.get('/badges', (c) => ok(c, I.badges()));
api.get('/today', (c) => ok(c, I.todayView()));
api.post('/today/queue', async (c) => {
  I.queueAdd((await body(c, z.object({ episodeIds: zIds }))).episodeIds);
  return ok(c);
});
api.put('/today/queue', async (c) => {
  I.queueOrder((await body(c, z.object({ episodeIds: z.array(z.number().int()) }))).episodeIds);
  return ok(c);
});
api.delete('/today/queue/:id', (c) => {
  I.queueRemove(id(c));
  return ok(c);
});
api.get('/next-actions', (c) => ok(c, I.nextActions()));
api.get('/bottleneck', (c) => ok(c, I.bottleneck(c.req.query('projectId') ? Number(c.req.query('projectId')) : undefined)));
api.get('/resurface', (c) => ok(c, I.resurface()));
api.get('/random-idea', (c) => ok(c, { id: I.randomIdea() }));
api.get('/activity', (c) =>
  ok(
    c,
    I.listActivity({
      limit: Number(c.req.query('limit') ?? 40),
      before: c.req.query('before') || undefined,
      episodeId: c.req.query('episodeId') ? Number(c.req.query('episodeId')) : undefined,
      projectId: c.req.query('projectId') ? Number(c.req.query('projectId')) : undefined,
    }),
  ),
);
api.get('/search', (c) => {
  const kinds = c.req.query('kinds')?.split(',').filter(Boolean) as never;
  return ok(c, I.search(c.req.query('q') ?? '', { kinds, limit: Number(c.req.query('limit') ?? 30) }));
});
api.post('/similar', async (c) => {
  const b = await body(c, z.object({ episodeId: z.number().int().optional(), text: z.string().max(5000).optional(), limit: z.number().int().max(30).optional() }));
  return ok(c, I.similarEpisodes(b));
});

api.get('/archive', (c) => ok(c, I.archiveAndTrash()));
api.post('/trash/:kind/:id/restore', (c) => {
  I.restoreFromTrash(c.req.param('kind'), id(c));
  return ok(c);
});
api.delete('/trash/:kind/:id', (c) => {
  I.purge(c.req.param('kind'), id(c));
  return ok(c);
});

// ================================================================ projects & series
const zProject = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(8),
  description: z.string().max(5000).optional(),
  goal: z.string().max(2000).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  targetCount: z.number().int().min(0).nullable().optional(),
  color: z.string().max(20).optional(),
  defaultContentTypeId: nullableId.optional(),
  notes: z.string().max(50000).optional(),
  tags: zTags.optional(),
});
api.get('/projects', (c) => ok(c, P.listProjects(c.req.query('archived') === '1')));
api.post('/projects', async (c) => ok(c, { id: P.createProject(await body(c, zProject)) }));
api.get('/projects/:id', (c) => ok(c, P.getProject(id(c))));
api.patch('/projects/:id', async (c) => {
  P.updateProject(id(c), await body(c, zProject.partial().extend({ archived: z.boolean().optional() })));
  return ok(c);
});
api.delete('/projects/:id', (c) => {
  P.deleteProject(id(c));
  return ok(c);
});

const zSeries = z.object({
  projectId: z.number().int().positive(),
  title: z.string().min(1).max(160),
  description: z.string().max(5000).optional(),
  targetCount: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(50000).optional(),
  tags: zTags.optional(),
});
api.get('/series', (c) => ok(c, P.listSeries({ projectId: c.req.query('projectId') ? Number(c.req.query('projectId')) : undefined, includeArchived: c.req.query('archived') === '1' })));
api.post('/series', async (c) => ok(c, { id: P.createSeries(await body(c, zSeries)) }));
api.get('/series/:id', (c) => ok(c, P.getSeries(id(c))));
api.patch('/series/:id', async (c) => {
  P.updateSeries(id(c), await body(c, zSeries.partial().extend({ archived: z.boolean().optional(), sortOrder: z.number().int().optional() })));
  return ok(c);
});
api.delete('/series/:id', (c) => {
  P.deleteSeries(id(c));
  return ok(c);
});

// ================================================================ episodes
api.post('/episodes/query', async (c) => ok(c, E.listEpisodes(await body(c, zQuery))));
api.post('/episodes/query-ids', async (c) => ok(c, { ids: E.listEpisodeIds(await body(c, zQuery)) }));
api.post('/episodes', async (c) => {
  const newId = E.createEpisode(await body(c, zEpisodeCreate));
  return ok(c, { id: newId });
});
api.get('/episodes/:id', (c) => ok(c, E.getEpisode(id(c))));
api.patch('/episodes/:id', async (c) => {
  E.updateEpisode(id(c), await body(c, zEpisodePatch));
  return ok(c, E.episodeItems([id(c)])[0] ?? null);
});
api.put('/episodes/:id/stages', async (c) => {
  const b = await body(c, z.object({ changes: z.array(z.object({ stage: zStage, status: zStatus, note: z.string().max(500).optional() })).min(1) }));
  const r = E.setStages(id(c), b.changes);
  return ok(c, { warnings: r.warnings, undo: { snapshot: r.snapshot, publicationIds: [] }, item: E.episodeItems([id(c)])[0] });
});
api.post('/episodes/:id/move', async (c) => {
  const b = await body(c, z.object({ phase: zPhase, scheduledAt: zIso.optional(), platform: zPlatform.optional(), account: z.string().max(100).optional() }));
  return ok(c, E.moveEpisode(id(c), b.phase, b));
});
api.post('/episodes/undo', async (c) => {
  const b = await body(c, z.object({ snapshot: zSnapshot, publicationIds: z.array(z.number().int()).default([]) }));
  return ok(c, E.restoreStages(b.snapshot, b.publicationIds));
});
api.post('/episodes/bulk', async (c) => {
  const b = await body(c, z.object({ ids: zIds, action: zBulkAction }));
  return ok(c, E.bulkEpisodes(b.ids, b.action));
});
api.post('/episodes/:id/duplicate', (c) => ok(c, { id: E.duplicateEpisode(id(c)) }));
api.post('/episodes/:id/archive', async (c) => {
  const b = await body(c, z.object({ archived: z.boolean() }));
  E.archiveEpisodes([id(c)], b.archived);
  return ok(c);
});
api.delete('/episodes/:id', (c) => {
  E.deleteEpisodes([id(c)]);
  return ok(c);
});

api.post('/episodes/:id/sources', async (c) => {
  const b = await body(c, z.object({ sourceIds: zIds, locator: z.string().max(200).optional() }));
  E.linkSources(id(c), b.sourceIds, b.locator);
  return ok(c);
});
api.delete('/episodes/:id/sources/:sourceId', (c) => {
  E.unlinkSource(id(c), id(c, 'sourceId'));
  return ok(c);
});
api.post('/episodes/:id/insights', async (c) => {
  E.linkInsight(id(c), (await body(c, z.object({ insightId: z.number().int().positive() }))).insightId);
  return ok(c);
});
api.delete('/episodes/:id/insights/:insightId', (c) => {
  E.unlinkInsight(id(c), id(c, 'insightId'));
  return ok(c);
});
api.post('/episodes/:id/relations', async (c) => {
  const b = await body(c, z.object({ otherId: z.number().int().positive(), kind: z.enum(RELATION_KINDS).default('RELATED') }));
  E.relate(id(c), b.otherId, b.kind);
  return ok(c);
});
api.delete('/episodes/:id/relations/:otherId', (c) => {
  E.unrelate(id(c), id(c, 'otherId'));
  return ok(c);
});
api.post('/episodes/:id/tasks', async (c) => {
  const b = await body(c, z.object({ title: z.string().min(1).max(300), stage: zStage.nullable().optional() }));
  return ok(c, { id: E.addTask(id(c), b.title, b.stage ?? null) });
});
api.patch('/tasks/:id', async (c) => {
  E.updateTask(id(c), await body(c, z.object({ title: z.string().min(1).max(300).optional(), done: z.boolean().optional() })));
  return ok(c);
});
api.delete('/tasks/:id', (c) => {
  E.deleteTask(id(c));
  return ok(c);
});

// ================================================================ publications & assets
const zPub = z.object({
  platform: zPlatform,
  account: z.string().max(100).optional(),
  status: z.enum(PUBLICATION_STATUSES).optional(),
  scheduledAt: zIso.nullable().optional(),
  publishedAt: zIso.nullable().optional(),
  url: z.string().max(2000).optional(),
  caption: z.string().max(10000).optional(),
  hashtags: z.string().max(2000).optional(),
  coverAssetId: nullableId.optional(),
  notes: z.string().max(10000).optional(),
});
api.post('/episodes/:id/publications', async (c) => ok(c, { id: Pub.createPublication(id(c), await body(c, zPub)) }));
api.patch('/publications/:id', async (c) => {
  Pub.updatePublication(id(c), await body(c, zPub.partial()));
  return ok(c);
});
api.delete('/publications/:id', (c) => {
  Pub.deletePublication(id(c));
  return ok(c);
});
const zNum = z.number().min(0).nullable().optional();
api.post('/publications/:id/metrics', async (c) => {
  const b = await body(c, z.object({ views: zNum, likes: zNum, comments: zNum, shares: zNum, saves: zNum, followers_gained: zNum, watch_time_sec: zNum, completion_rate: zNum }));
  return ok(c, { id: Pub.addMetrics(id(c), b) });
});

const zAsset = z.object({
  kind: z.enum(ASSET_KINDS),
  name: z.string().min(1).max(200),
  label: z.string().max(60).optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  stage: zStage.nullable().optional(),
  fileRef: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
});
const MAX_UPLOAD = 500 * 1024 * 1024;
api.post('/episodes/:id/assets', async (c) => {
  const epId = id(c);
  const ct = c.req.header('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    const form = await c.req.parseBody();
    const file = form.file;
    const meta = zAsset.parse({
      kind: form.kind,
      name: form.name || (file instanceof File ? file.name : ''),
      label: form.label || undefined,
      status: form.status || undefined,
      stage: form.stage || null,
      notes: form.notes || undefined,
      fileRef: typeof form.fileRef === 'string' ? form.fileRef : undefined,
    });
    if (file instanceof File) {
      if (file.size > MAX_UPLOAD) throw new HttpError(413, 'File is larger than 500 MB. Store it elsewhere and paste its path or URL instead.');
      E.episodeRow(epId);
      const saved = Pub.saveUpload(epId, file.name, Buffer.from(await file.arrayBuffer()));
      return ok(c, { id: Pub.createAsset(epId, { ...meta, fileRef: saved.fileRef }, { size: saved.size, mime: file.type || null }) });
    }
    return ok(c, { id: Pub.createAsset(epId, meta) });
  }
  return ok(c, { id: Pub.createAsset(epId, await body(c, zAsset)) });
});
api.patch('/assets/:id', async (c) => {
  Pub.updateAsset(id(c), await body(c, zAsset.partial()));
  return ok(c);
});
api.delete('/assets/:id', (c) => {
  Pub.deleteAsset(id(c));
  return ok(c);
});

// ================================================================ ideas
const zIdea = z.object({
  title: z.string().min(1).max(300),
  thought: z.string().max(20000).optional(),
  projectId: nullableId.optional(),
  seriesId: nullableId.optional(),
  sourceId: nullableId.optional(),
  insightId: nullableId.optional(),
  priority: zPriority.optional(),
  status: z.enum(IDEA_STATUSES).optional(),
  tags: zTags.optional(),
});
api.get('/ideas', (c) =>
  ok(
    c,
    L.listIdeas({
      view: (c.req.query('view') as L.IdeaView) ?? 'inbox',
      q: c.req.query('q'),
      projectId: c.req.query('projectId') ? Number(c.req.query('projectId')) : undefined,
      limit: Number(c.req.query('limit') ?? 100),
      offset: Number(c.req.query('offset') ?? 0),
    }),
  ),
);
api.post('/ideas', async (c) => ok(c, { id: L.createIdea(await body(c, zIdea)) }));
api.get('/ideas/:id', (c) => ok(c, L.getIdea(id(c))));
api.patch('/ideas/:id', async (c) => {
  L.updateIdea(id(c), await body(c, zIdea.partial().extend({ archived: z.boolean().optional(), snoozeDays: z.number().int().min(0).max(3650).nullable().optional(), touch: z.boolean().optional() })));
  return ok(c);
});
api.delete('/ideas/:id', (c) => {
  L.deleteIdea(id(c));
  return ok(c);
});
api.post('/ideas/:id/convert', async (c) => {
  const b = await body(c, z.object({ to: z.enum(['episode', 'series']), projectId: z.number().int().positive().optional(), seriesId: nullableId.optional(), contentTypeId: nullableId.optional(), title: z.string().max(300).optional() }));
  if (b.to === 'series') return ok(c, { seriesId: L.convertIdeaToSeries(id(c), b) });
  return ok(c, { episodeId: L.convertIdeaToEpisode(id(c), b) });
});

// ================================================================ sources, insights, people
const zSource = z.object({
  title: z.string().min(1).max(300),
  type: z.enum(SOURCE_TYPES),
  author: z.string().max(200).optional(),
  personId: nullableId.optional(),
  projectId: nullableId.optional(),
  description: z.string().max(20000).optional(),
  citation: z.string().max(500).optional(),
  url: z.string().max(2000).optional(),
  year: z.number().int().min(-3000).max(3000).nullable().optional(),
  status: z.enum(SOURCE_STATUSES).optional(),
  potential: z.number().int().min(0).max(100000).nullable().optional(),
  notes: z.string().max(50000).optional(),
  tags: zTags.optional(),
});
api.get('/sources', (c) =>
  ok(
    c,
    L.listSources({
      q: c.req.query('q'),
      type: c.req.query('type') || undefined,
      status: c.req.query('status') || undefined,
      projectId: c.req.query('projectId') ? Number(c.req.query('projectId')) : undefined,
      archived: c.req.query('archived') === '1',
      sort: c.req.query('sort'),
    }),
  ),
);
api.post('/sources', async (c) => ok(c, { id: L.createSource(await body(c, zSource)) }));
api.get('/sources/:id', (c) => ok(c, L.getSource(id(c))));
api.patch('/sources/:id', async (c) => {
  L.updateSource(id(c), await body(c, zSource.partial().extend({ archived: z.boolean().optional() })));
  return ok(c);
});
api.delete('/sources/:id', (c) => {
  L.deleteSource(id(c));
  return ok(c);
});
const zInsight = z.object({ statement: z.string().min(1).max(2000), detail: z.string().max(20000).optional(), locator: z.string().max(200).optional(), projectId: nullableId.optional() });
api.post('/sources/:id/insights', async (c) => ok(c, { id: L.createInsight({ ...(await body(c, zInsight)), sourceId: id(c) }) }));
api.post('/insights', async (c) => ok(c, { id: L.createInsight(await body(c, zInsight.extend({ sourceId: nullableId.optional() }))) }));
api.patch('/insights/:id', async (c) => {
  L.updateInsight(id(c), await body(c, zInsight.partial()));
  return ok(c);
});
api.delete('/insights/:id', (c) => {
  L.deleteInsight(id(c));
  return ok(c);
});
api.post('/insights/:id/idea', async (c) => ok(c, { id: L.ideaFromInsight(id(c), await body(c, z.object({ projectId: nullableId.optional(), title: z.string().max(300).optional() }))) }));

api.get('/people', (c) => ok(c, L.listPeople(c.req.query('q'))));
api.post('/people', async (c) => ok(c, { id: L.createPerson(await body(c, z.object({ name: z.string().min(1).max(200), kind: z.string().max(60).optional(), bio: z.string().max(5000).optional() }))) }));
api.patch('/people/:id', async (c) => {
  L.updatePerson(id(c), await body(c, z.object({ name: z.string().min(1).max(200).optional(), kind: z.string().max(60).optional(), bio: z.string().max(5000).optional(), notes: z.string().max(20000).optional() })));
  return ok(c);
});

api.notFound((c) => c.json({ error: `No API route for ${c.req.method} ${c.req.path}` }, 404));

export default api;
