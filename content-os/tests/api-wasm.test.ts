import fs from 'node:fs';
import path from 'node:path';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { WasmDb } from '../server/wasm-db';
import { apiSuite } from './api-suite';

/** Same API suite, running on the SQLite WebAssembly build used by the single-file app. */
let sqlite3: any;
let db: WasmDb;

apiSuite({
  name: 'sqlite wasm (single-file build)',
  open: async () => {
    const wasmBinary = fs.readFileSync(path.resolve('node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm'));
    sqlite3 = await (sqlite3InitModule as any)({ wasmBinary, print: () => {}, printErr: () => {} });
    db = WasmDb.open(sqlite3);
    db.migrate();
    return db;
  },
  reopenCount: async () => {
    const copy = WasmDb.open(sqlite3, db.export());
    const n = (copy.prepare('SELECT count(*) AS c FROM episodes').get() as { c: number }).c;
    copy.close();
    return n;
  },
});
