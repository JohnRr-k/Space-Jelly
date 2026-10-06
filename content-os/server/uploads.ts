/** Stores uploaded asset files on disk (server build only; the single-file build swaps this module). */
import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from './db';

export function saveUpload(episodeId: number, fileName: string, data: Buffer) {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-120) || 'file';
  const dir = path.join(UPLOAD_DIR, String(episodeId));
  fs.mkdirSync(dir, { recursive: true });
  const stored = `${Date.now()}-${safe}`;
  fs.writeFileSync(path.join(dir, stored), data);
  return { fileRef: `/files/${episodeId}/${stored}`, size: data.length };
}
