import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Button, Reveal, useScrollVar } from '../../components/ui';
import { CoverImage } from '../../components/media';
import { QUICK_ACTIONS } from '../../app/Shell';
import { useReminders } from '../../app/reminders';
import { useRecords } from '../../app/hooks';
import { useFmt, useMotion, useSettings } from '../../app/settings';
import { goalProgress } from '../future/Future';
import { Spotlight, type Spot } from './Spotlight';
import { addDays, formatInstant, monthName, parseDate, weekdayName, weekday } from '../../lib/dates';
import { expandMany } from '../../lib/recurrence';
import type { Achievement, CalendarEvent, Goal, JournalEntry, Memory } from '../../data/types';

const WORDS = ['Remember', 'Reflect', 'Plan', 'Breathe', 'Begin again'];
const ICONS = ['fish', 'jellyfish', 'shell', 'wave', 'anchor', 'bubbles'];

/** Two rows of slow, endlessly running marine assets: small icons and words, then a giant outlined line. */
function Marquee() {
  const row = (rev: boolean) => (
    <div className={`marquee ${rev ? 'rev' : ''}`} aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((k) => (
          <div className="marquee-half" key={k}>
            {WORDS.map((w, i) => (
              <span className="marquee-item" key={w}>
                <Icon name={ICONS[(i + (rev ? 3 : 0)) % ICONS.length]} />
                <span className={i % 2 ? 'serif italic' : 'serif'}>{w}</span>
                <Icon name={ICONS[(i + 2 + (rev ? 3 : 0)) % ICONS.length]} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="marquees" role="presentation">
      {row(false)}
      <div className="marquee big" aria-hidden="true">
        <div className="marquee-track slow">
          {[0, 1].map((k) => <div className="marquee-half" key={k}><span className="outline-text serif">your little corner of the ocean ·&nbsp;</span><span className="outline-text serif">the blue room ·&nbsp;</span></div>)}
        </div>
      </div>
      {row(true)}
    </div>
  );
}

function Wave({ flip, tone = 'a' }: { flip?: boolean; tone?: 'a' | 'b' | 'c' }) {
  return (
    <svg className={`wave tone-${tone} ${flip ? 'flip' : ''}`} viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 46C180 92 340 6 560 44S900 90 1100 40 1340 14 1440 46V90H0Z" />
      <path className="wave2" d="M0 62C220 22 380 96 620 60S960 20 1160 62 1360 78 1440 58V90H0Z" opacity=".55" />
    </svg>
  );
}

function MiniRing({ value }: { value: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="mini-ring" aria-hidden="true">
      <circle cx="28" cy="28" r={r} fill="none" stroke="color-mix(in srgb, var(--accent-soft) 28%, transparent)" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 28 28)" />
      <text x="28" y="32" textAnchor="middle" className="mini-ring-num">{value}</text>
    </svg>
  );
}

/** A thin “depth gauge” on the right edge: the deeper you scroll, the deeper you dive. */
function DepthGauge() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const on = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const max = document.documentElement.scrollHeight - innerHeight; setP(max > 0 ? Math.min(1, scrollY / max) : 0); }); };
    on(); addEventListener('scroll', on, { passive: true }); addEventListener('resize', on);
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className={`gauge ${p > 0.04 ? 'on' : ''}`} aria-hidden="true">
      <span className="gauge-top">0 m</span>
      <span className="gauge-track"><i style={{ height: `${p * 100}%` }} /><b style={{ top: `${p * 100}%` }}>{Math.round(p * 30)} m</b></span>
      <span className="gauge-bot">30</span>
    </div>
  );
}

export function Journey({ onDive }: { onDive: () => void }) {
  const { settings } = useSettings();
  const fmt = useFmt();
  const nav = useNavigate();
  const { reduced } = useMotion();
  const { due, upcoming } = useReminders();
  const events = useRecords<CalendarEvent>('event');
  const journal = useRecords<JournalEntry>('journal');
  const goals = useRecords<Goal>('goal');
  const memories = useRecords<Memory>('memory');
  const achievements = useRecords<Achievement>('achievement');
  const [spot, setSpot] = useState<Spot | null>(null);
  const today = fmt.today();
  const track = useRef<HTMLDivElement>(null);

  const todayRef = useScrollVar<HTMLElement>(reduced);
  const memRef = useScrollVar<HTMLElement>(reduced);
  const aheadRef = useScrollVar<HTMLElement>(reduced);

  const occs = useMemo(() => expandMany(events ?? [], today, addDays(today, 30)).filter((o) => !o.completed), [events, today]);
  const todays = occs.filter((o) => o.date <= today && o.endDate >= today);
  const nextEvents = occs.filter((o) => o.date > today).slice(0, 4);
  const lastEntry = [...(journal ?? [])].filter((j) => j.body.trim() || j.title.trim()).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)[0];
  const activeGoals = (goals ?? []).filter((g) => g.status === 'In Progress' || g.status === 'Not Started').sort((a, b) => (a.status === b.status ? (a.targetDate || '9999').localeCompare(b.targetDate || '9999') : a.status === 'In Progress' ? -1 : 1)).slice(0, 10);
  const mems = [...(memories ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const ach = [...(achievements ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const milestones = useMemo(() => {
    const out: { date: string; title: string; goal: Goal }[] = [];
    for (const g of goals ?? []) { if (g.status === 'Completed' || g.status === 'Archived') continue; for (const m of g.milestones) if (!m.done && m.targetDate && m.targetDate >= today) out.push({ date: m.targetDate, title: m.title, goal: g }); }
    return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  }, [goals, today]);

  const ahead = useMemo(() => {
    type Item = { key: string; date: string; label: string; title: string; icon: string; spot: Spot };
    const list: Item[] = [
      ...nextEvents.map((o): Item => ({ key: o.key, date: o.date, label: o.event.allDay ? 'All day' : fmt.time(o.event.startTime), title: o.event.title, icon: 'calendar', spot: { kind: 'event', occ: o } })),
      ...milestones.map((m, i): Item => ({ key: 'm' + i, date: m.date, label: 'Milestone', title: m.title, icon: 'flag', spot: { kind: 'milestone', title: m.title, date: m.date, goal: m.goal } })),
    ];
    return list.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextEvents.length, milestones.length, occs]);

  const { y, m, d } = parseDate(today);
  const reminders = [...due.slice(0, 2), ...upcoming.slice(0, 2)].slice(0, 3);
  const scrollTrack = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * 340, behavior: reduced ? 'auto' : 'smooth' });
  const spotPos = [
    { col: '1 / span 5', mt: 0, rot: -3, spd: 50 }, { col: '7 / span 4', mt: 70, rot: 2.2, spd: -40 }, { col: '11 / span 2', mt: 10, rot: -1.5, spd: 70 },
    { col: '2 / span 4', mt: 20, rot: 1.6, spd: -60 }, { col: '7 / span 5', mt: 10, rot: -2.4, spd: 30 },
  ];

  return (
    <div className="journey">
      <Marquee />

      {/* ───────── 1 · TODAY — split, with a huge parallax date ───────── */}
      <section className="j-sec j-today" ref={todayRef} aria-labelledby="j-today-h">
        <div className="j-inner today-grid">
          <Reveal variant="clip" className="today-num-wrap">
            <div className="today-num serif" aria-hidden="true">{d}</div>
            <div className="today-sub"><span>{monthName(m)} {y}</span><span>{weekdayName(weekday(today))}</span></div>
          </Reveal>
          <div className="today-list">
            <Reveal variant="right"><h2 id="j-today-h" className="j-h">Today</h2></Reveal>
            {todays.length === 0 ? (
              <Reveal variant="right" delay={80}><p className="j-lead">Nothing on the calendar. A quiet day is a fine day — or add something worth remembering.</p></Reveal>
            ) : todays.slice(0, 5).map((o, i) => (
              <Reveal key={o.key} variant="right" delay={80 + i * 70}>
                <button type="button" className="big-row" onClick={() => setSpot({ kind: 'event', occ: o })}>
                  <span className="big-row-time">{o.event.allDay ? 'All day' : fmt.time(o.event.startTime)}</span>
                  <span className="big-row-title">{o.event.important && '★ '}{o.event.title}</span>
                  <Icon name="chevR" />
                </button>
              </Reveal>
            ))}
            {reminders.length > 0 && (
              <Reveal variant="up" delay={200}>
                <div className="rem-strip"><Icon name="bell" size={16} />{reminders.map((r) => <Link key={r.key} to={r.route} className="chip lav">{r.title} · {formatInstant(r.dueAt, settings.timezone, settings.timeFormat, settings.dateFormat, today)}</Link>)}</div>
              </Reveal>
            )}
            <Reveal variant="up" delay={260}><div className="row wrap"><Button variant="primary" icon="plus" onClick={() => nav('/calendar?new=1')}>Schedule an event</Button><Link className="btn ghost" to="/calendar">Open calendar</Link></div></Reveal>
          </div>
        </div>
      </section>

      <Wave tone="a" />

      {/* ───────── 2 · GOALS — a horizontal track ───────── */}
      <section className="j-sec j-goals" aria-labelledby="j-goals-h">
        <div className="j-inner">
          <Reveal variant="left" className="j-head-row">
            <div><p className="j-kicker">My Future</p><h2 id="j-goals-h" className="j-h">What you’re growing toward</h2></div>
            {activeGoals.length > 2 && <div className="row" style={{ gap: 6 }}><button className="icon-btn bordered" aria-label="Previous goals" onClick={() => scrollTrack(-1)}><Icon name="chevL" /></button><button className="icon-btn bordered" aria-label="Next goals" onClick={() => scrollTrack(1)}><Icon name="chevR" /></button></div>}
          </Reveal>
        </div>
        <div className="goal-track" ref={track} tabIndex={0} aria-label="Your goals, scroll sideways">
          {activeGoals.length === 0 ? (
            <Reveal variant="scale" className="goal-slide empty-slide"><p className="serif">Your next chapter starts whenever you’re ready.</p><Button icon="plus" onClick={() => nav('/future?new=1')}>Create a goal</Button></Reveal>
          ) : activeGoals.map((g, i) => (
            <Reveal key={g.id} variant="scale" delay={i * 70} className="goal-slide-wrap">
              <button type="button" className="goal-slide" onClick={() => setSpot({ kind: 'goal', goal: g })}>
                <MiniRing value={goalProgress(g)} />
                <span className="chip">{g.category}</span>
                <strong className="serif">{g.title}</strong>
                <span className="small muted">{g.targetDate ? `By ${fmt.date(g.targetDate, { short: true })}` : g.status}</span>
              </button>
            </Reveal>
          ))}
          <div className="goal-slide-wrap end-cap"><Link className="end-link" to="/future">All goals<Icon name="chevR" /></Link></div>
        </div>
      </section>

      {/* ───────── 3 · MEMORIES — a scattered, parallax collage ───────── */}
      <section className="j-sec j-mem" ref={memRef} aria-labelledby="j-mem-h">
        <div className="j-inner">
          <Reveal variant="clip"><p className="j-kicker">Legacy</p><h2 id="j-mem-h" className="j-h big">Moments worth keeping</h2></Reveal>
          {mems.length === 0 ? (
            <Reveal variant="up"><div className="mem-empty"><p className="serif">No memories here yet. Save a moment whenever you find one worth keeping.</p><Button icon="plus" onClick={() => nav('/legacy/memories?new=1')}>Add a memory</Button></div></Reveal>
          ) : (
            <div className="collage">
              {mems.map((mm, i) => {
                const p = spotPos[i % spotPos.length];
                return (
                  <Reveal key={mm.id} variant={i % 2 ? 'right' : 'left'} delay={i * 80} className="collage-cell" style={{ gridColumn: p.col, marginTop: p.mt }}>
                    <button type="button" className="polaroid collage-pol" style={{ ['--rot' as any]: `${p.rot}deg`, ['--spd' as any]: `${p.spd}px` }} onClick={() => setSpot({ kind: 'memory', memory: mm })}>
                      <span className="tape" aria-hidden="true" />
                      {mm.attachmentIds.length ? <CoverImage ids={mm.attachmentIds} className="polaroid-img" /> : <span className="polaroid-ph" aria-hidden="true"><Icon name="wave" /></span>}
                      <span className="polaroid-cap"><span className="polaroid-date">{fmt.date(mm.date, { short: true })}</span><strong>{mm.title}</strong></span>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          )}
          {ach.length > 0 && (
            <Reveal variant="up" className="pearls">
              <span className="j-kicker" style={{ margin: 0 }}>Recent milestones</span>
              {ach.map((a) => <button key={a.id} type="button" className="pearl-chip" onClick={() => setSpot({ kind: 'achievement', achievement: a })}><span className="pearl sm"><Icon name="pearl" /></span>{a.title}</button>)}
            </Reveal>
          )}
        </div>
      </section>

      <Wave tone="b" flip />

      {/* ───────── 4 · JOURNAL — one big quiet quote ───────── */}
      <section className="j-sec j-journal" aria-labelledby="j-jr-h">
        <div className="j-inner narrow">
          <Reveal variant="scale"><span className="bigquote" aria-hidden="true">“</span></Reveal>
          <Reveal variant="clip"><h2 id="j-jr-h" className="sr-only">Latest journal entry</h2>
            {lastEntry ? (
              <button type="button" className="quote-btn" onClick={() => setSpot({ kind: 'entry', entry: lastEntry })}>
                <span className="quote-text serif">{(lastEntry.title || lastEntry.body.replace(/[#>*_`]/g, '').split('\n')[0]).slice(0, 110)}</span>
                <span className="quote-snip serif">{(() => { const t = lastEntry.body.replace(/[#>*_`-]/g, '').replace(/\s+/g, ' ').trim(); return t.length > 170 ? t.slice(0, 170) + '…' : t; })()}</span>
                <span className="small faint">— {fmt.date(lastEntry.date, { weekday: true })}</span>
              </button>
            ) : <p className="quote-text serif">Your journal is waiting for its first entry.</p>}
          </Reveal>
          <Reveal variant="up" delay={120}><Button variant="primary" icon="edit" onClick={() => nav('/journal/new')}>Write today’s entry</Button></Reveal>
        </div>
      </section>

      <Wave tone="c" />

      {/* ───────── 5 · AHEAD — a zig-zag timeline that draws itself ───────── */}
      <section className="j-sec j-ahead" ref={aheadRef} aria-labelledby="j-ahead-h">
        <div className="j-inner">
          <Reveal variant="right" className="center"><p className="j-kicker">Coming up</p><h2 id="j-ahead-h" className="j-h">What’s ahead</h2></Reveal>
          {ahead.length === 0 ? (
            <Reveal variant="up"><p className="j-lead center">Nothing scheduled yet. Add something worth looking forward to.</p></Reveal>
          ) : (
            <ol className="zig">
              <span className="zig-line" aria-hidden="true" />
              {ahead.map((it, i) => (
                <Reveal as="li" key={it.key} variant={i % 2 ? 'right' : 'left'} className={`zig-item ${i % 2 ? 'r' : 'l'}`}>
                  <span className="zig-dot" aria-hidden="true"><Icon name={it.icon} /></span>
                  <button type="button" className="zig-card" onClick={() => setSpot(it.spot)}>
                    <span className="small faint">{fmt.date(it.date, { weekday: true, short: true })} · {it.label}</span>
                    <strong>{it.title}</strong>
                  </button>
                </Reveal>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* ───────── 6 · begin ───────── */}
      <section className="j-sec j-end" aria-label="Quick actions">
        <div className="j-inner narrow center">
          <Reveal variant="scale"><h2 className="j-h big">Where to now?</h2></Reveal>
          <div className="end-pills">
            {QUICK_ACTIONS.map((q, i) => (
              <Reveal key={q.label} variant="up" delay={i * 60}><button type="button" className={`end-pill p${i % 3}`} onClick={() => nav(q.to())}><Icon name={q.icon} />{q.label}</button></Reveal>
            ))}
          </div>
          <Reveal variant="up" delay={200}><button type="button" className="btn ghost" onClick={onDive}><Icon name="jellyfish" />Take a moment — dive in</button></Reveal>
        </div>
      </section>
      <Wave tone="a" flip />

      <DepthGauge />
      <Spotlight spot={spot} onClose={() => setSpot(null)} />
    </div>
  );
}
