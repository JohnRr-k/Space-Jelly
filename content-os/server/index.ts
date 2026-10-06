import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';
import { openDb, DB_PATH, UPLOAD_DIR } from './db';
import { setDb } from './services/core';
import { bootstrap, seedDemo } from './seed-data';
import api from './api';

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 4317);
const PROD = process.env.NODE_ENV === 'production';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = openDb();
setDb(db);
const fresh = bootstrap();
if (fresh && !process.env.CONTENT_OS_NO_DEMO) {
  console.log('[seed] new database — loading demo content universe (set CONTENT_OS_NO_DEMO=1 to start empty)');
  seedDemo({ scale: 0 });
}

const app = new Hono();
// Full database backup (a standard SQLite file — also importable into the single-file app).
app.get('/api/export', () => {
  const bytes = db.serialize();
  const name = `content-os-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.sqlite`;
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/vnd.sqlite3', 'Content-Disposition': `attachment; filename="${name}"` } });
});
app.route('/api', api);

// Uploaded asset files
app.use(
  '/files/*',
  serveStatic({
    root: path.relative(process.cwd(), UPLOAD_DIR) || '.',
    rewriteRequestPath: (p) => p.replace(/^\/files/, ''),
  }),
);

if (PROD) {
  const dist = path.resolve('dist');
  if (!fs.existsSync(dist)) {
    console.error('dist/ not found — run `npm run build` first.');
    process.exit(1);
  }
  app.use('/*', serveStatic({ root: 'dist' }));
  const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  app.get('*', (c) => c.html(index));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[content-os] API on http://localhost:${info.port}/api  ·  db: ${DB_PATH}`);
  if (PROD) console.log(`[content-os] App on http://localhost:${info.port}`);
});

const shutdown = () => {
  try {
    db.close();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
