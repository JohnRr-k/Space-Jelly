import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../../components/Icon';
import { Button, Chips, EmptyState, PageHeader, Reveal, Segmented, useToast } from '../../components/ui';
import { CoverImage } from '../../components/media';
import { useAttachments, useRecords } from '../../app/hooks';
import { useFmt, useSettings } from '../../app/settings';
import { db } from '../../data/db';
import { ENTITIES, plural } from '../../data/entities';
import { promoteOdysseyToMemory, saveRecord } from '../../data/repo';
import { diffDays } from '../../lib/dates';
import type { AnyRecord, EntityType } from '../../data/types';
import { byDateAsc, byDateDesc, byRecent, RecordWorkspace, type Helpers } from '../RecordKit';
import {
  achievementConfig, chapterConfig, lessonConfig, letterConfig, memoryConfig, odysseyConfig, personConfig, placeConfig, SECTIONS, timelineConfig,
} from './configs';

// ============================================================ shell

export default function Legacy() {
  const { section } = useParams();
  const known = SECTIONS.find((s) => s.id === section);
  if (section && !known) return <Navigate to="/legacy" replace />;
  const areas = ['The Story', 'The Record', 'What It Meant'] as const;
  return (
    <div className="page">
      <PageHeader
        eyebrow="Legacy" icon="legacy" title={known ? known.label : 'Your Legacy'}
        sub={known ? known.blurb : 'A connected record of what happened, who was there, where it was, and what it meant.'}
      />
      <nav className="tabs" aria-label="Legacy sections">
        <NavLink to="/legacy" end aria-current={!section ? 'page' : undefined}><Icon name="legacy" />Overview</NavLink>
        {areas.map((a) => (
          <span key={a} style={{ display: 'contents' }}>
            <span className="tabgroup-label" aria-hidden="true">{a}</span>
            {SECTIONS.filter((s) => s.area === a).map((s) => (
              <NavLink key={s.id} to={`/legacy/${s.id}`}><Icon name={s.icon} />{s.label}</NavLink>
            ))}
          </span>
        ))}
      </nav>
      {!known ? <Overview /> : <SectionRouter id={known.id} />}
    </div>
  );
}

function SectionRouter({ id }: { id: string }) {
  switch (id) {
    case 'timeline': return <TimelineSection />;
    case 'chapters': return <ChaptersSection />;
    case 'memories': return <MemoriesSection />;
    case 'odyssey': return <OdysseySection />;
    case 'people': return <PeopleSection />;
    case 'places': return <PlacesSection />;
    case 'lessons': return <LessonsSection />;
    case 'letters': return <LettersSection />;
    default: return <AchievementsSection />;
  }
}

// ============================================================ overview

function OverviewCard({ s }: { s: (typeof SECTIONS)[number] }) {
  const rows = useRecords(s.cfg.type);
  const meta = ENTITIES[s.cfg.type];
  const newest = rows && rows.length ? [...rows].sort(byRecent)[0] : undefined;
  return (
    <Link to={`/legacy/${s.id}`} className="card-link legacy-card">
      <div className="row"><span className="legacy-ico"><Icon name={s.icon} /></span><div className="grow"><strong>{s.label}</strong><div className="small muted">{s.blurb}</div></div></div>
      <div className="legacy-foot small">
        <span className="chip plain">{rows ? plural(rows.length, meta.label.toLowerCase().replace('timeline event', 'moment').replace('odyssey experience', 'experience'), s.id === 'people' ? 'people' : s.id === 'timeline' ? 'moments' : s.id === 'odyssey' ? 'experiences' : undefined) : '…'}</span>
        {newest && <span className="faint truncate">Latest: {meta.titleOf(newest)}</span>}
      </div>
    </Link>
  );
}

function Overview() {
  return (
    <div className="stack lg">
      {(['The Story', 'The Record', 'What It Meant'] as const).map((area, i) => (
        <Reveal key={area} delay={i * 60}>
          <section aria-labelledby={`area-${i}`}>
            <h2 id={`area-${i}`} className="area-title">{area}</h2>
            <div className="legacy-grid">{SECTIONS.filter((s) => s.area === area).map((s) => <OverviewCard key={s.id} s={s} />)}</div>
          </section>
        </Reveal>
      ))}
      <p className="small faint" style={{ maxWidth: '62ch' }}>
        Everything here is yours alone and lives only in this browser. Records can be linked to one another — a memory to the people and places in it, a lesson to the memory it came from — without ever being copied.
      </p>
    </div>
  );
}

// ============================================================ timeline

function TimelineSection() {
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [show, setShow] = useState({ achievement: true, memory: false, odyssey: false, chapter: false });
  const achievements = useRecords('achievement');
  const memories = useRecords('memory');
  const odyssey = useRecords('odyssey');
  const chapters = useRecords('chapter');

  const toggle = (k: keyof typeof show) => setShow((s) => ({ ...s, [k]: !s[k] }));
  const extras = (
    <div className="chips" role="group" aria-label="Also show on the timeline">
      {([['achievement', 'Achievements'], ['memory', 'Memories'], ['odyssey', 'Experienced'], ['chapter', 'Chapters']] as const).map(([k, label]) => (
        <button key={k} type="button" className={`chip ${show[k] ? 'active' : ''}`} aria-pressed={show[k]} onClick={() => toggle(k)}>{show[k] ? '✓ ' : '+ '}{label}</button>
      ))}
    </div>
  );

  return (
    <RecordWorkspace
      config={timelineConfig}
      sort={order === 'desc' ? byDateDesc('date') : byDateAsc('date')}
      toolbarExtra={<><Segmented label="Order" value={order} onChange={setOrder} options={[{ value: 'desc', label: 'Newest first' }, { value: 'asc', label: 'Oldest first' }]} />{extras}</>}
      renderList={(items, h) => {
        type Row = { key: string; kind: EntityType; date: string; endDate?: string; title: string; text: string; chip: string; rec: AnyRecord; own: boolean };
        const rows: Row[] = items.map((r) => ({ key: r.id, kind: 'timeline', date: r.date, endDate: r.endDate, title: r.title, text: r.description, chip: r.category, rec: r, own: true }));
        if (show.achievement) (achievements ?? []).forEach((r) => rows.push({ key: 'a' + r.id, kind: 'achievement', date: r.date, title: r.title, text: r.description, chip: 'Achievement', rec: r, own: false }));
        if (show.memory) (memories ?? []).forEach((r) => rows.push({ key: 'm' + r.id, kind: 'memory', date: r.date, title: r.title, text: r.description, chip: 'Memory', rec: r, own: false }));
        if (show.odyssey) (odyssey ?? []).filter((r) => r.experiencedOn).forEach((r) => rows.push({ key: 'o' + r.id, kind: 'odyssey', date: r.experiencedOn, title: r.title, text: r.description, chip: 'Odyssey', rec: r, own: false }));
        if (show.chapter) (chapters ?? []).filter((r) => r.startDate).forEach((r) => rows.push({ key: 'c' + r.id, kind: 'chapter', date: r.startDate, title: `A chapter begins: ${r.title}`, text: r.summary, chip: 'Chapter', rec: r, own: false }));
        rows.sort((a, b) => (order === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
        let lastYear = '';
        return (
          <ol className="timeline" aria-label="Timeline">
            {rows.map((r) => {
              const year = r.date.slice(0, 4);
              const head = year !== lastYear ? <li className="tl-year" aria-hidden="true" key={'y' + year + r.key}>{year}</li> : null;
              lastYear = year;
              const body = (
                <>
                  <div className="tl-date">{h.fmt.date(r.date, { short: true })}{r.endDate ? ` → ${h.fmt.date(r.endDate, { short: true })}` : ''}</div>
                  <div className="tl-main">
                    <CoverImage ids={r.rec.attachmentIds ?? []} className="tl-img" />
                    <div className="grow">
                      <h3>{r.title}</h3>
                      {r.text && <p className="muted tl-text">{r.text}</p>}
                      <span className={`chip ${r.own ? '' : 'lav'}`}>{r.chip}</span>
                    </div>
                  </div>
                </>
              );
              return (
                <Fragment key={r.key}>
                  {head}
                  <li className={`tl-item ${r.own ? '' : 'overlay'}`}>
                    <span className="tl-dot" aria-hidden="true" />
                    {r.own
                      ? <button type="button" className="tl-card" onClick={() => h.open(r.key)}>{body}</button>
                      : <Link className="tl-card" to={ENTITIES[r.kind].route(r.rec.id)}>{body}</Link>}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        );
      }}
    />
  );
}

// ============================================================ chapters

function useRelCounts() {
  const rels = useLiveQuery(() => db.relationships.toArray(), []);
  return useMemo(() => {
    const m = new Map<string, Map<EntityType, number>>();
    for (const r of rels ?? []) {
      const add = (a: string, t: EntityType) => { const x = m.get(a) ?? new Map<EntityType, number>(); x.set(t, (x.get(t) ?? 0) + 1); m.set(a, x); };
      add(r.fromId, r.toType); add(r.toId, r.fromType);
    }
    return m;
  }, [rels]);
}

function ChaptersSection() {
  const counts = useRelCounts();
  const fmt = useFmt();
  const today = fmt.today();
  return (
    <RecordWorkspace
      config={chapterConfig}
      sort={(a, b) => (b.startDate ?? '9999').localeCompare(a.startDate ?? '9999') || b.updatedAt - a.updatedAt}
      renderList={(items, h) => (
        <div className="chapter-list">
          {items.map((c) => {
            const current = c.startDate && c.startDate <= today && (!c.endDate || c.endDate >= today);
            const cm = counts.get(c.id);
            return (
              <button type="button" key={c.id} className="chapter-card" onClick={() => h.open(c.id)}>
                <CoverImage ids={c.attachmentIds ?? []} className="chapter-img" />
                <div className="chapter-body">
                  <div className="row wrap">
                    <span className="small faint">{c.startDate ? `${h.fmt.date(c.startDate, { short: true })} — ${c.endDate ? h.fmt.date(c.endDate, { short: true }) : 'now'}` : 'Dates not set'}</span>
                    {current && <span className="chip ok">Current chapter</span>}
                  </div>
                  <h3>{c.title}</h3>
                  {c.summary && <p className="muted tl-text">{c.summary}</p>}
                  {cm && <div className="chips">{[...cm.entries()].map(([t, n]) => <span key={t} className="chip plain"><Icon name={ENTITIES[t].icon} size={13} /> {n}</span>)}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
      extra={(c) => <InPeriod chapter={c} />}
    />
  );
}

/** Derived (not stored): everything dated inside the chapter's span. */
function InPeriod({ chapter }: { chapter: AnyRecord }) {
  const fmt = useFmt();
  const timeline = useRecords('timeline');
  const memories = useRecords('memory');
  const achievements = useRecords('achievement');
  if (!chapter.startDate) return null;
  const end = chapter.endDate || fmt.today();
  const within = (d?: string) => !!d && d >= chapter.startDate && d <= end;
  const rows = [
    ...(timeline ?? []).filter((r) => within(r.date)).map((r) => ({ type: 'timeline' as EntityType, r })),
    ...(memories ?? []).filter((r) => within(r.date)).map((r) => ({ type: 'memory' as EntityType, r })),
    ...(achievements ?? []).filter((r) => within(r.date)).map((r) => ({ type: 'achievement' as EntityType, r })),
  ].sort((a, b) => a.r.date.localeCompare(b.r.date));
  if (!rows.length) return null;
  return (
    <div className="stack sm">
      <div className="card-title"><span className="left"><Icon name="clock" />Dated within this chapter</span></div>
      <p className="tiny faint">Found by date — not copied. Link a record explicitly if you want it permanently tied to this chapter.</p>
      <div className="rowlist">
        {rows.slice(0, 20).map(({ type, r }) => (
          <Link key={type + r.id} className="rowitem" to={ENTITIES[type].route(r.id)}>
            <Icon name={ENTITIES[type].icon} /><span className="grow">{ENTITIES[type].titleOf(r)}</span><span className="meta">{fmt.date(r.date, { short: true })}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ============================================================ memories

function MemoriesSection() {
  const [view, setView] = useState<'scrapbook' | 'gallery' | 'list'>('scrapbook');
  return (
    <RecordWorkspace
      config={memoryConfig}
      sort={byDateDesc('date')}
      toolbarExtra={<Segmented label="View" value={view} onChange={setView} options={[{ value: 'scrapbook', label: 'Scrapbook' }, { value: 'gallery', label: 'Photos' }, { value: 'list', label: 'List' }]} />}
      renderList={(items, h) => view === 'gallery' ? <MemoryGallery items={items} h={h} /> : view === 'list' ? (
        <div className="card flat"><div className="rowlist">
          {items.map((m) => <button key={m.id} className="rowitem" onClick={() => h.open(m.id)}><Icon name="memory" /><span className="grow" style={{ fontWeight: 600 }}>{m.title}</span><span className="meta">{h.fmt.date(m.date, { short: true })}</span></button>)}
        </div></div>
      ) : (
        <div className="scrapbook">
          {items.map((m, i) => (
            <button key={m.id} type="button" className={`polaroid tilt-${i % 4}`} onClick={() => h.open(m.id)}>
              <span className="tape" aria-hidden="true" />
              <CoverImage ids={m.attachmentIds ?? []} className="polaroid-img" />
              <span className="polaroid-cap">
                <span className="polaroid-date">{h.fmt.date(m.date, { short: true })}</span>
                <strong>{m.title}</strong>
                {m.description && <span className="polaroid-text">{m.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      extra={(m) => (
        <>
          {m.sourceJournalId && <p className="small muted"><Icon name="journal" size={14} /> Promoted from a journal entry — <Link to={`/journal/${m.sourceJournalId}`}>open the original</Link>.</p>}
          {m.sourceOdysseyId && <p className="small muted"><Icon name="compass" size={14} /> Saved from an Odyssey experience — <Link to={`/legacy/odyssey?open=${m.sourceOdysseyId}`}>open it</Link>.</p>}
        </>
      )}
    />
  );
}

function MemoryGallery({ items, h }: { items: AnyRecord[]; h: Helpers }) {
  const ownerOf = useMemo(() => { const m = new Map<string, AnyRecord>(); items.forEach((it) => (it.attachmentIds ?? []).forEach((id: string) => m.set(id, it))); return m; }, [items]);
  const atts = useAttachments([...ownerOf.keys()].slice(0, 150));
  const photos = atts.filter((a) => a.mime.startsWith('image/'));
  if (!photos.length) return <EmptyState compact title="No photos yet" body="Add photos to a memory and they’ll gather here." />;
  return (
    <div className="photo-wall">
      {photos.map((a) => {
        const m = ownerOf.get(a.id)!;
        return (
          <button key={a.id} className="photo-tile" type="button" onClick={() => h.open(m.id)} aria-label={`${m.title} — open memory`}>
            <img src={a.url} alt={a.name} loading="lazy" />
            <span className="photo-cap">{m.title}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================ odyssey

function OdysseySection() {
  const { settings } = useSettings();
  const toast = useToast();
  const statuses = settings.odysseyStatuses;
  const last = statuses[statuses.length - 1];
  return (
    <RecordWorkspace
      config={odysseyConfig}
      sort={byRecent}
      renderList={(items, h) => {
        const cols = [...statuses, ...(items.some((i) => !statuses.includes(i.status)) ? ['Other'] : [])];
        return (
          <div className="odyssey-board" style={{ ['--cols' as any]: cols.length }}>
            {cols.map((st, ci) => {
              const list = items.filter((i) => (st === 'Other' ? !statuses.includes(i.status) : i.status === st));
              return (
                <section key={st} className="odyssey-col" aria-label={st}>
                  <h3><span className={`dot step-${Math.min(ci, 2)}`} />{st}<span className="chip plain">{list.length}</span></h3>
                  {list.length === 0 && <p className="tiny faint">Nothing here yet.</p>}
                  {list.map((o) => (
                    <button key={o.id} type="button" className="odyssey-card" onClick={() => h.open(o.id)}>
                      <CoverImage ids={o.attachmentIds ?? []} className="odyssey-img" />
                      <strong>{o.title}</strong>
                      {(o.destination || o.targetDate || o.experiencedOn) && <span className="small muted">{[o.destination, o.experiencedOn ? `Lived ${h.fmt.date(o.experiencedOn, { short: true })}` : o.targetDate ? `Target ${h.fmt.date(o.targetDate, { short: true })}` : ''].filter(Boolean).join(' · ')}</span>}
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
        );
      }}
      extra={(o) => <OdysseyStatus item={o} statuses={statuses} last={last} onToast={toast} />}
    />
  );
}

function OdysseyStatus({ item, statuses, last, onToast }: { item: AnyRecord; statuses: string[]; last: string; onToast: (m: string) => void }) {
  const fmt = useFmt();
  const setStatus = async (st: string) => {
    const next = { ...item, status: st, experiencedOn: st === last && !item.experiencedOn ? fmt.today() : item.experiencedOn };
    await saveRecord('odyssey', next);
    onToast(`Moved to ${st}`);
  };
  const promote = async () => { await promoteOdysseyToMemory(item as any, fmt.today()); onToast('Saved as a memory'); };
  return (
    <div className="stack sm">
      <div className="card-title"><span className="left"><Icon name="swap" />Where it is now</span></div>
      <div className="chips">
        {statuses.map((s) => <button key={s} type="button" className={`chip ${item.status === s ? 'active' : ''}`} aria-pressed={item.status === s} onClick={() => item.status !== s && setStatus(s)}>{s}</button>)}
      </div>
      {item.status === last && (
        item.promotedMemoryId
          ? <p className="small muted">Saved as a memory — <Link to={`/legacy/memories?open=${item.promotedMemoryId}`}>open it</Link>.</p>
          : <div><Button size="sm" icon="memory" onClick={promote}>Save this as a memory</Button><p className="tiny faint" style={{ marginTop: 6 }}>Creates one linked memory using this experience’s words and photos.</p></div>
      )}
    </div>
  );
}

// ============================================================ people / places

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '·'; }

function PeopleSection() {
  return (
    <RecordWorkspace
      config={personConfig} sort={(a, b) => a.name.localeCompare(b.name)}
      renderList={(items, h) => (
        <div className="card-grid">
          {items.map((p) => (
            <button key={p.id} type="button" className="person-card" onClick={() => h.open(p.id)}>
              <span className="avatar">
                <CoverImage ids={p.attachmentIds ?? []} className="avatar-img" />
                <span aria-hidden="true">{initials(p.name)}</span>
              </span>
              <strong>{p.name}</strong>
              <span className="small muted">{p.relationship || ' '}</span>
            </button>
          ))}
        </div>
      )}
    />
  );
}

function PlacesSection() {
  return (
    <RecordWorkspace
      config={placeConfig} sort={(a, b) => a.name.localeCompare(b.name)}
      renderList={(items, h) => (
        <div className="card-grid wide">
          {items.map((p) => (
            <button key={p.id} type="button" className="place-card" onClick={() => h.open(p.id)}>
              <span className="place-cover"><CoverImage ids={p.attachmentIds ?? []} className="place-img" /><Icon name="place" /></span>
              <strong>{p.name}</strong>
              <span className="small muted">{p.location}</span>
              {p.description && <span className="small tl-text">{p.description}</span>}
            </button>
          ))}
        </div>
      )}
    />
  );
}

// ============================================================ lessons / letters / achievements

function LessonsSection() {
  return (
    <RecordWorkspace
      config={lessonConfig} sort={byDateDesc('dateLearned')}
      renderList={(items, h) => (
        <div className="lesson-list">
          {items.map((l) => (
            <button key={l.id} type="button" className="lesson-card" onClick={() => h.open(l.id)}>
              <span className="lesson-mark" aria-hidden="true"><Icon name="lesson" /></span>
              <span className="grow">
                <strong>{l.title}</strong>
                {l.principle && <span className="lesson-principle">“{l.principle}”</span>}
                {l.dateLearned && <span className="small faint">{h.fmt.date(l.dateLearned)}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    />
  );
}

function isSealed(l: AnyRecord, today: string) { return !!l.readOn && l.readOn > today && !l.openedAt; }

function LettersSection() {
  const fmt = useFmt();
  const today = fmt.today();
  return (
    <RecordWorkspace
      config={letterConfig} sort={byDateDesc('writtenOn')}
      renderList={(items, h) => (
        <div className="card-grid wide">
          {items.map((l) => {
            const sealed = isSealed(l, today);
            return (
              <button key={l.id} type="button" className={`letter-card ${sealed ? 'sealed' : ''}`} onClick={() => h.open(l.id)}>
                <span className="envelope" aria-hidden="true"><Icon name="letter" /></span>
                <strong>{l.title}</strong>
                <span className="small muted">To {l.recipient} · written {h.fmt.date(l.writtenOn, { short: true })}</span>
                {sealed && <span className="chip lav">Meant for {h.fmt.date(l.readOn, { short: true })}</span>}
                {l.readOn && !sealed && !l.openedAt && <span className="chip ok">Ready to read</span>}
              </button>
            );
          })}
        </div>
      )}
      hero={(l) => <LetterReader letter={l} />}
    />
  );
}

function LetterReader({ letter }: { letter: AnyRecord }) {
  const fmt = useFmt();
  const today = fmt.today();
  const sealed = isSealed(letter, today);
  useEffect(() => {
    // Reading a letter on/after its date marks it opened, which also stops its reminder.
    if (!sealed && letter.readOn && !letter.openedAt) db.letters.update(letter.id, { openedAt: Date.now() });
  }, [sealed, letter.id, letter.readOn, letter.openedAt]);
  if (sealed) {
    return (
      <div className="callout"><Icon name="lock" />
        <div className="stack sm">
          <div><strong>Sealed until {fmt.date(letter.readOn)}.</strong> You wrote this on {fmt.date(letter.writtenOn)} for {letter.recipient}.</div>
          <div className="small muted">There’s no lock — this is your own letter, and nothing is sent anywhere. The seal just keeps it a surprise.</div>
          <div><Button size="sm" onClick={() => db.letters.update(letter.id, { openedAt: Date.now() })}>Open it early</Button></div>
        </div>
      </div>
    );
  }
  return (
    <div className="letter-paper serif">
      <div className="small faint" style={{ fontFamily: 'var(--font-sans)' }}>{fmt.date(letter.writtenOn)}</div>
      <p className="letter-to">Dear {letter.recipient},</p>
      <div className="pre">{letter.body}</div>
    </div>
  );
}

function AchievementsSection() {
  return (
    <RecordWorkspace
      config={achievementConfig} sort={byDateDesc('date')}
      renderList={(items, h) => (
        <div className="card-grid wide">
          {items.map((a) => (
            <button key={a.id} type="button" className="ach-card" onClick={() => h.open(a.id)}>
              <span className="pearl" aria-hidden="true"><Icon name="pearl" /></span>
              <span className="grow">
                <span className="small faint">{h.fmt.date(a.date)}</span>
                <strong style={{ display: 'block' }}>{a.title}</strong>
                {a.whyItMatters && <span className="small muted tl-text">{a.whyItMatters}</span>}
              </span>
              <CoverImage ids={a.attachmentIds ?? []} className="ach-img" />
            </button>
          ))}
        </div>
      )}
    />
  );
}

export { diffDays, Chips };
