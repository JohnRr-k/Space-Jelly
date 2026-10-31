import { beforeEach, describe, expect, it } from 'vitest';
import { db, useDatabase } from './db';
import {
  addAttachment, addLink, deleteRecord, getLinks, ImmutableRecordError, newId, promoteJournalToMemory, recordDecision,
  saveRecord, saveReflection, syncLinks, validateAttachmentFile, ValidationError, convertNoteToJournal, findDuplicateByName,
  promoteOdysseyToMemory,
} from './repo';
import { buildBackup, decryptBackup, encryptBackup, importBackup, journalToMarkdown, validateBackup, wipeEverything } from './backup';
import type { Decision, JournalEntry, Note, OdysseyItem } from './types';

beforeEach(async () => {
  useDatabase('test-' + Math.random().toString(36).slice(2));
  await db.open();
});

const journal = (p: Partial<JournalEntry> = {}): JournalEntry => ({
  id: newId(), createdAt: 0, updatedAt: 0, title: 'A quiet day', body: 'It rained and I read.', date: '2026-03-02', category: 'Everyday',
  tags: ['rain'], status: 'saved', attachmentIds: [], ...p,
});
const decision = (p: Partial<Decision> = {}): Decision => ({
  id: newId(), createdAt: 0, updatedAt: 0, title: 'Which path?', date: '2026-03-01', status: 'draft', context: 'ctx', situation: 'sit', objective: 'obj',
  options: [{ id: 'a', name: 'A', pros: '', cons: '' }, { id: 'b', name: 'B', pros: '', cons: '' }], evidence: '', assumptions: 'It will be quiet',
  constraints: '', risks: '', tradeoffs: '', chosenOptionId: 'a', chosenText: 'A', reasoning: 'Because it felt right', expectedOutcome: 'Calm',
  confidence: 70, tags: [], ...p,
});

describe('records', () => {
  it('validates required fields and dates', async () => {
    await expect(saveRecord('journal', journal({ title: '', body: '' }))).rejects.toBeInstanceOf(ValidationError);
    await expect(saveRecord('memory', { id: newId(), title: 'x', date: '2026-02-30', description: '', whyItMattered: '', tags: [], attachmentIds: [] } as any)).rejects.toBeInstanceOf(ValidationError);
    await expect(saveRecord('event', { id: newId(), title: 'x', date: '2026-03-01', endDate: '2026-03-01', allDay: false, startTime: '10:00', endTime: '09:00', recurrence: { freq: 'none', interval: 1 } } as any)).rejects.toThrow(/end time/);
  });
  it('upserts by id so repeated saves never duplicate', async () => {
    const e = journal();
    await saveRecord('journal', e); await saveRecord('journal', { ...e, title: 'Edited' }); await saveRecord('journal', { ...e, title: 'Edited again' });
    const all = await db.journal.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Edited again');
    expect(all[0].createdAt).toBeGreaterThan(0);
  });
  it('links records without duplicating and cleans up on delete', async () => {
    const j = await saveRecord('journal', journal());
    const m = await saveRecord('memory', { id: newId(), title: 'Mem', date: '2026-03-02', description: '', whyItMattered: '', tags: [], attachmentIds: [] } as any);
    expect(await addLink({ type: 'memory', id: m.id }, { type: 'journal', id: j.id })).toBe(true);
    expect(await addLink({ type: 'journal', id: j.id }, { type: 'memory', id: m.id })).toBe(false); // reverse duplicate
    expect(await getLinks({ type: 'journal', id: j.id })).toEqual([{ type: 'memory', id: m.id }]);
    await syncLinks({ type: 'memory', id: m.id }, []);
    expect(await getLinks({ type: 'journal', id: j.id })).toEqual([]);
    await addLink({ type: 'memory', id: m.id }, { type: 'journal', id: j.id });
    await deleteRecord('journal', j.id);
    expect(await db.relationships.count()).toBe(0);
    expect(await db.memories.count()).toBe(1);
  });
  it('promotes a journal entry to a memory once, by reference', async () => {
    const j = await saveRecord('journal', journal({ attachmentIds: ['x1'] }));
    const m1 = await promoteJournalToMemory(j);
    const fresh = (await db.journal.get(j.id))!;
    const m2 = await promoteJournalToMemory(fresh);
    expect(m2.id).toBe(m1.id);
    expect(await db.memories.count()).toBe(1);
    expect(fresh.promotedMemoryId).toBe(m1.id);
    expect(m1.sourceJournalId).toBe(j.id);
    expect(await getLinks({ type: 'memory', id: m1.id })).toEqual([{ type: 'journal', id: j.id }]);
  });
  it('promotes odyssey and converts notes once', async () => {
    const o = await saveRecord<OdysseyItem>('odyssey', { id: newId(), title: 'See the sea', description: 'd', whyItMatters: 'w', destination: '', status: 'Experienced', experiencedOn: '2026-02-01', tags: [], attachmentIds: [] } as any);
    const m = await promoteOdysseyToMemory(o, '2026-03-01');
    expect(m.date).toBe('2026-02-01');
    expect((await promoteOdysseyToMemory((await db.odyssey.get(o.id))!, '2026-03-01')).id).toBe(m.id);
    const n = await saveRecord<Note>('note', { id: newId(), title: 'Thought', body: 'body', pinned: false, category: 'Idea', tags: [] } as any);
    const j1 = await convertNoteToJournal(n, '2026-03-02');
    const j2 = await convertNoteToJournal((await db.notes.get(n.id))!, '2026-03-02');
    expect(j2.id).toBe(j1.id);
    expect(await db.journal.count()).toBe(1);
  });
  it('detects duplicate people names case-insensitively', async () => {
    const p = await saveRecord('person', { id: newId(), name: 'Mara Lee', relationship: '', description: '', importantDates: '', notes: '', tags: [], attachmentIds: [] } as any);
    expect((await findDuplicateByName('person', '  mara lee ', undefined))?.id).toBe(p.id);
    expect(await findDuplicateByName('person', 'mara lee', p.id)).toBeUndefined();
  });
});

describe('attachments', () => {
  it('validates type and size', () => {
    expect(validateAttachmentFile({ name: 'a.exe', type: 'application/x-msdownload', size: 10 })).toMatch(/supported/);
    expect(validateAttachmentFile({ name: 'big.png', type: 'image/png', size: 20 * 1024 * 1024 })).toMatch(/15 MB/);
    expect(validateAttachmentFile({ name: 'ok.png', type: 'image/png', size: 1000 })).toBeNull();
  });
  it('stores blobs and removes them only when no record references them', async () => {
    const att = await addAttachment(new File([new Uint8Array([1, 2, 3, 4])], 'a.png', { type: 'image/png' }));
    const j = await saveRecord('journal', journal({ attachmentIds: [att.id] }));
    const m = await promoteJournalToMemory(j); // shares the attachment by reference
    await deleteRecord('journal', j.id);
    expect(await db.attachments.get(att.id)).toBeDefined(); // memory still uses it
    await deleteRecord('memory', m.id);
    expect(await db.attachments.get(att.id)).toBeUndefined();
  });
});

describe('ORACLE integrity', () => {
  it('lets drafts change but freezes recorded decisions', async () => {
    const d = await saveRecord('decision', decision());
    await saveRecord('decision', { ...d, reasoning: 'Edited while draft' });
    const rec = await recordDecision({ ...(await db.decisions.get(d.id))! });
    expect(rec.status).toBe('recorded');
    expect(rec.recordedAt).toBeGreaterThan(0);
    await expect(saveRecord('decision', { ...rec, reasoning: 'Hindsight rewrite' })).rejects.toBeInstanceOf(ImmutableRecordError);
    await expect(saveRecord('decision', { ...rec, confidence: 10 })).rejects.toBeInstanceOf(ImmutableRecordError);
    await expect(saveRecord('decision', { ...rec, status: 'draft' as const })).rejects.toBeInstanceOf(ImmutableRecordError);
    await expect(recordDecision(rec)).rejects.toBeInstanceOf(ImmutableRecordError);
    // organisation metadata can still change
    await saveRecord('decision', { ...rec, tags: ['career'], reviewDate: '2026-09-01' });
    const after = (await db.decisions.get(d.id))!;
    expect(after.reasoning).toBe('Edited while draft');
    expect(after.tags).toEqual(['career']);
  });
  it('requires the essentials before recording', async () => {
    const thin = await saveRecord('decision', decision({ options: [{ id: 'a', name: 'Only one', pros: '', cons: '' }], reasoning: '' }), { skipValidation: true });
    await expect(recordDecision(thin)).rejects.toThrow(/two options/);
  });
  it('stores reflections separately and only for recorded decisions; deleting a decision removes them', async () => {
    const d = await saveRecord('decision', decision());
    const base = { id: newId(), createdAt: 0, updatedAt: 0, decisionId: d.id, kind: 'outcome' as const, date: '2026-09-01', happened: 'It worked', expectedAchieved: 'yes' as const, assumptionsRight: '', assumptionsWrong: '', surprised: '', wouldDoDifferently: '', taught: '', text: '' };
    await expect(saveReflection(base)).rejects.toThrow(/Record the decision/);
    const rec = await recordDecision(d);
    await saveReflection(base);
    expect((await db.decisions.get(rec.id))!.reasoning).toBe('Because it felt right');
    expect(await db.reflections.count()).toBe(1);
    await deleteRecord('decision', rec.id);
    expect(await db.reflections.count()).toBe(0);
  });
});

describe('backup & restore', () => {
  it('round-trips everything including attachments, and merges safely', async () => {
    const att = await addAttachment(new File([new Uint8Array([9, 8, 7, 6, 5])], 'p.png', { type: 'image/png' }));
    const j = await saveRecord('journal', journal({ attachmentIds: [att.id] }));
    const d = await recordDecision(await saveRecord('decision', decision()));
    const backup = await buildBackup({ includeAttachments: true });
    const v = validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(v.ok).toBe(true);

    await wipeEverything();
    expect(await db.journal.count()).toBe(0);
    const res = await importBackup(backup, 'replace');
    expect(res.added).toBeGreaterThan(2);
    const restored = (await db.journal.get(j.id))!;
    expect(restored.title).toBe(j.title);
    const blob = (await db.attachments.get(att.id))!.blob;
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([9, 8, 7, 6, 5]);

    // merge: a recorded decision on this device is never overwritten by an import
    const tampered = JSON.parse(JSON.stringify(backup));
    tampered.tables.decisions[0].reasoning = 'rewritten in a file';
    tampered.tables.decisions[0].updatedAt = Date.now() + 99999;
    const merged = await importBackup(tampered, 'merge');
    expect(merged.keptRecordedDecisions).toBe(1);
    expect((await db.decisions.get(d.id))!.reasoning).toBe('Because it felt right');
    expect(await db.journal.count()).toBe(1); // no duplicates
  });
  it('rejects malformed files with helpful messages', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ format: 'something-else' }).ok).toBe(false);
    expect(validateBackup({ format: 'blue-room-backup', version: 99, tables: {} }).ok).toBe(false);
    const bad = validateBackup({ format: 'blue-room-backup', version: 1, tables: { journal: [{ title: 'no id' }] } });
    expect(bad.ok).toBe(false);
  });
  it('encrypts and decrypts, and fails on the wrong passphrase', async () => {
    await saveRecord('journal', journal());
    const backup = await buildBackup({ includeAttachments: false });
    const enc = await encryptBackup(backup, 'correct horse battery');
    expect(JSON.stringify(enc)).not.toContain('A quiet day');
    const dec = (await decryptBackup(enc, 'correct horse battery')) as any;
    expect(dec.tables.journal[0].title).toBe('A quiet day');
    await expect(decryptBackup(enc, 'wrong passphrase!!')).rejects.toThrow(/passphrase/);
    await expect(encryptBackup(backup, 'short')).rejects.toThrow(/8 characters/);
  });
  it('exports journal as readable Markdown', () => {
    const md = journalToMarkdown([journal({ date: '2026-03-02', tags: ['a b'] }), journal({ title: 'Older', date: '2025-12-31' })], 'ISO');
    expect(md).toContain('## 2025');
    expect(md).toContain('## 2026');
    expect(md.indexOf('Older')).toBeLessThan(md.indexOf('A quiet day'));
    expect(md).toContain('#a-b');
  });
});
