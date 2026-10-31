import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../../components/Icon';
import { Button, Field, IconButton, Modal, PageHeader, Segmented, SelectField, Switch, TextField, useConfirm, useToast } from '../../components/ui';
import { useSettings } from '../../app/settings';
import { db } from '../../data/db';
import { buildBackup, decryptBackup, downloadBlob, encryptBackup, importBackup, journalToMarkdown, validateBackup, wipeEverything, type BackupFile, type BackupSummary, type ImportMode } from '../../data/backup';
import { browserTimeZone, isValidTimeZone, listTimeZones, minutesLabel } from '../../lib/dates';
import { notificationPermission, registerServiceWorker, requestNotificationPermission, showSystemNotification, type PermissionState } from '../../lib/notify';
import { REMINDER_OFFSET_CHOICES } from '../../lib/reminders';
import type { Settings as S } from '../../data/types';

const SECTIONS = [
  ['profile', 'You', 'jellyfish'], ['appearance', 'Look & motion', 'wave'], ['time', 'Date, time & calendar', 'clock'], ['journal', 'Journal prompts', 'journal'],
  ['reminders', 'Reminders', 'bell'], ['lists', 'Categories', 'tag'], ['sound', 'Sound', 'sound'], ['data', 'Your data & privacy', 'lock'],
] as const;

function Section({ id, title, icon, children, lead }: { id: string; title: string; icon: string; children: ReactNode; lead?: string }) {
  return (
    <section id={id} className="settings-section card" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="settings-h"><Icon name={icon} />{title}</h2>
      {lead && <p className="muted" style={{ marginTop: -4 }}>{lead}</p>}
      <div className="stack lg">{children}</div>
    </section>
  );
}

export default function Settings() {
  const loc = useLocation();
  useEffect(() => { if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [loc.hash]);
  return (
    <div className="page">
      <PageHeader eyebrow="Settings" icon="settings" title="Make it yours" sub="Everything here is optional. Changes save as you make them." />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map(([id, label, icon]) => <a key={id} href={`#/settings#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}><Icon name={icon} />{label}</a>)}
        </nav>
        <div className="stack lg settings-body">
          <ProfileSection /><AppearanceSection /><TimeSection /><JournalSection /><RemindersSection /><ListsSection /><SoundSection /><DataSection />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ profile

function ProfileSection() {
  const { settings: s, update } = useSettings();
  const [replay, setReplay] = useState(false);
  return (
    <Section id="profile" title="You" icon="jellyfish">
      <TextField label="Display name" value={s.displayName} onChange={(v) => update({ displayName: v.slice(0, 40) })} hint="Used in the greeting" />
      <TextField label="Greeting line" value={s.greetingLine} onChange={(v) => update({ greetingLine: v.slice(0, 90) })} hint="A small line under “Welcome back”. Leave empty for none." />
      <div className="row wrap">
        <Button icon="refresh" onClick={() => { update({ onboarded: false }); setReplay(true); }}>Run the welcome tour again</Button>
        {replay && <span className="small muted">It will appear in a moment.</span>}
      </div>
    </Section>
  );
}

// ------------------------------------------------------------ appearance

function AppearanceSection() {
  const { settings: s, update } = useSettings();
  return (
    <Section id="appearance" title="Look & motion" icon="wave" lead="The room should be calm. Dial it up or down however you like.">
      <div className="field"><div className="label">Colour intensity</div>
        <Segmented<S['theme']> label="Theme" value={s.theme} onChange={(v) => update({ theme: v })} options={[{ value: 'mist', label: 'Mist · soft & bright' }, { value: 'tide', label: 'Tide · richer blue' }, { value: 'deep', label: 'Deep · night ocean' }]} /></div>
      <div className="field"><div className="label">Ambient animation <span className="hint">fish, jellyfish, light and drifting bubbles</span></div>
        <Segmented<S['motion']> label="Ambient animation" value={s.motion} onChange={(v) => update({ motion: v })} options={[{ value: 'full', label: 'Full' }, { value: 'gentle', label: 'Gentle' }, { value: 'off', label: 'Off' }]} />
        <span className="hint">“Off” also stops transitions. Your system’s reduced-motion setting is always respected.</span></div>
      <div className="field"><div className="label">Opening animation</div>
        <Segmented<S['intro']> label="Opening animation" value={s.intro} onChange={(v) => update({ intro: v })} options={[{ value: 'full', label: 'Full on first visit, short after' }, { value: 'short', label: 'Always short' }, { value: 'off', label: 'None' }]} />
        <span className="hint">You can always skip it with Esc, Enter, or a tap.</span></div>
      <div className="field"><div className="label">Home layout</div>
        <Segmented<S['layout']> label="Home layout" value={s.layout} onChange={(v) => update({ layout: v })} options={[{ value: 'immersive', label: 'The bedroom' }, { value: 'simple', label: 'Simple tiles' }]} />
        <span className="hint">On phones and small windows you always get the compact version.</span></div>
    </Section>
  );
}

// ------------------------------------------------------------ time

function TimeSection() {
  const { settings: s, update } = useSettings();
  const zones = useMemo(() => { const l = listTimeZones(); return l.includes(s.timezone) ? l : [s.timezone, ...l]; }, [s.timezone]);
  const detected = browserTimeZone();
  return (
    <Section id="time" title="Date, time & calendar" icon="clock">
      <div className="grid-2">
        <SelectField label="Time format" value={s.timeFormat} onChange={(v) => update({ timeFormat: v as S['timeFormat'] })} options={[{ value: '12h', label: '12-hour (3:30 PM)' }, { value: '24h', label: '24-hour (15:30)' }]} />
        <SelectField label="Date format" value={s.dateFormat} onChange={(v) => update({ dateFormat: v as S['dateFormat'] })} options={[{ value: 'MDY', label: 'March 2, 2026' }, { value: 'DMY', label: '2 March 2026' }, { value: 'ISO', label: '2026-03-02' }]} />
        <SelectField label="Week starts on" value={String(s.weekStart)} onChange={(v) => update({ weekStart: Number(v) as 0 | 1 })} options={[{ value: '0', label: 'Sunday' }, { value: '1', label: 'Monday' }]} />
        <SelectField label="Calendar opens in" value={s.calendarView} onChange={(v) => update({ calendarView: v as S['calendarView'] })} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }, { value: 'agenda', label: 'Upcoming' }]} />
      </div>
      <SelectField label="Time zone" value={s.timezone} onChange={(v) => isValidTimeZone(v) && update({ timezone: v })} options={zones} hint={s.timezone === detected ? 'Matches this device' : `This device reports ${detected}`} />
      {s.timezone !== detected && <div><Button size="sm" onClick={() => update({ timezone: detected })}>Use this device’s time zone ({detected})</Button></div>}
      <p className="small muted">Events keep the time zone they were created in, so changing this won’t silently shift events you’ve already scheduled. Daylight-saving changes are handled for you.</p>
    </Section>
  );
}

// ------------------------------------------------------------ journal

function JournalSection() {
  const { settings: s, update } = useSettings();
  const [text, setText] = useState(s.journalPrompts.list.join('\n'));
  return (
    <Section id="journal" title="Journal prompts" icon="journal" lead="Prompts are always optional — they only appear when you ask for a spark.">
      <Switch checked={s.journalPrompts.enabled} onChange={(v) => update({ journalPrompts: { ...s.journalPrompts, enabled: v } })} label="Offer prompts in the journal editor" />
      <TextField label="Your prompts" multiline rows={7} value={text} onChange={(v) => { setText(v); update({ journalPrompts: { ...s.journalPrompts, list: v.split('\n').map((x) => x.trim()).filter(Boolean) } }); }} hint="One per line" />
    </Section>
  );
}

// ------------------------------------------------------------ reminders

function RemindersSection() {
  const { settings: s, update } = useSettings();
  const toast = useToast();
  const [perm, setPerm] = useState<PermissionState>(notificationPermission());
  const r = s.reminders;
  const set = (p: Partial<S['reminders']>) => update({ reminders: { ...r, ...p } });

  const enable = async () => {
    const res = await requestNotificationPermission();
    setPerm(res);
    if (res === 'granted') { set({ browser: true }); toast('Browser notifications are on'); }
    else if (res === 'denied') toast('The browser blocked notifications — you can allow them in its site settings.', { tone: 'error' });
  };
  const test = async () => {
    await registerServiceWorker();
    const ok = await showSystemNotification('The Blue Room', 'This is a test. If you can read it, notifications work on this device.', 'blueroom-test');
    toast(ok ? 'I asked your browser to show a test notification. If you don’t see one, check your system’s notification or focus settings.' : 'Your browser didn’t accept the request.', { tone: ok ? 'ok' : 'error' });
  };

  const toggleOffset = (m: number) => set({ defaultOffsets: r.defaultOffsets.includes(m) ? r.defaultOffsets.filter((x) => x !== m) : [...r.defaultOffsets, m].sort((a, b) => a - b) });

  return (
    <Section id="reminders" title="Reminders" icon="bell">
      <Switch checked={r.inApp} onChange={(v) => set({ inApp: v })} label="In-app reminders (the bell)" />
      <div className="callout"><Icon name="info" /><div className="stack sm">
        <strong>What reminders can and can’t do</strong>
        <span>Reminders are checked every few seconds <em>while The Blue Room is open</em> in a browser tab or window. If it’s closed, nothing can fire — this app has no server to wake your browser. Anything that came due while you were away shows up in the bell as “missed” the next time you open it.</span>
      </div></div>

      <div className="stack sm">
        <div className="label" style={{ fontWeight: 650, fontSize: 13, color: 'var(--ink-2)' }}>Browser notifications</div>
        {perm === 'unsupported' && <p className="small muted">This browser doesn’t support notifications. In-app reminders still work.</p>}
        {perm === 'denied' && <p className="small muted">Notifications are blocked for this site. To allow them, change the site permission in your browser’s settings, then come back.</p>}
        {perm === 'default' && <p className="small muted">Turning this on lets The Blue Room show a system notification when a reminder is due — only while it’s open in a tab. Your browser will ask for permission.</p>}
        {perm === 'granted' && <Switch checked={r.browser} onChange={(v) => set({ browser: v })} label="Also show a system notification when a reminder is due" />}
        <div className="row wrap">
          {perm === 'default' && <Button variant="primary" icon="bell" onClick={enable}>Turn on browser notifications</Button>}
          {perm === 'granted' && <Button icon="bell" onClick={test}>Send a test notification</Button>}
        </div>
      </div>

      <div className="field"><div className="label">Default reminders for new events</div>
        <div className="chips">{REMINDER_OFFSET_CHOICES.map((m) => <button key={m} type="button" className={`chip ${r.defaultOffsets.includes(m) ? 'active' : ''}`} aria-pressed={r.defaultOffsets.includes(m)} onClick={() => toggleOffset(m)}>{m === 0 ? 'At the time' : minutesLabel(m).replace(' before', '')}</button>)}</div></div>

      <div className="grid-2">
        <div className="stack sm"><Switch checked={r.digest.enabled} onChange={(v) => set({ digest: { ...r.digest, enabled: v } })} label="Same-day summary" />
          <TextField label="Send at" type="time" value={r.digest.time} onChange={(v) => set({ digest: { ...r.digest, time: v } })} hint="Only on days with events" /></div>
        <div className="stack sm"><Switch checked={r.journal.enabled} onChange={(v) => set({ journal: { ...r.journal, enabled: v } })} label="Gentle journal nudge" />
          <TextField label="Around" type="time" value={r.journal.time} onChange={(v) => set({ journal: { ...r.journal, time: v } })} hint="Skipped if you’ve already written today" /></div>
      </div>
      <div className="grid-2">
        <div className="stack sm"><Switch checked={r.goalMilestones.enabled} onChange={(v) => set({ goalMilestones: { ...r.goalMilestones, enabled: v } })} label="Goal milestone reminders" />
          <TextField label="Also remind me this many days ahead" type="number" min="0" inputMode="numeric" value={String(r.goalMilestones.leadDays)} onChange={(v) => set({ goalMilestones: { ...r.goalMilestones, leadDays: Math.max(0, Math.min(60, parseInt(v || '0', 10) || 0)) } })} /></div>
        <div className="stack sm"><Switch checked={r.letters} onChange={(v) => set({ letters: v })} label="Remind me when a letter’s reading date arrives" /><p className="small muted">Letters are never delivered anywhere — this is just a reminder to open them yourself.</p></div>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------ editable lists

function ListEditor({ label, items, onChange, hint }: { label: string; items: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (!t || items.some((i) => i.toLowerCase() === t.toLowerCase())) { setDraft(''); return; } onChange([...items, t]); setDraft(''); };
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div className="field">
      <div className="label">{label}{hint && <span className="hint">{hint}</span>}</div>
      <ul className="list-editor">
        {items.map((it, i) => (
          <li key={it}><span className="grow">{it}</span>
            <IconButton icon="chevU" label={`Move ${it} up`} size="sm" disabled={i === 0} onClick={() => move(i, -1)} />
            <IconButton icon="chevD" label={`Move ${it} down`} size="sm" disabled={i === items.length - 1} onClick={() => move(i, 1)} />
            <IconButton icon="x" label={`Remove ${it}`} size="sm" disabled={items.length <= 1} onClick={() => onChange(items.filter((x) => x !== it))} />
          </li>
        ))}
      </ul>
      <div className="row"><input className="input" aria-label={`Add to ${label}`} placeholder="Add another…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /><Button onClick={add} icon="plus">Add</Button></div>
    </div>
  );
}

function ListsSection() {
  const { settings: s, update } = useSettings();
  const setCat = (k: keyof S['categories'], v: string[]) => update({ categories: { ...s.categories, [k]: v } });
  return (
    <Section id="lists" title="Categories" icon="tag" lead="Rename or reshape the labels to suit your life. Existing records keep whatever label they had.">
      <ListEditor label="Odyssey stages" hint="Dreaming → Planned → Experienced by default; reorder or rename freely. The last stage means “lived”." items={s.odysseyStatuses} onChange={(v) => update({ odysseyStatuses: v })} />
      <div className="grid-2">
        <ListEditor label="Event categories" items={s.categories.event} onChange={(v) => setCat('event', v)} />
        <ListEditor label="Goal categories" items={s.categories.goal} onChange={(v) => setCat('goal', v)} />
        <ListEditor label="Journal categories" items={s.categories.journal} onChange={(v) => setCat('journal', v)} />
        <ListEditor label="Timeline categories" items={s.categories.timeline} onChange={(v) => setCat('timeline', v)} />
        <ListEditor label="Note categories" items={s.categories.note} onChange={(v) => setCat('note', v)} />
      </div>
    </Section>
  );
}

// ------------------------------------------------------------ sound

function SoundSection() {
  const { settings: s, update } = useSettings();
  return (
    <Section id="sound" title="Sound" icon="sound" lead="Off by default and never plays on its own. Use the speaker button at the top of any page to start or mute it.">
      <div className="field"><label htmlFor="vol">Volume <span className="hint">{Math.round(s.sound.volume * 100)}%</span></label>
        <input id="vol" className="range" type="range" min={0.05} max={1} step={0.05} value={s.sound.volume} onChange={(e) => update({ sound: { ...s.sound, volume: Number(e.target.value) } })} /></div>
      <p className="small muted">The ocean sound is generated in your browser — no audio files are downloaded. After a reload it stays quiet until you tap the speaker again.</p>
    </Section>
  );
}

// ------------------------------------------------------------ data

function fmtBytes(n: number) { return n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`; }
const stamp = () => new Date().toISOString().slice(0, 10);

function DataSection() {
  const { settings: s } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [withPhotos, setWithPhotos] = useState(true);
  const [busy, setBusy] = useState('');
  const [encOpen, setEncOpen] = useState(false);
  const [imp, setImp] = useState<{ backup: BackupFile; summary: BackupSummary; name: string } | null>(null);
  const [impErr, setImpErr] = useState<string[] | null>(null);
  const [lockedFile, setLockedFile] = useState<{ file: any; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useLiveQuery(async () => {
    const t = ['journal', 'notes', 'timeline', 'chapters', 'memories', 'odyssey', 'people', 'places', 'lessons', 'letters', 'achievements', 'goals', 'events', 'decisions', 'reflections', 'wisdom', 'attachments'] as const;
    let total = 0; for (const n of t) total += await (db as any)[n].count();
    return { total, journal: await db.journal.count(), photos: await db.attachments.count() };
  }, []);

  useEffect(() => {
    navigator.storage?.estimate?.().then(setEstimate).catch(() => {});
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, [counts?.total]);

  const requestPersist = async () => {
    const ok = await navigator.storage?.persist?.();
    setPersisted(!!ok);
    toast(ok ? 'Your browser promised to keep this data unless you clear it yourself.' : 'The browser declined for now. It may grant it once you’ve used the app more or installed it.', { tone: ok ? 'ok' : 'error' });
  };

  const exportJson = async () => {
    setBusy('json');
    try { const b = await buildBackup({ includeAttachments: withPhotos }); downloadBlob(`blue-room-backup-${stamp()}.json`, new Blob([JSON.stringify(b)], { type: 'application/json' })); toast('Backup downloaded'); }
    catch (e) { toast('Couldn’t create the backup: ' + (e as Error).message, { tone: 'error' }); } finally { setBusy(''); }
  };
  const exportMd = async () => {
    const entries = await db.journal.toArray();
    if (!entries.length) { toast('There are no journal entries to export yet.', { tone: 'error' }); return; }
    downloadBlob(`journal-${stamp()}.md`, new Blob([journalToMarkdown(entries, s.dateFormat)], { type: 'text/markdown' })); toast('Journal exported as Markdown');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setImpErr(null);
    try {
      const text = await f.text();
      const obj = JSON.parse(text);
      if (obj?.format === 'blue-room-backup-encrypted') { setLockedFile({ file: obj, name: f.name }); return; }
      const v = validateBackup(obj);
      if (!v.ok) { setImpErr(v.errors); return; }
      setImp({ backup: v.backup, summary: v.summary, name: f.name });
    } catch { setImpErr(['That file couldn’t be read as a Blue Room backup (it isn’t valid JSON).']); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };

  const wipe = async () => {
    if (!(await confirm({ title: 'Erase everything?', tone: 'danger', confirmLabel: 'Erase all data', requireText: 'erase', body: 'Every journal entry, memory, goal, event, decision and photo on this device will be permanently deleted. If you haven’t exported a backup, it cannot be recovered.' }))) return;
    await wipeEverything(); toast('All data erased'); setTimeout(() => location.reload(), 600);
  };

  return (
    <Section id="data" title="Your data & privacy" icon="lock">
      <div className="callout"><Icon name="lock" /><div className="stack sm">
        <strong>How your data is stored — honestly</strong>
        <span>Everything lives in this browser’s own database (IndexedDB) on this device. It is <strong>not</strong> uploaded anywhere, there is no account, and there are no analytics or trackers.</span>
        <span>That also means: it doesn’t sync to your other devices, it isn’t encrypted on disk (anyone who can use this browser profile can open the app), and clearing site data or uninstalling the browser deletes it. <strong>Download backups regularly</strong> — an encrypted one is safest to keep in cloud storage.</span>
      </div></div>

      <dl className="kv">
        <dt>Stored here</dt><dd>{counts ? `${counts.total} records · ${counts.journal} journal entries · ${counts.photos} photos/files` : '…'}</dd>
        <dt>Space used</dt><dd>{estimate?.usage !== undefined ? `${fmtBytes(estimate.usage)}${estimate.quota ? ` of about ${fmtBytes(estimate.quota)} available` : ''}` : 'Not reported by this browser'}</dd>
        <dt>Protected from cleanup</dt><dd>{persisted === null ? 'Unknown' : persisted ? 'Yes — the browser won’t evict it automatically' : 'Not yet — the browser may clear it if the device runs low on space'}{persisted === false && <> <Button size="sm" onClick={requestPersist}>Ask the browser to keep it</Button></>}</dd>
      </dl>

      <div className="stack">
        <h3 className="settings-sub">Back up</h3>
        <Switch checked={withPhotos} onChange={setWithPhotos} label="Include photos and files (larger file)" />
        <div className="row wrap">
          <Button variant="primary" icon="download" disabled={busy === 'json'} onClick={exportJson}>{busy === 'json' ? 'Preparing…' : 'Download backup (.json)'}</Button>
          <Button icon="lock" onClick={() => setEncOpen(true)}>Encrypted backup…</Button>
          <Button icon="journal" onClick={exportMd}>Journal as Markdown</Button>
        </div>
        <p className="small muted">The JSON backup contains everything and can be restored here. The Markdown export is a readable copy of your journal for other apps.</p>
      </div>

      <div className="stack">
        <h3 className="settings-sub">Restore</h3>
        <div className="row wrap"><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} /><Button icon="upload" onClick={() => fileRef.current?.click()}>Choose a backup file…</Button></div>
        {impErr && <div className="callout danger" role="alert"><Icon name="warn" /><div>{impErr.map((e) => <div key={e}>{e}</div>)}</div></div>}
      </div>

      <div className="stack">
        <h3 className="settings-sub">Danger zone</h3>
        <div><Button variant="danger" icon="trash" onClick={wipe}>Erase all data on this device…</Button></div>
      </div>

      <EncryptDialog open={encOpen} onClose={() => setEncOpen(false)} includePhotos={withPhotos} />
      <UnlockDialog locked={lockedFile} onClose={() => setLockedFile(null)} onOpened={(b) => { const v = validateBackup(b); if (v.ok) setImp({ backup: v.backup, summary: v.summary, name: lockedFile?.name ?? 'backup' }); else setImpErr(v.errors); setLockedFile(null); }} />
      <ImportDialog state={imp} onClose={() => setImp(null)} />
    </Section>
  );
}

function EncryptDialog({ open, onClose, includePhotos }: { open: boolean; onClose: () => void; includePhotos: boolean }) {
  const toast = useToast();
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (open) { setA(''); setB(''); setErr(''); } }, [open]);
  const go = async () => {
    if (a.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (a !== b) { setErr('The two passphrases don’t match.'); return; }
    setBusy(true); setErr('');
    try { const enc = await encryptBackup(await buildBackup({ includeAttachments: includePhotos }), a); downloadBlob(`blue-room-backup-${stamp()}.encrypted.json`, new Blob([JSON.stringify(enc)], { type: 'application/json' })); toast('Encrypted backup downloaded'); onClose(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Encrypted backup" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="lock" disabled={busy} onClick={go}>{busy ? 'Encrypting…' : 'Encrypt & download'}</Button></>}>
      <div className="stack">
        <p className="muted">Your backup is encrypted in your browser (AES-256) with a passphrase only you know. <strong>There is no recovery</strong> — if you forget it, the file can’t be opened by anyone, including us.</p>
        {err && <div className="callout warn" role="alert"><Icon name="warn" />{err}</div>}
        <TextField label="Passphrase" type="password" value={a} onChange={setA} />
        <TextField label="Repeat passphrase" type="password" value={b} onChange={setB} />
      </div>
    </Modal>
  );
}

function UnlockDialog({ locked, onClose, onOpened }: { locked: { file: any; name: string } | null; onClose: () => void; onOpened: (b: unknown) => void }) {
  const [pass, setPass] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setPass(''); setErr(''); }, [locked]);
  const go = async () => { setBusy(true); setErr(''); try { onOpened(await decryptBackup(locked!.file, pass)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <Modal open={!!locked} onClose={onClose} size="sm" title="This backup is encrypted" subtitle={locked?.name} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || !pass} onClick={go}>{busy ? 'Opening…' : 'Unlock'}</Button></>}>
      <div className="stack">{err && <div className="callout warn" role="alert"><Icon name="warn" />{err}</div>}<TextField label="Passphrase" type="password" value={pass} onChange={setPass} autoFocus /></div>
    </Modal>
  );
}

function ImportDialog({ state, onClose }: { state: { backup: BackupFile; summary: BackupSummary; name: string } | null; onClose: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [safety, setSafety] = useState(true);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  useEffect(() => { setMode('merge'); setSafety(true); setTyped(''); }, [state]);
  if (!state) return <Modal open={false} onClose={onClose} title="" children={null} />;
  const { summary } = state;
  const labels: Record<string, string> = { journal: 'journal entries', notes: 'notes', timeline: 'timeline events', chapters: 'chapters', memories: 'memories', odyssey: 'Odyssey experiences', people: 'people', places: 'places', lessons: 'lessons', letters: 'letters', achievements: 'achievements', goals: 'goals', events: 'calendar events', decisions: 'decisions', reflections: 'reflections', wisdom: 'wisdom entries', attachments: 'photos & files' };
  const go = async () => {
    setBusy(true);
    try {
      if (mode === 'replace' && safety) { const b = await buildBackup({ includeAttachments: true }); downloadBlob(`blue-room-before-restore-${stamp()}.json`, new Blob([JSON.stringify(b)], { type: 'application/json' })); }
      const res = await importBackup(state.backup, mode);
      toast(mode === 'replace' ? `Restored ${res.added} records` : `Merged: ${res.added} added, ${res.updated} updated, ${res.skipped} unchanged${res.keptRecordedDecisions ? ` (${res.keptRecordedDecisions} recorded decisions kept as they were)` : ''}`);
      onClose();
      if (mode === 'replace') setTimeout(() => location.reload(), 700);
    } catch (e) { toast('Restore failed — nothing was changed: ' + (e as Error).message, { tone: 'error' }); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} size="md" title="Restore from backup" subtitle={`${state.name}${summary.exportedAt ? ` · made ${new Date(summary.exportedAt).toLocaleString()}` : ''}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={mode === 'replace' ? 'danger' : 'primary'} solid={mode === 'replace'} disabled={busy || (mode === 'replace' && typed.trim().toLowerCase() !== 'replace')} icon="upload" onClick={go}>{busy ? 'Working…' : mode === 'replace' ? 'Replace everything' : 'Merge into my data'}</Button></>}>
      <div className="stack lg">
        <div className="callout ok"><Icon name="check" /><div><strong>This backup is valid.</strong> It contains {summary.total} records{summary.includesAttachments ? ', including photos and files' : ', without photos'}.</div></div>
        <ul className="count-list">{Object.entries(summary.counts).filter(([k, n]) => n > 0 && labels[k]).map(([k, n]) => <li key={k}><strong>{n}</strong> {labels[k]}</li>)}</ul>
        <Segmented<ImportMode> label="Restore mode" value={mode} onChange={setMode} options={[{ value: 'merge', label: 'Merge (safe)' }, { value: 'replace', label: 'Replace everything' }]} />
        {mode === 'merge' ? (
          <p className="small muted">Adds anything you don’t have yet and keeps the newer version of records that exist in both. Recorded Oracle decisions on this device are never overwritten. Nothing is deleted.</p>
        ) : (
          <div className="stack">
            <div className="callout danger"><Icon name="warn" /><div>This <strong>overwrites</strong> everything currently on this device with the backup’s contents.</div></div>
            <Switch checked={safety} onChange={setSafety} label="Download a safety copy of my current data first" />
            <TextField label="Type “replace” to confirm" value={typed} onChange={setTyped} />
          </div>
        )}
      </div>
    </Modal>
  );
}

export { Link, journalToMarkdown };
