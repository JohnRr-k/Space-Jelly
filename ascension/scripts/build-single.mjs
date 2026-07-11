/**
 * Produce dist/ASCENSION.html — the entire app inlined into one file, so it
 * can be downloaded, kept anywhere, and opened directly in a browser with
 * no server and no internet. Run after `vite build`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
let html = readFileSync(resolve(dist, "index.html"), "utf8");

// Inline the single CSS asset.
html = html.replace(
  /<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/,
  (_, file) =>
    `<style>${readFileSync(resolve(dist, file), "utf8").trim()}</style>`,
);

// Inline the single JS chunk. `</script` inside the bundle would end the
// inline tag early, so escape it (harmless inside JS strings).
html = html.replace(
  /<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/,
  (_, file) => {
    const js = readFileSync(resolve(dist, file), "utf8")
      .replaceAll("</script", "<\\/script");
    return `<script type="module">${js}</script>`;
  },
);

if (html.includes("assets/")) {
  throw new Error("Single-file build failed: asset references remain.");
}

writeFileSync(resolve(dist, "ASCENSION.html"), html);
console.log("dist/ASCENSION.html written.");
