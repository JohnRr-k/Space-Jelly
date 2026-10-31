import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Button, EmptyState, Field, IconButton, Segmented, TagInput, useConfirm, useToast } from '../../components/ui';
import { AttachmentGallery, AttachmentPicker } from '../../components/media';
import { LinksField } from '../../components/links';
import { Markdown } from '../../components/Markdown';
import { useAllTags, useLinks, useRecords } from '../../app/hooks';
import { useFmt, useSettings } from '../../app/settings';
import { db } from '../../data/db';
import { deleteRecord, getLinks, newId, promoteJournalToMemory, saveRecord, syncLinks } from '../../data/repo';
import { ENTITIES, searchText } from '../../data/entities';
import { addMonths, formatMonthYear, monthGrid, startOfMonth, weekdayLetter } from '../../lib/dates';
import type { JournalEntry, LinkRef } from '../../data/types';

const snippet = (e: JournalEntry) => e.body.replace(/[#>*_`-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

// ============================================================ page

export default function Journal() {
  const { id } = useParams();
  const nav = useNavigate();
  if (id === 'new') return <Navigate to={`/journal/${newId()}`} replace />;
  return (
    <div className={`journal-shell ${id ? 'has-editor' : ''}`}>
      <JournalArchive activeId={id} onNew={() => nav(`/journal/${newId()}`)} onOpen={(eid) => nav(`/journal/${eid}`)} />
      <div className="journal-main">
        {id ? <JournalEditor key={id} id={id} onBack={() => nav('/journal')} onOpen={(eid) => nav(`/journal/${eid}`)} /> : <JournalWelcome onNew={() => nav(`/journal/${newId()}`)} />}
      </div>
    </div>
  );
}

function JournalWelcome({ onNew }: { onNew: () => void }) {
  const { settings } = useSettings();
  const entries = useRecords<JournalEntry>('journal');
  const prompt = useMemo(() => settings.journalPrompts.list[Math.floor(Date.now() / 86400000) % Math.max(1, settings.journalPrompts.list.length)], [settings.journalPrompts.list]);
  return (
    <div className="journal-welcome">
      <EmptyState
        title={entries && entries.length ? 'Pick an entry, or begin a new one' : 'Your journal is waiting for its first entry'}
        body={settings.journalPrompts.enabled && prompt ? `If you’d like a place to start: “${prompt}”` : 'Write whatever is on your mind. There’s no streak and no schedule — only you, when you feel like it.'}
        action={<Button variant="primary" icon="edit" onClick={onNew}>Write something</Button>}
      />
    </div>
  );
}

// ============================================================ archive (list / calendar / yearly)

type View = 'recent' | 'calendar' | 'archive';

function JournalArchive({ activeId, onNew, onOpen }: { activeId?: string; onNew: () => void; onOpen: (id: string) => void }) {
  const fmt = useFmt();
  const { settings } = useSettings();
  const entries = useRecords<JournalEntry>('journal');
  const [view, setView] = useState<View>('recent');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [month, setMonth] = useState(startOfMonth(fmt.today()));
  const [day, setDay] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const tags = useMemo(() => [...new Set((entries ?? []).flatMap((e) => e.tags))].sort((a, b) => a.localeCompare(b)), [entries]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (entries ?? [])
      .filter((e) => (category ? e.category === category : true))
      .filter((e) => (tag ? e.tags.includes(tag) : true))
      .filter((e) => (from ? e.date >= from : true))
      .filter((e) => (to ? e.date <= to : true))
      .filter((e) => (monthFilter ? e.date.startsWith(monthFilter) : true))
      .filter((e) => (needle ? searchText(e).toLowerCase().includes(needle) : true))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [entries, q, category, tag, from, to, monthFilter]);

  const byDay = useMemo(() => { const m = new Map<string, JournalEntry[]>(); filtered.forEach((e) => m.set(e.date, [...(m.get(e.date) ?? []), e])); return m; }, [filtered]);
  const filtersActive = !!(q || category || tag || from || to || monthFilter);
  const clear = () => { setQ(''); setCategory(''); setTag(''); setFrom(''); setTo(''); setMonthFilter(''); setDay(''); };
  const total = entries?.length ?? 0;

  return (
    <aside className="journal-archive" aria-label="Journal archive">
      <div className="journal-archive-head">
        <div className="row between">
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 500 }}>Journal</h1>
          <Button variant="primary" icon="plus" onClick={onNew}>New entry</Button>
        </div>
        <div className="toolbar" style={{ margin: '12px 0 8px' }}>
          <div className="search" style={{ maxWidth: 'none' }}>
            <Icon name="search" />
            <input className="input" type="search" aria-label="Search journal" placeholder="Search entries…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Segmented<View> label="Archive view" value={view} onChange={(v) => { setView(v); setDay(''); }} options={[{ value: 'recent', label: 'Recent' }, { value: 'calendar', label: 'Calendar' }, { value: 'archive', label: 'Archive' }]} />
        <details className="filters" open={!!(category || tag || from || to)}>
          <summary>Filters{(category || tag || from || to) && ' ·  on'}</summary>
          <div className="grid-2" style={{ marginTop: 8 }}>
            <div className="field"><label htmlFor="jf-cat">Category</label>
              <select id="jf-cat" className="select" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All</option>{settings.categories.journal.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label htmlFor="jf-tag">Tag</label>
              <select id="jf-tag" className="select" value={tag} onChange={(e) => setTag(e.target.value)}><option value="">All</option>{tags.map((t) => <option key={t} value={t}>#{t}</option>)}</select></div>
            <div className="field"><label htmlFor="jf-from">From</label><input id="jf-from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field"><label htmlFor="jf-to">To</label><input id="jf-to" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        </details>
        {filtersActive && <div className="row between small" style={{ marginTop: 8 }}><span className="muted">{filtered.length} of {total} entries</span><button className="btn ghost sm" onClick={clear}>Clear filters</button></div>}
      </div>

      <div className="journal-archive-body">
        {entries === undefined ? null : total === 0 ? (
          <EmptyState compact title="Nothing written yet" body="Your entries will gather here, newest first." />
        ) : view === 'calendar' ? (
          <JournalCalendar month={month} setMonth={setMonth} byDay={byDay} day={day} setDay={setDay} onNewOnDay={(d) => { onNew(); sessionStorage.setItem('blueroom.journalNewDate', d); }} />
        ) : view === 'archive' ? (
          <YearArchive entries={entries} monthFilter={monthFilter} onPick={(m) => { setMonthFilter(m); setView('recent'); }} />
        ) : null}
        {total > 0 && (view === 'recent' || (view === 'calendar' && day)) && (
          <EntryList entries={view === 'calendar' ? (byDay.get(day) ?? []) : filtered} activeId={activeId} onOpen={onOpen} grouped={view === 'recent'} fmt={fmt} />
        )}
        {total > 0 && view === 'recent' && filtered.length === 0 && <EmptyState compact title="No entries match" body="Try fewer filters or different words." />}
      </div>
    </aside>
  );
}

function EntryList({ entries, activeId, onOpen, grouped, fmt }: { entries: JournalEntry[]; activeId?: string; onOpen: (id: string) => void; grouped: boolean; fmt: ReturnType<typeof useFmt> }) {
  let last = '';
  return (
    <ul className="entry-list" aria-label="Journal entries">
      {entries.map((e) => {
        const m = e.date.slice(0, 7);
        const head = grouped && m !== last ? <li key={'h' + m} className="entry-month" aria-hidden="true">{formatMonthYear(e.date)}</li> : null;
        last = m;
        const { d } = { d: e.date.slice(8) };
        return (
          <Fragment key={e.id}>
            {head}
            <li>
              <button type="button" className={`entry-row ${activeId === e.id ? 'active' : ''}`} onClick={() => onOpen(e.id)} aria-current={activeId === e.id ? 'true' : undefined}>
                <span className="entry-day" aria-hidden="true"><b>{parseInt(d, 10)}</b><span>{fmt.date(e.date, { short: true, year: false }).split(' ')[0]}</span></span>
                <span className="grow">
                  <strong className="truncate" style={{ display: 'block' }}>{ENTITIES.journal.titleOf(e)}</strong>
                  <span className="small muted entry-snip">{snippet(e) || (e.attachmentIds.length ? 'Photos only' : '')}</span>
                  <span className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                    {e.status === 'draft' && <span className="chip warn">Draft</span>}
                    {e.promotedMemoryId && <span className="chip lav">In Legacy</span>}
                    {e.tags.slice(0, 3).map((t) => <span key={t} className="chip plain">#{t}</span>)}
                  </span>
                </span>
              </button>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

function JournalCalendar({ month, setMonth, byDay, day, setDay, onNewOnDay }: { month: string; setMonth: (m: string) => void; byDay: Map<string, JournalEntry[]>; day: string; setDay: (d: string) => void; onNewOnDay: (d: string) => void }) {
  const { settings } = useSettings();
  const fmt = useFmt();
  const today = fmt.today();
  const cells = monthGrid(month, settings.weekStart);
  const dows = cells.slice(0, 7).map((d) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8))).getUTCDay());
  return (
    <div className="mini-cal card flat">
      <div className="row between">
        <IconButton icon="chevL" label="Previous month" size="sm" onClick={() => setMonth(addMonths(month, -1))} />
        <strong aria-live="polite">{formatMonthYear(month)}</strong>
        <IconButton icon="chevR" label="Next month" size="sm" onClick={() => setMonth(addMonths(month, 1))} />
      </div>
      <div className="mini-grid" role="grid" aria-label={`Journal activity, ${formatMonthYear(month)}`}>
        {dows.map((w, i) => <span key={i} className="mini-dow" aria-hidden="true">{weekdayLetter(w)}</span>)}
        {cells.map((d) => {
          const n = byDay.get(d)?.length ?? 0;
          const out = d.slice(0, 7) !== month.slice(0, 7);
          return (
            <button key={d} type="button" className={`mini-day ${out ? 'out' : ''} ${d === today ? 'today' : ''} ${d === day ? 'sel' : ''} ${n ? 'has' : ''}`}
              aria-label={`${fmt.date(d, { weekday: true })}${n ? `, ${n} ${n === 1 ? 'entry' : 'entries'}` : ''}`} aria-pressed={d === day} onClick={() => setDay(d === day ? '' : d)}>
              {parseInt(d.slice(8), 10)}{n > 0 && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {day && (
        <div className="row between small" style={{ marginTop: 10 }}>
          <span className="muted">{fmt.date(day, { weekday: true })}</span>
          <Button size="sm" icon="plus" onClick={() => onNewOnDay(day)}>Write for this day</Button>
        </div>
      )}
    </div>
  );
}

function YearArchive({ entries, monthFilter, onPick }: { entries: JournalEntry[]; monthFilter: string; onPick: (m: string) => void }) {
  const tree = useMemo(() => {
    const t = new Map<string, Map<string, number>>();
    entries.forEach((e) => { const y = e.date.slice(0, 4); const m = e.date.slice(0, 7); const ym = t.get(y) ?? new Map(); ym.set(m, (ym.get(m) ?? 0) + 1); t.set(y, ym); });
    return [...t.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (
    <div className="stack">
      {tree.map(([y, months]) => (
        <section key={y} className="card flat pad-sm" aria-label={`Year ${y}`}>
          <div className="row between"><strong className="serif" style={{ fontSize: 20 }}>{y}</strong><span className="small faint">{[...months.values()].reduce((a, b) => a + b, 0)} entries</span></div>
          <div className="year-months">
            {MONTHS.map((mn, i) => {
              const key = `${y}-${String(i + 1).padStart(2, '0')}`;
              const n = months.get(key) ?? 0;
              return <button key={key} type="button" disabled={!n} className={`chip ${monthFilter === key ? 'active' : n ? '' : 'plain'}`} onClick={() => onPick(key)} aria-label={`${mn} ${y}, ${n} entries`}>{mn}{n ? ` · ${n}` : ''}</button>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ============================================================ editor

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const TOOLS: { icon: string; label: string; wrap?: [string, string]; line?: string }[] = [
  { icon: 'bold', label: 'Bold', wrap: ['**', '**'] },
  { icon: 'italic', label: 'Italic', wrap: ['*', '*'] },
  { icon: 'heading', label: 'Heading', line: '## ' },
  { icon: 'quote', label: 'Quote', line: '> ' },
  { icon: 'bullets', label: 'List', line: '- ' },
];

function JournalEditor({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen: (id: string) => void }) {
  const fmt = useFmt();
  const { settings } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const tagSuggestions = useAllTags();
  const all = useRecords<JournalEntry>('journal');
  const [draft, setDraft] = useState<JournalEntry | null>(null);
  const [links, setLinks] = useState<LinkRef[]>([]);
  const [existed, setExisted] = useState(false);
  const [state, setState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [mode, setMode] = useState<'write' | 'read'>('write');
  const [promptOpen, setPromptOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const dirty = useRef(false);
  const draftRef = useRef<JournalEntry | null>(null);
  const linksRef = useRef<LinkRef[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef<Promise<void> | null>(null);
  const deleted = useRef(false);

  // load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const e = await db.journal.get(id);
      const l = e ? await getLinks({ type: 'journal', id }) : [];
      if (cancelled) return;
      const presetDate = sessionStorage.getItem('blueroom.journalNewDate');
      if (!e && presetDate) sessionStorage.removeItem('blueroom.journalNewDate');
      const d: JournalEntry = e ?? { id, createdAt: 0, updatedAt: 0, title: '', body: '', date: presetDate || fmt.today(), category: settings.categories.journal[0] ?? 'Everyday', tags: [], status: 'draft', attachmentIds: [] };
      setExisted(!!e); setDraft(d); draftRef.current = d; setLinks(l); linksRef.current = l;
      if (e) setSavedAt(e.updatedAt), setState('saved');
      if (!e) setTimeout(() => taRef.current?.focus(), 60);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isEmpty = (d: JournalEntry) => !d.title.trim() && !d.body.trim() && d.attachmentIds.length === 0;

  const persist = useCallback(async () => {
    const d = draftRef.current;
    if (!d || deleted.current || !dirty.current) return;
    if (isEmpty(d) && !existed) { dirty.current = false; setState('idle'); return; }
    dirty.current = false;
    setState('saving');
    const run = (async () => {
      try {
        const saved = await saveRecord('journal', d, { skipValidation: true });
        await syncLinks({ type: 'journal', id: d.id }, linksRef.current);
        setExisted(true);
        setSavedAt(saved.updatedAt);
        setState(dirty.current ? 'dirty' : 'saved');
      } catch { setState('error'); dirty.current = true; }
    })();
    savingRef.current = run;
    await run;
  }, [existed]);

  const schedule = useCallback(() => {
    dirty.current = true; setState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { persist(); }, 600);
  }, [persist]);

  // flush on leave / hide
  useEffect(() => {
    const flush = () => { if (timer.current) clearTimeout(timer.current); persist(); };
    const vis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', flush); flush(); };
  }, [persist]);

  const patch = (p: Partial<JournalEntry>) => {
    setDraft((d) => { if (!d) return d; const n = { ...d, ...p }; draftRef.current = n; return n; });
    schedule();
  };
  const changeLinks = (l: LinkRef[]) => { setLinks(l); linksRef.current = l; schedule(); };

  const applyTool = (t: (typeof TOOLS)[number]) => {
    const ta = taRef.current; if (!ta || !draft) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    let next = value; let cs = s; let ce = e;
    if (t.wrap) {
      const sel = value.slice(s, e) || 'text';
      next = value.slice(0, s) + t.wrap[0] + sel + t.wrap[1] + value.slice(e);
      cs = s + t.wrap[0].length; ce = cs + sel.length;
    } else if (t.line) {
      const ls = value.lastIndexOf('\n', s - 1) + 1;
      next = value.slice(0, ls) + t.line + value.slice(ls);
      cs = s + t.line.length; ce = e + t.line.length;
    }
    patch({ body: next });
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(cs, ce); });
  };

  const insertPrompt = (p: string) => {
    if (!draft) return;
    const sep = draft.body && !draft.body.endsWith('\n\n') ? (draft.body.endsWith('\n') ? '\n' : '\n\n') : '';
    patch({ body: `${draft.body}${sep}> ${p}\n\n`, prompt: p });
    setPromptOpen(false);
    requestAnimationFrame(() => { const ta = taRef.current; if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } });
  };

  const keep = async () => {
    if (!draft) return;
    if (isEmpty(draft)) { toast('Write a few words first', { tone: 'error' }); return; }
    if (timer.current) clearTimeout(timer.current);
    draftRef.current = { ...draft, status: 'saved' };
    setDraft(draftRef.current);
    dirty.current = true;
    await persist();
    toast('Entry saved');
  };

  const del = async () => {
    if (!draft) return;
    if (!(await confirm({ title: 'Delete this entry?', tone: 'danger', confirmLabel: 'Delete entry', body: 'This entry and its photos will be removed. If you promoted it to a Legacy memory, that memory stays.' }))) return;
    deleted.current = true;
    if (timer.current) clearTimeout(timer.current);
    await deleteRecord('journal', draft.id);
    toast('Entry deleted');
    nav('/journal', { replace: true });
  };

  const promote = async () => {
    if (!draft) return;
    if (timer.current) clearTimeout(timer.current);
    dirty.current = true; await persist();
    const m = await promoteJournalToMemory(draftRef.current!, fmt.today());
    const fresh = await db.journal.get(draft.id);
    if (fresh) { setDraft(fresh); draftRef.current = fresh; }
    toast('Saved to your Legacy memories', { action: { label: 'View', run: () => nav(`/legacy/memories?open=${m.id}`) } });
  };

  // neighbours by date
  const sorted = useMemo(() => [...(all ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt), [all]);
  const idx = sorted.findIndex((e) => e.id === id);
  const prev = idx > 0 ? sorted[idx - 1] : undefined;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : undefined;

  if (!draft) return <div className="journal-editor" aria-busy="true" />;
  const words = draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0;
  const statusText = state === 'saving' ? 'Saving…' : state === 'dirty' ? 'Unsaved changes…' : state === 'error' ? 'Couldn’t save — retrying when you type' : savedAt ? `${draft.status === 'draft' ? 'Draft saved' : 'Saved'} · ${fmt.time(new Date(savedAt).toTimeString().slice(0, 5))}` : 'Nothing saved yet';

  return (
    <article className="journal-editor" aria-label="Journal entry">
      <div className="editor-top">
        <IconButton icon="chevL" label="Back to journal" className="only-mobile" onClick={onBack} />
        <div className="grow row" style={{ gap: 6 }}>
          <IconButton icon="chevL" label="Previous entry" size="sm" disabled={!prev} onClick={() => prev && onOpen(prev.id)} />
          <input className="input date-input" type="date" aria-label="Entry date" value={draft.date} onChange={(e) => e.target.value && patch({ date: e.target.value })} />
          <IconButton icon="chevR" label="Next entry" size="sm" disabled={!next} onClick={() => next && onOpen(next.id)} />
        </div>
        <span className={`save-status ${state}`} role="status" aria-live="polite">{statusText}</span>
      </div>

      <input className="title-input serif" aria-label="Title" placeholder="Title (optional)" value={draft.title} maxLength={140} onChange={(e) => patch({ title: e.target.value })} />

      <div className="editor-tools" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => <button key={t.label} type="button" className="icon-btn sm" aria-label={t.label} title={t.label} onClick={() => applyTool(t)} disabled={mode === 'read'}><Icon name={t.icon} /></button>)}
        <span className="tool-sep" aria-hidden="true" />
        {settings.journalPrompts.enabled && settings.journalPrompts.list.length > 0 && (
          <div className="prompt-wrap">
            <Button size="sm" variant="ghost" icon="sparkle" aria-expanded={promptOpen} onClick={() => setPromptOpen((o) => !o)}>Need a spark?</Button>
            {promptOpen && (
              <div className="prompt-menu" role="menu">
                <div className="tiny faint" style={{ padding: '6px 10px' }}>Optional — use one, or none.</div>
                {settings.journalPrompts.list.map((p) => <button key={p} role="menuitem" type="button" onClick={() => insertPrompt(p)}>{p}</button>)}
              </div>
            )}
          </div>
        )}
        <div className="grow" />
        <Segmented<'write' | 'read'> label="Mode" value={mode} onChange={setMode} options={[{ value: 'write', label: 'Write' }, { value: 'read', label: 'Read' }]} />
      </div>

      {mode === 'write' ? (
        <textarea ref={taRef} className="canvas serif" aria-label="Entry text" placeholder="What’s on your mind?" value={draft.body} onChange={(e) => patch({ body: e.target.value })} />
      ) : (
        <div className="canvas read serif">{draft.body.trim() ? <Markdown text={draft.body} /> : <p className="faint">Nothing written yet.</p>}</div>
      )}
      <div className="tiny faint" style={{ textAlign: 'right' }}>{words} {words === 1 ? 'word' : 'words'}</div>

      <div className="editor-meta">
        <div className="grid-2">
          <div className="field"><label htmlFor="j-cat">Category</label>
            <select id="j-cat" className="select" value={draft.category} onChange={(e) => patch({ category: e.target.value })}>
              {!settings.categories.journal.includes(draft.category) && <option>{draft.category}</option>}
              {settings.categories.journal.map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <TagInput value={draft.tags} onChange={(t) => patch({ tags: t })} suggestions={tagSuggestions} />
        </div>
        <AttachmentPicker label="Photos" value={draft.attachmentIds} onChange={(ids) => patch({ attachmentIds: ids })} />
        <LinksField value={links} onChange={changeLinks} selfRef={{ type: 'journal', id: draft.id }} types={['goal', 'event', 'person', 'place', 'decision', 'memory', 'lesson', 'odyssey', 'achievement', 'chapter']} hint="Optional — connect this entry to goals, events, people and more." />
      </div>

      <div className="editor-actions">
        {existed && <Button variant="danger" icon="trash" onClick={del}>Delete</Button>}
        <div className="grow" />
        <PromoteButton entry={draft} onPromote={promote} disabled={isEmpty(draft)} />
        <Button variant="primary" icon="check" onClick={keep}>{draft.status === 'draft' ? 'Keep entry' : 'Save now'}</Button>
      </div>
    </article>
  );
}

function PromoteButton({ entry, onPromote, disabled }: { entry: JournalEntry; onPromote: () => void; disabled: boolean }) {
  if (entry.promotedMemoryId) return <Link className="btn soft" to={`/legacy/memories?open=${entry.promotedMemoryId}`}><Icon name="memory" />In Legacy · view memory</Link>;
  return <Button icon="memory" disabled={disabled} onClick={onPromote} title="Preserve this entry as a long-term Legacy memory">Promote to memory</Button>;
}

export { AttachmentGallery, Field, useLinks };
