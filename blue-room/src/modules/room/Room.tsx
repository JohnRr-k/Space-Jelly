import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { BedroomScene } from '../../scene/BedroomScene';
import { OceanCanvas } from '../../scene/OceanCanvas';
import { DiveOverlay } from '../../scene/Dive';
import { Journey } from './Journey';
import { useAttachments, useMediaQuery, useRecords } from '../../app/hooks';
import { greetingFor, wallClock } from '../../lib/dates';
import type { Memory } from '../../data/types';
import { useFmt, useMotion, useSettings } from '../../app/settings';

const TILES = [
  { to: '/journal', label: 'Journal', icon: 'journal', hint: 'Write today’s entry' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar', hint: 'Events & schedule' },
  { to: '/legacy/memories', label: 'Memories', icon: 'memory', hint: 'Moments worth keeping' },
  { to: '/future', label: 'My Future', icon: 'goal', hint: 'Goals & milestones' },
  { to: '/notes', label: 'Notes', icon: 'note', hint: 'Quick thoughts' },
  { to: '/oracle', label: 'Oracle', icon: 'oracle', hint: 'Decisions & reasoning' },
  { to: '/legacy', label: 'Legacy', icon: 'legacy', hint: 'Your story, archived' },
  { to: '/legacy/odyssey', label: 'Odyssey', icon: 'compass', hint: 'Experiences' },
];

export default function Room() {
  const { settings } = useSettings();
  const fmt = useFmt();
  const nav = useNavigate();
  const narrow = useMediaQuery('(max-width: 899px)');
  const { reduced } = useMotion();
  const [diving, setDiving] = useState(false);
  const memories = useRecords<Memory>('memory');
  const today = fmt.today();
  const hour = wallClock(Date.now(), settings.timezone).hh;

  const photoIds = useMemo(() => (memories ?? []).filter((m) => m.attachmentIds.length).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((m) => m.attachmentIds[0]), [memories]);
  const photos = useAttachments(photoIds).filter((a) => a.mime.startsWith('image/')).map((a) => a.url);

  const immersive = settings.layout === 'immersive' && !narrow;

  return (
    <div className="room">
      <section className="room-hero" aria-label="Your room">
        <header className="greeting">
          <p className="greeting-small">{greetingFor(hour)} · {fmt.date(today, { weekday: true })}</p>
          <h1 className="serif">Welcome back, {settings.displayName || 'friend'}.</h1>
          {settings.greetingLine && <p className="greeting-line">{settings.greetingLine}</p>}
        </header>
        {immersive ? (
          <div className="scene-frame">
            <BedroomScene today={today} photos={photos} onGo={(p) => nav(p)} onDive={() => setDiving(true)} animate={!reduced} />
            <p className="scene-hint small faint">Tap anything in the room — or use the menu. Every object opens a real part of your space.</p>
          </div>
        ) : (
          <>
            <div className="mini-ocean">
              <OceanCanvas variant="mini" className="mini-ocean-canvas" />
              <button type="button" className="mini-dive" onClick={() => setDiving(true)}><Icon name="jellyfish" />Dive in</button>
            </div>
            <ul className="tiles" aria-label="Your room">
              {TILES.map((t) => (
                <li key={t.to}><Link to={t.to} className="tile"><span className="tile-ico"><Icon name={t.icon} /></span><strong>{t.label}</strong><span className="tiny muted">{t.hint}</span></Link></li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Journey onDive={() => setDiving(true)} />
      {diving && <DiveOverlay onClose={() => setDiving(false)} />}
    </div>
  );
}

