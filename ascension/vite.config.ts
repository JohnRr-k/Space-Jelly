/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" keeps the build servable from any static host or the filesystem —
// ASCENSION has no backend, so the bundle must be location-independent.
export default defineConfig({
  plugins: [react()],
  base: "./",
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
