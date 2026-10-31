import { ENTITIES, ENTITY_TYPES, searchText } from './entities';
import { listRecords } from './repo';
import type { AnyRecord, EntityType } from './types';

export interface SearchHit { type: EntityType; id: string; title: string; subtitle: string; snippet: string; score: number; route: string }

const strip = (s: string) => s.replace(/[#>*_`]/g, '').replace(/\s+/g, ' ');

function snippetAround(text: string, needle: string): string {
  const t = strip(text);
  const i = t.toLowerCase().indexOf(needle);
  if (i < 0) return t.slice(0, 120);
  const start = Math.max(0, i - 40);
  return (start > 0 ? '…' : '') + t.slice(start, i + needle.length + 80) + (i + needle.length + 80 < t.length ? '…' : '');
}

/** Search across every kind of record. Sealed future letters only expose their title, never their body. */
export async function searchAll(query: string, today: string, limit = 80): Promise<SearchHit[]> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const type of ENTITY_TYPES) {
    const rows = await listRecords<AnyRecord>(type);
    const meta = ENTITIES[type];
    for (const r of rows) {
      let hay = searchText(r);
      if (type === 'letter' && r.readOn && r.readOn > today && !r.openedAt) hay = `${r.title} ${r.recipient}`;
      const lower = hay.toLowerCase();
      if (!lower.includes(needle)) continue;
      const title = meta.titleOf(r) || 'Untitled';
      const tl = title.toLowerCase();
      const score = (tl === needle ? 100 : tl.startsWith(needle) ? 70 : tl.includes(needle) ? 50 : 10) + (r.updatedAt ? r.updatedAt / 1e14 : 0);
      hits.push({ type, id: r.id, title, subtitle: meta.subtitleOf?.(r) ?? '', snippet: tl.includes(needle) ? '' : snippetAround(hay, needle), score, route: meta.route(r.id, r) });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
