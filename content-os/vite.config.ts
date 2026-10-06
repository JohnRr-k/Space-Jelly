import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API_PORT = Number(process.env.API_PORT ?? 4317);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': `http://localhost:${API_PORT}`, '/files': `http://localhost:${API_PORT}` },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
});
