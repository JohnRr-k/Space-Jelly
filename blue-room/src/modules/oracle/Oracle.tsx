import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Button, Chips, EmptyState, Field, IconButton, Modal, PageHeader, Reveal, Segmented, SelectField, TagInput, TextField, useConfirm, useOnce, useToast } from '../../components/ui';
import { LinksField, RelatedLinks } from '../../components/links';
import { useAllTags, useRecord, useRecords } from '../../app/hooks';
import { useFmt } from '../../app/settings';
import { db } from '../../data/db';
import { deleteRecord, getLinks, ImmutableRecordError, newId, recordDecision, saveRecord, saveReflection, syncLinks, ValidationError, validateDecisionForRecording } from '../../data/repo';
import type { AnyRecord, Decision, DecisionReflection, LinkRef, WisdomItem } from '../../data/types';
import { diffDays, relativeDays } from '../../lib/dates';
import { byRecent, RecordWorkspace } from '../RecordKit';
import type { RecordConfig } from '../RecordKit';

// ============================================================ shell

export default function Oracle() {
  return (
    <div className="page oracle">
      <Routes>
        <Route index element={<OracleFrame title="Oracle" sub="A quiet place to keep the reasoning behind your decisions, and to learn from how they turned out."><Overview /></OracleFrame>} />
        <Route path="decisions" element={<OracleFrame title="Decisions" sub="Each record keeps your thinking exactly as it was when you made the choice."><DecisionList /></OracleFrame>} />
        <Route path="decisions/new" element={<NewDecision />} />
        <Route path="decisions/:id" element={<DecisionPage />} />
        <Route path="replay" element={<OracleFrame title="Decision Replay" sub="Revisit an old decision as you saw it then — before you remember how it turned out."><ReplayPicker /></OracleFrame>} />
        <Route path="replay/:id" element={<Replay />} />
        <Route path="wisdom" element={<OracleFrame title="Wisdom Library" sub="Principles and patterns that came from your own decisions."><Wisdom /></OracleFrame>} />
        <Route path="*" element={<Navigate to="/oracle" replace />} />
      </Routes>
    </div>
  );
}

function NewDecision() {
  const id = useMemo(() => newId(), []);
  return <Navigate to={`/oracle/decisions/${id}`} replace />;
}

function OracleFrame({ title, sub, children, actions }: { title: string; sub: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <PageHeader eyebrow="Oracle" icon="oracle" title={title} sub={sub} actions={actions} />
      <nav className="tabs" aria-label="Oracle sections">
        <NavLink to="/oracle" end><Icon name="oracle" />Overview</NavLink>
        <NavLink to="/oracle/decisions"><Icon name="note" />Decisions</NavLink>
        <NavLink to="/oracle/replay"><Icon name="refresh" />Replay</NavLink>
        <NavLink to="/oracle/wisdom"><Icon name="wisdom" />Wisdom</NavLink>
      </nav>
      {children}
    </>
  );
}

// ============================================================ helpers

const statusOf = (d: Decision, refl: DecisionReflection[], today: string) => {
  if (d.status === 'draft') return { label: 'Draft', cls: 'warn' };
  const has = refl.some((r) => r.kind === 'outcome');
  if (has) return { label: 'Reflected on', cls: 'ok' };
  if (d.reviewDate && d.reviewDate <= today) return { label: 'Ready for a second look', cls: 'lav' };
  return { label: 'Recorded', cls: '' };
};

function useReflections() {
  const refl = useRecords<DecisionReflection>('reflection');
  return useMemo(() => {
    const m = new Map<string, DecisionReflection[]>();
    (refl ?? []).forEach((r) => m.set(r.decisionId, [...(m.get(r.decisionId) ?? []), r]));
    m.forEach((v) => v.sort((a, b) => a.createdAt - b.createdAt));
    return { map: m, all: refl };
  }, [refl]);
}

// ============================================================ overview

function Overview() {
  const fmt = useFmt();
  const nav = useNavigate();
  const decisions = useRecords<Decision>('decision');
  const wisdom = useRecords<WisdomItem>('wisdom');
  const { map: reflMap } = useReflections();
  const today = fmt.today();
  const recorded = (decisions ?? []).filter((d) => d.status === 'recorded');
  const drafts = (decisions ?? []).filter((d) => d.status === 'draft');
  const reflected = recorded.filter((d) => (reflMap.get(d.id) ?? []).some((r) => r.kind === 'outcome'));
  const due = recorded.filter((d) => !reflected.includes(d) && d.reviewDate && d.reviewDate <= today).sort((a, b) => (a.reviewDate ?? '').localeCompare(b.reviewDate ?? ''));

  // Patterns: transparent arithmetic over the owner's own reflections — no AI involved.
  const pattern = useMemo(() => {
    const rows = reflected.map((d) => ({ d, r: [...(reflMap.get(d.id) ?? [])].reverse().find((x) => x.kind === 'outcome')! })).filter((x) => x.r.expectedAchieved && x.r.expectedAchieved !== 'unclear');
    if (rows.length < 3) return null;
    const hit = rows.filter((x) => x.r.expectedAchieved === 'yes');
    const miss = rows.filter((x) => x.r.expectedAchieved === 'no' || x.r.expectedAchieved === 'partly');
    const avg = (xs: typeof rows) => (xs.length ? Math.round(xs.reduce((a, x) => a + x.d.confidence, 0) / xs.length) : null);
    return { n: rows.length, hit: hit.length, avgAll: avg(rows), avgHit: avg(hit), avgMiss: avg(miss) };
  }, [reflected, reflMap]);

  const pillars = [
    { icon: 'note', title: 'Decision Records', body: 'Capture the situation, options, reasoning and what you expect — frozen as written.', to: '/oracle/decisions', n: `${recorded.length} recorded${drafts.length ? ` · ${drafts.length} draft${drafts.length > 1 ? 's' : ''}` : ''}` },
    { icon: 'eye', title: 'Outcome Reflection', body: 'Come back when the results are clearer and add what actually happened — separately.', to: '/oracle/decisions', n: `${reflected.length} reflected on` },
    { icon: 'refresh', title: 'Decision Replay', body: 'Step back into what you knew then, and compare it with what you know now.', to: '/oracle/replay', n: recorded.length ? 'Choose a decision to replay' : 'Needs a recorded decision' },
    { icon: 'wisdom', title: 'Wisdom Library', body: 'Keep the principles and patterns your own decisions have taught you.', to: '/oracle/wisdom', n: `${wisdom?.length ?? 0} entries` },
  ];

  return (
    <div className="stack lg">
      <div className="pillars">
        {pillars.map((p, i) => (
          <Reveal key={p.title} delay={i * 50}>
            <Link to={p.to} className="card-link pillar">
              <span className="pillar-ico"><Icon name={p.icon} /></span>
              <strong>{p.title}</strong>
              <span className="small muted">{p.body}</span>
              <span className="chip plain" style={{ alignSelf: 'flex-start' }}>{p.n}</span>
            </Link>
          </Reveal>
        ))}
      </div>
      <div className="grid-2 oracle-two">
        <section className="card" aria-label="Waiting for a second look">
          <div className="card-title"><span className="left"><Icon name="clock" />Ready for a second look</span></div>
          {due.length === 0 ? (
            <p className="muted" style={{ marginTop: 10 }}>{recorded.length ? 'Nothing is waiting. When a review date arrives, the decision will appear here.' : 'Record a decision and give it a review date — it will resurface here when it’s time.'}</p>
          ) : (
            <div className="rowlist" style={{ marginTop: 6 }}>
              {due.slice(0, 5).map((d) => <Link key={d.id} to={`/oracle/decisions/${d.id}`} className="rowitem"><Icon name="note" /><span className="grow"><strong>{d.title}</strong><span className="meta" style={{ display: 'block' }}>Review date {fmt.date(d.reviewDate, { short: true })}</span></span><Icon name="chevR" /></Link>)}
            </div>
          )}
          <div style={{ marginTop: 14 }}><Button variant="primary" icon="plus" onClick={() => nav(`/oracle/decisions/${newId()}`)}>Record a decision</Button></div>
        </section>
        <section className="card" aria-label="Patterns so far">
          <div className="card-title"><span className="left"><Icon name="sparkle" />Patterns so far</span></div>
          {pattern ? (
            <div className="stack" style={{ marginTop: 10 }}>
              <p>Across {pattern.n} reflected decisions, {pattern.hit} went as you expected.</p>
              {pattern.avgHit !== null && pattern.avgMiss !== null && <p className="muted">Your average confidence was <strong>{pattern.avgHit}%</strong> when things went as expected, and <strong>{pattern.avgMiss}%</strong> when they didn’t quite.</p>}
              <p className="tiny faint">Simple arithmetic over your own reflections — not advice, and with few decisions it’s only a hint.</p>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 10 }}>Once you’ve reflected on a few decisions, simple patterns (like how your confidence compares with how things turned out) appear here. Nothing is guessed on your behalf.</p>
          )}
        </section>
      </div>
      {drafts.length > 0 && (
        <section className="card" aria-label="Drafts">
          <div className="card-title"><span className="left"><Icon name="edit" />Unfinished drafts</span></div>
          <div className="rowlist">{drafts.map((d) => <Link key={d.id} to={`/oracle/decisions/${d.id}`} className="rowitem"><Icon name="edit" /><span className="grow">{d.title || 'Untitled decision'}</span><span className="meta">Edited {new Date(d.updatedAt).toLocaleDateString()}</span></Link>)}</div>
        </section>
      )}
    </div>
  );
}

// ============================================================ list

function DecisionList() {
  const fmt = useFmt();
  const nav = useNavigate();
  const decisions = useRecords<Decision>('decision');
  const { map: reflMap } = useReflections();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'reflected' | 'draft'>('all');
  const today = fmt.today();
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (decisions ?? []).filter((d) => {
      const reflected = (reflMap.get(d.id) ?? []).some((r) => r.kind === 'outcome');
      if (filter === 'draft' && d.status !== 'draft') return false;
      if (filter === 'reflected' && !reflected) return false;
      if (filter === 'pending' && (d.status !== 'recorded' || reflected)) return false;
      if (needle && !(`${d.title} ${d.context} ${d.situation} ${d.objective} ${d.reasoning} ${d.tags.join(' ')} ${d.options.map((o) => o.name).join(' ')}`.toLowerCase().includes(needle))) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [decisions, reflMap, q, filter]);

  return (
    <>
      <div className="toolbar">
        <div className="search"><Icon name="search" /><input className="input" type="search" aria-label="Search decisions" placeholder="Search decisions…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Segmented<typeof filter> label="Filter" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'pending', label: 'Awaiting reflection' }, { value: 'reflected', label: 'Reflected on' }, { value: 'draft', label: 'Drafts' }]} />
        <div className="grow" />
        <Button variant="primary" icon="plus" onClick={() => nav(`/oracle/decisions/${newId()}`)}>Record a decision</Button>
      </div>
      {decisions === undefined ? null : decisions.length === 0 ? (
        <EmptyState title="No decisions recorded yet" body="When you’re weighing something that matters, write down what you know and why you’re choosing as you are. Future-you will be glad of it." action={<Button variant="primary" icon="plus" onClick={() => nav(`/oracle/decisions/${newId()}`)}>Record a decision</Button>} />
      ) : list.length === 0 ? <EmptyState compact title="Nothing matches" body="Try another filter or search." /> : (
        <div className="decision-list">
          {list.map((d) => {
            const refl = reflMap.get(d.id) ?? [];
            const st = statusOf(d, refl, today);
            return (
              <Link key={d.id} to={`/oracle/decisions/${d.id}`} className="decision-card card-link">
                <div className="row between wrap">
                  <span className="small faint">{fmt.date(d.date)}</span>
                  <span className={`chip ${st.cls}`}>{st.label}</span>
                </div>
                <strong className="decision-title">{d.title || 'Untitled decision'}</strong>
                {d.status === 'recorded' && <span className="small muted tl-text">Chose: {d.chosenText} · {d.confidence}% confident</span>}
                {d.reviewDate && d.status === 'recorded' && !refl.some((r) => r.kind === 'outcome') && <span className="tiny faint">Review {relativeDays(d.reviewDate, today)}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

// ============================================================ decision page

function DecisionPage() {
  const { id } = useParams();
  const { rec, loading } = useRecord<Decision>('decision', id);
  if (loading || !id) return <div aria-busy="true" />;
  if (!rec || rec.status === 'draft') return <DecisionForm id={id} existing={rec} />;
  return <DecisionRecordView d={rec} />;
}

const blankDecision = (id: string, today: string): Decision => ({
  id, createdAt: 0, updatedAt: 0, title: '', date: today, status: 'draft', context: '', situation: '', objective: '',
  options: [{ id: newId(), name: '', pros: '', cons: '' }, { id: newId(), name: '', pros: '', cons: '' }],
  evidence: '', assumptions: '', constraints: '', risks: '', tradeoffs: '', chosenOptionId: undefined, chosenText: '', reasoning: '', expectedOutcome: '',
  confidence: 60, reviewDate: undefined, tags: [],
});

function DecisionForm({ id, existing }: { id: string; existing?: Decision }) {
  const fmt = useFmt();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const tags = useAllTags();
  const [d, setD] = useState<Decision>(() => existing ?? blankDecision(id, fmt.today()));
  const [links, setLinks] = useState<LinkRef[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(existing?.updatedAt ?? null);
  const [stored, setStored] = useState(!!existing);
  const dirty = useRef(false);
  const dRef = useRef(d); dRef.current = d;
  const linksRef = useRef(links); linksRef.current = links;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lock = useRef(false);

  useEffect(() => { if (existing) getLinks({ type: 'decision', id }).then((l) => { setLinks(l); }); }, [id, existing?.id]);

  const persist = useCallback(async () => {
    if (!dirty.current || lock.current) return;
    const cur = dRef.current;
    if (!cur.title.trim() && !cur.situation.trim() && !cur.reasoning.trim()) return;
    dirty.current = false;
    try {
      const saved = await saveRecord('decision', cur, { skipValidation: true });
      await syncLinks({ type: 'decision', id }, linksRef.current);
      setSavedAt(saved.updatedAt); setStored(true);
    } catch (e) { if (!(e instanceof ImmutableRecordError)) dirty.current = true; }
  }, [id]);
  const touch = () => { dirty.current = true; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(persist, 1200); };
  useEffect(() => {
    const flush = () => { if (timer.current) clearTimeout(timer.current); persist(); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [persist]);

  const set = <K extends keyof Decision>(k: K, v: Decision[K]) => { setD((x) => ({ ...x, [k]: v })); touch(); };
  const setOpt = (oid: string, p: Partial<Decision['options'][number]>) => { setD((x) => ({ ...x, options: x.options.map((o) => (o.id === oid ? { ...o, ...p } : o)) })); touch(); };
  const namedOptions = d.options.filter((o) => o.name.trim());

  const chooseOption = (v: string) => {
    if (v === '__other') { setD((x) => ({ ...x, chosenOptionId: undefined })); touch(); return; }
    const o = d.options.find((x) => x.id === v);
    setD((x) => ({ ...x, chosenOptionId: v, chosenText: o?.name ?? x.chosenText })); touch();
  };

  const [record, recording] = useOnce(async () => {
    const cleaned: Decision = { ...d, title: d.title.trim(), options: d.options.filter((o) => o.name.trim()), chosenText: (d.chosenOptionId ? d.options.find((o) => o.id === d.chosenOptionId)?.name : d.chosenText)?.trim() ?? d.chosenText.trim() };
    const errs = validateDecisionForRecording(cleaned);
    if (errs.length) { setErrors(errs); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!(await confirm({ title: 'Record this decision?', confirmLabel: 'Record it', body: 'Once recorded, your reasoning is preserved exactly as written. You’ll still be able to add reflections and notes later — but you won’t be able to edit this record. That’s what makes it honest.' }))) return;
    lock.current = true;
    if (timer.current) clearTimeout(timer.current);
    try {
      await saveRecord('decision', cleaned, { skipValidation: true });
      await syncLinks({ type: 'decision', id }, links);
      await recordDecision(cleaned);
      toast('Decision recorded');
    } catch (e) {
      lock.current = false;
      setErrors(e instanceof ValidationError ? e.errors : [(e as Error).message]);
    }
  });

  const discard = async () => {
    if (!(await confirm({ title: 'Delete this draft?', tone: 'danger', confirmLabel: 'Delete draft', body: 'The draft will be removed.' }))) return;
    lock.current = true; if (timer.current) clearTimeout(timer.current);
    await deleteRecord('decision', id); nav('/oracle/decisions');
  };

  return (
    <>
      <PageHeader eyebrow="Oracle · Decision" icon="oracle" title={stored ? 'Draft decision' : 'Record a decision'} sub="Write it as you see it now. Don’t tidy it up or soften it — the point is to be able to see how you really thought."
        actions={<span className="small faint" role="status">{savedAt ? `Draft saved · ${new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Drafts save automatically'}</span>} />
      <form className="stack lg decision-form" onSubmit={(e) => { e.preventDefault(); record(); }}>
        {errors.length > 0 && <div className="callout warn" role="alert"><Icon name="warn" /><div><strong>A few things to finish before recording:</strong>{errors.map((e) => <div key={e}>{e}</div>)}</div></div>}

        <section className="card stack" aria-labelledby="ds1">
          <h2 id="ds1" className="step-title"><span className="step-n">1</span>The situation</h2>
          <div className="grid-2"><TextField label="Decision" required autoFocus={!existing} value={d.title} onChange={(v) => set('title', v)} placeholder="What are you deciding?" /><TextField label="Date" type="date" required value={d.date} onChange={(v) => set('date', v)} /></div>
          <TextField label="Context" multiline rows={3} value={d.context} onChange={(v) => set('context', v)} hint="What’s going on in your life around this?" />
          <TextField label="The situation" multiline rows={3} value={d.situation} onChange={(v) => set('situation', v)} hint="What exactly needs deciding, and why now?" />
          <TextField label="Objective" multiline rows={2} value={d.objective} onChange={(v) => set('objective', v)} hint="What are you hoping to achieve?" />
        </section>

        <section className="card stack" aria-labelledby="ds2">
          <h2 id="ds2" className="step-title"><span className="step-n">2</span>Options you’re considering</h2>
          {d.options.map((o, i) => (
            <div className="option-card" key={o.id}>
              <div className="row"><strong className="small faint">Option {i + 1}</strong><div className="grow" />{d.options.length > 2 && <IconButton icon="trash" size="sm" label={`Remove option ${i + 1}`} onClick={() => { setD((x) => ({ ...x, options: x.options.filter((y) => y.id !== o.id), chosenOptionId: x.chosenOptionId === o.id ? undefined : x.chosenOptionId })); touch(); }} />}</div>
              <TextField label="Name" value={o.name} onChange={(v) => setOpt(o.id, { name: v, ...(d.chosenOptionId === o.id ? {} : {}) })} placeholder={i === 0 ? 'e.g. Take the offer' : i === 1 ? 'e.g. Stay as I am' : ''} />
              <div className="grid-2"><TextField label="For" multiline rows={2} value={o.pros} onChange={(v) => setOpt(o.id, { pros: v })} /><TextField label="Against" multiline rows={2} value={o.cons} onChange={(v) => setOpt(o.id, { cons: v })} /></div>
            </div>
          ))}
          <div><Button size="sm" icon="plus" onClick={() => { setD((x) => ({ ...x, options: [...x.options, { id: newId(), name: '', pros: '', cons: '' }] })); touch(); }}>Add an option</Button></div>
        </section>

        <section className="card stack" aria-labelledby="ds3">
          <h2 id="ds3" className="step-title"><span className="step-n">3</span>What you know</h2>
          <TextField label="Evidence" multiline rows={3} value={d.evidence} onChange={(v) => set('evidence', v)} hint="Facts, advice, experience you’re relying on" />
          <TextField label="Assumptions" multiline rows={3} value={d.assumptions} onChange={(v) => set('assumptions', v)} hint="What are you taking for granted that might not be true?" />
          <div className="grid-2"><TextField label="Constraints" multiline rows={2} value={d.constraints} onChange={(v) => set('constraints', v)} /><TextField label="Risks" multiline rows={2} value={d.risks} onChange={(v) => set('risks', v)} /></div>
          <TextField label="Trade-offs" multiline rows={2} value={d.tradeoffs} onChange={(v) => set('tradeoffs', v)} hint="What are you giving up?" />
        </section>

        <section className="card stack" aria-labelledby="ds4">
          <h2 id="ds4" className="step-title"><span className="step-n">4</span>Your choice</h2>
          <SelectField label="Chosen option" value={d.chosenOptionId ?? '__other'} onChange={chooseOption} options={[...namedOptions.map((o) => ({ value: o.id, label: o.name })), { value: '__other', label: 'Something else…' }]} />
          {!d.chosenOptionId && <TextField label="What did you choose?" value={d.chosenText} onChange={(v) => set('chosenText', v)} />}
          <TextField label="Why this one" required multiline rows={4} value={d.reasoning} onChange={(v) => set('reasoning', v)} hint="Your honest reasoning" />
          <TextField label="What you expect to happen" required multiline rows={3} value={d.expectedOutcome} onChange={(v) => set('expectedOutcome', v)} hint="Be specific — you’ll compare against this later" />
          <div className="grid-2">
            <div className="field"><label htmlFor="conf">How confident are you? <span className="hint">{d.confidence}%</span></label><input id="conf" className="range" type="range" min={0} max={100} step={5} value={d.confidence} onChange={(e) => set('confidence', Number(e.target.value))} /></div>
            <TextField label="Look back on" type="date" value={d.reviewDate ?? ''} onChange={(v) => set('reviewDate', v || undefined)} hint="When will you know more? You’ll get a reminder-style nudge here." />
          </div>
          <TagInput value={d.tags} onChange={(t) => set('tags', t)} suggestions={tags} />
          <LinksField value={links} onChange={(l) => { setLinks(l); touch(); }} selfRef={{ type: 'decision', id }} types={['goal', 'chapter', 'journal', 'memory', 'person', 'place', 'event', 'timeline']} hint="Optional — a goal this serves, a chapter it belongs to." />
        </section>

        <div className="row wrap decision-actions">
          {stored && <Button variant="danger" icon="trash" onClick={discard}>Delete draft</Button>}
          <div className="grow" />
          <Button onClick={async () => { if (timer.current) clearTimeout(timer.current); dirty.current = true; await persist(); toast('Draft saved'); nav('/oracle/decisions'); }}>Save draft & close</Button>
          <Button variant="primary" icon="lock" type="submit" disabled={recording}>Record decision</Button>
        </div>
      </form>
    </>
  );
}

// ============================================================ recorded view

function Block({ label, text }: { label: string; text?: string }) {
  if (!text?.trim()) return null;
  return <div className="block"><h3>{label}</h3><p className="pre">{text}</p></div>;
}

const EXPECT_LABEL: Record<string, string> = { yes: 'Yes, largely', partly: 'Partly', no: 'No', unclear: 'Too early to tell' };

function DecisionRecordView({ d }: { d: Decision }) {
  const fmt = useFmt();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { map } = useReflections();
  const refl = map.get(d.id) ?? [];
  const today = fmt.today();
  const st = statusOf(d, refl, today);
  const [reflecting, setReflecting] = useState<DecisionReflection | null>(null);
  const [addendum, setAddendum] = useState<DecisionReflection | null>(null);
  const [connections, setConnections] = useState<LinkRef[] | null>(null);

  const blankRefl = (kind: DecisionReflection['kind']): DecisionReflection => ({ id: newId(), createdAt: 0, updatedAt: 0, decisionId: d.id, kind, date: today, happened: '', expectedAchieved: '', assumptionsRight: '', assumptionsWrong: '', surprised: '', wouldDoDifferently: '', taught: '', text: '' });

  const del = async () => {
    if (!(await confirm({ title: 'Delete this decision?', tone: 'danger', confirmLabel: 'Delete permanently', requireText: 'delete', body: 'This removes the recorded reasoning and every reflection on it. It can’t be undone — and the original record is the point of Oracle.' }))) return;
    await deleteRecord('decision', d.id); toast('Decision deleted'); nav('/oracle/decisions');
  };
  const editConnections = async () => setConnections(await getLinks({ type: 'decision', id: d.id }));

  const toWisdom = (r?: DecisionReflection) => {
    const links: string[] = [`decision:${d.id}`]; if (r) links.push(`reflection:${r.id}`);
    nav(`/oracle/wisdom?new=1&title=${encodeURIComponent('')}&from=${links.join(',')}`);
  };

  return (
    <>
      <PageHeader eyebrow="Oracle · Decision" icon="oracle" title={d.title}
        sub={<>Decided {fmt.date(d.date, { weekday: true })} <span className="faint">· recorded {d.recordedAt ? new Date(d.recordedAt).toLocaleString() : ''}</span></>}
        actions={<Link className="btn ghost" to="/oracle/decisions"><Icon name="chevL" />All decisions</Link>} />
      <div className="row wrap" style={{ marginBottom: 18 }}>
        <span className={`chip ${st.cls}`}>{st.label}</span>
        <span className="chip plain">{d.confidence}% confident</span>
        {d.reviewDate && <span className="chip plain"><Icon name="clock" size={13} />Review {fmt.date(d.reviewDate, { short: true })}</span>}
        <Chips items={d.tags} />
      </div>

      <div className="decision-layout">
        <div className="stack lg">
          <section className="frozen card" aria-label="Original record">
            <div className="frozen-head"><Icon name="lock" /><div><strong>As recorded</strong><span className="small muted" style={{ display: 'block' }}>{d.recordedAt ? new Date(d.recordedAt).toLocaleString() : fmt.date(d.date)} · preserved exactly as written</span></div></div>
            <Block label="Context" text={d.context} />
            <Block label="The situation" text={d.situation} />
            <Block label="Objective" text={d.objective} />
            <div className="block"><h3>Options considered</h3>
              <div className="options-view">{d.options.map((o) => (
                <div key={o.id} className={`option-view ${o.id === d.chosenOptionId ? 'chosen' : ''}`}>
                  <strong>{o.name}{o.id === d.chosenOptionId && <span className="chip" style={{ marginLeft: 8 }}>Chosen</span>}</strong>
                  {o.pros && <p className="small"><b>For:</b> <span className="pre">{o.pros}</span></p>}
                  {o.cons && <p className="small"><b>Against:</b> <span className="pre">{o.cons}</span></p>}
                </div>))}</div></div>
            <Block label="Evidence" text={d.evidence} />
            <Block label="Assumptions" text={d.assumptions} />
            <Block label="Constraints" text={d.constraints} />
            <Block label="Risks" text={d.risks} />
            <Block label="Trade-offs" text={d.tradeoffs} />
            <div className="block choice"><h3>What I chose</h3><p><strong>{d.chosenText}</strong></p></div>
            <Block label="Why" text={d.reasoning} />
            <Block label="What I expected" text={d.expectedOutcome} />
          </section>
          <RelatedLinks type="decision" id={d.id} />
        </div>

        <aside className="stack lg" aria-label="Later perspectives">
          <div className="card stack">
            <div className="card-title"><span className="left"><Icon name="eye" />Later perspectives</span></div>
            <p className="small muted">Written afterwards, kept separate from the original so the two never blur together.</p>
            <div className="row wrap">
              <Button variant="primary" icon="edit" onClick={() => setReflecting(blankRefl('outcome'))}>Reflect on the outcome</Button>
              <Link className="btn" to={`/oracle/replay/${d.id}`}><Icon name="refresh" />Replay</Link>
            </div>
            <div className="row wrap"><Button size="sm" icon="plus" onClick={() => setAddendum(blankRefl('addendum'))}>Add a note</Button><Button size="sm" icon="wisdom" onClick={() => toWisdom()}>Add to Wisdom</Button><Button size="sm" icon="link" onClick={editConnections}>Connections</Button></div>
          </div>
          {refl.length === 0 && <EmptyState compact art={false} title="No reflections yet" body="When the results are clearer, come back and write what actually happened." />}
          {[...refl].reverse().map((r) => (
            <article key={r.id} className={`later card ${r.kind}`} aria-label={`${r.kind} written ${r.date}`}>
              <div className="row between wrap"><span className="chip lav">{r.kind === 'outcome' ? 'Outcome reflection' : r.kind === 'replay' ? 'Replay notes' : 'Added note'}</span><span className="small faint">Written {fmt.date(r.date, { short: true })}{diffDays(r.date, d.date) > 0 ? ` · ${relativeDays(d.date, r.date).replace('in ', '')} after` : ''}</span></div>
              {r.expectedAchieved && <p><strong>Did it go as expected?</strong> {EXPECT_LABEL[r.expectedAchieved]}</p>}
              <Block label="What actually happened" text={r.happened} />
              <Block label="Assumptions that held" text={r.assumptionsRight} />
              <Block label="Assumptions that didn’t" text={r.assumptionsWrong} />
              <Block label="What surprised me" text={r.surprised} />
              <Block label="What I’d do differently" text={r.wouldDoDifferently} />
              <Block label="What it taught me" text={r.taught} />
              <Block label={r.kind === 'replay' ? 'Replay notes' : 'Note'} text={r.text} />
              <div className="row" style={{ gap: 4 }}>
                <Button size="sm" variant="ghost" icon="edit" onClick={() => (r.kind === 'addendum' ? setAddendum(r) : setReflecting(r))}>Edit</Button>
                <Button size="sm" variant="ghost" icon="wisdom" onClick={() => toWisdom(r)}>To Wisdom</Button>
                <Button size="sm" variant="ghost" icon="trash" onClick={async () => { if (await confirm({ title: 'Delete this reflection?', tone: 'danger', confirmLabel: 'Delete', body: 'Your original decision record is not affected.' })) { await deleteRecord('reflection', r.id); toast('Reflection deleted'); } }}>Delete</Button>
              </div>
            </article>
          ))}
          <div><Button variant="danger" icon="trash" size="sm" onClick={del}>Delete decision…</Button></div>
        </aside>
      </div>

      <ReflectionEditor decision={d} value={reflecting} onClose={() => setReflecting(null)} />
      <AddendumEditor value={addendum} onClose={() => setAddendum(null)} />
      <Modal open={!!connections} onClose={() => setConnections(null)} title="Connections" subtitle="Links live outside the frozen record, so you can change them any time." footer={<Button variant="primary" onClick={async () => { await syncLinks({ type: 'decision', id: d.id }, connections!); setConnections(null); toast('Connections saved'); }}>Save connections</Button>}>
        {connections && <LinksField value={connections} onChange={setConnections} selfRef={{ type: 'decision', id: d.id }} types={['goal', 'chapter', 'journal', 'memory', 'person', 'place', 'event', 'timeline', 'lesson', 'wisdom']} />}
      </Modal>
    </>
  );
}

function ReflectionEditor({ decision, value, onClose }: { decision: Decision; value: DecisionReflection | null; onClose: () => void }) {
  const toast = useToast();
  const [r, setR] = useState<DecisionReflection | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { setR(value ? { ...value } : null); setErr(''); }, [value?.id]);
  const set = (k: keyof DecisionReflection, v: string) => setR((x) => (x ? { ...x, [k]: v } : x));
  const [save, saving] = useOnce(async () => {
    if (!r) return;
    if (!r.happened.trim() && !r.taught.trim() && !r.surprised.trim() && !r.text.trim()) { setErr('Write at least what happened or what it taught you.'); return; }
    try { await saveReflection(r); toast('Reflection saved'); onClose(); } catch (e) { setErr((e as Error).message); }
  });
  return (
    <Modal open={!!r} onClose={onClose} size="lg" title="Reflect on the outcome" subtitle={decision.title}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="check" disabled={saving} onClick={() => save()}>Save reflection</Button></>}>
      {r && (
        <div className="stack lg">
          {err && <div className="callout warn" role="alert"><Icon name="warn" />{err}</div>}
          <div className="callout"><Icon name="lock" /><div className="stack sm"><strong>What you expected back then</strong><span className="pre">{decision.expectedOutcome}</span>{decision.assumptions && <><strong>Your assumptions</strong><span className="pre">{decision.assumptions}</span></>}</div></div>
          <TextField label="Date of this reflection" type="date" value={r.date} onChange={(v) => set('date', v)} />
          <TextField label="What actually happened?" multiline rows={4} autoFocus value={r.happened} onChange={(v) => set('happened', v)} />
          <SelectField label="Was the expected result achieved?" value={r.expectedAchieved} onChange={(v) => set('expectedAchieved', v)} allowEmpty emptyLabel="Choose…" options={[{ value: 'yes', label: 'Yes, largely' }, { value: 'partly', label: 'Partly' }, { value: 'no', label: 'No' }, { value: 'unclear', label: 'Too early to tell' }]} />
          <div className="grid-2"><TextField label="Which assumptions were right?" multiline rows={3} value={r.assumptionsRight} onChange={(v) => set('assumptionsRight', v)} /><TextField label="Which were wrong?" multiline rows={3} value={r.assumptionsWrong} onChange={(v) => set('assumptionsWrong', v)} /></div>
          <TextField label="What surprised me?" multiline rows={2} value={r.surprised} onChange={(v) => set('surprised', v)} />
          <TextField label="What would I do differently?" multiline rows={2} value={r.wouldDoDifferently} onChange={(v) => set('wouldDoDifferently', v)} />
          <TextField label="What did this decision teach me?" multiline rows={3} value={r.taught} onChange={(v) => set('taught', v)} />
        </div>
      )}
    </Modal>
  );
}

function AddendumEditor({ value, onClose }: { value: DecisionReflection | null; onClose: () => void }) {
  const toast = useToast();
  const [r, setR] = useState<DecisionReflection | null>(null);
  useEffect(() => { setR(value ? { ...value } : null); }, [value?.id]);
  const [save, saving] = useOnce(async () => { if (!r || !r.text.trim()) return; await saveReflection(r); toast('Note added'); onClose(); });
  return (
    <Modal open={!!r} onClose={onClose} size="md" title="Add a note" subtitle="A clarification or new thought. The original record stays exactly as it was."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving || !r?.text.trim()} onClick={() => save()}>Add note</Button></>}>
      {r && <div className="stack"><TextField label="Date" type="date" value={r.date} onChange={(v) => setR({ ...r, date: v })} /><TextField label="Note" multiline rows={5} autoFocus value={r.text} onChange={(v) => setR({ ...r, text: v })} /></div>}
    </Modal>
  );
}

// ============================================================ replay

function ReplayPicker() {
  const fmt = useFmt();
  const decisions = useRecords<Decision>('decision');
  const recorded = (decisions ?? []).filter((d) => d.status === 'recorded').sort((a, b) => a.date.localeCompare(b.date));
  if (decisions === undefined) return null;
  if (!recorded.length) return <EmptyState title="Nothing to replay yet" body="Replay works on decisions you’ve recorded. Once you have one, you’ll be able to walk back through it step by step." action={<Link className="btn primary" to="/oracle/decisions"><Icon name="plus" />Record a decision</Link>} />;
  return (
    <div className="decision-list">
      {recorded.map((d) => (
        <Link key={d.id} to={`/oracle/replay/${d.id}`} className="decision-card card-link">
          <span className="small faint">{fmt.date(d.date)}</span>
          <strong className="decision-title">{d.title}</strong>
          <span className="small muted">Replay what you knew then <Icon name="chevR" size={14} /></span>
        </Link>
      ))}
    </div>
  );
}

const STEPS = ['Begin', 'The situation', 'Options', 'What you knew', 'Your prediction', 'The choice', 'What happened', 'Looking back'] as const;

function Replay() {
  const { id } = useParams();
  const fmt = useFmt();
  const nav = useNavigate();
  const toast = useToast();
  const { rec: d, loading } = useRecord<Decision>('decision', id);
  const { map } = useReflections();
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState({ option: '', why: '' });
  const [now, setNow] = useState('');
  const [reflecting, setReflecting] = useState<DecisionReflection | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headRef.current?.focus(); }, [step]);

  const [saveNotes, saving] = useOnce(async () => {
    if (!d) return;
    const pred = prediction.option || prediction.why ? `Before seeing my choice, I thought I would pick: ${d.options.find((o) => o.id === prediction.option)?.name ?? prediction.option ?? '—'}. ${prediction.why}`.trim() : '';
    const text = [pred, now.trim() ? `What I understand differently now: ${now.trim()}` : ''].filter(Boolean).join('\n\n');
    if (!text) { toast('Nothing to save yet', { tone: 'error' }); return; }
    await saveReflection({ id: newId(), createdAt: 0, updatedAt: 0, decisionId: d.id, kind: 'replay', date: fmt.today(), happened: '', expectedAchieved: '', assumptionsRight: '', assumptionsWrong: '', surprised: '', wouldDoDifferently: '', taught: '', text });
    toast('Replay notes saved to this decision'); nav(`/oracle/decisions/${d.id}`);
  });

  if (loading) return <div aria-busy="true" />;
  if (!d || d.status !== 'recorded') return <Navigate to="/oracle/replay" replace />;
  const refl = (map.get(d.id) ?? []).filter((r) => r.kind === 'outcome');
  const last = STEPS.length - 1;
  const named = d.options.filter((o) => o.name.trim());
  const chosen = d.options.find((o) => o.id === d.chosenOptionId);
  const matched = prediction.option && d.chosenOptionId && prediction.option === d.chosenOptionId;

  return (
    <div className="replay">
      <PageHeader eyebrow="Oracle · Replay" icon="refresh" title={d.title} sub={`As things stood on ${fmt.date(d.date, { weekday: true })}`} actions={<Link className="btn ghost" to={`/oracle/decisions/${d.id}`}><Icon name="x" />Leave replay</Link>} />
      <ol className="replay-steps" aria-label="Replay progress">
        {STEPS.map((s, i) => <li key={s} className={i === step ? 'cur' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}><span>{i + 1}</span><em>{s}</em></li>)}
      </ol>
      <section className="card replay-card pad-lg" aria-live="polite">
        <h2 ref={headRef} tabIndex={-1} className="serif replay-h">{STEPS[step]}</h2>
        {step === 0 && (
          <div className="stack">
            <p>This replay shows your thinking in the order you lived it — <strong>without</strong> the outcome. Try to put yourself back in {fmt.date(d.date)} and notice what you notice.</p>
            <p className="muted">The outcome stays hidden until the end. Nothing here changes your original record.</p>
          </div>
        )}
        {step === 1 && <div className="stack"><Block label="Context" text={d.context} /><Block label="The situation" text={d.situation} /><Block label="What I wanted" text={d.objective} />{!d.context && !d.situation && !d.objective && <p className="muted">You didn’t write a description of the situation.</p>}</div>}
        {step === 2 && (
          <div className="stack">
            <div className="options-view">{named.map((o) => <div key={o.id} className="option-view"><strong>{o.name}</strong>{o.pros && <p className="small"><b>For:</b> <span className="pre">{o.pros}</span></p>}{o.cons && <p className="small"><b>Against:</b> <span className="pre">{o.cons}</span></p>}</div>)}</div>
            <Block label="Constraints" text={d.constraints} /><Block label="Risks" text={d.risks} /><Block label="Trade-offs" text={d.tradeoffs} />
          </div>
        )}
        {step === 3 && <div className="stack"><Block label="Evidence I had" text={d.evidence} /><Block label="Assumptions I was making" text={d.assumptions} />{!d.evidence && !d.assumptions && <p className="muted">No evidence or assumptions were written down.</p>}</div>}
        {step === 4 && (
          <div className="stack">
            <p>Before you see what you chose — with only what you knew then, what would you pick? <span className="faint">(Optional, but it’s the part that teaches the most.)</span></p>
            <SelectField label="I think I would choose" value={prediction.option} onChange={(v) => setPrediction({ ...prediction, option: v })} allowEmpty emptyLabel="Not sure yet" options={named.map((o) => ({ value: o.id, label: o.name }))} />
            <TextField label="Because…" multiline rows={3} value={prediction.why} onChange={(v) => setPrediction({ ...prediction, why: v })} />
          </div>
        )}
        {step === 5 && (
          <div className="stack">
            <div className="block choice"><h3>What I chose</h3><p><strong>{d.chosenText}</strong></p></div>
            {prediction.option && <p className={`callout ${matched ? 'ok' : ''}`}><Icon name={matched ? 'check' : 'info'} />{matched ? 'That matches your prediction.' : `You predicted “${named.find((o) => o.id === prediction.option)?.name}” — and chose “${d.chosenText}”. Interesting.`}</p>}
            <Block label="Why" text={d.reasoning} />
            <Block label="What I expected" text={d.expectedOutcome} />
            <p><strong>{d.confidence}%</strong> confident at the time.</p>
          </div>
        )}
        {step === 6 && (
          <div className="stack">
            {refl.length === 0 ? (
              <>
                <p className="muted">You haven’t reflected on the outcome yet. Add what actually happened, and it will sit beside your original expectation.</p>
                <div><Button variant="primary" icon="edit" onClick={() => setReflecting({ id: newId(), createdAt: 0, updatedAt: 0, decisionId: d.id, kind: 'outcome', date: fmt.today(), happened: '', expectedAchieved: '', assumptionsRight: '', assumptionsWrong: '', surprised: '', wouldDoDifferently: '', taught: '', text: '' })}>Reflect on the outcome</Button></div>
              </>
            ) : refl.map((r) => (
              <div key={r.id} className="later card"><span className="chip lav">Written {fmt.date(r.date, { short: true })}</span>{r.expectedAchieved && <p><strong>As expected?</strong> {EXPECT_LABEL[r.expectedAchieved]}</p>}<Block label="What happened" text={r.happened} /><Block label="Assumptions that were wrong" text={r.assumptionsWrong} /><Block label="What it taught me" text={r.taught} /></div>
            ))}
            <div className="compare"><div><h3>Then, I expected</h3><p className="pre">{d.expectedOutcome}</p></div>{refl[0]?.happened && <div><h3>What happened</h3><p className="pre">{refl[refl.length - 1].happened}</p></div>}</div>
          </div>
        )}
        {step === 7 && (
          <div className="stack">
            <p>Looking at it all together: what do you understand differently now?</p>
            <TextField label="What I understand differently now" multiline rows={5} value={now} onChange={setNow} />
            <p className="tiny faint">Saved as “Replay notes” beside the decision. If you made a prediction earlier, it’s saved too.</p>
          </div>
        )}
        <div className="row between replay-nav">
          <Button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} icon="chevL">Back</Button>
          {step < last
            ? <Button variant="primary" onClick={() => setStep((s) => s + 1)}>{step === 4 && !prediction.option ? 'Skip & reveal' : step === 0 ? 'Begin replay' : 'Continue'}<Icon name="chevR" /></Button>
            : <Button variant="primary" icon="check" disabled={saving} onClick={() => saveNotes()}>Save replay notes</Button>}
        </div>
      </section>
      <ReflectionEditor decision={d} value={reflecting} onClose={() => setReflecting(null)} />
    </div>
  );
}

// ============================================================ wisdom

const KINDS = ['Principle', 'Pattern', 'Lesson', 'Avoid', 'Reflection'];
const wisdomConfig: RecordConfig = {
  type: 'wisdom', icon: 'wisdom', newLabel: 'Add to the library', tags: true,
  emptyTitle: 'Your wisdom library is empty',
  emptyBody: 'When a decision teaches you something that deserves to be remembered — a principle, a pattern, a thing to avoid — keep it here, in your own words.',
  blank: () => ({ title: '', kind: 'Principle', principle: '', body: '', tags: [] }),
  fields: [
    { key: 'title', label: 'Title', kind: 'text', required: true, wide: true },
    { key: 'kind', label: 'Kind', kind: 'select', options: KINDS },
    { key: 'principle', label: 'In one line', kind: 'text', wide: true, hint: 'The principle, as you’d say it to yourself' },
    { key: 'body', label: 'Where it came from, and what it means', kind: 'textarea', rows: 6 },
  ],
  linkTypes: ['decision', 'reflection', 'lesson', 'chapter', 'memory', 'goal', 'journal'],
  headerChips: (r) => <span className="chip lav">{r.kind}</span>,
};

function Wisdom() {
  const [params, setParams] = useSearchParams();
  const [signal, setSignal] = useState<{ initial?: Partial<AnyRecord>; links?: LinkRef[] } | null>(null);
  useEffect(() => {
    if (params.get('new')) {
      const links: LinkRef[] = (params.get('from') ?? '').split(',').filter(Boolean).map((s) => { const [type, id] = s.split(':'); return { type, id } as LinkRef; });
      setSignal({ initial: { title: params.get('title') ?? '' }, links });
      setParams((p) => { const n = new URLSearchParams(p); ['new', 'from', 'title'].forEach((k) => n.delete(k)); return n; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <RecordWorkspace
      config={wisdomConfig} sort={byRecent} createSignal={signal} onCreateSignalHandled={() => setSignal(null)}
      renderList={(items, h) => (
        <div className="wisdom-grid">
          {items.map((w) => (
            <button key={w.id} type="button" className="wisdom-card" onClick={() => h.open(w.id)}>
              <span className="chip lav" style={{ alignSelf: 'flex-start' }}>{w.kind}</span>
              <strong className="serif wisdom-title">{w.title}</strong>
              {w.principle && <span className="wisdom-line">“{w.principle}”</span>}
              {w.body && <span className="small muted tl-text">{w.body}</span>}
            </button>
          ))}
        </div>
      )}
    />
  );
}

export { Field, db };
