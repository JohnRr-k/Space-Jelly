import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Button, EmptyState, Field, IconButton, Modal, PageHeader, Segmented, SelectField, Switch, TextField, useConfirm, useOnce, useToast } from '../../components/ui';
import { LinksField, RelatedLinks } from '../../components/links';
import { useCustomReminders, useRecords } from '../../app/hooks';
import { useFmt, useSettings } from '../../app/settings';
import { deleteRecord, getLinks, newId, saveRecord, syncLinks, validateRecord } from '../../data/repo';
import { searchText } from '../../data/entities';
import type { CalendarEvent, CustomReminder, Goal, LinkRef, Recurrence } from '../../data/types';
import { db } from '../../data/db';
import { addDays, addMonths, diffDays, isValidDate, isValidTime, formatMonthYear, minutesLabel, monthGrid, weekday, weekdayName, weekDays, wallClock } from '../../lib/dates';
import { compareOccurrences, describeRecurrence, expandMany, noRecurrence, occurrencesOnDay, type Occurrence } from '../../lib/recurrence';
import { REMINDER_OFFSET_CHOICES } from '../../lib/reminders';

type View = 'month' | 'week' | 'day' | 'agenda';
const HOUR_PX = 52;
const mins = (t?: string) => (t ? parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10) : 0);
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function blankEvent(date: string, tz: string, defaults: number[], category: string): CalendarEvent {
  return {
    id: newId(), createdAt: 0, updatedAt: 0, title: '', date, endDate: date, allDay: false, startTime: '10:00', endTime: '11:00', description: '', location: '', url: '',
    category, reminders: [...defaults], recurrence: noRecurrence(), completed: false, completedDates: [], excludedDates: [], important: false, timezone: tz,
  };
}

function catClass(cats: string[], c: string, important: boolean) {
  const i = cats.indexOf(c);
  return `cat-${i < 0 ? 7 : i % 8}${important ? ' imp' : ''}`;
}

export default function CalendarPage() {
  const { settings } = useSettings();
  const fmt = useFmt();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const events = useRecords<CalendarEvent>('event');
  const goals = useRecords<Goal>('goal');
  const customs = useCustomReminders();
  const today = fmt.today();

  const view = (params.get('view') as View) || settings.calendarView;
  const anchor = params.get('date') || today;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const [showGoals, setShowGoals] = useState(true);
  const [viewing, setViewing] = useState<{ id: string; date: string } | null>(null);
  const [editor, setEditor] = useState<{ ev: CalendarEvent; links: LinkRef[]; occDate?: string } | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [moving, setMoving] = useState<{ ev: CalendarEvent; date: string } | null>(null);

  const setNav = useCallback((p: Record<string, string | null>) => {
    setParams((old) => { const n = new URLSearchParams(old); Object.entries(p).forEach(([k, v]) => (v === null ? n.delete(k) : n.set(k, v))); return n; }, { replace: true });
  }, [setParams]);

  const newEvent = useCallback((date: string, extra: Partial<CalendarEvent> = {}, links: LinkRef[] = []) => {
    setEditor({ ev: { ...blankEvent(date, settings.timezone, settings.reminders.defaultOffsets, settings.categories.event[0] ?? 'Personal'), ...extra }, links });
  }, [settings]);

  // deep links: ?new=1&title=…&link=goal:id  ·  ?event=id&date=…
  useEffect(() => {
    if (params.get('new') && events) {
      const link = params.get('link');
      const [lt, li] = link ? link.split(':') : [];
      newEvent(params.get('date') || today, { title: params.get('title') ?? '' }, lt && li ? [{ type: lt as any, id: li }] : []);
      setNav({ new: null, title: null, link: null });
    }
    const evId = params.get('event');
    if (evId && events) {
      const found = events.find((e) => e.id === evId);
      if (found) { setViewing({ id: evId, date: params.get('date') || found.date }); setNav({ event: null }); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, events]);

  // visible range
  const range = useMemo(() => {
    if (view === 'month') { const g = monthGrid(anchor, settings.weekStart); return { start: g[0], end: g[g.length - 1] }; }
    if (view === 'week') { const w = weekDays(anchor, settings.weekStart); return { start: w[0], end: w[6] }; }
    if (view === 'day') return { start: anchor, end: anchor };
    return { start: addDays(anchor, -1), end: addDays(anchor, 90) };
  }, [view, anchor, settings.weekStart]);

  const searching = q.trim().length > 0;
  const occs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = expandMany((events ?? []), searching ? addDays(today, -730) : range.start, searching ? addDays(today, 730) : range.end);
    if (cat) list = list.filter((o) => o.event.category === cat);
    if (hideDone) list = list.filter((o) => !o.completed);
    if (needle) list = list.filter((o) => (searchText(o.event) + ' ' + o.event.category).toLowerCase().includes(needle));
    return list.sort(compareOccurrences);
  }, [events, range, q, cat, hideDone, searching, today]);

  const milestones = useMemo(() => {
    if (!showGoals || searching) return [] as { date: string; title: string; goal: Goal; done: boolean }[];
    const out: { date: string; title: string; goal: Goal; done: boolean }[] = [];
    for (const g of goals ?? []) {
      if (g.status === 'Archived') continue;
      for (const m of g.milestones) if (m.targetDate && m.targetDate >= range.start && m.targetDate <= range.end) out.push({ date: m.targetDate, title: m.title, goal: g, done: m.done });
    }
    return out;
  }, [goals, showGoals, range, searching]);

  const customInRange = useMemo(() => (customs ?? []).filter((c) => c.date >= range.start && c.date <= range.end), [customs, range]);

  const step = (dir: -1 | 1) => {
    const next = view === 'month' ? addMonths(anchor, dir) : view === 'week' ? addDays(anchor, 7 * dir) : view === 'day' ? addDays(anchor, dir) : addDays(anchor, 30 * dir);
    setNav({ date: next });
  };

  const title = view === 'month' ? formatMonthYear(anchor)
    : view === 'week' ? (() => { const w = weekDays(anchor, settings.weekStart); return `${fmt.date(w[0], { short: true, year: false })} – ${fmt.date(w[6], { short: true })}`; })()
    : view === 'day' ? fmt.date(anchor, { weekday: true })
    : 'Coming up';

  const openOcc = (o: Occurrence) => setViewing({ id: o.event.id, date: o.date });
  const eventById = (id: string) => events?.find((e) => e.id === id);
  const viewingEv = viewing ? eventById(viewing.id) : undefined;

  const openEditor = async (ev: CalendarEvent, occDate?: string) => {
    const links = await getLinks({ type: 'event', id: ev.id });
    setEditor({ ev, links, occDate });
  };

  return (
    <div className="page wide cal-page">
      <PageHeader
        eyebrow="Calendar" icon="calendar" title={view === 'month' ? 'Your calendar' : title}
        sub={view === 'month' ? title : undefined}
        actions={<><Button icon="bell" onClick={() => setReminderOpen(true)}>Remind me</Button><Button variant="primary" icon="plus" onClick={() => newEvent(view === 'agenda' ? today : anchor)}>New event</Button></>}
      />
      <div className="cal-toolbar">
        <div className="row" style={{ gap: 4 }}>
          <IconButton icon="chevL" label="Previous" bordered onClick={() => step(-1)} />
          <Button onClick={() => setNav({ date: null })}>Today</Button>
          <IconButton icon="chevR" label="Next" bordered onClick={() => step(1)} />
        </div>
        <strong className="cal-title" aria-live="polite">{title}</strong>
        <div className="grow" />
        <Segmented<View> label="Calendar view" value={view} onChange={(v) => setNav({ view: v })} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }, { value: 'agenda', label: 'Upcoming' }]} />
      </div>
      <div className="toolbar">
        <div className="search"><Icon name="search" /><input className="input" type="search" aria-label="Search events" placeholder="Search all events…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select" style={{ width: 'auto', borderRadius: 999 }} aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {[...new Set([...settings.categories.event, ...(events ?? []).map((e) => e.category)])].filter(Boolean).map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="checkline"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />Hide completed</label>
        <label className="checkline"><input type="checkbox" checked={showGoals} onChange={(e) => setShowGoals(e.target.checked)} />Goal milestones</label>
      </div>

      {events === undefined ? null : searching ? (
        <SearchResults occs={occs} onOpen={openOcc} />
      ) : view === 'month' ? (
        <MonthView anchor={anchor} today={today} occs={occs} milestones={milestones} customs={customInRange} onOpen={openOcc} onDay={(d) => setNav({ view: 'day', date: d })} onAdd={(d) => newEvent(d)} />
      ) : view === 'week' || view === 'day' ? (
        <TimeGrid days={view === 'week' ? weekDays(anchor, settings.weekStart) : [anchor]} today={today} occs={occs} milestones={milestones} customs={customInRange} onOpen={openOcc} onAdd={(d, t) => newEvent(d, t ? { startTime: t, endTime: hhmm(Math.min(mins(t) + 60, 23 * 60 + 59)) } : {})} onDay={(d) => setNav({ view: 'day', date: d })} />
      ) : (
        <Agenda occs={occs} milestones={milestones} customs={customInRange} today={today} onOpen={openOcc} onAdd={() => newEvent(today)} />
      )}

      <EventView
        ev={viewingEv} date={viewing?.date ?? ''} onClose={() => setViewing(null)}
        onEdit={(e, d) => { setViewing(null); openEditor(e, d); }} onMove={(e, d) => { setViewing(null); setMoving({ ev: e, date: d }); }}
      />
      <EventEditor state={editor} onClose={() => setEditor(null)} />
      <MoveDialog state={moving} onClose={() => setMoving(null)} />
      <ReminderDialog open={reminderOpen} onClose={() => setReminderOpen(false)} onSaved={() => toast('Reminder set')} />
    </div>
  );
}

// ============================================================ month

function Pill({ o, onOpen }: { o: Occurrence; onOpen: (o: Occurrence) => void }) {
  const fmt = useFmt();
  const { settings } = useSettings();
  const e = o.event;
  return (
    <button type="button" className={`ev-pill ${catClass(settings.categories.event, e.category, e.important)} ${o.completed ? 'done' : ''}`} onClick={(ev) => { ev.stopPropagation(); onOpen(o); }}
      aria-label={`${e.title}, ${e.allDay ? 'all day' : fmt.time(e.startTime)}${o.completed ? ', completed' : ''}`}>
      {!e.allDay && <span className="ev-time">{fmt.time(e.startTime).replace(':00', '').replace(' ', '').toLowerCase()}</span>}
      <span className="truncate">{e.important && '★ '}{e.title}</span>
    </button>
  );
}

function MonthView({ anchor, today, occs, milestones, customs, onOpen, onDay, onAdd }: {
  anchor: string; today: string; occs: Occurrence[]; milestones: { date: string; title: string; goal: Goal; done: boolean }[]; customs: CustomReminder[]; onOpen: (o: Occurrence) => void; onDay: (d: string) => void; onAdd: (d: string) => void;
}) {
  const { settings } = useSettings();
  const fmt = useFmt();
  const cells = monthGrid(anchor, settings.weekStart);
  return (
    <div className="month" role="grid" aria-label={formatMonthYear(anchor)}>
      {cells.slice(0, 7).map((d) => <div key={d} className="month-dow" role="columnheader">{weekdayName(weekday(d), true)}</div>)}
      {cells.map((d) => {
        const list = occurrencesOnDay(occs, d);
        const ms = milestones.filter((m) => m.date === d);
        const cs = customs.filter((c) => c.date === d);
        const out = d.slice(0, 7) !== anchor.slice(0, 7);
        const shown = list.slice(0, 3);
        const rest = list.length - shown.length + (ms.length ? 0 : 0);
        return (
          <div key={d} role="gridcell" className={`month-cell ${out ? 'out' : ''} ${d === today ? 'today' : ''}`} onClick={() => onAdd(d)}>
            <div className="month-cell-head">
              <button type="button" className="month-num" onClick={(e) => { e.stopPropagation(); onDay(d); }} aria-label={`${fmt.date(d, { weekday: true })}${d === today ? ' (today)' : ''} — open day`}>{parseInt(d.slice(8), 10)}</button>
              <button type="button" className="month-add" onClick={(e) => { e.stopPropagation(); onAdd(d); }} aria-label={`Add event on ${fmt.date(d)}`}><Icon name="plus" /></button>
            </div>
            <div className="month-events">
              {shown.map((o) => <Pill key={o.key} o={o} onOpen={onOpen} />)}
              {rest > 0 && <button type="button" className="more" onClick={(e) => { e.stopPropagation(); onDay(d); }}>+{rest} more</button>}
              {ms.slice(0, 2).map((m, i) => <Link key={i} to={`/future?open=${m.goal.id}`} className={`ms-pill ${m.done ? 'done' : ''}`} onClick={(e) => e.stopPropagation()}><Icon name="flag" size={12} /><span className="truncate">{m.title}</span></Link>)}
              {cs.map((c) => <span key={c.id} className="ms-pill rem"><Icon name="bell" size={12} /><span className="truncate">{c.title}</span></span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================ week / day time grid

function layoutDay(items: { start: number; end: number; o: Occurrence }[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: { o: Occurrence; start: number; end: number; col: number; cols: number }[] = [];
  let cluster: typeof out = []; let clusterEnd = -1; let colsEnd: number[] = [];
  const flush = () => { cluster.forEach((c) => (c.cols = colsEnd.length)); out.push(...cluster); cluster = []; colsEnd = []; clusterEnd = -1; };
  for (const it of sorted) {
    if (it.start >= clusterEnd && cluster.length) flush();
    let col = colsEnd.findIndex((e) => e <= it.start);
    if (col < 0) { col = colsEnd.length; colsEnd.push(it.end); } else colsEnd[col] = it.end;
    cluster.push({ ...it, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return out;
}

function TimeGrid({ days, today, occs, milestones, customs, onOpen, onAdd, onDay }: {
  days: string[]; today: string; occs: Occurrence[]; milestones: { date: string; title: string; goal: Goal; done: boolean }[]; customs: CustomReminder[]; onOpen: (o: Occurrence) => void; onAdd: (d: string, t?: string) => void; onDay: (d: string) => void;
}) {
  const { settings } = useSettings();
  const fmt = useFmt();
  const scroller = useRef<HTMLDivElement>(null);
  const [nowMin, setNowMin] = useState(() => mins(wallClock(Date.now(), settings.timezone).time));
  useEffect(() => { const t = setInterval(() => setNowMin(mins(wallClock(Date.now(), settings.timezone).time)), 60000); return () => clearInterval(t); }, [settings.timezone]);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = Math.max(0, (days.includes(today) ? nowMin / 60 - 2 : 7) * HOUR_PX); /* eslint-disable-next-line */ }, [days[0]]);

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const allDayFor = (d: string) => occurrencesOnDay(occs, d).filter((o) => o.event.allDay || o.date !== o.endDate);
  const hasAllDay = days.some((d) => allDayFor(d).length || milestones.some((m) => m.date === d) || customs.some((c) => c.date === d));

  return (
    <div className="timegrid" style={{ ['--days' as any]: days.length }}>
      <div className="tg-head">
        <div className="tg-gutter" />
        {days.map((d) => (
          <button key={d} type="button" className={`tg-dayhead ${d === today ? 'today' : ''}`} onClick={() => onDay(d)} aria-label={`${fmt.date(d, { weekday: true })} — open day`}>
            <span>{weekdayName(weekday(d), true)}</span><b>{parseInt(d.slice(8), 10)}</b>
          </button>
        ))}
      </div>
      {hasAllDay && (
        <div className="tg-allday">
          <div className="tg-gutter small faint">all day</div>
          {days.map((d) => (
            <div key={d} className="tg-allday-cell">
              {allDayFor(d).map((o) => <Pill key={o.key} o={o} onOpen={onOpen} />)}
              {milestones.filter((m) => m.date === d).map((m, i) => <Link key={i} to={`/future?open=${m.goal.id}`} className={`ms-pill ${m.done ? 'done' : ''}`}><Icon name="flag" size={12} /><span className="truncate">{m.title}</span></Link>)}
              {customs.filter((c) => c.date === d).map((c) => <span key={c.id} className="ms-pill rem"><Icon name="bell" size={12} /><span className="truncate">{c.time ? fmt.time(c.time) + ' ' : ''}{c.title}</span></span>)}
            </div>
          ))}
        </div>
      )}
      <div className="tg-scroll" ref={scroller}>
        <div className="tg-body" style={{ height: 24 * HOUR_PX }}>
          <div className="tg-gutter">{hours.map((h) => <div key={h} className="tg-hour" style={{ height: HOUR_PX }}><span>{h === 0 ? '' : fmt.time(hhmm(h * 60)).replace(':00', '')}</span></div>)}</div>
          {days.map((d) => {
            const timed = occurrencesOnDay(occs, d).filter((o) => !o.event.allDay && o.date === o.endDate);
            const items = timed.map((o) => {
              const start = mins(o.event.startTime);
              const end = Math.max(start + 30, o.event.endTime ? mins(o.event.endTime) : start + 60);
              return { o, start, end };
            });
            const laid = layoutDay(items);
            return (
              <div key={d} className={`tg-col ${d === today ? 'today' : ''}`}
                onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const m = Math.floor(((e.clientY - r.top) / HOUR_PX) * 2) * 30; onAdd(d, hhmm(Math.min(m, 23 * 60))); }}>
                {hours.map((h) => <div key={h} className="tg-line" style={{ height: HOUR_PX }} />)}
                {laid.map(({ o, start, end, col, cols }) => (
                  <button key={o.key} type="button" className={`tg-ev ${catClass(settings.categories.event, o.event.category, o.event.important)} ${o.completed ? 'done' : ''}`}
                    style={{ top: (start / 60) * HOUR_PX, height: Math.max(22, ((end - start) / 60) * HOUR_PX - 2), left: `${(col / cols) * 100}%`, width: `calc(${100 / cols}% - 3px)` }}
                    onClick={(e) => { e.stopPropagation(); onOpen(o); }}>
                    <strong className="truncate">{o.event.important && '★ '}{o.event.title}</strong>
                    <span className="truncate tiny">{fmt.time(o.event.startTime)}{o.event.location ? ` · ${o.event.location}` : ''}</span>
                  </button>
                ))}
                {d === today && <div className="tg-now" style={{ top: (nowMin / 60) * HOUR_PX }} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================ agenda / search

function OccRow({ o, onOpen, showDate }: { o: Occurrence; onOpen: (o: Occurrence) => void; showDate?: boolean }) {
  const fmt = useFmt();
  const { settings } = useSettings();
  const toast = useToast();
  const e = o.event;
  const toggle = async () => {
    if (e.recurrence.freq === 'none') await saveRecord('event', { ...e, completed: !e.completed });
    else await saveRecord('event', { ...e, completedDates: o.completed ? e.completedDates.filter((d) => d !== o.date) : [...e.completedDates, o.date] });
    toast(o.completed ? 'Marked as not done' : 'Marked complete');
  };
  return (
    <div className={`agenda-row ${o.completed ? 'done' : ''}`}>
      <input type="checkbox" className="agenda-check" aria-label={`Mark “${e.title}” complete`} checked={o.completed} onChange={toggle} />
      <button type="button" className="agenda-main" onClick={() => onOpen(o)}>
        <span className={`ev-dot ${catClass(settings.categories.event, e.category, e.important)}`} aria-hidden="true" />
        <span className="grow">
          <strong className={o.completed ? 'done-text' : ''}>{e.important && '★ '}{e.title}</strong>
          <span className="small muted" style={{ display: 'block' }}>
            {showDate && `${fmt.date(o.date, { weekday: true, short: true })} · `}{e.allDay ? 'All day' : `${fmt.time(e.startTime)}${e.endTime ? ' – ' + fmt.time(e.endTime) : ''}`}{e.location ? ` · ${e.location}` : ''}
          </span>
        </span>
        <span className="row" style={{ gap: 6 }}>
          {e.recurrence.freq !== 'none' && <Icon name="repeat" size={15} />}
          {e.reminders.length > 0 && <Icon name="bell" size={15} />}
          <span className="chip plain">{e.category}</span>
        </span>
      </button>
    </div>
  );
}

function Agenda({ occs, milestones, customs, today, onOpen, onAdd }: { occs: Occurrence[]; milestones: { date: string; title: string; goal: Goal; done: boolean }[]; customs: CustomReminder[]; today: string; onOpen: (o: Occurrence) => void; onAdd: () => void }) {
  const fmt = useFmt();
  const upcoming = occs.filter((o) => o.endDate >= today);
  const groups = new Map<string, Occurrence[]>();
  for (const o of upcoming) { const d = o.date < today ? today : o.date; groups.set(d, [...(groups.get(d) ?? []), o]); }
  for (const m of milestones) if (m.date >= today && !groups.has(m.date)) groups.set(m.date, []);
  for (const c of customs) if (c.date >= today && !groups.has(c.date)) groups.set(c.date, []);
  const dates = [...groups.keys()].sort();
  if (!dates.length) return <EmptyState title="Nothing on the calendar yet" body="Add something worth remembering." action={<Button variant="primary" icon="plus" onClick={onAdd}>New event</Button>} />;
  return (
    <div className="agenda">
      {dates.map((d) => (
        <section key={d} className="agenda-day" aria-label={fmt.date(d, { weekday: true })}>
          <h2><span className={d === today ? 'today-badge' : ''}>{d === today ? 'Today' : fmt.date(d, { weekday: true })}</span><span className="small faint">{d === today ? fmt.date(d, { weekday: true }) : d === addDays(today, 1) ? 'Tomorrow' : ''}</span></h2>
          <div className="card flat pad-sm">
            {groups.get(d)!.map((o) => <OccRow key={o.key} o={o} onOpen={onOpen} />)}
            {milestones.filter((m) => m.date === d).map((m, i) => <Link key={i} className="agenda-row ms" to={`/future?open=${m.goal.id}`}><Icon name="flag" size={16} /><span className="grow"><strong>{m.title}</strong><span className="small muted" style={{ display: 'block' }}>Milestone · {m.goal.title}</span></span></Link>)}
            {customs.filter((c) => c.date === d).map((c) => <div key={c.id} className="agenda-row ms"><Icon name="bell" size={16} /><span className="grow"><strong>{c.title}</strong><span className="small muted" style={{ display: 'block' }}>Reminder{c.time ? ` · ${fmt.time(c.time)}` : ''}{c.note ? ` · ${c.note}` : ''}</span></span></div>)}
          </div>
        </section>
      ))}
    </div>
  );
}

function SearchResults({ occs, onOpen }: { occs: Occurrence[]; onOpen: (o: Occurrence) => void }) {
  const seen = new Set<string>();
  const first = occs.filter((o) => (seen.has(o.event.id) ? false : (seen.add(o.event.id), true)));
  if (!first.length) return <EmptyState compact title="No events match" body="Try a different word." />;
  return <div className="card flat pad-sm"><p className="small faint" style={{ padding: '4px 8px' }}>{first.length} matching {first.length === 1 ? 'event' : 'events'} (showing the nearest occurrence of each)</p>{first.map((o) => <OccRow key={o.key} o={o} onOpen={onOpen} showDate />)}</div>;
}

// ============================================================ view dialog

function EventView({ ev, date, onClose, onEdit, onMove }: { ev?: CalendarEvent; date: string; onClose: () => void; onEdit: (e: CalendarEvent, d: string) => void; onMove: (e: CalendarEvent, d: string) => void }) {
  const fmt = useFmt();
  const { settings } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [choice, setChoice] = useState<'one' | 'series' | null>(null);
  const [choiceResolve, setChoiceResolve] = useState<((v: 'one' | 'series' | null) => void) | null>(null);
  if (!ev) return <Modal open={false} onClose={onClose} title="" children={null} />;
  const recurring = ev.recurrence.freq !== 'none';
  const occ: Occurrence = { key: `${ev.id}:${date}`, event: ev, date, endDate: addDays(date, Math.max(0, diffDays(ev.endDate, ev.date))), completed: recurring ? ev.completedDates.includes(date) : ev.completed };

  const toggle = async () => {
    if (!recurring) await saveRecord('event', { ...ev, completed: !ev.completed });
    else await saveRecord('event', { ...ev, completedDates: occ.completed ? ev.completedDates.filter((d) => d !== date) : [...ev.completedDates, date] });
    toast(occ.completed ? 'Marked as not done' : 'Marked complete');
  };

  const del = async () => {
    if (recurring) {
      const pick = await new Promise<'one' | 'series' | null>((res) => { setChoiceResolve(() => res); setChoice('one'); });
      setChoice(null); setChoiceResolve(null);
      if (!pick) return;
      if (pick === 'one') { await saveRecord('event', { ...ev, excludedDates: [...ev.excludedDates, date] }); toast('Removed this occurrence'); onClose(); return; }
    }
    if (!(await confirm({ title: recurring ? 'Delete the whole series?' : 'Delete this event?', tone: 'danger', confirmLabel: 'Delete', body: `“${ev.title}” will be removed${recurring ? ' along with every repeat' : ''}.` }))) return;
    await deleteRecord('event', ev.id); toast('Event deleted'); onClose();
  };

  return (
    <>
      <Modal open={!choice} onClose={onClose} size="md" title={ev.title}
        footer={<>
          <div className="left"><Button variant="danger" icon="trash" onClick={del}>Delete</Button></div>
          <Button icon="swap" onClick={() => onMove(ev, date)}>Reschedule</Button>
          <Button variant="primary" icon="edit" onClick={() => onEdit(ev, date)}>Edit</Button>
        </>}>
        <div className="stack lg">
          <div className="row wrap">
            <span className="chip">{ev.category}</span>
            {ev.important && <span className="chip lav">★ Important</span>}
            {occ.completed && <span className="chip ok"><Icon name="check" size={13} />Completed</span>}
          </div>
          <dl className="kv">
            <dt>When</dt><dd>{fmt.date(date, { weekday: true })}{ev.endDate !== ev.date ? ` → ${fmt.date(occ.endDate, { weekday: true, short: true })}` : ''}<br />{ev.allDay ? 'All day' : `${fmt.time(ev.startTime)}${ev.endTime ? ' – ' + fmt.time(ev.endTime) : ''}`}{ev.timezone && ev.timezone !== settings.timezone ? <span className="small faint"> ({ev.timezone})</span> : null}</dd>
            {recurring && <><dt>Repeats</dt><dd>{describeRecurrence(ev.recurrence)}</dd></>}
            {ev.location && <><dt>Where</dt><dd>{ev.location}</dd></>}
            {ev.url && <><dt>Link</dt><dd><a href={ev.url} target="_blank" rel="noreferrer">{ev.url}</a></dd></>}
            {ev.description && <><dt>Notes</dt><dd className="pre">{ev.description}</dd></>}
            <dt>Reminders</dt><dd>{ev.reminders.length ? ev.reminders.map((m) => minutesLabel(m)).join(' · ') : 'None'}</dd>
          </dl>
          <div><Button icon={occ.completed ? 'undo' : 'check'} variant={occ.completed ? 'default' : 'soft'} onClick={toggle}>{occ.completed ? 'Mark as not done' : recurring ? 'Mark this one complete' : 'Mark complete'}</Button></div>
          <RelatedLinks type="event" id={ev.id} />
        </div>
      </Modal>
      <Modal open={!!choice} onClose={() => choiceResolve?.(null)} size="sm" title="Delete a repeating event"
        footer={<><Button onClick={() => choiceResolve?.(null)}>Cancel</Button><Button variant="danger" onClick={() => choiceResolve?.('one')}>Just this one</Button><Button variant="danger" solid onClick={() => choiceResolve?.('series')}>The whole series</Button></>}>
        <p className="muted">“{ev.title}” repeats. Remove only the {fmt.date(date)} occurrence, or the entire series?</p>
      </Modal>
    </>
  );
}

// ============================================================ move / reschedule

function MoveDialog({ state, onClose }: { state: { ev: CalendarEvent; date: string } | null; onClose: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [scope, setScope] = useState<'one' | 'series'>('one');
  useEffect(() => { if (state) { setDate(state.date); setTime(state.ev.startTime); setScope(state.ev.recurrence.freq === 'none' ? 'series' : 'one'); } }, [state]);
  const [save, saving] = useOnce(async () => {
    if (!state || !date) return;
    const { ev } = state;
    const span = Math.max(0, diffDays(ev.endDate, ev.date));
    const timeFix = ev.allDay ? {} : { startTime: time, endTime: ev.endTime && time ? hhmm(Math.min(23 * 60 + 59, mins(time) + Math.max(15, mins(ev.endTime) - mins(ev.startTime)))) : ev.endTime };
    if (ev.recurrence.freq !== 'none' && scope === 'one') {
      // detach this occurrence into its own single event
      await saveRecord('event', { ...ev, excludedDates: [...ev.excludedDates, state.date] });
      await saveRecord('event', { ...ev, ...timeFix, id: newId(), createdAt: 0, date, endDate: addDays(date, span), recurrence: noRecurrence(), excludedDates: [], completedDates: [], completed: false });
    } else {
      await saveRecord('event', { ...ev, ...timeFix, date, endDate: addDays(date, span) });
    }
    toast('Rescheduled');
    onClose();
  });
  if (!state) return <Modal open={false} onClose={onClose} title="" children={null} />;
  const recurring = state.ev.recurrence.freq !== 'none';
  return (
    <Modal open onClose={onClose} size="sm" title="Reschedule" subtitle={state.ev.title}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving || !date} onClick={() => save()}>Move it</Button></>}>
      <div className="stack">
        <TextField label="New date" type="date" value={date} onChange={setDate} autoFocus />
        {!state.ev.allDay && <TextField label="Start time" type="time" value={time} onChange={setTime} />}
        {recurring && (
          <Segmented<'one' | 'series'> label="Scope" value={scope} onChange={setScope} options={[{ value: 'one', label: 'Only this one' }, { value: 'series', label: 'The whole series' }]} />
        )}
        {recurring && <p className="small muted">{scope === 'one' ? 'This occurrence becomes its own event; the rest of the series is unchanged.' : 'The series start moves, and every repeat shifts with it.'}</p>}
      </div>
    </Modal>
  );
}

// ============================================================ custom reminder

function ReminderDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const fmt = useFmt();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setTitle(''); setNote(''); setDate(fmt.today()); setTime('09:00'); setErr(''); } /* eslint-disable-next-line */ }, [open]);
  const [save, saving] = useOnce(async () => {
    if (!title.trim()) { setErr('What should I remind you about?'); return; }
    const rec: CustomReminder = { id: newId(), createdAt: 0, updatedAt: 0, title: title.trim(), note: note.trim(), date, time };
    if (!isValidDate(date) || !isValidTime(time)) { setErr('Choose a valid date and time.'); return; }
    const now = Date.now();
    await db.customReminders.put({ ...rec, createdAt: now, updatedAt: now });
    onSaved(); onClose();
  });
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Remind me" subtitle="A one-off reminder. It shows in your notification bell while The Blue Room is open."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="bell" disabled={saving} onClick={() => save()}>Set reminder</Button></>}>
      <div className="stack">
        {err && <div className="callout warn" role="alert"><Icon name="warn" />{err}</div>}
        <TextField label="Remind me to…" value={title} onChange={setTitle} autoFocus />
        <div className="grid-2"><TextField label="Date" type="date" value={date} onChange={setDate} /><TextField label="Time" type="time" value={time} onChange={setTime} /></div>
        <TextField label="Note" hint="Optional" value={note} onChange={setNote} />
      </div>
    </Modal>
  );
}

// ============================================================ editor

function EventEditor({ state, onClose }: { state: { ev: CalendarEvent; links: LinkRef[]; occDate?: string } | null; onClose: () => void }) {
  const { settings, update } = useSettings();
  const fmt = useFmt();
  const toast = useToast();
  const all = useRecords<CalendarEvent>('event');
  const [d, setD] = useState<CalendarEvent | null>(null);
  const [links, setLinks] = useState<LinkRef[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const existing = !!(state && all?.some((e) => e.id === state.ev.id));
  useEffect(() => { if (state) { setD({ ...state.ev, recurrence: { ...state.ev.recurrence } }); setLinks(state.links); setErrors([]); } else setD(null); }, [state?.ev.id]);

  const set = <K extends keyof CalendarEvent>(k: K, v: CalendarEvent[K]) => setD((x) => (x ? { ...x, [k]: v } : x));
  const setRec = (p: Partial<Recurrence>) => setD((x) => (x ? { ...x, recurrence: { ...x.recurrence, ...p } } : x));

  const [save, saving] = useOnce(async () => {
    if (!d) return;
    const next: CalendarEvent = { ...d, title: d.title.trim(), endDate: d.endDate && d.endDate >= d.date ? d.endDate : d.date };
    if (next.allDay) { next.startTime = ''; next.endTime = ''; }
    else if (!next.endTime) next.endTime = '';
    if (next.recurrence.freq !== 'none') {
      next.recurrence = { ...next.recurrence, interval: Math.max(1, Math.floor(next.recurrence.interval || 1)) };
      if (next.recurrence.freq === 'weekly' && !(next.recurrence.byWeekday?.length)) next.recurrence.byWeekday = [weekday(next.date)];
    }
    const errs = validateRecord('event', next);
    if (errs.length) { setErrors(errs); return; }
    await saveRecord('event', next);
    await syncLinks({ type: 'event', id: next.id }, links);
    if (next.category && !settings.categories.event.includes(next.category)) update((s) => ({ ...s, categories: { ...s.categories, event: [...s.categories.event, next.category] } }));
    toast(existing ? 'Event saved' : 'Event added');
    onClose();
  });

  const toggleOffset = (m: number) => setD((x) => (x ? { ...x, reminders: x.reminders.includes(m) ? x.reminders.filter((r) => r !== m) : [...x.reminders, m].sort((a, b) => a - b) } : x));
  const rec = d?.recurrence;

  return (
    <Modal open={!!d} onClose={onClose} size="lg" title={existing ? 'Edit event' : 'New event'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="check" disabled={saving} onClick={() => save()}>Save event</Button></>}>
      {d && rec && (
        <form className="stack lg" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {errors.length > 0 && <div className="callout warn" role="alert"><Icon name="warn" /><div>{errors.map((e) => <div key={e}>{e}</div>)}</div></div>}
          <TextField label="Title" required autoFocus={!existing} value={d.title} onChange={(v) => set('title', v)} />
          <div className="row wrap" style={{ gap: 24 }}>
            <Switch checked={d.allDay} onChange={(v) => set('allDay', v)} label="All day" />
            <Switch checked={d.important} onChange={(v) => set('important', v)} label="Important" />
          </div>
          <div className="grid-2">
            <TextField label="Date" type="date" required value={d.date} onChange={(v) => setD((x) => (x ? { ...x, date: v, endDate: x.endDate < v ? v : x.endDate } : x))} />
            {!d.allDay ? <TextField label="Start time" type="time" required value={d.startTime} onChange={(v) => setD((x) => { if (!x) return x; const keep = x.endTime && x.endDate === x.date && v && x.endTime > v; return { ...x, startTime: v, endTime: keep || !v ? x.endTime : hhmm(Math.min(mins(v) + 60, 23 * 60 + 59)) }; })} /> : <TextField label="Until (optional)" type="date" value={d.endDate} onChange={(v) => set('endDate', v)} hint="For multi-day events" />}
            {!d.allDay && <TextField label="End time" type="time" value={d.endTime} onChange={(v) => set('endTime', v)} />}
            {!d.allDay && <TextField label="End date" type="date" value={d.endDate} onChange={(v) => set('endDate', v)} hint="Only if it ends on another day" />}
          </div>
          <div className="grid-2">
            <Field label="Category" htmlFor="ev-cat">
              <input id="ev-cat" className="input" list="ev-cats" value={d.category} onChange={(e) => set('category', e.target.value)} />
              <datalist id="ev-cats">{settings.categories.event.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <TextField label="Location" value={d.location} onChange={(v) => set('location', v)} />
          </div>
          <TextField label="Link" type="url" placeholder="https://…" hint="Optional" value={d.url} onChange={(v) => set('url', v)} />
          <TextField label="Description" multiline rows={3} value={d.description} onChange={(v) => set('description', v)} />

          <fieldset className="fieldset">
            <legend>Repeat</legend>
            <div className="stack">
              <SelectField label="Repeats" value={rec.freq} onChange={(v) => setRec({ freq: v as Recurrence['freq'], ...(v === 'weekly' && !rec.byWeekday?.length ? { byWeekday: [weekday(d.date)] } : {}) })} options={[{ value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} />
              {rec.freq !== 'none' && (
                <>
                  <div className="grid-2">
                    <TextField label={`Every (${{ daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }[rec.freq]})`} type="number" min="1" inputMode="numeric" value={String(rec.interval)} onChange={(v) => setRec({ interval: Math.max(1, parseInt(v || '1', 10) || 1) })} />
                    <div className="field"><label htmlFor="ev-end">Ends</label>
                      <select id="ev-end" className="select" value={rec.until ? 'until' : rec.count ? 'count' : 'never'} onChange={(e) => setRec(e.target.value === 'never' ? { until: undefined, count: undefined } : e.target.value === 'until' ? { until: addDays(d.date, 90), count: undefined } : { count: 10, until: undefined })}>
                        <option value="never">Never</option><option value="until">On a date</option><option value="count">After a number of times</option>
                      </select></div>
                  </div>
                  {rec.freq === 'weekly' && (
                    <div className="field"><div className="label">On</div>
                      <div className="chips">{[0, 1, 2, 3, 4, 5, 6].map((w) => { const on = (rec.byWeekday ?? []).includes(w); return <button key={w} type="button" className={`chip ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => setRec({ byWeekday: on ? (rec.byWeekday ?? []).filter((x) => x !== w) : [...(rec.byWeekday ?? []), w].sort() })}>{weekdayName(w, true)}</button>; })}</div></div>
                  )}
                  {rec.until !== undefined && <TextField label="Repeat until" type="date" value={rec.until ?? ''} onChange={(v) => setRec({ until: v })} />}
                  {rec.count !== undefined && <TextField label="Number of times" type="number" min="1" inputMode="numeric" value={String(rec.count)} onChange={(v) => setRec({ count: Math.max(1, parseInt(v || '1', 10) || 1) })} />}
                  <p className="small muted">{describeRecurrence(rec)}{rec.freq === 'monthly' && parseInt(d.date.slice(8), 10) > 28 ? ' · On shorter months this lands on the last day.' : ''}</p>
                </>
              )}
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Reminders</legend>
            <div className="chips">
              {REMINDER_OFFSET_CHOICES.map((m) => <button key={m} type="button" className={`chip ${d.reminders.includes(m) ? 'active' : ''}`} aria-pressed={d.reminders.includes(m)} onClick={() => toggleOffset(m)}>{m === 0 ? 'At the time' : minutesLabel(m).replace(' before', '')}</button>)}
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>{d.reminders.length ? 'You’ll see these in your notification bell — and as a browser notification if you’ve turned those on — while The Blue Room is open.' : 'No reminders for this event.'}{d.allDay ? ' For all-day events, reminders count from 9:00 AM.' : ''}</p>
          </fieldset>

          <LinksField value={links} onChange={setLinks} selfRef={{ type: 'event', id: d.id }} types={['goal', 'odyssey', 'achievement', 'journal', 'person', 'place', 'memory', 'timeline', 'chapter', 'decision']} hint="Goals, Odyssey experiences, achievements, journal entries and more." />
          <p className="tiny faint">Times use {d.timezone || settings.timezone}. {fmt.tz !== (d.timezone || settings.timezone) ? 'This event keeps the time zone it was created in.' : ''}</p>
        </form>
      )}
    </Modal>
  );
}

export { Fragment };
