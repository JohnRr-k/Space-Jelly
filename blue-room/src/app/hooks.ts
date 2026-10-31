import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../data/db';
import { ENTITIES } from '../data/entities';
import { getLinks, tableFor } from '../data/repo';
import type { AnyRecord, EntityType, LinkRef } from '../data/types';

/** Live list of every record of a type. `undefined` while the first read is in flight. */
export function useRecords<T = AnyRecord>(type: EntityType): T[] | undefined {
  return useLiveQuery(() => tableFor(type).toArray(), [type]) as T[] | undefined;
}

export function useCustomReminders() {
  return useLiveQuery(() => db.customReminders.toArray(), []);
}

export function useRecord<T = AnyRecord>(type: EntityType, id: string | undefined): { rec: T | undefined; loading: boolean } {
  const res = useLiveQuery(async () => (id ? { rec: (await tableFor(type).get(id)) as T | undefined } : { rec: undefined }), [type, id]);
  return { rec: res?.rec, loading: res === undefined };
}

export function useLinks(ref: LinkRef | null): LinkRef[] {
  const res = useLiveQuery(() => (ref ? getLinks(ref) : Promise.resolve([] as LinkRef[])), [ref?.type, ref?.id]);
  return res ?? [];
}

/** Resolve `type:id` refs to display titles (live). */
export function useTitles(refs: LinkRef[]): Map<string, { title: string; subtitle: string; exists: boolean }> {
  const key = refs.map((r) => `${r.type}:${r.id}`).join('|');
  const res = useLiveQuery(async () => {
    const out = new Map<string, { title: string; subtitle: string; exists: boolean }>();
    for (const r of refs) {
      const rec = (await tableFor(r.type).get(r.id)) as AnyRecord | undefined;
      const meta = ENTITIES[r.type];
      out.set(`${r.type}:${r.id}`, rec ? { title: meta.titleOf(rec), subtitle: meta.subtitleOf?.(rec) ?? '', exists: true } : { title: 'Removed item', subtitle: '', exists: false });
    }
    return out;
  }, [key]);
  return res ?? new Map();
}

export function useAllTags(): string[] {
  const res = useLiveQuery(async () => {
    const set = new Map<string, string>();
    const tables = ['journal', 'notes', 'timeline', 'chapters', 'memories', 'odyssey', 'people', 'places', 'lessons', 'letters', 'achievements', 'goals', 'decisions', 'wisdom'];
    for (const t of tables) {
      const rows = (await (db as any)[t].toArray()) as AnyRecord[];
      for (const r of rows) for (const tag of r.tags ?? []) if (!set.has(tag.toLowerCase())) set.set(tag.toLowerCase(), tag);
    }
    return [...set.values()].sort((a, b) => a.localeCompare(b));
  }, []);
  return res ?? [];
}

export function useAttachments(ids: string[]) {
  const key = ids.join(',');
  const [items, setItems] = useState<{ id: string; name: string; mime: string; url: string; size: number }[]>([]);
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const rows = await db.attachments.bulkGet(ids);
      const out: typeof items = [];
      for (const a of rows) {
        if (!a) continue;
        const url = URL.createObjectURL(a.blob);
        urls.push(url);
        out.push({ id: a.id, name: a.name, mime: a.mime, url, size: a.size });
      }
      if (!cancelled) setItems(out);
    })();
    return () => { cancelled = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return items;
}

export function useDebouncedCallbackValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

export const useStable = <T,>(v: T) => useMemo(() => v, [JSON.stringify(v)]); // eslint-disable-line
