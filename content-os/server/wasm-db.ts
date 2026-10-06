/**
 * Adapts the official SQLite WebAssembly build (`@sqlite.org/sqlite-wasm`, which includes FTS5)
 * to the small better-sqlite3-shaped interface the services use. This lets the single-file
 * browser build run the exact same services, schema and triggers as the Node server.
 */
import type { DB, Statement } from './services/core';
import { MIGRATIONS } from './schema';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sqlite3 = any;
type OoDb = any;
type OoStmt = any;

const MAX_CACHED = 400;

export class WasmDb implements DB {
  private cache = new Map<string, OoStmt>();
  private depth = 0;

  constructor(
    public sqlite3: Sqlite3,
    public db: OoDb,
  ) {
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  /** Opens an in-memory database, optionally loaded from previously exported bytes. */
  static open(sqlite3: Sqlite3, bytes?: Uint8Array | null) {
    const db = new sqlite3.oo1.DB(':memory:', 'c');
    if (bytes && bytes.length) {
      const { capi, wasm } = sqlite3;
      const p = wasm.allocFromTypedArray(bytes);
      const rc = capi.sqlite3_deserialize(db.pointer, 'main', p, bytes.length, bytes.length, capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE);
      db.checkRc(rc);
    }
    return new WasmDb(sqlite3, db);
  }

  private stmt(sql: string): OoStmt {
    let s = this.cache.get(sql);
    if (s) {
      this.cache.delete(sql); // refresh LRU position
    } else {
      s = this.db.prepare(sql);
      if (this.cache.size >= MAX_CACHED) {
        const [oldSql, old] = this.cache.entries().next().value as [string, OoStmt];
        this.cache.delete(oldSql);
        old.finalize();
      }
    }
    this.cache.set(sql, s);
    return s;
  }

  private bound(sql: string, params: unknown[]) {
    const s = this.stmt(sql);
    s.reset(true);
    if (params.length) s.bind(params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p)));
    return s;
  }

  prepare(sql: string): Statement {
    const self = this;
    return {
      get(...params: unknown[]) {
        const s = self.bound(sql, params);
        try {
          return s.step() ? s.get({}) : undefined;
        } finally {
          s.reset(true);
        }
      },
      all(...params: unknown[]) {
        const s = self.bound(sql, params);
        const out: unknown[] = [];
        try {
          while (s.step()) out.push(s.get({}));
        } finally {
          s.reset(true);
        }
        return out;
      },
      run(...params: unknown[]) {
        const s = self.bound(sql, params);
        try {
          while (s.step()) {
            /* drain */
          }
        } finally {
          s.reset(true);
        }
        const { capi } = self.sqlite3;
        return { changes: Number(capi.sqlite3_changes(self.db.pointer)), lastInsertRowid: Number(capi.sqlite3_last_insert_rowid(self.db.pointer)) };
      },
      raw() {
        return {
          get(...params: unknown[]) {
            const s = self.bound(sql, params);
            try {
              return s.step() ? s.get([]) : undefined;
            } finally {
              s.reset(true);
            }
          },
        };
      },
    };
  }

  exec(sql: string) {
    this.db.exec(sql);
    return this;
  }

  /** Same semantics as better-sqlite3: nested transactions become savepoints. */
  transaction<T>(fn: () => T): () => T {
    return () => {
      const level = this.depth++;
      const sp = `sp${level}`;
      this.db.exec(level === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`);
      try {
        const result = fn();
        this.db.exec(level === 0 ? 'COMMIT' : `RELEASE ${sp}`);
        return result;
      } catch (e) {
        try {
          this.db.exec(level === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
        } catch {
          /* already rolled back */
        }
        throw e;
      } finally {
        this.depth--;
      }
    };
  }

  userVersion(): number {
    return Number(this.db.selectValue('PRAGMA user_version') ?? 0);
  }

  migrate() {
    const current = this.userVersion();
    for (const m of MIGRATIONS.filter((x) => x.version > current)) {
      this.transaction(() => {
        this.db.exec(m.sql);
        this.db.exec(`PRAGMA user_version = ${m.version}`);
      })();
    }
  }

  /** Serialises the whole database to bytes (for persistence and export). */
  export(): Uint8Array {
    return this.sqlite3.capi.sqlite3_js_db_export(this.db);
  }

  close() {
    for (const s of this.cache.values()) s.finalize();
    this.cache.clear();
    this.db.close();
  }
}
