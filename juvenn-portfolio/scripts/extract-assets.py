"""Converts raw images extracted from the portfolio PDF (pdfimages -png) into
optimised web assets under public/img. Usage: python3 extract-assets.py <raw_dir>"""
import sys, os
from PIL import Image

raw, out = sys.argv[1], os.path.join(os.path.dirname(__file__), '..', 'public', 'img')

def load(n): return Image.open(os.path.join(raw, f'img-{n:03d}.png'))

def save(im, rel, q=82, maxw=None):
    if maxw and im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    p = os.path.join(out, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    print(rel, im.size)

def rgba(color_n, mask_n):
    c = load(color_n).convert('RGB'); m = load(mask_n).convert('L')
    c.putalpha(m); return c

photos = {
 'about/portrait': 1, 'about/knights': 5, 'about/paper': 7, 'about/meeting': 78, 'about/strategy': 91,
 'work/hov-workshop': 26, 'work/hov-webinar-duo': 27, 'work/hov-webinar-invite': 28,
 'work/hov-listens': 29, 'work/hov-didyouknow': 30, 'work/hov-three-gaps': 31, 'work/hov-listens-2': 32,
 'work/npea-prizes': 34, 'work/npea-jury': 35, 'work/npea-sponsors': 36, 'work/npea-asmat': 44,
 'work/npea-mockup': 45, 'work/npea-scan': 46, 'work/npea-phygital': 48,
 'work/tc-inaco': 50, 'work/tc-research': 51, 'work/tc-handshake': 52,
 'work/wu-join': 56, 'work/wu-recap': 57, 'work/wu-appreciation': 58, 'work/wu-proposal': 64,
 'work/wu-webinar': 65, 'work/wu-talkshow': 66, 'work/wu-idulfitri': 68, 'work/wu-nyepi': 69, 'work/wu-waisak': 70,
 'certs/iciss': 72, 'certs/binus-secretary': 73, 'certs/committee-pm': 75, 'certs/creative-division': 76,
}
for rel, n in photos.items(): save(load(n).convert('RGB'), rel + '.webp')

logos = {'hovarlay': (88, 89), 'transcosmos': (86, 87), 'binus': (84, 85), 'wushu': (81, 82)}
for k, (c, m) in logos.items():
    im = rgba(c, m); p = os.path.join(out, 'logos', k + '.png'); os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, optimize=True); print('logos/' + k, im.size)

blobs = {'blob-a': (59, 60), 'blob-b': (11, 12), 'blob-c': (17, 18), 'blob-d': (79, 80), 'blob-e': (3, 4)}
for k, (c, m) in blobs.items():
    im = rgba(c, m); im.thumbnail((640, 640), Image.LANCZOS)
    p = os.path.join(out, 'deco', k + '.webp'); os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=85, method=6); print('deco/' + k, im.size)
