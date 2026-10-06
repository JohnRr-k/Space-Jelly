/** Backup/restore hooks. The server build only exports; the single-file build can also import and reset. */
export interface DataControls {
  mode: 'server' | 'standalone';
  exportDb: () => Promise<void>;
  importDb?: (file: File) => Promise<void>;
  reset?: (to: 'demo' | 'empty') => Promise<void>;
  status?: () => { lastSavedAt: string | null; persistent: boolean | null; storageOk: boolean };
}

let controls: DataControls = {
  mode: 'server',
  exportDb: async () => {
    window.location.href = '/api/export';
  },
};

export const setDataControls = (c: DataControls) => {
  controls = c;
};
export const dataControls = () => controls;

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
