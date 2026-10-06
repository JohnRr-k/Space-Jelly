import { HttpError } from '../../../server/services/core';

/** The single-file app has no disk access: assets are referenced by path or URL instead. */
export function saveUpload(): { fileRef: string; size: number } {
  throw new HttpError(400, 'File upload isn’t available in the single-file version. Paste the file’s path or a link instead — the file stays where it is.');
}
