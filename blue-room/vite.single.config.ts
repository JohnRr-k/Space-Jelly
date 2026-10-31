import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file (scripts, styles and fonts inlined) that opens straight from disk.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: { target: 'es2022', outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false, sourcemap: false },
});
