import { beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../server/services/core';
import { bootstrap } from '../server/seed-data';
import api from '../server/api';

export interface Backend {
  name: string;
  /** Opens a fresh database and returns it (already migrated). */
  open: () => Promise<unknown>;
  /** Re-opens the persisted data independently and counts episodes. */
  reopenCount: () => Promise<number>;
}

/** Exercises the real HTTP API against a real SQLite database (Node file DB or the browser WASM build). */
export function apiSuite(backend: Backend) {

async function call<T = any>(method: string, url: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await api.request(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: (await res.json()) as T };
}
const ok = async <T = any>(method: string, url: string, body?: unknown) => {
  const r = await call<T>(method, url, body);
  if (r.status !== 200) throw new Error(`${method} ${url} → ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
};

let projectId: number;
let seriesId: number;
let episodeId: number;
let reelType: number;

beforeAll(async () => {
  setDb(await backend.open());
  bootstrap();
});

describe('projects, series, episodes', () => {
  it('creates a project and a series', async () => {
    projectId = (await ok('POST', '/projects', { name: 'Bible — 400 Human Stories', code: 'bib', targetCount: 400 })).id;
    seriesId = (await ok('POST', '/series', { projectId, title: 'Family' })).id;
    const meta = await ok('GET', '/meta');
    reelType = meta.contentTypes.find((c: any) => c.key === 'animated-reel').id;
    expect(meta.projects[0].code).toBe('BIB');
  });

  it('rejects duplicate project codes with a readable error', async () => {
    const r = await call('POST', '/projects', { name: 'Other', code: 'BIB' });
    expect(r.status).toBe(409);
    expect(r.data.error).toMatch(/already used/);
  });

  it('creates an episode with numbered code, stages and checklist', async () => {
    episodeId = (await ok('POST', '/episodes', { projectId, seriesId, contentTypeId: reelType, title: 'Joseph and the brothers who sold him', coreIdea: 'Favouritism plants betrayal', tags: ['Family', '#betrayal'] })).id;
    const d = await ok('GET', `/episodes/${episodeId}`);
    expect(d.episode.code).toBe('BIB-001');
    expect(d.stages).toHaveLength(11);
    expect(d.readiness.phase).toBe('IDEA');
    expect(d.episode.tags).toEqual(['betrayal', 'family']);
    expect(d.tasks.length).toBeGreaterThan(0);
  });

  it('validates input', async () => {
    const r = await call('POST', '/episodes', { projectId, title: '' });
    expect(r.status).toBe(400);
    const missing = await call('GET', '/episodes/99999');
    expect(missing.status).toBe(404);
  });
});

describe('production workflow', () => {
  it('stage changes are independent and recompute readiness', async () => {
    for (const stage of ['RESEARCH', 'CONCEPT', 'SCRIPT']) await ok('PUT', `/episodes/${episodeId}/stages`, { changes: [{ stage, status: 'DONE' }] });
    const r = await ok('PUT', `/episodes/${episodeId}/stages`, { changes: [{ stage: 'VISUAL', status: 'IN_PROGRESS' }] });
    expect(r.item.phase).toBe('VOICE');
    expect(r.item.actionable).toEqual(expect.arrayContaining(['VOICE', 'VISUAL', 'CAPTION', 'COVER']));
    const list = await ok('POST', '/episodes/query', { waitingFor: ['VOICE'] });
    expect(list.items.map((e: any) => e.id)).toContain(episodeId);
  });

  it('warns (but allows) out-of-order work', async () => {
    const r = await ok('PUT', `/episodes/${episodeId}/stages`, { changes: [{ stage: 'EDIT', status: 'IN_PROGRESS' }] });
    expect(r.warnings[0]).toMatch(/before Voice/);
    await ok('POST', '/episodes/undo', r.undo);
    const d = await ok('GET', `/episodes/${episodeId}`);
    expect(d.stages.find((s: any) => s.stage === 'EDIT').status).toBe('NOT_STARTED');
  });

  it('blocking requires nothing but records the reason', async () => {
    await ok('PUT', `/episodes/${episodeId}/stages`, { changes: [{ stage: 'VOICE', status: 'BLOCKED', note: 'Mic broken' }] });
    const blocked = await ok('POST', '/episodes/query', { blocked: true });
    expect(blocked.items[0].blockedNote).toBe('VOICE: Mic broken');
    await ok('PUT', `/episodes/${episodeId}/stages`, { changes: [{ stage: 'VOICE', status: 'DONE' }] });
  });

  it('board move to READY keeps parallel progress and can be undone', async () => {
    const r = await ok('POST', `/episodes/${episodeId}/move`, { phase: 'READY' });
    expect(r.phase).toBe('READY');
    await ok('POST', '/episodes/undo', r.undo);
    const d = await ok('GET', `/episodes/${episodeId}`);
    expect(d.readiness.phase).toBe('VISUAL');
    expect(d.stages.find((s: any) => s.stage === 'VOICE').status).toBe('DONE');
  });

  it('assets version instead of overwriting', async () => {
    await ok('POST', `/episodes/${episodeId}/assets`, { kind: 'VOICEOVER', name: 'vo', stage: 'VOICE', fileRef: 'D:/x/vo_v1.wav' });
    await ok('POST', `/episodes/${episodeId}/assets`, { kind: 'VOICEOVER', name: 'vo', stage: 'VOICE', fileRef: 'D:/x/vo_v2.wav', label: 'final' });
    const d = await ok('GET', `/episodes/${episodeId}`);
    expect(d.assets.map((a: any) => a.version)).toEqual([2, 1]);
  });

  it('publications drive release stages; one episode, many platforms', async () => {
    await ok('POST', `/episodes/${episodeId}/move`, { phase: 'READY' });
    const at = new Date(Date.now() + 86_400_000).toISOString();
    await ok('POST', `/episodes/${episodeId}/publications`, { platform: 'INSTAGRAM', status: 'SCHEDULED', scheduledAt: at });
    let d = await ok('GET', `/episodes/${episodeId}`);
    expect(d.readiness.phase).toBe('SCHEDULED');
    const pubId = d.publications[0].id;
    await ok('PATCH', `/publications/${pubId}`, { status: 'PUBLISHED' });
    await ok('POST', `/episodes/${episodeId}/publications`, { platform: 'TIKTOK', status: 'PUBLISHED' });
    d = await ok('GET', `/episodes/${episodeId}`);
    expect(d.readiness.phase).toBe('PUBLISHED');
    expect(d.publications).toHaveLength(2);
    const dash = await ok('GET', '/dashboard');
    expect(dash.today.published).toBe(1); // distinct episodes, not platform posts
    expect(dash.today.publications).toBe(2);
    expect(dash.counts.published).toBe(1);
  });
});

describe('bulk operations', () => {
  let ids: number[] = [];
  it('creates many and bulk-updates them', async () => {
    for (let i = 0; i < 12; i++) ids.push((await ok('POST', '/episodes', { projectId, title: `Bulk episode ${i}` })).id);
    await ok('POST', '/episodes/bulk', { ids, action: { type: 'priority', priority: 0 } });
    await ok('POST', '/episodes/bulk', { ids, action: { type: 'addTags', tags: ['batch'] } });
    const r = await ok('POST', '/episodes/bulk', { ids, action: { type: 'move', phase: 'VOICE' } });
    expect(r.affected).toBe(12);
    const q = await ok('POST', '/episodes/query', { tags: ['batch'], priorities: [0], phases: ['VOICE'] });
    expect(q.total).toBe(12);
    await ok('POST', '/episodes/undo', r.undo);
    const after = await ok('POST', '/episodes/query', { tags: ['batch'], phases: ['IDEA'] });
    expect(after.total).toBe(12);
  });

  it('schedules a batch at a cadence and archives/restores', async () => {
    await ok('POST', '/episodes/bulk', { ids: ids.slice(0, 4), action: { type: 'move', phase: 'READY' } });
    const r = await ok('POST', '/episodes/bulk', { ids: ids.slice(0, 4), action: { type: 'schedule', platform: 'YOUTUBE', startAt: new Date(Date.now() + 3_600_000).toISOString(), intervalMinutes: 72 } });
    expect(r.affected).toBe(4);
    expect((await ok('POST', '/episodes/query', { phases: ['SCHEDULED'] })).total).toBe(4);
    await ok('POST', '/episodes/bulk', { ids: ids.slice(8), action: { type: 'archive' } });
    expect((await ok('POST', '/episodes/query', { tags: ['batch'] })).total).toBe(8);
    expect((await ok('POST', '/episodes/query', { tags: ['batch'], archived: 'only' })).total).toBe(4);
    await ok('POST', '/episodes/bulk', { ids: ids.slice(8), action: { type: 'unarchive' } });
  });

  it('soft-deletes to trash and restores', async () => {
    await ok('POST', '/episodes/bulk', { ids: [ids[11]], action: { type: 'delete' } });
    expect((await call('GET', `/episodes/${ids[11]}`)).status).toBe(200); // still readable for restore
    expect((await ok('POST', '/episodes/query', { tags: ['batch'] })).total).toBe(11);
    await ok('POST', `/trash/episode/${ids[11]}/restore`);
    expect((await ok('POST', '/episodes/query', { tags: ['batch'] })).total).toBe(12);
  });
});

describe('ideas, sources and lineage', () => {
  it('source → insight → idea → episode is traceable both ways', async () => {
    const sourceId = (await ok('POST', '/sources', { title: 'Genesis', type: 'SCRIPTURE', citation: 'Genesis 1–50' })).id;
    const insightId = (await ok('POST', `/sources/${sourceId}/insights`, { statement: 'Envy grows fastest between people who are compared.' })).id;
    const ideaId = (await ok('POST', `/insights/${insightId}/idea`, { projectId })).id;
    const { episodeId: newEp } = await ok('POST', `/ideas/${ideaId}/convert`, { to: 'episode', title: 'Cain and Abel: the first comparison' });
    const d = await ok('GET', `/episodes/${newEp}`);
    expect(d.idea.id).toBe(ideaId);
    expect(d.idea.source_title).toBe('Genesis');
    expect(d.idea.insight_statement).toMatch(/Envy/);
    expect(d.sources[0].title).toBe('Genesis');
    const s = await ok('GET', `/sources/${sourceId}`);
    expect(s.episodes.map((e: any) => e.id)).toContain(newEp);
    expect(s.counts.insight_count).toBe(1);
    const idea = await ok('GET', `/ideas/${ideaId}`);
    expect(idea.idea.status).toBe('CONVERTED');
  });

  it('idea inbox views and resurfacing', async () => {
    await ok('POST', '/ideas', { title: 'Biblical siblings series', thought: 'Rivalry pattern' });
    const inbox = await ok('GET', '/ideas?view=inbox');
    expect(inbox.items.some((i: any) => i.title === 'Biblical siblings series')).toBe(true);
    const r = await ok('GET', '/resurface');
    expect(r).toHaveProperty('forgottenIdeas');
  });
});

describe('search, similarity, intelligence', () => {
  it('finds episodes by text, prefix and code', async () => {
    const hits = await ok('GET', '/search?q=joseph');
    expect(hits[0].kind).toBe('episode');
    const byCode = await ok('GET', '/search?q=BIB-001');
    expect(byCode[0].title).toMatch(/^BIB-001/);
    const prefix = await ok('POST', '/episodes/query', { q: 'broth' });
    expect(prefix.total).toBe(1);
  });

  it('flags likely duplicates', async () => {
    const sim = await ok('POST', '/similar', { text: 'brothers sold Joseph out of envy' });
    expect(sim[0].id).toBe(episodeId);
  });

  it('dashboard answers the core operational questions', async () => {
    const d = await ok('GET', '/dashboard');
    expect(d.counts.total).toBeGreaterThan(10);
    expect(d.bottleneck).toHaveProperty('flows');
    expect(Array.isArray(d.actions)).toBe(true);
    expect(d.projects[0].stats.target).toBe(400);
  });

  it('content type workflow changes recompute readiness', async () => {
    await ok('PATCH', `/content-types/${reelType}`, { modes: { COVER: 'NONE' } });
    const d = await ok('GET', `/episodes/${episodeId}`);
    expect(d.modes.COVER).toBe('NONE');
    await ok('PATCH', `/content-types/${reelType}`, { modes: { COVER: 'REQUIRED' } });
  });
});

describe(`persistence (${backend.name})`, () => {
  it('data survives reopening the database', async () => {
    expect(await backend.reopenCount()).toBeGreaterThan(10);
  });
});
}
