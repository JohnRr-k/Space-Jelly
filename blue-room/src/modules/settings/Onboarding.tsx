import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Button, Modal, Segmented, SelectField, TextField } from '../../components/ui';
import { useSettings } from '../../app/settings';
import { browserTimeZone, listTimeZones } from '../../lib/dates';
import { notificationPermission, requestNotificationPermission, type PermissionState } from '../../lib/notify';
import type { Settings } from '../../data/types';

const STEPS = ['Hello', 'Time', 'Motion', 'Reminders', 'Your room'] as const;

/** A short, skippable welcome. Nothing is required and nothing is pre-filled with invented life details. */
export function Onboarding({ open }: { open: boolean }) {
  const { settings: s, update } = useSettings();
  const [step, setStep] = useState(0);
  const [perm, setPerm] = useState<PermissionState>(notificationPermission());
  const zones = useMemo(() => { const l = listTimeZones(); return l.includes(s.timezone) ? l : [s.timezone, ...l]; }, [s.timezone]);
  useEffect(() => { if (open) setStep(0); }, [open]);
  const finish = () => update({ onboarded: true });
  const last = step === STEPS.length - 1;

  return (
    <Modal open={open} onClose={finish} size="md" title={step === 0 ? 'Welcome to your Blue Room' : STEPS[step] === 'Your room' ? 'A quick look around' : STEPS[step]}
      subtitle={`Step ${step + 1} of ${STEPS.length} · all optional`}
      footer={<>
        <div className="left"><Button variant="ghost" onClick={finish}>Skip for now</Button></div>
        {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
        <Button variant="primary" onClick={() => (last ? finish() : setStep(step + 1))}>{last ? 'Enter your room' : 'Continue'}</Button>
      </>}>
      <div className="stack lg">
        {step === 0 && (<>
          <p className="muted">This is a private place for your memories, thoughts, plans and decisions. Let’s make it feel like yours — it takes under a minute.</p>
          <TextField label="What should the room call you?" value={s.displayName} onChange={(v) => update({ displayName: v.slice(0, 40) })} autoFocus />
        </>)}
        {step === 1 && (<>
          <div className="grid-2">
            <SelectField label="Time format" value={s.timeFormat} onChange={(v) => update({ timeFormat: v as Settings['timeFormat'] })} options={[{ value: '12h', label: '12-hour (3:30 PM)' }, { value: '24h', label: '24-hour (15:30)' }]} />
            <SelectField label="Week starts on" value={String(s.weekStart)} onChange={(v) => update({ weekStart: Number(v) as 0 | 1 })} options={[{ value: '0', label: 'Sunday' }, { value: '1', label: 'Monday' }]} />
          </div>
          <SelectField label="Time zone" value={s.timezone} onChange={(v) => update({ timezone: v })} options={zones} hint={s.timezone === browserTimeZone() ? 'Detected from this device' : ''} />
        </>)}
        {step === 2 && (<>
          <div className="field"><div className="label">Ambient animation <span className="hint">fish, jellyfish, drifting light</span></div>
            <Segmented<Settings['motion']> label="Ambient animation" value={s.motion} onChange={(v) => update({ motion: v })} options={[{ value: 'full', label: 'Full' }, { value: 'gentle', label: 'Gentle' }, { value: 'off', label: 'Off' }]} /></div>
          <div className="field"><div className="label">Opening animation</div>
            <Segmented<Settings['intro']> label="Opening animation" value={s.intro} onChange={(v) => update({ intro: v })} options={[{ value: 'full', label: 'Welcome me' }, { value: 'short', label: 'Keep it short' }, { value: 'off', label: 'None' }]} /></div>
          <p className="small muted">Sound is off, and stays off until you tap the speaker button.</p>
        </>)}
        {step === 3 && (<>
          <p className="muted">The Blue Room can remind you about events and milestones. Reminders appear in the bell at the top of the page.</p>
          <div className="callout"><Icon name="info" /><span>Browser notifications are optional, and honest about their limits: they only appear <strong>while The Blue Room is open</strong> in a tab. If it’s closed, nothing can reach you — anything missed waits in the bell.</span></div>
          {perm === 'default' && <div><Button icon="bell" onClick={async () => { const r = await requestNotificationPermission(); setPerm(r); if (r === 'granted') update({ reminders: { ...s.reminders, browser: true } }); }}>Turn on browser notifications</Button></div>}
          {perm === 'granted' && <p className="callout ok"><Icon name="check" />Browser notifications are on.</p>}
          {perm === 'denied' && <p className="small muted">Your browser has notifications blocked for this site. You can change that later in its settings.</p>}
          {perm === 'unsupported' && <p className="small muted">This browser doesn’t support notifications — in-app reminders will still work.</p>}
        </>)}
        {step === 4 && (
          <ul className="tour">
            {[['journal', 'Journal', 'Write freely. Drafts save themselves.'], ['legacy', 'Legacy', 'Preserve the story: memories, people, places, lessons, letters.'], ['oracle', 'Oracle', 'Keep the reasoning behind important decisions.'], ['goal', 'My Future', 'Goals and milestones, without pressure.'], ['calendar', 'Calendar', 'Events, repeats and reminders.'], ['note', 'Notes', 'Quick thoughts for later.']].map(([i, t, d]) => <li key={t}><Icon name={i} /><span><strong>{t}</strong> — {d}</span></li>)}
          </ul>
        )}
      </div>
    </Modal>
  );
}
