import { AsyncLocalStorage } from 'node:async_hooks';
import { nowIso } from '../time';

// ---------------------------------------------------------------- database handle
/**
 * The subset of the better-sqlite3 API the services use. The server passes a real better-sqlite3
 * connection; the single-file browser build passes a SQLite-WASM adapter with the same shape.
 */
export interface Statement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  raw(): { get(...params: unknown[]): unknown };
}
export interface DB {
  prepare(sql: string): Statement;
  exec(sql: string): unknown;
  transaction<T>(fn: () => T): () => T;
}

let _db: DB | null = null;
export function setDb(db: unknown) {
  _db = db as DB;
}
export function db(): DB {
  if (!_db) throw new Error('Database not initialised');
  return _db;
}
export function tx<T>(fn: () => T): T {
  return db().transaction(fn)();
}

// ---------------------------------------------------------------- errors
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}
export const notFound = (what: string, id: number | string) => new HttpError(404, `${what} #${id} does not exist (it may have been deleted).`);
export const conflict = (msg: string) => new HttpError(409, msg);
export const invalid = (msg: string) => new HttpError(400, msg);

// ---------------------------------------------------------------- actor (who made a change)
const actorStore = new AsyncLocalStorage<string>();
export const withActor = <T>(actor: string, fn: () => T) => actorStore.run(actor, fn);
export const currentActor = () => actorStore.getStore() ?? 'you';

// ---------------------------------------------------------------- activity log
export interface ActivityInput {
  action: string;
  entityType: string;
  entityId: number;
  episodeId?: number | null;
  projectId?: number | null;
  summary: string;
  data?: unknown;
}
export function logActivity(a: ActivityInput) {
  db()
    .prepare(
      `INSERT INTO activity (at, actor, action, entity_type, entity_id, episode_id, project_id, summary, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(nowIso(), currentActor(), a.action, a.entityType, a.entityId, a.episodeId ?? null, a.projectId ?? null, a.summary, a.data === undefined ? null : JSON.stringify(a.data));
}

// ---------------------------------------------------------------- tags
export type TagTable = 'episode_tags' | 'idea_tags' | 'source_tags' | 'series_tags' | 'project_tags';
const TAG_FK: Record<TagTable, string> = {
  episode_tags: 'episode_id',
  idea_tags: 'idea_id',
  source_tags: 'source_id',
  series_tags: 'series_id',
  project_tags: 'project_id',
};

export function normaliseTag(name: string) {
  return name.trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase().slice(0, 48);
}

export function ensureTags(names: string[]): number[] {
  const ids: number[] = [];
  const sel = db().prepare('SELECT id FROM tags WHERE name = ?');
  const ins = db().prepare('INSERT INTO tags (name) VALUES (?)');
  for (const raw of names) {
    const name = normaliseTag(raw);
    if (!name) continue;
    const row = sel.get(name) as { id: number } | undefined;
    ids.push(row ? row.id : Number(ins.run(name).lastInsertRowid));
  }
  return [...new Set(ids)];
}

export function setTags(table: TagTable, id: number, names: string[]) {
  const fk = TAG_FK[table];
  db().prepare(`DELETE FROM ${table} WHERE ${fk} = ?`).run(id);
  addTags(table, [id], names);
}

export function addTags(table: TagTable, ids: number[], names: string[]) {
  const fk = TAG_FK[table];
  const tagIds = ensureTags(names);
  const ins = db().prepare(`INSERT OR IGNORE INTO ${table} (${fk}, tag_id) VALUES (?, ?)`);
  for (const id of ids) for (const t of tagIds) ins.run(id, t);
}

export function removeTags(table: TagTable, ids: number[], names: string[]) {
  const fk = TAG_FK[table];
  const del = db().prepare(`DELETE FROM ${table} WHERE ${fk} = ? AND tag_id = (SELECT id FROM tags WHERE name = ?)`);
  for (const id of ids) for (const n of names) del.run(id, normaliseTag(n));
}

export function tagsFor(table: TagTable, ids: number[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  if (!ids.length) return out;
  const fk = TAG_FK[table];
  const rows = db()
    .prepare(`SELECT x.${fk} AS id, t.name FROM ${table} x JOIN tags t ON t.id = x.tag_id WHERE x.${fk} IN (${placeholders(ids)}) ORDER BY t.name`)
    .all(...ids) as { id: number; name: string }[];
  for (const r of rows) {
    const arr = out.get(r.id) ?? [];
    arr.push(r.name);
    out.set(r.id, arr);
  }
  return out;
}

// ---------------------------------------------------------------- settings
export const DEFAULT_SETTINGS = {
  daily_target: '10',
  dormant_idea_days: '30',
  stuck_episode_days: '14',
  quiet_project_days: '14',
  default_account: '@growmindset',
};
export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export function getSettings(): Record<SettingKey, string> {
  const rows = db().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const out = { ...DEFAULT_SETTINGS } as Record<SettingKey, string>;
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
}
export function settingNum(key: SettingKey) {
  const v = Number(getSettings()[key]);
  return Number.isFinite(v) ? v : Number(DEFAULT_SETTINGS[key]);
}
export function updateSettings(patch: Partial<Record<SettingKey, string>>) {
  const up = db().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_SETTINGS && v !== undefined) up.run(k, String(v));
  return getSettings();
}

// ---------------------------------------------------------------- misc helpers
export const placeholders = (arr: unknown[]) => arr.map(() => '?').join(',');

/** Builds `SET a = ?, b = ?` from a patch, only for whitelisted columns. */
export function buildUpdate(patch: Record<string, unknown>, columns: Record<string, string>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [key, col] of Object.entries(columns)) {
    if (key in patch && patch[key] !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(patch[key]);
    }
  }
  return { sets, vals };
}

export function daysBetween(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}
