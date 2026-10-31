import type { AnyRecord, EntityType } from './types';

export interface EntityMeta {
  type: EntityType;
  table: string;
  label: string;
  plural: string;
  icon: string;
  /** Where the record lives in the app. */
  route: (id: string, rec?: AnyRecord) => string;
  titleOf: (r: AnyRecord) => string;
  subtitleOf?: (r: AnyRecord) => string;
  /** Representative date used for sorting / display where relevant. */
  dateOf?: (r: AnyRecord) => string | undefined;
  /** Can this type be the target of a relationship? */
  linkable: boolean;
}

const q = (path: string, id: string) => `${path}?open=${encodeURIComponent(id)}`;

export const ENTITIES: Record<EntityType, EntityMeta> = {
  journal: {
    type: 'journal', table: 'journal', label: 'Journal entry', plural: 'Journal entries', icon: 'journal',
    route: (id) => `/journal/${id}`,
    titleOf: (r) => r.title || firstLine(r.body) || 'Untitled entry',
    subtitleOf: (r) => r.date,
    dateOf: (r) => r.date, linkable: true,
  },
  note: {
    type: 'note', table: 'notes', label: 'Note', plural: 'Notes', icon: 'note',
    route: (id) => q('/notes', id),
    titleOf: (r) => r.title || firstLine(r.body) || 'Untitled note',
    linkable: true,
  },
  timeline: {
    type: 'timeline', table: 'timeline', label: 'Timeline event', plural: 'Timeline events', icon: 'timeline',
    route: (id) => q('/legacy/timeline', id),
    titleOf: (r) => r.title, subtitleOf: (r) => r.date, dateOf: (r) => r.date, linkable: true,
  },
  chapter: {
    type: 'chapter', table: 'chapters', label: 'Chapter', plural: 'Chapters', icon: 'chapter',
    route: (id) => q('/legacy/chapters', id),
    titleOf: (r) => r.title, subtitleOf: (r) => r.startDate ?? '', dateOf: (r) => r.startDate, linkable: true,
  },
  memory: {
    type: 'memory', table: 'memories', label: 'Memory', plural: 'Memories', icon: 'memory',
    route: (id) => q('/legacy/memories', id),
    titleOf: (r) => r.title, subtitleOf: (r) => r.date, dateOf: (r) => r.date, linkable: true,
  },
  odyssey: {
    type: 'odyssey', table: 'odyssey', label: 'Odyssey experience', plural: 'Odyssey experiences', icon: 'compass',
    route: (id) => q('/legacy/odyssey', id),
    titleOf: (r) => r.title, subtitleOf: (r) => r.status, dateOf: (r) => r.experiencedOn ?? r.targetDate, linkable: true,
  },
  person: {
    type: 'person', table: 'people', label: 'Person', plural: 'People', icon: 'people',
    route: (id) => q('/legacy/people', id),
    titleOf: (r) => r.name, subtitleOf: (r) => r.relationship, linkable: true,
  },
  place: {
    type: 'place', table: 'places', label: 'Place', plural: 'Places', icon: 'place',
    route: (id) => q('/legacy/places', id),
    titleOf: (r) => r.name, subtitleOf: (r) => r.location, linkable: true,
  },
  lesson: {
    type: 'lesson', table: 'lessons', label: 'Lesson', plural: 'Lessons', icon: 'lesson',
    route: (id) => q('/legacy/lessons', id),
    titleOf: (r) => r.title, subtitleOf: (r) => r.principle, dateOf: (r) => r.dateLearned, linkable: true,
  },
  letter: {
    type: 'letter', table: 'letters', label: 'Letter', plural: 'Letters', icon: 'letter',
    route: (id) => q('/legacy/letters', id),
    titleOf: (r) => r.title, subtitleOf: (r) => `To ${r.recipient}`, dateOf: (r) => r.writtenOn, linkable: true,
  },
  achievement: {
    type: 'achievement', table: 'achievements', label: 'Achievement', plural: 'Achievements', icon: 'pearl',
    route: (id) => q('/legacy/achievements', id),
    titleOf: (r) => r.title, subtitleOf: (r) => r.date, dateOf: (r) => r.date, linkable: true,
  },
  goal: {
    type: 'goal', table: 'goals', label: 'Goal', plural: 'Goals', icon: 'goal',
    route: (id) => q('/future', id),
    titleOf: (r) => r.title, subtitleOf: (r) => r.status, dateOf: (r) => r.targetDate, linkable: true,
  },
  event: {
    type: 'event', table: 'events', label: 'Calendar event', plural: 'Calendar events', icon: 'calendar',
    route: (id) => `/calendar?event=${encodeURIComponent(id)}`,
    titleOf: (r) => r.title, subtitleOf: (r) => r.date, dateOf: (r) => r.date, linkable: true,
  },
  decision: {
    type: 'decision', table: 'decisions', label: 'Decision', plural: 'Decisions', icon: 'oracle',
    route: (id) => `/oracle/decisions/${id}`,
    titleOf: (r) => r.title, subtitleOf: (r) => r.date, dateOf: (r) => r.date, linkable: true,
  },
  reflection: {
    type: 'reflection', table: 'reflections', label: 'Decision reflection', plural: 'Decision reflections', icon: 'oracle',
    route: (_id, r) => `/oracle/decisions/${r?.decisionId ?? ''}`,
    titleOf: (r) => r.happened || r.text || 'Reflection', subtitleOf: (r) => r.date, dateOf: (r) => r.date, linkable: true,
  },
  wisdom: {
    type: 'wisdom', table: 'wisdom', label: 'Wisdom entry', plural: 'Wisdom entries', icon: 'wisdom',
    route: (id) => q('/oracle/wisdom', id),
    titleOf: (r) => r.title, subtitleOf: (r) => r.principle, linkable: true,
  },
};

export const ENTITY_TYPES = Object.keys(ENTITIES) as EntityType[];

function firstLine(s: unknown): string {
  if (typeof s !== 'string') return '';
  const line = s.split('\n').find((l) => l.trim()) ?? '';
  return line.replace(/^[#>\-*\s]+/, '').slice(0, 80);
}

const SKIP_KEYS = new Set(['id', 'attachmentIds', 'createdAt', 'updatedAt', 'status', 'timezone', 'blob']);

/** Flatten every human-readable string in a record for search. */
export function searchText(rec: AnyRecord): string {
  const out: string[] = [];
  const walk = (v: unknown, depth: number) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v) && depth < 3) v.forEach((x) => walk(x, depth + 1));
    else if (v && typeof v === 'object' && depth < 3) {
      for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) walk(x, depth + 1);
    }
  };
  for (const [k, v] of Object.entries(rec)) if (!SKIP_KEYS.has(k)) walk(v, 0);
  return out.join(' \n ');
}

export function plural(n: number, one: string, many?: string) {
  return `${n} ${n === 1 ? one : many ?? one + 's'}`;
}
