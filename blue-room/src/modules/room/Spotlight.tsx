import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/ui';
import { AttachmentGallery } from '../../components/media';
import { goalProgress } from '../future/Future';
import { useFmt } from '../../app/settings';
import { describeRecurrence, type Occurrence } from '../../lib/recurrence';
import { relativeDays } from '../../lib/dates';
import type { Achievement, Goal, JournalEntry, Memory } from '../../data/types';

export type Spot =
  | { kind: 'event'; occ: Occurrence }
  | { kind: 'goal'; goal: Goal }
  | { kind: 'memory'; memory: Memory }
  | { kind: 'entry'; entry: JournalEntry }
  | { kind: 'achievement'; achievement: Achievement }
  | { kind: 'milestone'; title: string; date: string; goal: Goal };

function Ring({ value }: { value: number }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(value), 80); return () => clearTimeout(t); }, [value]);
  const r = 54, c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 128 128" role="img" aria-label={`${value}% complete`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
      <circle cx="64" cy="64" r={r} fill="none" stroke="url(#ringg)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 64 64)" style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.22,.7,.2,1)' }} />
      <defs><linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#76b7d1" /><stop offset="1" stopColor="#14547b" /></linearGradient></defs>
      <text x="64" y="72" textAnchor="middle" className="ring-num">{value}%</text>
    </svg>
  );
}

/** A pop-up “highlight” whose shape depends on what was pressed: a ticket for events, a ring for goals,
 *  a polaroid for memories, a page for journal entries, a pearl for achievements. */
export function Spotlight({ spot, onClose }: { spot: Spot | null; onClose: () => void }) {
  const fmt = useFmt();
  const today = fmt.today();
  return (
    <Modal open={!!spot} onClose={onClose} size="md" title={spot ? titleOf(spot) : ''} className="spotlight">
      {spot?.kind === 'event' && (() => {
        const e = spot.occ.event;
        return (
          <div className="ticket">
            <div className="ticket-stub"><span>{fmt.date(spot.occ.date, { short: true, year: false }).split(' ')[0]}</span><b>{parseInt(spot.occ.date.slice(8), 10)}</b><em>{relativeDays(spot.occ.date, today)}</em></div>
            <div className="ticket-main stack">
              <div className="row wrap"><span className="chip">{e.category}</span>{e.important && <span className="chip lav">★ Important</span>}</div>
              <p><Icon name="clock" size={16} /> {e.allDay ? 'All day' : `${fmt.time(e.startTime)}${e.endTime ? ' – ' + fmt.time(e.endTime) : ''}`}</p>
              {e.location && <p><Icon name="place" size={16} /> {e.location}</p>}
              {e.recurrence.freq !== 'none' && <p className="muted"><Icon name="repeat" size={16} /> {describeRecurrence(e.recurrence)}</p>}
              {e.description && <p className="pre muted">{e.description}</p>}
              <Link className="btn primary" to={`/calendar?event=${e.id}&date=${spot.occ.date}`}>Open in calendar <Icon name="chevR" /></Link>
            </div>
          </div>
        );
      })()}
      {spot?.kind === 'goal' && (
        <div className="goal-spot">
          <Ring value={goalProgress(spot.goal)} />
          <div className="stack">
            <div className="row wrap"><span className="chip">{spot.goal.category}</span><span className="chip plain">{spot.goal.status}</span></div>
            {spot.goal.description && <p className="pre muted">{spot.goal.description}</p>}
            {spot.goal.milestones.length > 0 && <ul className="spot-ms">{spot.goal.milestones.slice(0, 6).map((m) => <li key={m.id} className={m.done ? 'done' : ''}><Icon name={m.done ? 'check' : 'flag'} size={15} />{m.title}</li>)}</ul>}
            <Link className="btn primary" to={`/future?open=${spot.goal.id}`}>Open goal <Icon name="chevR" /></Link>
          </div>
        </div>
      )}
      {spot?.kind === 'memory' && (
        <div className="polaroid-spot">
          <AttachmentGallery ids={spot.memory.attachmentIds} />
          <p className="small faint">{fmt.date(spot.memory.date, { weekday: true })}</p>
          {spot.memory.description && <p className="pre serif spot-quote">{spot.memory.description}</p>}
          {spot.memory.whyItMattered && <p className="muted"><b>Why it mattered:</b> {spot.memory.whyItMattered}</p>}
          <Link className="btn primary" to={`/legacy/memories?open=${spot.memory.id}`}>Open memory <Icon name="chevR" /></Link>
        </div>
      )}
      {spot?.kind === 'entry' && (
        <div className="page-spot serif">
          <p className="small faint" style={{ fontFamily: 'var(--font-sans)' }}>{fmt.date(spot.entry.date, { weekday: true })}</p>
          <p className="pre">{spot.entry.body.replace(/[#>*_`]/g, '').slice(0, 700)}{spot.entry.body.length > 700 ? '…' : ''}</p>
          <Link className="btn primary" style={{ fontFamily: 'var(--font-sans)' }} to={`/journal/${spot.entry.id}`}>Keep reading <Icon name="chevR" /></Link>
        </div>
      )}
      {spot?.kind === 'achievement' && (
        <div className="pearl-spot">
          <span className="pearl big"><Icon name="pearl" /></span>
          <p className="small faint">{fmt.date(spot.achievement.date, { weekday: true })}</p>
          {spot.achievement.whyItMatters && <p className="serif spot-quote">{spot.achievement.whyItMatters}</p>}
          <Link className="btn primary" to={`/legacy/achievements?open=${spot.achievement.id}`}>Open milestone <Icon name="chevR" /></Link>
        </div>
      )}
      {spot?.kind === 'milestone' && (
        <div className="pearl-spot">
          <span className="pearl big"><Icon name="flag" /></span>
          <p>{fmt.date(spot.date, { weekday: true })} · {relativeDays(spot.date, today)}</p>
          <p className="muted">A step toward “{spot.goal.title}”.</p>
          <Link className="btn primary" to={`/future?open=${spot.goal.id}`}>Open goal <Icon name="chevR" /></Link>
        </div>
      )}
    </Modal>
  );
}

function titleOf(s: Spot): string {
  switch (s.kind) {
    case 'event': return s.occ.event.title;
    case 'goal': return s.goal.title;
    case 'memory': return s.memory.title;
    case 'entry': return s.entry.title || 'Journal entry';
    case 'achievement': return s.achievement.title;
    default: return s.title;
  }
}
