// Packs the static export (./out) into ONE self-contained HTML file that opens from disk (file://).
// CSS, JS, Latin fonts, favicon and every image are embedded. Build first with:
//   npx next build --webpack   (webpack runtime: chunk loading does not depend on script URLs)
// Usage: node scripts/make-single-file.mjs [output.html]
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';

const OUT = 'out';
const target = process.argv[2] ?? 'dist/fellicia-portfolio.html';
const b64 = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;
const read = (p) => readFileSync(join(OUT, p.replace(/^\//, '').split('?')[0]));

let html = readFileSync(join(OUT, 'index.html'), 'utf8');

/* ---- CSS: inline, keep only Latin font subsets, embed woff2 ---- */
html = html.replace(/<link rel="stylesheet" href="([^"]+)"[^>]*\/>/g, (_, href) => {
  let css = read(href).toString('utf8');
  css = css.replace(/@font-face\{[^}]*\}/g, (rule) => {
    const m = rule.match(/url\(([^)]+?\.woff2)\)/);
    if (!m || !/-latin-(?!ext)/.test(m[1])) return ''; // keep Latin only (drop latin-ext, cyrillic, greek, vietnamese)
    const file = m[1].replace(/^"|"$/g, '');
    return rule.replace(/src:[^;}]*/, `src:url(${b64(read(file), 'font/woff2')}) format("woff2")`);
  });
  return `<style>${css}</style>`;
});

/* ---- favicon ---- */
html = html.replace(/<link rel="icon" href="([^"]+)"[^>]*\/>/, (_, href) =>
  `<link rel="icon" href="${b64(read(href), 'image/svg+xml')}" type="image/svg+xml"/>`);

/* ---- drop preloads (their URLs do not exist on disk) ---- */
html = html.replace(/<link rel="preload"[^>]*\/>/g, '');

/* ---- media map ---- */
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const mime = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const map = {};
for (const f of walk(join(OUT, 'media'))) map[relative(join(OUT, 'media'), f).replaceAll('\\', '/')] = b64(readFileSync(f), mime[extname(f)]);
html = html.replace(/<img\b[^>]*>/g, (tag) => {
  const m = tag.match(/\ssrc="\/media\/([^"]+)"/);
  if (!m) return tag;
  return tag.replace(/\ssrc="[^"]*"/, ` data-m="${m[1]}"`).replace(/\ssrcSet="[^"]*"/i, '').replace(/\ssizes="[^"]*"/i, '');
});
const mapScript = `<script>window.__M=${JSON.stringify(map)};document.querySelectorAll('img[data-m]').forEach(function(i){var d=window.__M[i.getAttribute('data-m')];if(d)i.src=d});</script>`;

/* ---- scripts: inline in original order, placed at the end of <body> ---- */
const chunks = [];
html = html.replace(/<script src="([^"]+)"([^>]*)><\/script>/g, (tag, src, rest) => {
  if (/noModule/i.test(rest)) return ''; // legacy polyfills
  const id = rest.match(/id="([^"]+)"/)?.[1];
  let js = read(src).toString('utf8');
  const needle = 'let{pathname:t}=new URL(e.src),r=t.indexOf("/_next/")';
  if (js.includes(needle)) js = js.replace(needle, 'let{pathname:t}={pathname:"/_next/"},r=t.indexOf("/_next/")');
  js = js.replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--');
  chunks.push(`<script${id ? ` id="${id}"` : ''}>${js}</script>`);
  return '';
});
if (!chunks.some((c) => c.includes('pathname:"/_next/"'))) throw new Error('asset-prefix patch did not apply: Next.js internals changed');
// React re-injects resource-hint <link>s (stylesheet, preloads, icon) that point at files which do not
// exist beside a single HTML file. Everything is already embedded, so drop them before they hit the network.
const guard = `<script>(function(){function skip(n){if(!n||n.tagName!=='LINK')return false;var h=n.getAttribute('href')||'';return h.indexOf('/_next/')===0||h.indexOf('/icon.svg')===0||!!n.getAttribute('imagesrcset')}['appendChild','insertBefore'].forEach(function(m){var o=Node.prototype[m];Node.prototype[m]=function(n){if(skip(n)){setTimeout(function(){n.dispatchEvent(new Event('load'))},0);return n}return o.apply(this,arguments)}})})();</script>`;
html = html.replace('</body>', `${guard}${mapScript}${chunks.join('')}</body>`);

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, html);
console.log(`[single-file] ${target} — ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB, ${Object.keys(map).length} images, ${chunks.length} scripts`);
