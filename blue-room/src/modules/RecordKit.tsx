import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Button, Chips, EmptyState, Field, Modal, SelectField, TagInput, TextField, useConfirm, useOnce, useToast } from '../components/ui';
import { AttachmentGallery, AttachmentPicker } from '../components/media';
import { LinksField, RelatedLinks } from '../components/links';
import { useAllTags, useRecords } from '../app/hooks';
import { useFmt, useSettings } from '../app/settings';
import { ENTITIES, searchText } from '../data/entities';
import { deleteRecord, findDuplicateByName, getLinks, newId, saveRecord, syncLinks, validateRecord, ValidationError } from '../data/repo';
import type { AnyRecord, EntityType, LinkRef, Settings } from '../data/types';

export type FieldKind = 'text' | 'textarea' | 'date' | 'select' | 'time' | 'url';
export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: string[] | ((s: Settings) => string[]);
  rows?: number;
  /** Render full width in the two-column grid (default for textarea). */
  wide?: boolean;
  /** Hide in the detail view (e.g. status shown as a chip). */
  hideInDetail?: boolean;
  /** Only show this field when the predicate passes. */
  when?: (d: AnyRecord) => boolean;
}

export interface RecordConfig {
  type: EntityType;
  fields: FieldDef[];
  blank: (ctx: { settings: Settings; today: string }) => Record<string, any>;
  attachments?: { label: string; allowPdf?: boolean };
  linkTypes?: EntityType[];
  tags?: boolean;
  nameDuplicateCheck?: boolean;
  /** Transform draft just before saving. */
  normalize?: (d: AnyRecord, ctx: { settings: Settings; today: string }) => AnyRecord;
  /** Chips shown in detail header. */
  headerChips?: (r: AnyRecord) => ReactNode;
  emptyTitle: string;
  emptyBody: string;
  newLabel: string;
  icon: string;
}

export function useOpenParam(): [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const open = params.get('open');
  const set = useCallback((id: string | null) => {
    setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('open', id); else n.delete('open'); return n; }, { replace: true });
  }, [setParams]);
  return [open, set];
}

// ================================================================== Editor

export function RecordEditor({ config, record, open, onClose, onSaved, initial, initialLinks }: {
  config: RecordConfig; record: AnyRecord | null; open: boolean; onClose: () => void; onSaved?: (r: AnyRecord) => void; initial?: Partial<AnyRecord>; initialLinks?: LinkRef[];
}) {
  const { settings } = useSettings();
  const fmt = useFmt();
  const toast = useToast();
  const confirm = useConfirm();
  const tags = useAllTags();
  const meta = ENTITIES[config.type];
  const [draft, setDraft] = useState<AnyRecord | null>(null);
  const [links, setLinks] = useState<LinkRef[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setErrors([]);
    if (record) {
      setDraft({ ...record });
      getLinks({ type: config.type, id: record.id }).then(setLinks);
    } else {
      setDraft({ id: newId(), createdAt: 0, updatedAt: 0, ...config.blank({ settings, today: fmt.today() }), ...(initial ?? {}) });
      setLinks(initialLinks ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id]);

  const set = (k: string, v: any) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const [save, saving] = useOnce(async () => {
    if (!draft) return;
    let d = config.normalize ? config.normalize(draft, { settings, today: fmt.today() }) : draft;
    const errs = validateRecord(config.type, d);
    if (errs.length) { setErrors(errs); return; }
    if (config.nameDuplicateCheck) {
      const dup = await findDuplicateByName(config.type as 'person' | 'place', d.name, d.id);
      if (dup && !(await confirm({ title: `“${d.name}” already exists`, body: `You already have a ${meta.label.toLowerCase()} with this name. Save another one anyway?`, confirmLabel: 'Save anyway' }))) return;
    }
    try {
      const saved = await saveRecord(config.type, d);
      await syncLinks({ type: config.type, id: saved.id }, links);
      toast(record ? 'Saved' : `${meta.label} added`);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setErrors(e instanceof ValidationError ? e.errors : [String((e as Error).message)]);
    }
  });

  if (!draft) return <Modal open={false} onClose={onClose} title="" children={null} />;
  const visible = config.fields.filter((f) => !f.when || f.when(draft));
  return (
    <Modal
      open={open} onClose={onClose} size="lg"
      title={record ? `Edit ${meta.label.toLowerCase()}` : config.newLabel}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="check" disabled={saving} onClick={() => save()}>{saving ? 'Saving…' : 'Save'}</Button></>}
    >
      <form className="stack lg" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {errors.length > 0 && (
          <div className="callout warn" role="alert"><Icon name="warn" /><div>{errors.map((e) => <div key={e}>{e}</div>)}</div></div>
        )}
        <div className="grid-2">
          {visible.map((f, i) => {
            const wide = f.wide || f.kind === 'textarea';
            const style = wide ? { gridColumn: '1 / -1' } : undefined;
            const common = { label: f.label, hint: f.hint, required: f.required, placeholder: f.placeholder };
            if (f.kind === 'select') {
              const opts = typeof f.options === 'function' ? f.options(settings) : f.options ?? [];
              return <div key={f.key} style={style}><SelectField label={f.label} hint={f.hint} value={draft[f.key] ?? ''} onChange={(v) => set(f.key, v)} options={opts} /></div>;
            }
            return (
              <div key={f.key} style={style}>
                <TextField
                  {...common} autoFocus={i === 0 && !record}
                  type={f.kind === 'date' ? 'date' : f.kind === 'time' ? 'time' : f.kind === 'url' ? 'url' : 'text'}
                  multiline={f.kind === 'textarea'} rows={f.rows} value={draft[f.key] ?? ''} onChange={(v) => set(f.key, v)}
                />
              </div>
            );
          })}
        </div>
        {config.tags !== false && <TagInput value={draft.tags ?? []} onChange={(v) => set('tags', v)} suggestions={tags} />}
        {config.attachments && (
          <AttachmentPicker label={config.attachments.label} allowPdf={config.attachments.allowPdf} value={draft.attachmentIds ?? []} onChange={(v) => set('attachmentIds', v)} />
        )}
        {config.linkTypes && <LinksField value={links} onChange={setLinks} types={config.linkTypes} selfRef={{ type: config.type, id: draft.id }} />}
      </form>
    </Modal>
  );
}

// ================================================================== Detail

export function RecordDetail({ config, id, onClose, onEdit, actions, extra, hero }: {
  config: RecordConfig; id: string | null; onClose: () => void; onEdit: (r: AnyRecord) => void; actions?: (r: AnyRecord) => ReactNode; extra?: (r: AnyRecord) => ReactNode; hero?: (r: AnyRecord) => ReactNode;
}) {
  const records = useRecords(config.type);
  const rec = id ? records?.find((r) => r.id === id) : undefined;
  const fmt = useFmt();
  const confirm = useConfirm();
  const toast = useToast();
  const meta = ENTITIES[config.type];

  const del = async () => {
    if (!rec) return;
    const ok = await confirm({
      title: `Delete this ${meta.label.toLowerCase()}?`, tone: 'danger', confirmLabel: 'Delete',
      body: <>“{meta.titleOf(rec)}” will be removed for good. Anything linked to it stays — only the connection goes away.</>,
    });
    if (!ok) return;
    await deleteRecord(config.type, rec.id);
    toast(`${meta.label} deleted`);
    onClose();
  };

  return (
    <Modal
      open={!!id && !!rec} onClose={onClose} size="lg" title={rec ? meta.titleOf(rec) : ''} subtitle={rec && meta.subtitleOf && config.type !== 'person' ? undefined : undefined}
      footer={rec && (
        <>
          <div className="left"><Button variant="danger" icon="trash" onClick={del}>Delete</Button></div>
          {actions?.(rec)}
          <Button icon="edit" variant="primary" onClick={() => onEdit(rec)}>Edit</Button>
        </>
      )}
    >
      {rec && (
        <div className="stack lg">
          {config.headerChips && <div className="chips">{config.headerChips(rec)}</div>}
          {hero?.(rec)}
          {config.attachments && <AttachmentGallery ids={rec.attachmentIds ?? []} />}
          <dl className="kv">
            {config.fields.filter((f) => !f.hideInDetail && rec[f.key] && (!f.when || f.when(rec))).map((f) => (
              <div key={f.key} style={{ display: 'contents' }}>
                <dt>{f.label}</dt>
                <dd className={f.kind === 'textarea' ? 'pre' : ''}>
                  {f.kind === 'date' ? fmt.date(rec[f.key]) : f.kind === 'time' ? fmt.time(rec[f.key]) : f.kind === 'url' ? <a href={rec[f.key]} target="_blank" rel="noreferrer">{rec[f.key]}</a> : rec[f.key]}
                </dd>
              </div>
            ))}
          </dl>
          {config.tags !== false && <Chips items={rec.tags ?? []} />}
          {extra?.(rec)}
          <RelatedLinks type={config.type} id={rec.id} />
          <div className="tiny faint">Added {new Date(rec.createdAt).toLocaleDateString()} · Updated {new Date(rec.updatedAt).toLocaleDateString()}</div>
        </div>
      )}
    </Modal>
  );
}

// ================================================================== Workspace

export interface Helpers {
  open: (id: string) => void;
  edit: (r: AnyRecord) => void;
  fmt: ReturnType<typeof useFmt>;
}

export function RecordWorkspace({
  config, sort, renderList, toolbarExtra, filterFn, actions, extra, hero, headerSlot, initialForNew, searchPlaceholder, onSaved, items: itemsProp, createSignal, onCreateSignalHandled,
}: {
  createSignal?: { initial?: Partial<AnyRecord>; links?: LinkRef[] } | null;
  onCreateSignalHandled?: () => void;
  config: RecordConfig;
  sort?: (a: AnyRecord, b: AnyRecord) => number;
  renderList: (items: AnyRecord[], h: Helpers) => ReactNode;
  toolbarExtra?: ReactNode;
  filterFn?: (r: AnyRecord) => boolean;
  actions?: (r: AnyRecord) => ReactNode;
  extra?: (r: AnyRecord) => ReactNode;
  hero?: (r: AnyRecord) => ReactNode;
  headerSlot?: ReactNode;
  initialForNew?: Partial<AnyRecord>;
  searchPlaceholder?: string;
  onSaved?: (r: AnyRecord) => void;
  items?: AnyRecord[] | undefined;
}) {
  const fmt = useFmt();
  const all = useRecords(config.type);
  const source = itemsProp ?? all;
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [openId, setOpenId] = useOpenParam();
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [signalInit, setSignalInit] = useState<{ initial?: Partial<AnyRecord>; links?: LinkRef[] } | null>(null);
  const meta = ENTITIES[config.type];

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new')) {
      setCreating(true);
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('new')]);

  useEffect(() => {
    if (createSignal) { setSignalInit(createSignal); setCreating(true); onCreateSignalHandled?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSignal]);

  const tagList = useMemo(() => {
    const s = new Set<string>();
    (source ?? []).forEach((r) => (r.tags ?? []).forEach((t: string) => s.add(t)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [source]);

  const items = useMemo(() => {
    let list = (source ?? []).filter((r) => (filterFn ? filterFn(r) : true));
    if (tag) list = list.filter((r) => (r.tags ?? []).includes(tag));
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((r) => searchText(r).toLowerCase().includes(needle));
    return sort ? [...list].sort(sort) : list;
  }, [source, q, tag, sort, filterFn]);

  const helpers: Helpers = { open: (id) => setOpenId(id), edit: (r) => setEditing(r), fmt };
  const loading = source === undefined;
  const total = (source ?? []).filter((r) => (filterFn ? filterFn(r) : true)).length;

  return (
    <>
      {headerSlot}
      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input className="input" type="search" aria-label={`Search ${meta.plural.toLowerCase()}`} placeholder={searchPlaceholder ?? `Search ${meta.plural.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {tagList.length > 0 && (
          <select className="select" style={{ width: 'auto', minHeight: 40, borderRadius: 999 }} aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All tags</option>
            {tagList.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
        {toolbarExtra}
        <div className="grow" />
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>{config.newLabel}</Button>
      </div>

      {loading ? null : total === 0 ? (
        <EmptyState title={config.emptyTitle} body={config.emptyBody} action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>{config.newLabel}</Button>} />
      ) : items.length === 0 ? (
        <EmptyState compact title="Nothing matches" body="Try a different word, or clear the filters." action={<Button onClick={() => { setQ(''); setTag(''); }}>Clear filters</Button>} />
      ) : renderList(items, helpers)}

      <RecordDetail
        config={config} id={openId} onClose={() => setOpenId(null)} onEdit={(r) => { setEditing(r); }}
        actions={actions} extra={extra} hero={hero}
      />
      <RecordEditor
        config={config} record={editing} open={!!editing || creating} initial={{ ...(initialForNew ?? {}), ...(signalInit?.initial ?? {}) }} initialLinks={signalInit?.links}
        onClose={() => { setEditing(null); setCreating(false); setSignalInit(null); }}
        onSaved={(r) => { onSaved?.(r); if (creating) setOpenId(null); }}
      />
    </>
  );
}

/** Small helper: sort newest date first. */
export const byDateDesc = (key: string) => (a: AnyRecord, b: AnyRecord) => String(b[key] ?? '').localeCompare(String(a[key] ?? '')) || b.updatedAt - a.updatedAt;
export const byDateAsc = (key: string) => (a: AnyRecord, b: AnyRecord) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) || a.updatedAt - b.updatedAt;
export const byRecent = (a: AnyRecord, b: AnyRecord) => b.updatedAt - a.updatedAt;

export { Field };
