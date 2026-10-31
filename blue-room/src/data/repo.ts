/** Repository layer: the only place the UI talks to storage. Swap this module (or the
 *  Dexie instance in db.ts) to move to a different storage provider later. */
import type { Table } from 'dexie';
import { db } from './db';
import { ENTITIES } from './entities';
import { isValidDate, isValidTime, todayIn } from '../lib/dates';
import type {
  AnyRecord, Attachment, CalendarEvent, Decision, DecisionReflection, EntityType, JournalEntry, LinkRef, Memory, Note,
  OdysseyItem, RecordRelationship, ReminderState, Settings,
} from './types';
import { normalizeSettings } from './db';

export function newId(): string {
  const c: any = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function tableFor(type: EntityType): Table<any, string> {
  return (db as any)[ENTITIES[type].table] as Table<any, string>;
}

/** Tables whose records can reference attachments. */
const ATTACHMENT_TYPES: EntityType[] = ['journal', 'timeline', 'chapter', 'memory', 'odyssey', 'person', 'place', 'achievement', 'goal'];

// ---------------------------------------------------------------- validation

export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(' '));
    this.name = 'ValidationError';
  }
}
export class ImmutableRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImmutableRecordError';
  }
}

const DATE_FIELDS = ['date', 'endDate', 'startDate', 'targetDate', 'completedOn', 'dateLearned', 'writtenOn', 'readOn', 'experiencedOn', 'reviewDate', 'until'];

export function validateRecord(type: EntityType, r: AnyRecord): string[] {
  const errs: string[] = [];
  const need = (cond: unknown, msg: string) => { if (!cond || (typeof cond === 'string' && !cond.trim())) errs.push(msg); };
  switch (type) {
    case 'journal': need(r.title || r.body, 'Write a few words or add a title first.'); need(r.date, 'Choose a date.'); break;
    case 'note': need(r.title || r.body, 'A note needs a few words.'); break;
    case 'timeline': need(r.title, 'Give this event a title.'); need(r.date, 'Choose a date.'); break;
    case 'chapter': need(r.title, 'Give this chapter a name.'); break;
    case 'memory': need(r.title, 'Give this memory a title.'); need(r.date, 'Choose a date.'); break;
    case 'odyssey': need(r.title, 'Give this experience a title.'); break;
    case 'person': need(r.name, 'Add a name.'); break;
    case 'place': need(r.name, 'Add a name.'); break;
    case 'lesson': need(r.title, 'Give this lesson a title.'); break;
    case 'letter': need(r.title, 'Give this letter a title.'); need(r.recipient, 'Who is it for?'); need(r.body, 'A letter needs some words.'); break;
    case 'achievement': need(r.title, 'Give this achievement a title.'); need(r.date, 'Choose a date.'); break;
    case 'goal': need(r.title, 'Give this goal a title.'); break;
    case 'event': {
      need(r.title, 'Give this event a title.'); need(r.date, 'Choose a date.');
      if (!r.allDay) {
        if (!isValidTime(r.startTime)) errs.push('Enter a valid start time.');
        else if (r.endTime && !isValidTime(r.endTime)) errs.push('Enter a valid end time.');
        else if (r.endTime && r.endDate === r.date && r.endTime < r.startTime) errs.push('The end time is before the start time.');
      }
      if (r.endDate && r.date && r.endDate < r.date) errs.push('The end date is before the start date.');
      if (r.recurrence?.freq && r.recurrence.freq !== 'none') {
        if (!(r.recurrence.interval >= 1)) errs.push('Repeat interval must be at least 1.');
        if (r.recurrence.until && r.recurrence.until < r.date) errs.push('“Repeat until” is before the first date.');
        if (r.recurrence.count !== undefined && !(r.recurrence.count >= 1)) errs.push('Repeat count must be at least 1.');
      }
      if (r.url && !/^https?:\/\//i.test(r.url)) errs.push('Links should start with http:// or https://');
      break;
    }
    case 'decision': need(r.title, 'Give this decision a title.'); need(r.date, 'Choose a date.'); break;
    case 'wisdom': need(r.title, 'Give this a title.'); break;
    case 'reflection': need(r.decisionId, 'Missing decision.'); break;
  }
  for (const f of DATE_FIELDS) {
    const v = r[f];
    if (v !== undefined && v !== '' && v !== null && !isValidDate(v)) errs.push(`“${f}” is not a valid date.`);
  }
  if (r.date && r.endDate && isValidDate(r.date) && isValidDate(r.endDate) && r.endDate < r.date && type !== 'event') errs.push('The end date is before the start date.');
  if (r.startDate && r.endDate && isValidDate(r.startDate) && isValidDate(r.endDate) && r.endDate < r.startDate) errs.push('The end date is before the start date.');
  return errs;
}

export function validateDecisionForRecording(d: Decision): string[] {
  const errs = validateRecord('decision', d);
  if (!d.situation.trim() && !d.context.trim()) errs.push('Describe the situation or context you were in.');
  const named = d.options.filter((o) => o.name.trim());
  if (named.length < 2) errs.push('List at least two options you considered — even “do nothing” counts.');
  if (!d.chosenText.trim()) errs.push('Say which option you chose.');
  if (!d.reasoning.trim()) errs.push('Write down why you chose it — this is the heart of the record.');
  if (!d.expectedOutcome.trim()) errs.push('What do you expect to happen? Future-you will compare against this.');
  return errs;
}

// ---------------------------------------------------------------- generic CRUD

export async function getRecord<T extends AnyRecord = AnyRecord>(type: EntityType, id: string): Promise<T | undefined> {
  return (await tableFor(type).get(id)) as T | undefined;
}

export async function listRecords<T extends AnyRecord = AnyRecord>(type: EntityType): Promise<T[]> {
  return (await tableFor(type).toArray()) as T[];
}

/** Fields of a recorded decision that may still change (scheduling / organisation only). */
const DECISION_MUTABLE_AFTER_RECORDING = new Set(['tags', 'reviewDate', 'updatedAt']);

export async function saveRecord<T extends AnyRecord>(type: EntityType, rec: T, opts: { skipValidation?: boolean } = {}): Promise<T> {
  if (!opts.skipValidation) {
    const errs = validateRecord(type, rec);
    if (errs.length) throw new ValidationError(errs);
  }
  const t = tableFor(type);
  const existing = (await t.get(rec.id)) as AnyRecord | undefined;
  const now = Date.now();
  const next: any = { ...rec, createdAt: existing?.createdAt || rec.createdAt || now, updatedAt: now };

  if (type === 'decision' && existing?.status === 'recorded') {
    // ORACLE integrity: the original reasoning is frozen the moment it is recorded.
    for (const k of Object.keys({ ...existing, ...next })) {
      if (DECISION_MUTABLE_AFTER_RECORDING.has(k)) continue;
      if (JSON.stringify(existing[k]) !== JSON.stringify(next[k])) {
        throw new ImmutableRecordError(
          'This decision has been recorded, so its original reasoning can’t be changed. Add a reflection or an addendum instead.',
        );
      }
    }
  }
  if (type === 'decision' && next.status === 'recorded' && !existing?.recordedAt) {
    next.recordedAt = now;
  }
  await t.put(next);
  return next as T;
}

export async function deleteRecord(type: EntityType, id: string): Promise<void> {
  const rec = (await tableFor(type).get(id)) as AnyRecord | undefined;
  if (!rec) return;
  const attachmentIds: string[] = rec.attachmentIds ?? [];
  const reflectionIds = type === 'decision' ? (await db.reflections.where('decisionId').equals(id).primaryKeys()) : [];
  await db.transaction('rw', [db.relationships, db.reflections, ...Object.values(ENTITIES).map((e) => (db as any)[e.table] as Table)], async () => {
    await tableFor(type).delete(id);
    if (type === 'decision') {
      await db.reflections.bulkDelete(reflectionIds as string[]);
      for (const rid of reflectionIds) await removeAllLinks('reflection', rid as string);
    }
    await removeAllLinks(type, id);
  });
  await cleanupOrphanAttachments(attachmentIds);
}

// ---------------------------------------------------------------- relationships

export async function removeAllLinks(type: EntityType, id: string): Promise<void> {
  const out = await db.relationships.where('[fromType+fromId]').equals([type, id]).primaryKeys();
  const inc = await db.relationships.where('[toType+toId]').equals([type, id]).primaryKeys();
  await db.relationships.bulkDelete([...out, ...inc]);
}

export async function getLinks(ref: LinkRef): Promise<LinkRef[]> {
  const out = await db.relationships.where('[fromType+fromId]').equals([ref.type, ref.id]).toArray();
  const inc = await db.relationships.where('[toType+toId]').equals([ref.type, ref.id]).toArray();
  const seen = new Set<string>();
  const refs: LinkRef[] = [];
  for (const r of out) { const k = `${r.toType}:${r.toId}`; if (!seen.has(k)) { seen.add(k); refs.push({ type: r.toType, id: r.toId }); } }
  for (const r of inc) { const k = `${r.fromType}:${r.fromId}`; if (!seen.has(k)) { seen.add(k); refs.push({ type: r.fromType, id: r.fromId }); } }
  return refs;
}

export async function addLink(from: LinkRef, to: LinkRef): Promise<boolean> {
  if (from.type === to.type && from.id === to.id) return false;
  const existing = await getLinks(from);
  if (existing.some((r) => r.type === to.type && r.id === to.id)) return false; // duplicate prevention
  const rel: RecordRelationship = { id: newId(), fromType: from.type, fromId: from.id, toType: to.type, toId: to.id, createdAt: Date.now() };
  await db.relationships.add(rel);
  return true;
}

export async function removeLink(a: LinkRef, b: LinkRef): Promise<void> {
  const ids: string[] = [];
  const o = await db.relationships.where('[fromType+fromId]').equals([a.type, a.id]).toArray();
  for (const r of o) if (r.toType === b.type && r.toId === b.id) ids.push(r.id);
  const i = await db.relationships.where('[toType+toId]').equals([a.type, a.id]).toArray();
  for (const r of i) if (r.fromType === b.type && r.fromId === b.id) ids.push(r.id);
  await db.relationships.bulkDelete(ids);
}

/** Make the set of links for `from` equal to `desired` (adds missing, removes dropped — both directions). */
export async function syncLinks(from: LinkRef, desired: LinkRef[]): Promise<void> {
  const current = await getLinks(from);
  const key = (r: LinkRef) => `${r.type}:${r.id}`;
  const want = new Set(desired.map(key));
  const have = new Set(current.map(key));
  for (const r of current) if (!want.has(key(r))) await removeLink(from, r);
  for (const r of desired) if (!have.has(key(r))) await addLink(from, r);
}

// ---------------------------------------------------------------- attachments

export const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export const ATTACHMENT_TYPES_OK = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'application/pdf'];

export function validateAttachmentFile(f: { name: string; type: string; size: number }): string | null {
  if (!ATTACHMENT_TYPES_OK.includes(f.type)) return `“${f.name}” isn’t a supported file. Use PNG, JPEG, WebP, GIF, AVIF or PDF.`;
  if (f.size > ATTACHMENT_MAX_BYTES) return `“${f.name}” is larger than 15 MB.`;
  if (f.size === 0) return `“${f.name}” is empty.`;
  return null;
}

async function downscale(file: File, maxEdge = 2200): Promise<Blob> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) { bmp.close?.(); return file; }
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const out: Blob | null = await new Promise((res) => c.toBlob(res, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88));
    return out && out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

export async function addAttachment(file: File): Promise<Attachment> {
  const err = validateAttachmentFile(file);
  if (err) throw new ValidationError([err]);
  const blob = await downscale(file);
  const att: Attachment = { id: newId(), name: file.name, mime: blob.type || file.type, size: blob.size, blob, createdAt: Date.now() };
  await db.attachments.add(att);
  return att;
}

export async function referencedAttachmentIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const type of ATTACHMENT_TYPES) {
    const rows = (await tableFor(type).toArray()) as AnyRecord[];
    for (const r of rows) for (const id of r.attachmentIds ?? []) ids.add(id);
  }
  return ids;
}

export async function cleanupOrphanAttachments(candidates: string[]): Promise<void> {
  if (!candidates.length) return;
  const used = await referencedAttachmentIds();
  const orphans = candidates.filter((id) => !used.has(id));
  if (orphans.length) await db.attachments.bulkDelete(orphans);
}

// ---------------------------------------------------------------- settings

export async function loadSettings(): Promise<Settings> {
  const raw = await db.settings.get('main');
  const s = normalizeSettings(raw);
  if (!raw) await db.settings.put(s);
  return s;
}

export async function saveSettings(s: Settings): Promise<Settings> {
  const next = { ...s, updatedAt: Date.now() };
  await db.settings.put(next);
  return next;
}

// ---------------------------------------------------------------- reminder state

export async function putReminderState(s: ReminderState) { await db.reminderState.put(s); }

// ---------------------------------------------------------------- promotions (reference, don't duplicate)

export async function promoteJournalToMemory(entry: JournalEntry, today = todayIn('UTC')): Promise<Memory> {
  if (entry.promotedMemoryId) {
    const existing = await db.memories.get(entry.promotedMemoryId);
    if (existing) return existing; // already promoted — never create a duplicate
  }
  const memory: Memory = {
    id: newId(), createdAt: 0, updatedAt: 0,
    title: entry.title || ENTITIES.journal.titleOf(entry),
    date: entry.date || today,
    description: entry.body,
    whyItMattered: '',
    tags: [...entry.tags],
    attachmentIds: [...entry.attachmentIds], // shared by reference; orphan-safe on delete
    sourceJournalId: entry.id,
  };
  const saved = await saveRecord('memory', memory);
  await db.journal.update(entry.id, { promotedMemoryId: saved.id, updatedAt: Date.now() });
  await addLink({ type: 'memory', id: saved.id }, { type: 'journal', id: entry.id });
  return saved;
}

export async function promoteOdysseyToMemory(item: OdysseyItem, today: string): Promise<Memory> {
  if (item.promotedMemoryId) {
    const existing = await db.memories.get(item.promotedMemoryId);
    if (existing) return existing;
  }
  const memory: Memory = {
    id: newId(), createdAt: 0, updatedAt: 0,
    title: item.title,
    date: item.experiencedOn || today,
    description: item.description,
    whyItMattered: item.whyItMatters,
    tags: [...item.tags],
    attachmentIds: [...item.attachmentIds],
    sourceOdysseyId: item.id,
  };
  const saved = await saveRecord('memory', memory);
  await db.odyssey.update(item.id, { promotedMemoryId: saved.id, updatedAt: Date.now() });
  await addLink({ type: 'memory', id: saved.id }, { type: 'odyssey', id: item.id });
  return saved;
}

export async function convertNoteToJournal(note: Note, date: string): Promise<JournalEntry> {
  if (note.convertedJournalId) {
    const existing = await db.journal.get(note.convertedJournalId);
    if (existing) return existing;
  }
  const entry: JournalEntry = {
    id: newId(), createdAt: 0, updatedAt: 0,
    title: note.title, body: note.body, date, category: 'Everyday', tags: [...note.tags], status: 'saved', attachmentIds: [],
  };
  const saved = await saveRecord('journal', entry);
  await db.notes.update(note.id, { convertedJournalId: saved.id, updatedAt: Date.now() });
  await addLink({ type: 'journal', id: saved.id }, { type: 'note', id: note.id });
  return saved;
}

// ---------------------------------------------------------------- oracle helpers

export async function recordDecision(d: Decision): Promise<Decision> {
  const errs = validateDecisionForRecording(d);
  if (errs.length) throw new ValidationError(errs);
  const existing = await db.decisions.get(d.id);
  if (existing?.status === 'recorded') throw new ImmutableRecordError('This decision is already recorded.');
  return saveRecord('decision', { ...d, status: 'recorded' as const });
}

export async function saveReflection(r: DecisionReflection): Promise<DecisionReflection> {
  const decision = await db.decisions.get(r.decisionId);
  if (!decision) throw new ValidationError(['That decision no longer exists.']);
  if (decision.status !== 'recorded') throw new ValidationError(['Record the decision before reflecting on it.']);
  return saveRecord('reflection', r);
}

// ---------------------------------------------------------------- duplicates

export async function findDuplicateByName(type: 'person' | 'place', name: string, excludeId?: string): Promise<AnyRecord | undefined> {
  const norm = name.trim().toLowerCase();
  if (!norm) return undefined;
  const rows = (await tableFor(type).toArray()) as AnyRecord[];
  return rows.find((r) => r.id !== excludeId && String(r.name).trim().toLowerCase() === norm);
}

export type { CalendarEvent };
