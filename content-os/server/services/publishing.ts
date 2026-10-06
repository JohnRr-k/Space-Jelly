/** Publications (one episode → many platforms), analytics snapshots and assets (versioned files). */
import fs from 'node:fs';
import path from 'node:path';
import { STAGE_META, PLATFORM_LABEL, type Platform, type Stage } from '../../shared/domain';
import { nowIso, UPLOAD_DIR } from '../db';
import { db, tx, notFound, invalid, logActivity, buildUpdate } from './core';
import { episodeRow, recomputeEpisodes, setStages } from './episodes';

// =============================================================== publications

export interface PublicationInput {
  platform: Platform;
  account?: string;
  status?: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  url?: string;
  caption?: string;
  hashtags?: string;
  coverAssetId?: number | null;
  notes?: string;
}

interface PubRow {
  id: number;
  episode_id: number;
  platform: Platform;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  deleted_at: string | null;
}

/** Keeps SCHEDULE / PUBLISH stage state consistent with publication records. */
function syncReleaseStages(episodeId: number) {
  const c = db()
    .prepare(`SELECT sum(status = 'PUBLISHED') AS pubs, sum(status = 'SCHEDULED') AS sched FROM publications WHERE episode_id = ? AND deleted_at IS NULL`)
    .get(episodeId) as { pubs: number | null; sched: number | null };
  const st = Object.fromEntries(
    (db().prepare(`SELECT stage, status FROM episode_stages WHERE episode_id = ? AND stage IN ('SCHEDULE','PUBLISH')`).all(episodeId) as { stage: Stage; status: string }[]).map((r) => [r.stage, r.status]),
  );
  const changes: { stage: Stage; status: 'DONE' }[] = [];
  if ((c.pubs ?? 0) > 0 && st.PUBLISH !== 'DONE') changes.push({ stage: 'PUBLISH', status: 'DONE' });
  if (((c.sched ?? 0) > 0 || (c.pubs ?? 0) > 0) && st.SCHEDULE !== 'DONE' && st.SCHEDULE !== 'SKIPPED') changes.push({ stage: 'SCHEDULE', status: 'DONE' });
  if (changes.length) setStages(episodeId, changes, { log: false });
  recomputeEpisodes([episodeId]);
}

function normalise(input: Partial<PublicationInput>, before?: PubRow) {
  const out: Record<string, unknown> = { ...input };
  const status = input.status ?? before?.status;
  if (status === 'PUBLISHED' && !(input.publishedAt ?? before?.published_at)) out.publishedAt = nowIso();
  if (status === 'SCHEDULED' && !(input.scheduledAt ?? before?.scheduled_at)) throw invalid('A scheduled publication needs a date and time.');
  return out;
}

const PUB_COLUMNS = {
  platform: 'platform',
  account: 'account',
  status: 'status',
  scheduledAt: 'scheduled_at',
  publishedAt: 'published_at',
  url: 'url',
  caption: 'caption',
  hashtags: 'hashtags',
  coverAssetId: 'cover_asset_id',
  notes: 'notes',
};

export function createPublication(episodeId: number, input: PublicationInput) {
  return tx(() => {
    const e = episodeRow(episodeId);
    const p = normalise({ status: 'DRAFT', ...input });
    const cols = Object.entries(PUB_COLUMNS).filter(([k]) => p[k] !== undefined);
    const id = Number(
      db()
        .prepare(`INSERT INTO publications (episode_id, ${cols.map(([, c]) => c).join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`)
        .run(episodeId, ...cols.map(([k]) => p[k])).lastInsertRowid,
    );
    syncReleaseStages(episodeId);
    const status = String(p.status);
    logActivity({
      action: status === 'PUBLISHED' ? 'published' : status === 'SCHEDULED' ? 'scheduled' : 'publication',
      entityType: 'publication',
      entityId: id,
      episodeId,
      projectId: e.project_id,
      summary:
        status === 'PUBLISHED'
          ? `Published “${e.title}” on ${PLATFORM_LABEL[input.platform]}`
          : status === 'SCHEDULED'
            ? `Scheduled “${e.title}” on ${PLATFORM_LABEL[input.platform]}`
            : `${PLATFORM_LABEL[input.platform]} publication drafted for “${e.title}”`,
    });
    return id;
  });
}

export function updatePublication(id: number, patch: Partial<PublicationInput>) {
  return tx(() => {
    const before = db().prepare('SELECT * FROM publications WHERE id = ?').get(id) as PubRow | undefined;
    if (!before || before.deleted_at) throw notFound('Publication', id);
    const p = normalise(patch, before);
    const { sets, vals } = buildUpdate(p, PUB_COLUMNS);
    if (sets.length) db().prepare(`UPDATE publications SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), id);
    syncReleaseStages(before.episode_id);
    if (patch.status && patch.status !== before.status) {
      const e = episodeRow(before.episode_id);
      logActivity({
        action: patch.status === 'PUBLISHED' ? 'published' : patch.status === 'SCHEDULED' ? 'scheduled' : 'publication',
        entityType: 'publication',
        entityId: id,
        episodeId: e.id,
        projectId: e.project_id,
        summary: `${PLATFORM_LABEL[before.platform]} publication of “${e.title}” → ${patch.status.toLowerCase()}`,
      });
    }
  });
}

export function deletePublication(id: number) {
  return tx(() => {
    const p = db().prepare('SELECT * FROM publications WHERE id = ?').get(id) as PubRow | undefined;
    if (!p) throw notFound('Publication', id);
    db().prepare('UPDATE publications SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
    recomputeEpisodes([p.episode_id]);
  });
}

export function addMetrics(publicationId: number, m: Record<string, number | null | undefined>) {
  const p = db().prepare('SELECT id FROM publications WHERE id = ? AND deleted_at IS NULL').get(publicationId);
  if (!p) throw notFound('Publication', publicationId);
  const cols = ['views', 'likes', 'comments', 'shares', 'saves', 'followers_gained', 'watch_time_sec', 'completion_rate'];
  const keys = cols.filter((c) => m[c] !== undefined && m[c] !== null);
  if (!keys.length) throw invalid('Enter at least one metric.');
  return Number(
    db()
      .prepare(`INSERT INTO publication_metrics (publication_id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`)
      .run(publicationId, ...keys.map((k) => m[k])).lastInsertRowid,
  );
}

// =============================================================== assets

export interface AssetInput {
  kind: string;
  name: string;
  label?: string;
  status?: string;
  stage?: Stage | null;
  fileRef?: string;
  notes?: string;
}

interface AssetRow {
  id: number;
  episode_id: number;
  kind: string;
  name: string;
  version: number;
  label: string;
  status: string;
  stage: Stage | null;
  file_ref: string;
  deleted_at: string | null;
}

export function saveUpload(episodeId: number, fileName: string, data: Buffer) {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-120) || 'file';
  const dir = path.join(UPLOAD_DIR, String(episodeId));
  fs.mkdirSync(dir, { recursive: true });
  const stored = `${Date.now()}-${safe}`;
  fs.writeFileSync(path.join(dir, stored), data);
  return { fileRef: `/files/${episodeId}/${stored}`, size: data.length };
}

export function createAsset(episodeId: number, input: AssetInput, file?: { size: number; mime: string | null }) {
  return tx(() => {
    const e = episodeRow(episodeId);
    if (!input.name.trim()) throw invalid('Asset name is required.');
    // Same kind + name → next version; never overwrite an existing version.
    const v = (db().prepare('SELECT coalesce(max(version), 0) + 1 AS v FROM assets WHERE episode_id = ? AND kind = ? AND name = ?').get(episodeId, input.kind, input.name.trim()) as { v: number }).v;
    const id = Number(
      db()
        .prepare('INSERT INTO assets (episode_id, kind, name, version, label, status, stage, file_ref, file_size, mime, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(episodeId, input.kind, input.name.trim(), v, input.label ?? '', input.status ?? 'DRAFT', input.stage ?? null, input.fileRef ?? '', file?.size ?? null, file?.mime ?? null, input.notes ?? '').lastInsertRowid,
    );
    db().prepare('UPDATE episodes SET updated_at = ? WHERE id = ?').run(nowIso(), episodeId);
    logActivity({
      action: 'asset',
      entityType: 'asset',
      entityId: id,
      episodeId,
      projectId: e.project_id,
      summary: `${e.title}: ${input.kind.toLowerCase().replace('_', ' ')} “${input.name.trim()}” v${v} attached${input.stage ? ` (${STAGE_META[input.stage].label})` : ''}`,
    });
    return id;
  });
}

export function updateAsset(id: number, patch: Partial<AssetInput>) {
  const a = db().prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | undefined;
  if (!a || a.deleted_at) throw notFound('Asset', id);
  const { sets, vals } = buildUpdate(patch as Record<string, unknown>, { label: 'label', status: 'status', stage: 'stage', fileRef: 'file_ref', notes: 'notes' });
  if (sets.length) db().prepare(`UPDATE assets SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), id);
  if (patch.status && patch.status !== a.status && (patch.status === 'APPROVED' || patch.status === 'FINAL')) {
    const e = episodeRow(a.episode_id);
    logActivity({ action: 'asset', entityType: 'asset', entityId: id, episodeId: e.id, projectId: e.project_id, summary: `${e.title}: ${a.name} v${a.version} ${patch.status.toLowerCase()}` });
  }
}

export function deleteAsset(id: number) {
  const a = db().prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | undefined;
  if (!a) throw notFound('Asset', id);
  db().prepare('UPDATE assets SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
}
