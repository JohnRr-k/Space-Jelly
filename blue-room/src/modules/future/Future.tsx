import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Button, Chips, EmptyState, Field, IconButton, Modal, PageHeader, ProgressBar, Segmented, SelectField, TagInput, TextField, useConfirm, useOnce, useToast } from '../../components/ui';
import { AttachmentGallery, AttachmentPicker, CoverImage } from '../../components/media';
import { LinksField, RelatedLinks } from '../../components/links';
import { useAllTags, useRecords } from '../../app/hooks';
import { useFmt, useSettings } from '../../app/settings';
import { deleteRecord, getLinks, newId, saveRecord, syncLinks, validateRecord } from '../../data/repo';
import { searchText } from '../../data/entities';
import { GOAL_STATUSES, type Goal, type GoalMilestone, type GoalStatus, type LinkRef } from '../../data/types';
import { relativeDays } from '../../lib/dates';
import { useOpenParam } from '../RecordKit';

export function goalProgress(g: Goal): number {
  if (g.status === 'Completed') return 100;
  if (g.progressMode === 'auto' && g.milestones.length) return Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100);
  return Math.max(0, Math.min(100, g.manualProgress || 0));
}

const blankGoal = (category: string, today: string): Goal => ({
  id: newId(), createdAt: 0, updatedAt: 0, title: '', description: '', category, startDate: today, targetDate: '', priority: 'Medium', status: 'Not Started',
  progressMode: 'auto', manualProgress: 0, milestones: [], notes: '', tags: [], attachmentIds: [],
});

const BOARD: GoalStatus[] = ['Not Started', 'In Progress', 'On Hold', 'Completed'];

export default function Future() {
  const { settings } = useSettings();
  const fmt = useFmt();
  const goals = useRecords<Goal>('goal');
  const [view, setView] = useState<'board' | 'list' | 'archive'>('board');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [openId, setOpenId] = useOpenParam();
  const [editing, setEditing] = useState<Goal | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (goals ?? [])
      .filter((g) => (cat ? g.category === cat : true))
      .filter((g) => (needle ? searchText(g).toLowerCase().includes(needle) : true));
  }, [goals, q, cat]);
  const active = filtered.filter((g) => g.status !== 'Archived');
  const archived = filtered.filter((g) => g.status === 'Archived');
  const counts = useMemo(() => ({
    progress: (goals ?? []).filter((g) => g.status === 'In Progress').length,
    done: (goals ?? []).filter((g) => g.status === 'Completed').length,
    total: (goals ?? []).filter((g) => g.status !== 'Archived').length,
  }), [goals]);

  const newGoal = () => setEditing(blankGoal(settings.categories.goal[0] ?? 'Personal', fmt.today()));
  const [sp, setSp] = useSearchParams();
  useEffect(() => {
    if (sp.get('new')) { newGoal(); setSp((p) => { const n = new URLSearchParams(p); n.delete('new'); return n; }, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.get('new')]);

  return (
    <div className="page wide">
      <PageHeader
        eyebrow="My Future" icon="goal" title="What I’m growing toward"
        sub={goals && counts.total ? `${counts.progress} in progress · ${counts.done} completed · ${counts.total} in all. Plans can change — that’s allowed.` : 'Goals are specific things you hope to make real. Break them into small milestones when that helps.'}
        actions={<Button variant="primary" icon="plus" onClick={newGoal}>New goal</Button>}
      />
      <div className="toolbar">
        <Segmented<'board' | 'list' | 'archive'> label="View" value={view} onChange={setView} options={[{ value: 'board', label: 'Board' }, { value: 'list', label: 'List' }, { value: 'archive', label: `Archive${archived.length ? ` · ${archived.length}` : ''}` }]} />
        <div className="search"><Icon name="search" /><input className="input" type="search" aria-label="Search goals" placeholder="Search goals…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select" style={{ width: 'auto', borderRadius: 999 }} aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {[...new Set([...settings.categories.goal, ...(goals ?? []).map((g) => g.category)])].filter(Boolean).map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {goals === undefined ? null : goals.length === 0 ? (
        <EmptyState title="Nothing planned yet — and that’s fine" body="When something starts to feel like a direction, give it a name here. You can always change it later." action={<Button variant="primary" icon="plus" onClick={newGoal}>Create a goal</Button>} />
      ) : view === 'board' ? (
        <div className="goal-board">
          {BOARD.map((st) => {
            const list = active.filter((g) => g.status === st).sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999'));
            return (
              <section key={st} className="goal-col" aria-label={st}>
                <h2><span className={`dot s-${st.replace(/\s/g, '')}`} />{st}<span className="chip plain">{list.length}</span></h2>
                {list.length === 0 && <p className="tiny faint">{st === 'In Progress' ? 'Nothing underway right now.' : 'Empty for now.'}</p>}
                {list.map((g) => <GoalCard key={g.id} g={g} onOpen={() => setOpenId(g.id)} />)}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="goal-list">
          {(view === 'archive' ? archived : active).sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999')).map((g) => <GoalCard key={g.id} g={g} wide onOpen={() => setOpenId(g.id)} />)}
          {(view === 'archive' ? archived : active).length === 0 && <EmptyState compact title={view === 'archive' ? 'Nothing archived' : 'No goals match'} body={view === 'archive' ? 'Completed goals you tuck away will rest here.' : 'Try clearing the filters.'} />}
        </div>
      )}

      <GoalDetail id={openId} onClose={() => setOpenId(null)} onEdit={(g) => setEditing(g)} />
      <GoalEditor goal={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function GoalCard({ g, onOpen, wide }: { g: Goal; onOpen: () => void; wide?: boolean }) {
  const fmt = useFmt();
  const today = fmt.today();
  const p = goalProgress(g);
  const open = g.status !== 'Completed' && g.status !== 'Archived';
  const passed = open && g.targetDate && g.targetDate < today;
  const done = g.milestones.filter((m) => m.done).length;
  return (
    <button type="button" className={`goal-card ${wide ? 'wide' : ''}`} onClick={onOpen}>
      <CoverImage ids={g.attachmentIds} className="goal-img" />
      <div className="row between wrap" style={{ gap: 6 }}>
        <span className="chip">{g.category || 'Goal'}</span>
        <span className={`prio p-${g.priority}`} title={`${g.priority} priority`}>{g.priority}</span>
      </div>
      <strong className="goal-title">{g.title}</strong>
      <ProgressBar value={p} label={`${g.title} progress`} thin />
      <div className="row between small muted">
        <span>{p}%{g.milestones.length ? ` · ${done}/${g.milestones.length} steps` : ''}</span>
        {g.targetDate && <span className={passed ? 'gentle' : ''}>{passed ? 'Target passed' : `By ${fmt.date(g.targetDate, { short: true })}`}</span>}
      </div>
    </button>
  );
}

// ============================================================ detail

function GoalDetail({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (g: Goal) => void }) {
  const goals = useRecords<Goal>('goal');
  const g = id ? goals?.find((x) => x.id === id) : undefined;
  const fmt = useFmt();
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const today = fmt.today();

  const setStatus = async (status: GoalStatus) => {
    if (!g) return;
    await saveRecord('goal', { ...g, status, completedOn: status === 'Completed' ? g.completedOn || today : status === 'Archived' ? g.completedOn : '' });
    toast(status === 'Completed' ? 'Marked complete — well done' : `Status: ${status}`);
  };
  const toggleMilestone = async (mid: string) => {
    if (!g) return;
    const milestones = g.milestones.map((m) => (m.id === mid ? { ...m, done: !m.done, doneAt: !m.done ? today : undefined } : m));
    await saveRecord('goal', { ...g, milestones, status: g.status === 'Not Started' && milestones.some((m) => m.done) ? 'In Progress' : g.status });
  };
  const del = async () => {
    if (!g) return;
    if (!(await confirm({ title: 'Delete this goal?', tone: 'danger', confirmLabel: 'Delete goal', body: <>“{g.title}” and its milestones will be removed. Archiving keeps it without cluttering the board — consider that instead.</> }))) return;
    await deleteRecord('goal', g.id); toast('Goal deleted'); onClose();
  };
  const allDone = g && g.milestones.length > 0 && g.milestones.every((m) => m.done) && g.status !== 'Completed' && g.status !== 'Archived';

  return (
    <Modal open={!!g} onClose={onClose} size="lg" title={g?.title ?? ''}
      footer={g && <>
        <div className="left"><Button variant="danger" icon="trash" onClick={del}>Delete</Button></div>
        {g.status === 'Completed' && <Button icon="download" onClick={() => setStatus('Archived')}>Archive</Button>}
        {g.status === 'Archived' && <Button onClick={() => setStatus('In Progress')}>Restore</Button>}
        <Button icon="calendar" onClick={() => nav(`/calendar?new=1&title=${encodeURIComponent(g.title)}&link=goal:${g.id}`)}>Schedule time</Button>
        <Button variant="primary" icon="edit" onClick={() => onEdit(g)}>Edit</Button>
      </>}>
      {g && (
        <div className="stack lg">
          <div className="row wrap"><span className="chip">{g.category}</span><span className={`prio p-${g.priority}`}>{g.priority} priority</span>{g.targetDate && <span className="chip plain"><Icon name="flag" size={13} />{fmt.date(g.targetDate)} · {relativeDays(g.targetDate, today)}</span>}</div>
          <div className="stack sm">
            <div className="row between"><strong>Progress</strong><span className="muted">{goalProgress(g)}%</span></div>
            <ProgressBar value={goalProgress(g)} label="Goal progress" />
            {g.status !== 'Completed' && g.status !== 'Archived' && g.targetDate && g.targetDate < today && (
              <p className="small muted">The target date has passed. That’s okay — you can keep going, move the date, or put this on hold.</p>
            )}
          </div>
          <div className="stack sm">
            <div className="card-title"><span className="left"><Icon name="swap" />Status</span></div>
            <div className="chips">{GOAL_STATUSES.filter((s) => s !== 'Archived').map((s) => <button key={s} type="button" className={`chip ${g.status === s ? 'active' : ''}`} aria-pressed={g.status === s} onClick={() => g.status !== s && setStatus(s)}>{s}</button>)}
              {g.status === 'Archived' && <span className="chip lav">Archived</span>}</div>
            {g.completedOn && g.status === 'Completed' && <p className="small muted">Completed on {fmt.date(g.completedOn)}.</p>}
            {allDone && <div className="callout ok"><Icon name="check" /><div>Every milestone is done. <button className="btn soft sm" style={{ marginLeft: 8 }} onClick={() => setStatus('Completed')}>Mark goal complete</button></div></div>}
          </div>
          {g.description && <p className="pre">{g.description}</p>}
          {g.milestones.length > 0 && (
            <div className="stack sm">
              <div className="card-title"><span className="left"><Icon name="flag" />Milestones</span></div>
              <ul className="milestones">
                {g.milestones.map((m) => (
                  <li key={m.id}>
                    <label className="checkline"><input type="checkbox" checked={m.done} onChange={() => toggleMilestone(m.id)} /><span className={m.done ? 'done-text' : ''}>{m.title}</span></label>
                    <span className="tiny faint">{m.done && m.doneAt ? `Done ${fmt.date(m.doneAt, { short: true })}` : m.targetDate ? `By ${fmt.date(m.targetDate, { short: true })}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {g.notes && <div className="stack sm"><div className="card-title"><span className="left"><Icon name="note" />Notes</span></div><p className="pre">{g.notes}</p></div>}
          <AttachmentGallery ids={g.attachmentIds} />
          <Chips items={g.tags} />
          <RelatedLinks type="goal" id={g.id} />
          <div className="tiny faint">Started {g.startDate ? fmt.date(g.startDate) : '—'} · Updated {new Date(g.updatedAt).toLocaleDateString()}</div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================ editor

function GoalEditor({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { settings, update } = useSettings();
  const toast = useToast();
  const tags = useAllTags();
  const all = useRecords<Goal>('goal');
  const [d, setD] = useState<Goal | null>(null);
  const [links, setLinks] = useState<LinkRef[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fmt = useFmt();
  const existing = !!(goal && all?.some((x) => x.id === goal.id));

  useEffect(() => {
    if (!goal) { setD(null); return; }
    setD({ ...goal, milestones: goal.milestones.map((m) => ({ ...m })) }); setErrors([]);
    getLinks({ type: 'goal', id: goal.id }).then(setLinks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal?.id]);

  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setD((x) => (x ? { ...x, [k]: v } : x));
  const setMs = (id: string, p: Partial<GoalMilestone>) => setD((x) => (x ? { ...x, milestones: x.milestones.map((m) => (m.id === id ? { ...m, ...p } : m)) } : x));
  const addMs = () => setD((x) => (x ? { ...x, milestones: [...x.milestones, { id: newId(), title: '', done: false }] } : x));

  const [save, saving] = useOnce(async () => {
    if (!d) return;
    const ms = d.milestones.filter((m) => m.title.trim()).map((m) => ({ ...m, title: m.title.trim(), doneAt: m.done ? m.doneAt || fmt.today() : undefined }));
    let next: Goal = { ...d, title: d.title.trim(), milestones: ms, manualProgress: Math.max(0, Math.min(100, Number(d.manualProgress) || 0)) };
    if (next.status === 'Completed' && !next.completedOn) next.completedOn = fmt.today();
    if (next.status !== 'Completed' && next.status !== 'Archived') next.completedOn = '';
    const errs = validateRecord('goal', next);
    if (next.startDate && next.targetDate && next.targetDate < next.startDate) errs.push('The target date is before the start date.');
    if (errs.length) { setErrors(errs); return; }
    await saveRecord('goal', next);
    await syncLinks({ type: 'goal', id: next.id }, links);
    if (next.category && !settings.categories.goal.includes(next.category)) update((s) => ({ ...s, categories: { ...s.categories, goal: [...s.categories.goal, next.category] } }));
    toast(existing ? 'Goal saved' : 'Goal created');
    onClose();
  });

  return (
    <Modal open={!!d} onClose={onClose} size="lg" title={existing ? 'Edit goal' : 'New goal'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="check" disabled={saving} onClick={() => save()}>Save goal</Button></>}>
      {d && (
        <form className="stack lg" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {errors.length > 0 && <div className="callout warn" role="alert"><Icon name="warn" /><div>{errors.map((e) => <div key={e}>{e}</div>)}</div></div>}
          <TextField label="Goal" required autoFocus={!existing} value={d.title} onChange={(v) => set('title', v)} placeholder="What do you hope to make real?" />
          <TextField label="Description" multiline rows={3} value={d.description} onChange={(v) => set('description', v)} />
          <div className="grid-3">
            <Field label="Category" htmlFor="g-cat">
              <input id="g-cat" list="goal-cats" className="input" value={d.category} onChange={(e) => set('category', e.target.value)} />
              <datalist id="goal-cats">{settings.categories.goal.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <SelectField label="Priority" value={d.priority} onChange={(v) => set('priority', v as Goal['priority'])} options={['Low', 'Medium', 'High']} />
            <SelectField label="Status" value={d.status} onChange={(v) => set('status', v as GoalStatus)} options={[...GOAL_STATUSES]} />
          </div>
          <div className="grid-3">
            <TextField label="Start date" type="date" value={d.startDate ?? ''} onChange={(v) => set('startDate', v)} />
            <TextField label="Target date" type="date" value={d.targetDate ?? ''} onChange={(v) => set('targetDate', v)} hint="Optional" />
            {d.status === 'Completed' && <TextField label="Completed on" type="date" value={d.completedOn ?? ''} onChange={(v) => set('completedOn', v)} />}
          </div>

          <div className="stack sm">
            <div className="label" style={{ fontWeight: 650, fontSize: 13, color: 'var(--ink-2)' }}>Milestones <span className="hint faint">Small steps that make it real</span></div>
            {d.milestones.map((m, i) => (
              <div className="ms-row" key={m.id}>
                <input type="checkbox" aria-label={`Milestone ${i + 1} done`} checked={m.done} onChange={(e) => setMs(m.id, { done: e.target.checked })} />
                <input className="input" aria-label={`Milestone ${i + 1} title`} placeholder="A step along the way" value={m.title} onChange={(e) => setMs(m.id, { title: e.target.value })} />
                <input className="input ms-date" type="date" aria-label={`Milestone ${i + 1} date`} value={m.targetDate ?? ''} onChange={(e) => setMs(m.id, { targetDate: e.target.value || undefined })} />
                <IconButton icon="trash" label={`Remove milestone ${i + 1}`} size="sm" onClick={() => set('milestones', d.milestones.filter((x) => x.id !== m.id))} />
              </div>
            ))}
            <div><Button size="sm" icon="plus" onClick={addMs}>Add milestone</Button></div>
          </div>

          <div className="stack sm">
            <Segmented<'auto' | 'manual'> label="Progress tracking" value={d.progressMode} onChange={(v) => set('progressMode', v)} options={[{ value: 'auto', label: 'From milestones' }, { value: 'manual', label: 'Set manually' }]} />
            {(d.progressMode === 'manual' || d.milestones.length === 0) && (
              <div className="field"><label htmlFor="g-prog">Progress: {d.manualProgress}%</label><input id="g-prog" className="range" type="range" min={0} max={100} step={5} value={d.manualProgress} onChange={(e) => set('manualProgress', Number(e.target.value))} /></div>
            )}
          </div>

          <TextField label="Notes" multiline rows={3} value={d.notes} onChange={(v) => set('notes', v)} hint="Reflections, adjustments, what you’re learning" />
          <TagInput value={d.tags} onChange={(t) => set('tags', t)} suggestions={tags} />
          <AttachmentPicker label="Supporting attachments" allowPdf value={d.attachmentIds} onChange={(ids) => set('attachmentIds', ids)} />
          <LinksField value={links} onChange={setLinks} selfRef={{ type: 'goal', id: d.id }} types={['journal', 'memory', 'event', 'odyssey', 'decision', 'achievement', 'person', 'place', 'chapter', 'lesson']} hint="Journal entries, memories, calendar events and more." />
        </form>
      )}
    </Modal>
  );
}

export { Link };
