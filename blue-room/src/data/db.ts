import Dexie, { type Table } from 'dexie';
import type {
  Achievement, Attachment, CalendarEvent, Chapter, CustomReminder, Decision, DecisionReflection, Goal,
  JournalEntry, Lesson, Letter, Memory, Note, OdysseyItem, Person, Place, RecordRelationship,
  ReminderState, Settings, TimelineEvent, WisdomItem,
} from './types';
import { browserTimeZone } from '../lib/dates';

export class BlueRoomDB extends Dexie {
  journal!: Table<JournalEntry, string>;
  notes!: Table<Note, string>;
  timeline!: Table<TimelineEvent, string>;
  chapters!: Table<Chapter, string>;
  memories!: Table<Memory, string>;
  odyssey!: Table<OdysseyItem, string>;
  people!: Table<Person, string>;
  places!: Table<Place, string>;
  lessons!: Table<Lesson, string>;
  letters!: Table<Letter, string>;
  achievements!: Table<Achievement, string>;
  goals!: Table<Goal, string>;
  events!: Table<CalendarEvent, string>;
  customReminders!: Table<CustomReminder, string>;
  reminderState!: Table<ReminderState, string>;
  decisions!: Table<Decision, string>;
  reflections!: Table<DecisionReflection, string>;
  wisdom!: Table<WisdomItem, string>;
  attachments!: Table<Attachment, string>;
  relationships!: Table<RecordRelationship, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'blue-room') {
    super(name);
    this.version(1).stores({
      journal: 'id, date, status, updatedAt',
      notes: 'id, pinned, updatedAt',
      timeline: 'id, date, updatedAt',
      chapters: 'id, startDate, updatedAt',
      memories: 'id, date, updatedAt',
      odyssey: 'id, status, updatedAt',
      people: 'id, name, updatedAt',
      places: 'id, name, updatedAt',
      lessons: 'id, updatedAt',
      letters: 'id, readOn, updatedAt',
      achievements: 'id, date, updatedAt',
      goals: 'id, status, targetDate, updatedAt',
      events: 'id, date, updatedAt',
      customReminders: 'id, date, updatedAt',
      reminderState: 'key',
      decisions: 'id, date, status, updatedAt',
      reflections: 'id, decisionId, updatedAt',
      wisdom: 'id, updatedAt',
      attachments: 'id, createdAt',
      relationships: 'id, [fromType+fromId], [toType+toId]',
      settings: 'id',
    });
  }
}

export let db = new BlueRoomDB();

/** Used by tests to point the app at a throwaway database. */
export function useDatabase(name: string) {
  db = new BlueRoomDB(name);
  return db;
}

export const DEFAULT_PROMPTS = [
  'What made today meaningful?',
  'What is something I want to remember?',
  'What challenged me today?',
  'What did I learn?',
  'What am I grateful for?',
  'What am I looking forward to?',
];

export function defaultSettings(): Settings {
  const now = Date.now();
  return {
    id: 'main',
    displayName: 'Janice',
    greetingLine: 'Your little corner of the ocean.',
    theme: 'mist',
    motion: 'full',
    intro: 'full',
    layout: 'immersive',
    timeFormat: '12h',
    dateFormat: 'MDY',
    weekStart: 0,
    timezone: browserTimeZone(),
    calendarView: 'month',
    journalPrompts: { enabled: true, list: [...DEFAULT_PROMPTS] },
    reminders: {
      inApp: true,
      browser: false,
      defaultOffsets: [30],
      digest: { enabled: false, time: '08:00' },
      journal: { enabled: false, time: '21:00' },
      goalMilestones: { enabled: true, leadDays: 3 },
      letters: true,
    },
    categories: {
      event: ['Personal', 'Academic', 'Career', 'Social', 'Family', 'Health', 'Important', 'Other'],
      goal: ['Personal', 'Academic', 'Career', 'Experiences', 'Relationships', 'Creative', 'Health', 'Other'],
      journal: ['Everyday', 'Reflection', 'Gratitude', 'Dream', 'Travel', 'Other'],
      timeline: ['Personal', 'Academic', 'Career', 'First', 'Turning point', 'Occasion', 'Change', 'Other'],
      note: ['Idea', 'To remember', 'Quote', 'Other'],
    },
    odysseyStatuses: ['Dreaming', 'Planned', 'Experienced'],
    sound: { volume: 0.35, wasOn: false },
    onboarded: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Merge stored settings over defaults so newly added options never come back undefined. */
export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const d = defaultSettings();
  if (!raw) return d;
  return {
    ...d,
    ...raw,
    id: 'main',
    journalPrompts: { ...d.journalPrompts, ...(raw.journalPrompts ?? {}) },
    reminders: {
      ...d.reminders,
      ...(raw.reminders ?? {}),
      digest: { ...d.reminders.digest, ...(raw.reminders?.digest ?? {}) },
      journal: { ...d.reminders.journal, ...(raw.reminders?.journal ?? {}) },
      goalMilestones: { ...d.reminders.goalMilestones, ...(raw.reminders?.goalMilestones ?? {}) },
    },
    categories: { ...d.categories, ...(raw.categories ?? {}) },
    sound: { ...d.sound, ...(raw.sound ?? {}) },
  };
}
