/** Builds dist-standalone/standalone.html: the whole app (UI + API + SQLite WASM) in one file. */
import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';

/** Embeds the SQLite WebAssembly binary as base64 so the output really is one self-contained file. */
const sqliteWasm = () => ({
  name: 'embed-sqlite-wasm',
  resolveId: (id: string) => (id === 'virtual:sqlite-wasm' ? '\0virtual:sqlite-wasm' : null),
  load: (id: string) =>
    id === '\0virtual:sqlite-wasm'
      ? `export default ${JSON.stringify(fs.readFileSync(path.resolve('node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm')).toString('base64'))};`
      : null,
});

export default defineConfig({
  plugins: [sqliteWasm(), react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: [
      { find: 'node:async_hooks', replacement: path.resolve('src/standalone/stubs/async_hooks.ts') },
      { find: /^\.\/uploads$/, replacement: path.resolve('src/standalone/stubs/uploads.ts') },
    ],
  },
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 10_000,
    rollupOptions: { input: path.resolve('standalone.html') },
  },
});
