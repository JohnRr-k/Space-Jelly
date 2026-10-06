/**
 * Single-file build entry. Runs the real API (same services, schema, FTS triggers) in the page on
 * SQLite WebAssembly, and persists the database to IndexedDB after every change.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hono } from 'hono';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import wasmBase64 from 'virtual:sqlite-wasm';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../styles.css';
import { ToastProvider } from '../components/toast';
import { App } from '../App';
import { WasmDb } from '../../server/wasm-db';
import { setDb } from '../../server/services/core';
import { invalidateContentTypes } from '../../server/services/config';
import { bootstrap, seedDemo } from '../../server/seed-data';
import api from '../../server/api';
import { idbDelete, idbGet, idbSet } from './persist';
import { downloadBytes, setDataControls } from '../lib/dataControls';

const KEY = 'database';
const rootEl = document.getElementById('root')!;

function splash(message: string, error = false) {
  rootEl.innerHTML = `<div style="min-height:100dvh;display:grid;place-items:center;font:14px system-ui,sans-serif;color:${error ? '#b42318' : '#667'};padding:24px;text-align:center;max-width:560px;margin:auto">${message}</div>`;
}

function decodeBase64(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function boot() {
  splash('Loading Content OS…');
  const sqlite3 = await (sqlite3InitModule as unknown as (o: object) => Promise<any>)({ wasmBinary: decodeBase64(wasmBase64), print: () => {}, printErr: () => {} });

  let storageOk = true;
  let saved: Uint8Array | undefined;
  try {
    saved = await idbGet<Uint8Array>(KEY);
  } catch {
    storageOk = false;
  }
  let db = WasmDb.open(sqlite3, saved ?? null);
  const attach = (fresh: WasmDb, seed: 'demo' | 'empty' | null) => {
    fresh.migrate();
    setDb(fresh);
    invalidateContentTypes();
    const isNew = bootstrap();
    if (isNew && seed === 'demo') seedDemo({ scale: 0 });
  };
  attach(db, saved ? null : 'demo');

  let persistent: boolean | null = null;
  navigator.storage?.persist?.().then((p) => (persistent = p)).catch(() => {});

  // ---------------------------------------------------------------- persistence
  let lastSavedAt: string | null = saved ? new Date().toISOString() : null;
  let timer: number | undefined;
  const persistNow = async () => {
    window.clearTimeout(timer);
    if (!storageOk) return;
    try {
      await idbSet(KEY, db.export());
      lastSavedAt = new Date().toISOString();
    } catch (e) {
      storageOk = false;
      console.error('Could not save to browser storage', e);
    }
  };
  const schedulePersist = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(persistNow, 300);
  };
  if (!saved) await persistNow();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persistNow());
  window.addEventListener('pagehide', () => void persistNow());

  // ---------------------------------------------------------------- in-page API
  const app = new Hono();
  app.route('/api', api);
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('/api/')) {
      const req = new Request(new URL(url, 'http://content-os.local'), init);
      const res = await app.fetch(req);
      if (req.method !== 'GET') schedulePersist();
      return res;
    }
    return realFetch(input, init);
  };

  // ---------------------------------------------------------------- backup controls
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  setDataControls({
    mode: 'standalone',
    exportDb: async () => downloadBytes(db.export(), `content-os-${stamp()}.sqlite`),
    importDb: async (file: File) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const header = new TextDecoder().decode(bytes.slice(0, 15));
      if (header !== 'SQLite format 3') throw new Error('That file is not a Content OS / SQLite database.');
      const next = WasmDb.open(sqlite3, bytes);
      const ok = next.prepare("SELECT count(*) AS c FROM sqlite_master WHERE name = 'episodes'").get() as { c: number };
      if (!ok.c) {
        next.close();
        throw new Error('That database does not contain Content OS data.');
      }
      downloadBytes(db.export(), `content-os-before-import-${stamp()}.sqlite`); // safety copy
      db.close();
      db = next;
      attach(db, null);
      await persistNow();
      location.reload();
    },
    reset: async (to) => {
      downloadBytes(db.export(), `content-os-before-reset-${stamp()}.sqlite`); // safety copy
      db.close();
      db = WasmDb.open(sqlite3, null);
      attach(db, to);
      await idbDelete(KEY).catch(() => {});
      await persistNow();
      location.reload();
    },
    status: () => ({ lastSavedAt, persistent, storageOk }),
  });

  // ---------------------------------------------------------------- render
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 0, refetchOnWindowFocus: false } } });
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </HashRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

boot().catch((e) => {
  console.error(e);
  splash(`Content OS could not start: ${(e as Error).message}. Try a current version of Chrome, Edge, Firefox or Safari.`, true);
});
