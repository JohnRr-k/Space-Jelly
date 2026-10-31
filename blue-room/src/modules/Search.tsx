import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { EmptyState, PageHeader } from '../components/ui';
import { useFmt } from '../app/settings';
import { ENTITIES } from '../data/entities';
import { searchAll, type SearchHit } from '../data/search';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const fmt = useFmt();
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  useEffect(() => setText(q), [q]);
  // re-run when any data changes
  const tick = useLiveQuery(async () => (await db.journal.count()) + (await db.memories.count()) + (await db.goals.count()) + (await db.events.count()), []);
  useEffect(() => {
    let cancelled = false;
    if (q.trim().length < 2) { setHits(null); return; }
    searchAll(q, fmt.today()).then((h) => { if (!cancelled) setHits(h); });
    return () => { cancelled = true; };
  }, [q, tick]);

  const grouped = new Map<string, SearchHit[]>();
  (hits ?? []).forEach((h) => grouped.set(ENTITIES[h.type].plural, [...(grouped.get(ENTITIES[h.type].plural) ?? []), h]));

  return (
    <div className="page">
      <PageHeader eyebrow="Search" icon="search" title="Find anything" sub="Searches your journal, memories, goals, events, notes, decisions and everything else — on this device only." />
      <form className="toolbar" role="search" onSubmit={(e) => { e.preventDefault(); setParams(text.trim() ? { q: text.trim() } : {}); }}>
        <div className="search" style={{ maxWidth: 560 }}><Icon name="search" /><input className="input" type="search" aria-label="Search" autoFocus value={text} placeholder="Try a name, a place, a word you remember…" onChange={(e) => { setText(e.target.value); if (e.target.value.trim().length >= 2) setParams({ q: e.target.value.trim() }, { replace: true }); }} /></div>
      </form>
      {q.trim().length < 2 ? <EmptyState compact title="What are you looking for?" body="Type at least two letters." /> : hits === null ? null : hits.length === 0 ? (
        <EmptyState title="Nothing found" body={`No records mention “${q}”. Check the spelling, or try a shorter word.`} />
      ) : (
        <div className="stack lg">
          <p className="small muted" aria-live="polite">{hits.length} result{hits.length === 1 ? '' : 's'}</p>
          {[...grouped.entries()].map(([label, list]) => (
            <section key={label} aria-label={label}>
              <h2 className="area-title">{label}</h2>
              <div className="card flat pad-sm rowlist">
                {list.map((h) => (
                  <Link key={h.type + h.id} to={h.route} className="rowitem">
                    <Icon name={ENTITIES[h.type].icon} />
                    <span className="grow"><strong>{h.title}</strong>{(h.subtitle || h.snippet) && <span className="small muted" style={{ display: 'block' }}>{h.snippet || h.subtitle}</span>}</span>
                    <Icon name="chevR" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
