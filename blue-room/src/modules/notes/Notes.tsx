import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Button, Chips, EmptyState, Modal, PageHeader, SelectField, TagInput, TextField, useConfirm, useOnce, useToast } from '../../components/ui';
import { useAllTags, useRecords } from '../../app/hooks';
import { useFmt, useSettings } from '../../app/settings';
import { convertNoteToJournal, deleteRecord, newId, saveRecord } from '../../data/repo';
import { searchText } from '../../data/entities';
import { useOpenParam } from '../RecordKit';
import type { Note } from '../../data/types';

const blankNote = (category: string): Note => ({ id: newId(), createdAt: 0, updatedAt: 0, title: '', body: '', pinned: false, category, tags: [] });

export default function Notes() {
  const { settings } = useSettings();
  const fmt = useFmt();
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const notes = useRecords<Note>('note');
  const [quick, setQuick] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [tag, setTag] = useState('');
  const [openId, setOpenId] = useOpenParam();
  const [editing, setEditing] = useState<Note | null>(null);
  const quickRef = useRef<HTMLTextAreaElement>(null);

  const [addQuick, adding] = useOnce(async () => {
    if (!quick.trim()) return;
    await saveRecord('note', { ...blankNote(settings.categories.note[0] ?? 'Idea'), body: quick.trim() });
    setQuick('');
    toast('Note added');
    quickRef.current?.focus();
  });

  const [sp, setSp] = useSearchParams();
  useEffect(() => {
    if (sp.get('new')) { quickRef.current?.focus(); setSp((p) => { const n = new URLSearchParams(p); n.delete('new'); return n; }, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.get('new')]);

  // ?open=<id> opens that note in the editor
  useEffect(() => {
    if (!openId || !notes) return;
    const n = notes.find((x) => x.id === openId);
    if (n) { setEditing(n); setOpenId(null); }
  }, [openId, notes, setOpenId]);

  const tags = useMemo(() => [...new Set((notes ?? []).flatMap((n) => n.tags))].sort(), [notes]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (notes ?? [])
      .filter((n) => (cat ? n.category === cat : true))
      .filter((n) => (tag ? n.tags.includes(tag) : true))
      .filter((n) => (needle ? searchText(n).toLowerCase().includes(needle) : true))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [notes, q, cat, tag]);

  const togglePin = async (n: Note) => { await saveRecord('note', { ...n, pinned: !n.pinned }); };
  const remove = async (n: Note) => {
    if (!(await confirm({ title: 'Delete this note?', tone: 'danger', confirmLabel: 'Delete', body: 'This can’t be undone.' }))) return;
    await deleteRecord('note', n.id); toast('Note deleted'); setEditing(null);
  };
  const toJournal = async (n: Note) => {
    const e = await convertNoteToJournal(n, fmt.today());
    toast(n.convertedJournalId ? 'This note is already in your journal' : 'Added to your journal', { action: { label: 'Open', run: () => nav(`/journal/${e.id}`) } });
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Notes" icon="note" title="Quick notes" sub="For thoughts that aren’t ready to be anything else yet." />

      <form className="quick-capture card" onSubmit={(e) => { e.preventDefault(); addQuick(); }}>
        <label htmlFor="quick-note" className="sr-only">Quick note</label>
        <textarea
          id="quick-note" ref={quickRef} className="textarea" rows={2} placeholder="Jot something down…" value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addQuick(); } }}
        />
        <div className="row between">
          <span className="tiny faint">Ctrl/⌘ + Enter to add</span>
          <Button variant="primary" icon="plus" type="submit" disabled={!quick.trim() || adding}>Add note</Button>
        </div>
      </form>

      <div className="toolbar" style={{ marginTop: 20 }}>
        <div className="search"><Icon name="search" /><input className="input" type="search" aria-label="Search notes" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select" style={{ width: 'auto', borderRadius: 999 }} aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{settings.categories.note.map((c) => <option key={c}>{c}</option>)}</select>
        {tags.length > 0 && <select className="select" style={{ width: 'auto', borderRadius: 999 }} aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)}><option value="">All tags</option>{tags.map((t) => <option key={t} value={t}>#{t}</option>)}</select>}
        <div className="grow" />
        <Button icon="edit" onClick={() => setEditing(blankNote(settings.categories.note[0] ?? 'Idea'))}>New detailed note</Button>
      </div>

      {notes === undefined ? null : notes.length === 0 ? (
        <EmptyState title="Nothing on the desk yet" body="Notes live here until you decide what they should become — a journal entry, a goal, or nothing at all." />
      ) : shown.length === 0 ? (
        <EmptyState compact title="No notes match" body="Try a different word or clear a filter." />
      ) : (
        <div className="notes-board">
          {shown.map((n, i) => (
            <article key={n.id} className={`sticky c${i % 4} ${n.pinned ? 'pinned' : ''}`}>
              <button type="button" className="sticky-body" onClick={() => setEditing(n)} aria-label={`Edit note: ${n.title || n.body.slice(0, 40)}`}>
                {n.title && <strong>{n.title}</strong>}
                <span className="pre">{n.body.length > 280 ? n.body.slice(0, 280) + '…' : n.body}</span>
              </button>
              <div className="sticky-foot">
                <span className="tiny">{n.category}{n.tags.length ? ` · ${n.tags.map((t) => '#' + t).join(' ')}` : ''}</span>
                <span className="row" style={{ gap: 0 }}>
                  <button type="button" className="icon-btn sm" aria-pressed={n.pinned} aria-label={n.pinned ? 'Unpin note' : 'Pin note'} title={n.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(n)}><Icon name="pin" /></button>
                  <button type="button" className="icon-btn sm" aria-label="Add to journal" title="Turn into a journal entry" onClick={() => toJournal(n)}><Icon name="journal" /></button>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <NoteEditor note={editing} onClose={() => setEditing(null)} onDelete={remove} onToJournal={toJournal} />
    </div>
  );
}

function NoteEditor({ note, onClose, onDelete, onToJournal }: { note: Note | null; onClose: () => void; onDelete: (n: Note) => void; onToJournal: (n: Note) => void }) {
  const { settings } = useSettings();
  const toast = useToast();
  const suggestions = useAllTags();
  const [d, setD] = useState<Note | null>(null);
  const [err, setErr] = useState('');
  const existing = useRecords<Note>('note');
  const isExisting = !!(note && existing?.some((n) => n.id === note.id));
  useEffect(() => { setD(note ? { ...note } : null); setErr(''); }, [note?.id]);
  const [save, saving] = useOnce(async () => {
    if (!d) return;
    if (!d.title.trim() && !d.body.trim()) { setErr('A note needs a few words.'); return; }
    await saveRecord('note', d); toast('Note saved'); onClose();
  });
  return (
    <Modal open={!!d} onClose={onClose} title={isExisting ? 'Edit note' : 'New note'} size="md"
      footer={d && <>
        {isExisting && <div className="left row"><Button variant="danger" icon="trash" onClick={() => onDelete(d)}>Delete</Button><Button icon="journal" onClick={() => onToJournal(d)}>To journal</Button></div>}
        <Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="check" disabled={saving} onClick={() => save()}>Save</Button></>}>
      {d && (
        <div className="stack">
          {err && <div className="callout warn" role="alert"><Icon name="warn" />{err}</div>}
          <TextField label="Title" hint="Optional" value={d.title} onChange={(v) => setD({ ...d, title: v })} />
          <TextField label="Note" multiline rows={7} autoFocus value={d.body} onChange={(v) => setD({ ...d, body: v })} />
          <div className="grid-2">
            <SelectField label="Category" value={d.category} onChange={(v) => setD({ ...d, category: v })} options={settings.categories.note} />
            <div className="field"><div className="label">Pin to top</div><label className="switch"><input type="checkbox" role="switch" checked={d.pinned} onChange={(e) => setD({ ...d, pinned: e.target.checked })} /><span className="track" aria-hidden="true" /><span>{d.pinned ? 'Pinned' : 'Not pinned'}</span></label></div>
          </div>
          <TagInput value={d.tags} onChange={(t) => setD({ ...d, tags: t })} suggestions={suggestions} />
          <Chips items={[]} />
        </div>
      )}
    </Modal>
  );
}
