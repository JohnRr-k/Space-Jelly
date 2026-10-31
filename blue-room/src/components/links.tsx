import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { Button, Modal } from './ui';
import { useLinks, useTitles } from '../app/hooks';
import { ENTITIES, ENTITY_TYPES, searchText } from '../data/entities';
import { listRecords } from '../data/repo';
import type { AnyRecord, EntityType, LinkRef } from '../data/types';

const key = (r: LinkRef) => `${r.type}:${r.id}`;
const DEFAULT_TYPES: EntityType[] = ENTITY_TYPES.filter((t) => t !== 'reflection');

function groupByType(refs: LinkRef[]) {
  const g = new Map<EntityType, LinkRef[]>();
  for (const r of refs) g.set(r.type, [...(g.get(r.type) ?? []), r]);
  return [...g.entries()];
}

/** Editable set of links (applied by the editor on save via syncLinks). */
export function LinksField({ value, onChange, types = DEFAULT_TYPES, selfRef, label = 'Connections', hint = 'Link this to other parts of your life — nothing is copied, only connected.' }: {
  value: LinkRef[]; onChange: (v: LinkRef[]) => void; types?: EntityType[]; selfRef?: LinkRef; label?: string; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const titles = useTitles(value);
  return (
    <div className="field">
      <div className="label">{label}<span className="hint">{hint}</span></div>
      {value.length > 0 && (
        <div className="stack sm">
          {groupByType(value).map(([type, refs]) => (
            <div className="links-group" key={type}>
              <h4>{ENTITIES[type].plural}</h4>
              <div className="chips">
                {refs.map((r) => {
                  const t = titles.get(key(r));
                  return (
                    <span className="linkchip" key={key(r)}>
                      <Icon name={ENTITIES[r.type].icon} />
                      <span className="truncate" style={{ maxWidth: 220 }}>{t?.title ?? '…'}</span>
                      <button type="button" className="rm" aria-label={`Remove link to ${t?.title ?? 'item'}`} onClick={() => onChange(value.filter((v) => key(v) !== key(r)))}><Icon name="x" /></button>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div><Button size="sm" icon="link" onClick={() => setOpen(true)}>Link something</Button></div>
      <LinkPicker open={open} onClose={() => setOpen(false)} types={types} exclude={[...(selfRef ? [selfRef] : []), ...value]} onPick={(r) => { onChange([...value, r]); }} />
    </div>
  );
}

export function LinkPicker({ open, onClose, types, exclude, onPick }: { open: boolean; onClose: () => void; types: EntityType[]; exclude: LinkRef[]; onPick: (r: LinkRef) => void }) {
  const [type, setType] = useState<EntityType>(types[0]);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AnyRecord[]>([]);
  useEffect(() => { if (!types.includes(type)) setType(types[0]); }, [types, type]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listRecords(type).then((r) => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, [open, type]);
  const ex = useMemo(() => new Set(exclude.map(key)), [exclude]);
  const meta = ENTITIES[type];
  const shown = rows
    .filter((r) => !ex.has(`${type}:${r.id}`))
    .filter((r) => !q.trim() || (meta.titleOf(r) + ' ' + searchText(r)).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 80);
  return (
    <Modal open={open} onClose={onClose} title="Link something" subtitle="Pick a record to connect. You can add several." size="md" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="stack">
        <div className="row wrap">
          <select className="select" style={{ maxWidth: 240 }} aria-label="Type of record" value={type} onChange={(e) => setType(e.target.value as EntityType)}>
            {types.map((t) => <option key={t} value={t}>{ENTITIES[t].plural}</option>)}
          </select>
          <input className="input grow" type="search" placeholder="Search…" aria-label="Search records" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="picker-list" role="list">
          {shown.length === 0 && <div className="empty compact"><p>{rows.length ? 'Nothing matches.' : `No ${meta.plural.toLowerCase()} yet.`}</p></div>}
          {shown.map((r) => (
            <button type="button" role="listitem" key={r.id} className="rowitem" onClick={() => onPick({ type, id: r.id })}>
              <Icon name={meta.icon} />
              <span className="grow"><span style={{ fontWeight: 600 }}>{meta.titleOf(r) || 'Untitled'}</span><span className="meta" style={{ display: 'block' }}>{meta.subtitleOf?.(r)}</span></span>
              <Icon name="plus" />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** Read-only "Connected to" block for detail views. Chips navigate to the linked record. */
export function RelatedLinks({ type, id, title = 'Connected to' }: { type: EntityType; id: string; title?: string }) {
  const links = useLinks({ type, id });
  const titles = useTitles(links);
  if (!links.length) return null;
  return (
    <div className="stack sm">
      <div className="card-title"><span className="left"><Icon name="link" />{title}</span></div>
      {groupByType(links).map(([t, refs]) => (
        <div className="links-group" key={t}>
          <h4>{ENTITIES[t].plural}</h4>
          <div className="chips">
            {refs.map((r) => {
              const info = titles.get(key(r));
              const inner = <><Icon name={ENTITIES[r.type].icon} /><span className="truncate" style={{ maxWidth: 240 }}>{info?.title ?? '…'}</span></>;
              return info?.exists === false
                ? <span key={key(r)} className="linkchip static">{inner}</span>
                : <Link key={key(r)} className="linkchip static" to={ENTITIES[r.type].route(r.id)}>{inner}</Link>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
