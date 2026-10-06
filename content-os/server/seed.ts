/**
 * Resets the database and loads demo data.
 *   npm run seed                 → demo content universe (~110 curated episodes)
 *   npm run seed -- --scale 5000 → demo + 5,000 synthetic episodes (performance testing)
 *   npm run seed -- --empty      → clean database with only base configuration
 * The previous database file is moved to data/backups/ first — nothing is destroyed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { openDb, DB_PATH } from './db';
import { setDb } from './services/core';
import { bootstrap, seedDemo } from './seed-data';

const args = process.argv.slice(2);
const scaleIdx = args.indexOf('--scale');
const scale = scaleIdx >= 0 ? Number(args[scaleIdx + 1] ?? 1000) : 0;
const empty = args.includes('--empty');

if (fs.existsSync(DB_PATH)) {
  const dir = path.join(path.dirname(DB_PATH), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const ext of ['', '-wal', '-shm']) {
    if (fs.existsSync(DB_PATH + ext)) fs.renameSync(DB_PATH + ext, path.join(dir, `content-os.before-seed.${stamp}.db${ext}`));
  }
  console.log(`[seed] previous database moved to ${dir}`);
}

const t0 = Date.now();
const db = openDb();
setDb(db);
bootstrap();
if (!empty) {
  const r = seedDemo({ scale });
  console.log(`[seed] ${r.episodes} episodes in ${Date.now() - t0} ms`);
} else console.log('[seed] empty database ready');
db.close();
