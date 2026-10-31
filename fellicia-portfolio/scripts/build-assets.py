"""One-off asset pipeline (kept for provenance). Originals live outside the repo.
Usage: python3 scripts/build-assets.py <src_root> <cert_dir>
Converts source images to WebP without upscaling, creates thumbnails and a
redacted diploma preview. Sensitive client visuals go to assets/restricted."""
import sys, os
from PIL import Image, ImageDraw
SRC, CERTS = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')

def save(im, path, q=84, maxw=None):
    im = im.convert('RGB')
    if maxw and im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=q, method=6)
    print(os.path.relpath(path, OUT), im.size)

# Portrait (highest-resolution original found in the credentials PDF)
p = Image.open(f'{SRC}/ac/a-006.png')
save(p, f'{OUT}/open/portrait/fellicia.webp', 86)
save(p, f'{OUT}/open/portrait/fellicia-800.webp', 86, 800)

# Diploma: redact serials, birth data, student ID and ID photo
d = Image.open(f'{SRC}/ac/a-008.jpg').convert('RGB')
dr = ImageDraw.Draw(d)
for box in [(40,5,330,48),(760,32,900,62),(455,172,580,200),(45,205,545,246),(428,552,592,790)]:
    dr.rectangle(box, fill=(41,41,45))
save(d, f'{OUT}/open/credentials/diploma-redacted.webp', 86)
save(d, f'{OUT}/open/credentials/diploma-redacted-thumb.webp', 80, 520)
for name, f in [('pkpa-1','a-012.jpg'),('pkpa-2','a-013.jpg'),('cla-letter','a-015.jpg')]:
    im = Image.open(f'{SRC}/ac/{f}')
    save(im, f'{OUT}/open/credentials/{name}.webp', 86)
    save(im, f'{OUT}/open/credentials/{name}-thumb.webp', 80, 520)

# Certificates (original uploads). Posters 3/4 intentionally excluded (other people's faces).
certs = {'debate':1,'moot':2,'pr-coordinator':5,'tilc-committee':6,'law-festival':7,'hrd-member':8,'leadership-training':9,'young-member':10,'end-year':11}
for name, n in certs.items():
    im = Image.open(f'{CERTS}/{n}.jpg')
    save(im, f'{OUT}/open/certificates/{name}.webp', 88)
    save(im, f'{OUT}/open/certificates/{name}-thumb.webp', 80, 480)

# Project 8 visual is a stock image of the Consumer Protection Act (no client data)
save(Image.open(f'{SRC}/pf/p-078.jpg'), f'{OUT}/open/projects/p08-consumer-protection-act.webp', 84)

# Client-related visuals -> restricted until publication is approved
restricted = {
 'p01-meeting-1':'p-014.jpg','p01-meeting-2':'p-015.jpg','p02-ldd-matrix':'p-023.jpg',
 'p03-disciplinary-matrix':'p-031.jpg','p04-gcg-harmonization':'p-039.jpg',
 'p05-cpm':'p-047.jpg','p05-bpm':'p-048.jpg','p06-pdp-cover':'p-057.jpg','p06-pdp-matrix':'p-058.jpg',
 'p07-iso-standard':'p-069.jpg','p07-iso-matrix-cover':'p-070.jpg','p07-iso-matrix':'p-068.jpg',
 'p09-ict-contract':'p-086.jpg'}
for name, f in restricted.items():
    save(Image.open(f'{SRC}/pf/{f}'), f'{OUT}/restricted/projects/{name}.webp', 86)
