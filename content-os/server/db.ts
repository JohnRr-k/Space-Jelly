import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS } from './schema';

export type DB = Database.Database;

export const DATA_DIR = path.resolve(process.env.CONTENT_OS_DATA ?? path.join(process.cwd(), 'data'));
export const DB_PATH = process.env.CONTENT_OS_DB ?? path.join(DATA_DIR, 'content-os.db');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

export function openDb(file = DB_PATH): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const existed = file !== ':memory:' && fs.existsSync(file);
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  migrate(db, existed ? file : null);
  return db;
}

/** Applies pending migrations transactionally. Backs the database file up first (data safety). */
export function migrate(db: DB, fileForBackup: string | null) {
  const current = db.pragma('user_version', { simple: true }) as number;
  const pending = MIGRATIONS.filter((m) => m.version > current);
  if (!pending.length) return;
  if (fileForBackup && current > 0) {
    const dir = path.join(path.dirname(fileForBackup), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `content-os.v${current}.${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(fileForBackup, target);
    console.log(`[db] backed up v${current} → ${target}`);
  }
  for (const m of pending) {
    db.transaction(() => {
      db.exec(m.sql);
      db.pragma(`user_version = ${m.version}`);
    })();
    console.log(`[db] migrated to v${m.version} (${m.name})`);
  }
}

export const nowIso = () => new Date().toISOString();

/** The owner's local calendar day. Daily targets are about the owner's day, not UTC. */
export function localDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** UTC ISO bounds of a local day — used to count "published today". */
export function localDayBounds(day = localDay()) {
  const [y, m, d] = day.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
