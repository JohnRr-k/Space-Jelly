import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../server/db';
import { apiSuite } from './api-suite';

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cos-')), 'test.db');

apiSuite({
  name: 'node sqlite file',
  open: async () => openDb(file),
  reopenCount: async () => {
    const db2 = openDb(file);
    const n = (db2.prepare('SELECT count(*) AS c FROM episodes').get() as { c: number }).c;
    db2.close();
    return n;
  },
});
