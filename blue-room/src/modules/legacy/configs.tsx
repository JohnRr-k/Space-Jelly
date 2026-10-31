import type { EntityType } from '../../data/types';
import type { RecordConfig } from '../RecordKit';

const L = (...t: EntityType[]) => t;

export const timelineConfig: RecordConfig = {
  type: 'timeline', icon: 'timeline', newLabel: 'Add a moment', tags: true,
  emptyTitle: 'Your timeline starts whenever you’re ready',
  emptyBody: 'Add the events that shaped you — the turning points, the firsts, the days you’d want to be able to find again. Not every day, just the meaningful ones.',
  blank: ({ today }) => ({ title: '', date: today, endDate: '', category: 'Personal', description: '', tags: [], attachmentIds: [] }),
  fields: [
    { key: 'title', label: 'What happened', kind: 'text', required: true, wide: true },
    { key: 'date', label: 'Date', kind: 'date', required: true },
    { key: 'endDate', label: 'Until', kind: 'date', hint: 'Optional, for something that lasted' },
    { key: 'category', label: 'Category', kind: 'select', options: (s) => s.categories.timeline },
    { key: 'description', label: 'Description', kind: 'textarea', rows: 4 },
  ],
  attachments: { label: 'Photos & media' },
  linkTypes: L('chapter', 'memory', 'person', 'place', 'achievement', 'lesson', 'odyssey', 'event', 'journal', 'goal', 'decision'),
  headerChips: (r) => <span className="chip">{r.category}</span>,
};

export const chapterConfig: RecordConfig = {
  type: 'chapter', icon: 'chapter', newLabel: 'Begin a chapter', tags: true,
  emptyTitle: 'Your next chapter starts whenever you’re ready',
  emptyBody: 'A chapter is a stretch of life with its own feeling — a school, a city, a season of change. Name it however you like.',
  blank: () => ({ title: '', startDate: '', endDate: '', summary: '', lessonsNote: '', tags: [], attachmentIds: [] }),
  fields: [
    { key: 'title', label: 'Chapter name', kind: 'text', required: true, wide: true, placeholder: 'Give it a name that feels right' },
    { key: 'startDate', label: 'Began', kind: 'date' },
    { key: 'endDate', label: 'Ended', kind: 'date', hint: 'Leave empty if it’s still going' },
    { key: 'summary', label: 'Summary', kind: 'textarea', rows: 4 },
    { key: 'lessonsNote', label: 'What this chapter taught me', kind: 'textarea', rows: 3 },
  ],
  attachments: { label: 'Cover photo' },
  linkTypes: L('timeline', 'memory', 'person', 'place', 'lesson', 'achievement', 'goal', 'decision', 'odyssey', 'wisdom'),
};

export const memoryConfig: RecordConfig = {
  type: 'memory', icon: 'memory', newLabel: 'Save a memory', tags: true,
  emptyTitle: 'No memories here yet',
  emptyBody: 'Save a moment whenever you find one worth keeping. It doesn’t have to be big.',
  blank: ({ today }) => ({ title: '', date: today, description: '', whyItMattered: '', tags: [], attachmentIds: [] }),
  fields: [
    { key: 'title', label: 'Title', kind: 'text', required: true, wide: true },
    { key: 'date', label: 'When', kind: 'date', required: true },
    { key: 'description', label: 'What happened', kind: 'textarea', rows: 5 },
    { key: 'whyItMattered', label: 'Why it mattered', kind: 'textarea', rows: 3 },
  ],
  attachments: { label: 'Photos' },
  linkTypes: L('person', 'place', 'chapter', 'timeline', 'lesson', 'achievement', 'journal', 'odyssey', 'goal', 'event'),
};

export const odysseyConfig: RecordConfig = {
  type: 'odyssey', icon: 'compass', newLabel: 'Add an experience', tags: true,
  emptyTitle: 'Where would you like life to take you?',
  emptyBody: 'Odyssey keeps the experiences you dream of, plan, and have already lived — places, adventures, things worth trying.',
  blank: ({ settings }) => ({ title: '', description: '', whyItMatters: '', destination: '', targetDate: '', status: settings.odysseyStatuses[0] ?? 'Dreaming', experiencedOn: '', tags: [], attachmentIds: [] }),
  fields: [
    { key: 'title', label: 'Experience', kind: 'text', required: true, wide: true, placeholder: 'Something you want to live through' },
    { key: 'status', label: 'Where is it now?', kind: 'select', options: (s) => s.odysseyStatuses },
    { key: 'destination', label: 'Place or context', kind: 'text' },
    { key: 'targetDate', label: 'Target date', kind: 'date', hint: 'Optional' },
    { key: 'experiencedOn', label: 'Experienced on', kind: 'date', hint: 'Optional' },
    { key: 'description', label: 'Description', kind: 'textarea', rows: 3 },
    { key: 'whyItMatters', label: 'Why it matters to me', kind: 'textarea', rows: 3 },
  ],
  attachments: { label: 'Photos' },
  linkTypes: L('person', 'place', 'memory', 'goal', 'event', 'chapter', 'achievement'),
  normalize: (d, { settings, today }) => {
    const last = settings.odysseyStatuses[settings.odysseyStatuses.length - 1];
    if (d.status === last && !d.experiencedOn) return { ...d, experiencedOn: today };
    return d;
  },
};

export const personConfig: RecordConfig = {
  type: 'person', icon: 'people', newLabel: 'Add a person', tags: true, nameDuplicateCheck: true,
  emptyTitle: 'The people who shaped your story',
  emptyBody: 'Family, friends, teachers, mentors — anyone who belongs in the story of your life. This isn’t an address book; it’s a place to remember what they meant.',
  blank: () => ({ name: '', relationship: '', description: '', importantDates: '', notes: '', tags: [], attachmentIds: [] }),
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'relationship', label: 'Relationship', kind: 'text', placeholder: 'Friend, mentor, cousin…' },
    { key: 'description', label: 'Who they are to me', kind: 'textarea', rows: 3 },
    { key: 'importantDates', label: 'Important dates', kind: 'textarea', rows: 2, hint: 'One per line, e.g. “Birthday — 12 March”' },
    { key: 'notes', label: 'Personal notes', kind: 'textarea', rows: 3 },
  ],
  attachments: { label: 'Photos' },
  linkTypes: L('memory', 'place', 'chapter', 'timeline', 'achievement', 'letter', 'lesson', 'odyssey'),
  headerChips: (r) => (r.relationship ? <span className="chip">{r.relationship}</span> : null),
};

export const placeConfig: RecordConfig = {
  type: 'place', icon: 'place', newLabel: 'Add a place', tags: true, nameDuplicateCheck: true,
  emptyTitle: 'Places that hold your stories',
  emptyBody: 'A home, a school, a city, a corner of a café — somewhere that matters to your story.',
  blank: () => ({ name: '', location: '', description: '', tags: [], attachmentIds: [] }),
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'location', label: 'Where is it?', kind: 'text', placeholder: 'City, country, address…' },
    { key: 'description', label: 'What it means to me', kind: 'textarea', rows: 4 },
  ],
  attachments: { label: 'Photos' },
  linkTypes: L('memory', 'person', 'timeline', 'chapter', 'achievement', 'odyssey'),
};

export const lessonConfig: RecordConfig = {
  type: 'lesson', icon: 'lesson', newLabel: 'Record a lesson', tags: true,
  emptyTitle: 'Lessons that are really yours',
  emptyBody: 'Write down what life has actually taught you — in your own words, from your own experience.',
  blank: ({ today }) => ({ title: '', principle: '', description: '', dateLearned: today, reflection: '', tags: [] }),
  fields: [
    { key: 'title', label: 'Lesson', kind: 'text', required: true, wide: true },
    { key: 'principle', label: 'In one line', kind: 'text', wide: true, hint: 'The principle, as you’d tell a friend' },
    { key: 'dateLearned', label: 'When I learned it', kind: 'date' },
    { key: 'description', label: 'What happened', kind: 'textarea', rows: 4 },
    { key: 'reflection', label: 'Reflection', kind: 'textarea', rows: 3 },
  ],
  linkTypes: L('memory', 'chapter', 'timeline', 'achievement', 'decision', 'journal', 'odyssey', 'person'),
};

export const LETTER_KINDS = ['Future self', 'Younger self', 'Family', 'Friend', 'Someone important', 'Other'];
export const letterConfig: RecordConfig = {
  type: 'letter', icon: 'letter', newLabel: 'Write a letter', tags: true,
  emptyTitle: 'A letter is waiting to be written',
  emptyBody: 'Write to your future self, your younger self, or someone who matters. Letters stay private in this browser — nothing is ever sent.',
  blank: ({ today }) => ({ title: '', recipient: 'Future me', recipientKind: 'Future self', writtenOn: today, readOn: '', body: '', tags: [] }),
  fields: [
    { key: 'title', label: 'Title', kind: 'text', required: true, wide: true },
    { key: 'recipientKind', label: 'Who is it for?', kind: 'select', options: LETTER_KINDS },
    { key: 'recipient', label: 'Addressed to', kind: 'text', required: true },
    { key: 'writtenOn', label: 'Written on', kind: 'date' },
    { key: 'readOn', label: 'Remind me to read it on', kind: 'date', hint: 'Optional · an in-app reminder, not a delivery' },
    { key: 'body', label: 'Your letter', kind: 'textarea', rows: 12, required: true, hideInDetail: true },
  ],
  linkTypes: L('memory', 'chapter', 'person', 'timeline'),
};

export const achievementConfig: RecordConfig = {
  type: 'achievement', icon: 'pearl', newLabel: 'Record a milestone', tags: true,
  emptyTitle: 'Your milestones live here',
  emptyBody: 'Big or small — finishing something hard, learning something new, getting through a difficult stretch.',
  blank: ({ today }) => ({ title: '', date: today, description: '', whyItMatters: '', evidence: '', tags: [], attachmentIds: [] }),
  fields: [
    { key: 'title', label: 'Milestone', kind: 'text', required: true, wide: true },
    { key: 'date', label: 'When', kind: 'date', required: true },
    { key: 'description', label: 'What I did', kind: 'textarea', rows: 4 },
    { key: 'whyItMatters', label: 'Why it matters', kind: 'textarea', rows: 3 },
    { key: 'evidence', label: 'Evidence or reference', kind: 'textarea', rows: 2, hint: 'A certificate, a link, a note about proof' },
  ],
  attachments: { label: 'Supporting images', allowPdf: true },
  linkTypes: L('chapter', 'timeline', 'goal', 'memory', 'event', 'person', 'lesson'),
};

export const SECTIONS = [
  { id: 'timeline', area: 'The Story', label: 'Timeline', icon: 'timeline', cfg: timelineConfig, blurb: 'Meaningful events, in order.' },
  { id: 'chapters', area: 'The Story', label: 'Chapters', icon: 'chapter', cfg: chapterConfig, blurb: 'The periods that make up your life.' },
  { id: 'memories', area: 'The Record', label: 'Memories', icon: 'memory', cfg: memoryConfig, blurb: 'Moments worth keeping.' },
  { id: 'odyssey', area: 'The Record', label: 'Odyssey', icon: 'compass', cfg: odysseyConfig, blurb: 'Experiences dreamed, planned, lived.' },
  { id: 'people', area: 'The Record', label: 'People', icon: 'people', cfg: personConfig, blurb: 'The people in your story.' },
  { id: 'places', area: 'The Record', label: 'Places', icon: 'place', cfg: placeConfig, blurb: 'Places that matter.' },
  { id: 'lessons', area: 'What It Meant', label: 'Lessons', icon: 'lesson', cfg: lessonConfig, blurb: 'What you actually learned.' },
  { id: 'letters', area: 'What It Meant', label: 'Letters', icon: 'letter', cfg: letterConfig, blurb: 'Words to keep, or to open later.' },
  { id: 'achievements', area: 'What It Meant', label: 'Achievements', icon: 'pearl', cfg: achievementConfig, blurb: 'Milestones you’ve reached.' },
] as const;
