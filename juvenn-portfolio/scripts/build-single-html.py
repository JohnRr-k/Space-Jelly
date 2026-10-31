"""Packs the static export (`npm run build` -> out/) into ONE self-contained HTML file that opens from disk
(double-click, file://). Scripts, CSS, fonts, images and the portfolio PDF are embedded.
Usage: python3 scripts/build-single-html.py [output.html]"""
import base64, json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'out')
dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'Juvenn-Ravelliyo-Portfolio.html')

def read(p, mode='r'):
    with open(p, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f: return f.read()
def b64(p): return base64.b64encode(read(p, 'rb')).decode()
MIME = {'.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff'}
def data_uri(p): return f"data:{MIME[os.path.splitext(p)[1]]};base64,{b64(p)}"

html = read(os.path.join(OUT, 'index.html'))

# --- scripts: chunks referenced by the page get inlined (at the end of <body>); every other chunk is embedded for lazy loading
chunk_dir = os.path.join(OUT, '_next', 'static', 'chunks')
def wrap(name, code):
    # Turbopack identifies a chunk by <script src>; an inline script has none, so give it one before it runs.
    return f'document.currentScript.setAttribute("src","/_next/static/chunks/{name}");\n{code}'.replace('</script', '<\\/script')

inline_names = []
def grab(m):
    name = m.group(1)
    if name not in inline_names: inline_names.append(name)
    return ''
html = re.sub(r'<script src="/_next/static/chunks/([^"]+\.js)"[^>]*?></script>', lambda m: '' if 'noModule' in m.group(0) else grab(m), html)
html = re.sub(r'<link rel="preload" as="script"[^>]*>', '', html)
html = re.sub(r'<link rel="preload" as="image"[^>]*>', '', html)
html = re.sub(r'<link rel="preconnect"[^>]*>', '', html)
html = re.sub(r'<link rel="icon"[^>]*>', f'<link rel="icon" href="{data_uri(os.path.join(OUT, "icon.svg"))}" type="image/svg+xml"/>', html)

lazy = {n: read(os.path.join(chunk_dir, n)) for n in os.listdir(chunk_dir) if n.endswith('.js') and n not in inline_names and not n.startswith('0cz1d0mv5g')}
# the nomodule polyfill chunk is not needed by modern browsers
nomodule = re.findall(r'<script src="/_next/static/chunks/([^"]+)" noModule', read(os.path.join(OUT, 'index.html')))
lazy = {k: v for k, v in lazy.items() if k not in nomodule}

# --- css (+ fonts)
def inline_css(m):
    css = read(os.path.join(OUT, m.group(1).lstrip('/')))
    def font(fm):
        p = os.path.join(OUT, '_next', 'static', 'media', fm.group(1).split('?')[0])
        return f'url({data_uri(p)})' if os.path.exists(p) else fm.group(0)
    css = re.sub(r'url\((?:\.\./media|/_next/static/media)/([^)]+)\)', font, css)
    return f'<style data-precedence="next">{css}</style>' + m.group(0)
html = re.sub(r'<link rel="stylesheet" href="(/_next/static/chunks/[^"]+\.css)"[^>]*/>', inline_css, html, count=1)

# --- images + pdf maps
imgs = {}
for d, _, fs in os.walk(os.path.join(OUT, 'img')):
    for f in fs:
        p = os.path.join(d, f); imgs['/' + os.path.relpath(p, OUT).replace(os.sep, '/')] = data_uri(p)
pdf_b64 = b64(os.path.join(OUT, 'Juvenn_Ravelliyo_Portfolio.pdf'))

shim = """
(function(){
  var IMG = %s;
  var LAZY = %s;
  var fix = function(u){ return (typeof u === 'string' && IMG[u]) || u; };
  var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { get: d.get, set: function(v){ d.set.call(this, fix(v)); }, configurable: true });
  var sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(n, v){ if (this.tagName === 'IMG' && n === 'src') v = fix(v); return sa.call(this, n, v); };
  var fixAll = function(){ document.querySelectorAll('img').forEach(function(i){ var s = i.getAttribute('src'); if (s && IMG[s]) i.src = IMG[s]; }); };
  document.addEventListener('DOMContentLoaded', fixAll);
  new MutationObserver(fixAll).observe(document.documentElement, { childList: true, subtree: true });
  // lazily loaded code-split chunks
  var ac = Element.prototype.appendChild;
  Element.prototype.appendChild = function(n){
    if (n && n.tagName === 'SCRIPT') {
      var s = n.getAttribute('src') || '', m = /\\/_next\\/static\\/chunks\\/([^?]+)/.exec(s);
      if (m && LAZY[m[1]] !== undefined) {
        var t = document.createElement('script');
        t.text = 'document.currentScript.setAttribute("src","/_next/static/chunks/' + m[1] + '");\\n' + LAZY[m[1]];
        var r = ac.call(this, t);
        setTimeout(function(){ n.dispatchEvent(new Event('load')); }, 0);
        return r;
      }
    }
    return ac.call(this, n);
  };
  // portfolio PDF: open from an embedded copy
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href$=".pdf"]'); if (!a) return;
    e.preventDefault();
    var bin = atob(window.__PDF), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    window.open(URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })), '_blank');
  }, true);
})();
""" % (json.dumps(imgs), json.dumps(lazy).replace('</script', '<\\/script'))

head_shim = f'<script>{shim.replace("</script", "<" + chr(92) + "/script")}</script><script>window.__PDF="{pdf_b64}";</script>'
html = html.replace('<head>', '<head>' + head_shim, 1)
chunks = ''.join(f'<script>{wrap(n, read(os.path.join(chunk_dir, n)))}</script>' for n in inline_names)
html = html.replace('</body>', chunks + '</body>', 1)

with open(dest, 'w', encoding='utf-8') as f: f.write(html)
print(dest, round(os.path.getsize(dest) / 1e6, 1), 'MB;', len(inline_names), 'inline chunks,', len(lazy), 'lazy,', len(imgs), 'images')
