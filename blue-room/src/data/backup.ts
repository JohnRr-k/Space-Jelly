/** Backup, restore, encrypted backup and readable (Markdown) exports. */
import { db } from './db';
import { formatDate } from '../lib/dates';
import type { Attachment, JournalEntry } from './types';

export const BACKUP_FORMAT = 'blue-room-backup';
export const BACKUP_VERSION = 1;

const DATA_TABLES = [
  'journal', 'notes', 'timeline', 'chapters', 'memories', 'odyssey', 'people', 'places', 'lessons', 'letters',
  'achievements', 'goals', 'events', 'customReminders', 'decisions', 'reflections', 'wisdom', 'relationships',
] as const;
const ALL_TABLES = [...DATA_TABLES, 'reminderState', 'settings', 'attachments'] as const;
export type TableName = (typeof ALL_TABLES)[number];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: 'The Blue Room';
  exportedAt: string;
  includesAttachments: boolean;
  tables: Record<string, any[]>;
}

export interface EncryptedBackupFile {
  format: 'blue-room-backup-encrypted';
  version: 1;
  exportedAt: string;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  data: string;
}

// ---------------------------------------------------------------- base64 helpers

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------- export

export async function buildBackup(opts: { includeAttachments: boolean }): Promise<BackupFile> {
  const tables: Record<string, any[]> = {};
  for (const name of [...DATA_TABLES, 'reminderState', 'settings'] as const) {
    tables[name] = await (db as any)[name].toArray();
  }
  if (opts.includeAttachments) {
    const rows: Attachment[] = await db.attachments.toArray();
    const out: any[] = [];
    for (const a of rows) {
      const buf = new Uint8Array(await a.blob.arrayBuffer());
      out.push({ id: a.id, name: a.name, mime: a.mime, size: a.size, createdAt: a.createdAt, data: bytesToB64(buf) });
    }
    tables.attachments = out;
  } else {
    tables.attachments = [];
  }
  return {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, app: 'The Blue Room',
    exportedAt: new Date().toISOString(), includesAttachments: opts.includeAttachments, tables,
  };
}

// ---------------------------------------------------------------- validation

export interface BackupSummary {
  counts: Record<string, number>;
  total: number;
  includesAttachments: boolean;
  exportedAt?: string;
}

export function validateBackup(obj: unknown): { ok: true; backup: BackupFile; summary: BackupSummary } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['This file isn’t a Blue Room backup.'] };
  const b = obj as any;
  if (b.format === 'blue-room-backup-encrypted') return { ok: false, errors: ['This backup is encrypted. Enter its passphrase to open it.'] };
  if (b.format !== BACKUP_FORMAT) errors.push('This file isn’t a Blue Room backup (unrecognised format).');
  if (typeof b.version !== 'number') errors.push('The backup has no version number.');
  else if (b.version > BACKUP_VERSION) errors.push(`This backup was made by a newer version (v${b.version}). Update the app first.`);
  if (!b.tables || typeof b.tables !== 'object') errors.push('The backup has no data tables.');
  if (errors.length) return { ok: false, errors };

  const counts: Record<string, number> = {};
  let total = 0;
  for (const name of ALL_TABLES) {
    const rows = b.tables[name];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) { errors.push(`“${name}” is not a list.`); continue; }
    const keyField = name === 'reminderState' ? 'key' : 'id';
    rows.forEach((r: any, i: number) => {
      if (!r || typeof r !== 'object' || typeof r[keyField] !== 'string' || !r[keyField]) {
        if (errors.length < 8) errors.push(`“${name}” row ${i + 1} has no ${keyField}.`);
      } else if (name === 'attachments' && typeof r.data !== 'string') {
        if (errors.length < 8) errors.push(`Attachment “${r.name ?? r.id}” has no file data.`);
      }
    });
    counts[name] = rows.length;
    total += rows.length;
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, backup: b as BackupFile, summary: { counts, total, includesAttachments: !!b.includesAttachments, exportedAt: b.exportedAt } };
}

// ---------------------------------------------------------------- import

export type ImportMode = 'merge' | 'replace';
export interface ImportResult { added: number; updated: number; skipped: number; keptRecordedDecisions: number }

export async function importBackup(backup: BackupFile, mode: ImportMode): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, keptRecordedDecisions: 0 };
  const tableObjs = ALL_TABLES.map((n) => (db as any)[n]);
  await db.transaction('rw', tableObjs, async () => {
    if (mode === 'replace') for (const t of tableObjs) await t.clear();
    for (const name of ALL_TABLES) {
      const rows: any[] | undefined = backup.tables[name];
      if (!rows?.length) continue;
      const table = (db as any)[name];
      const keyField = name === 'reminderState' ? 'key' : 'id';
      for (const raw of rows) {
        let row = raw;
        if (name === 'attachments') {
          const bytes = b64ToBytes(raw.data);
          row = { id: raw.id, name: raw.name, mime: raw.mime, size: bytes.length, createdAt: raw.createdAt, blob: new Blob([bytes as BlobPart], { type: raw.mime }) };
        }
        const existing = await table.get(row[keyField]);
        if (!existing) { await table.put(row); result.added++; continue; }
        if (mode === 'replace') { await table.put(row); result.added++; continue; }
        // merge: never touch a recorded decision; otherwise newest wins
        if (name === 'decisions' && existing.status === 'recorded') { result.keptRecordedDecisions++; result.skipped++; continue; }
        if (name === 'attachments' || name === 'relationships' || name === 'reminderState') { result.skipped++; continue; }
        if ((row.updatedAt ?? 0) > (existing.updatedAt ?? 0)) { await table.put(row); result.updated++; } else result.skipped++;
      }
    }
  });
  return result;
}

export async function wipeEverything(): Promise<void> {
  const tableObjs = ALL_TABLES.map((n) => (db as any)[n]);
  await db.transaction('rw', tableObjs, async () => { for (const t of tableObjs) await t.clear(); });
}

// ---------------------------------------------------------------- encryption (WebCrypto AES-GCM + PBKDF2)

const PBKDF2_ITERATIONS = 250_000;

async function deriveKey(pass: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptBackup(backup: BackupFile, passphrase: string): Promise<EncryptedBackupFile> {
  if (passphrase.length < 8) throw new Error('Use a passphrase of at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plain = new TextEncoder().encode(JSON.stringify(backup));
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain));
  return {
    format: 'blue-room-backup-encrypted', version: 1, exportedAt: backup.exportedAt,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: bytesToB64(salt) },
    cipher: { name: 'AES-GCM', iv: bytesToB64(iv) },
    data: bytesToB64(enc),
  };
}

export async function decryptBackup(file: EncryptedBackupFile, passphrase: string): Promise<unknown> {
  try {
    const key = await deriveKey(passphrase, b64ToBytes(file.kdf.salt), file.kdf.iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(file.cipher.iv) as BufferSource }, key, b64ToBytes(file.data) as BufferSource);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error('That passphrase didn’t work, or the file is damaged.');
  }
}

// ---------------------------------------------------------------- Markdown

export function journalToMarkdown(entries: JournalEntry[], dateFormat: 'MDY' | 'DMY' | 'ISO' = 'ISO'): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const out: string[] = ['# Journal', '', `_Exported from The Blue Room on ${new Date().toISOString().slice(0, 10)} · ${sorted.length} entries_`, ''];
  let lastYear = '';
  for (const e of sorted) {
    const year = e.date.slice(0, 4);
    if (year !== lastYear) { out.push(`## ${year}`, ''); lastYear = year; }
    out.push(`### ${e.title || 'Untitled'} — ${formatDate(e.date, dateFormat, { weekday: dateFormat !== 'ISO' })}`);
    const meta = [e.category, e.status === 'draft' ? 'draft' : '', e.tags.length ? e.tags.map((t) => `#${t.replace(/\s+/g, '-')}`).join(' ') : ''].filter(Boolean);
    if (meta.length) out.push(`_${meta.join(' · ')}_`);
    out.push('', e.body.trim(), '');
    if (e.attachmentIds.length) out.push(`_${e.attachmentIds.length} attached file(s) — included in the full JSON backup._`, '');
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- download helper (browser)

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
