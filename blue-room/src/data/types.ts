/** Core data model for The Blue Room. All dates are plain `YYYY-MM-DD` strings and
 *  all times are `HH:mm` strings in the owner's chosen time zone; instants are epoch ms. */

export type EntityType =
  | 'journal' | 'note'
  | 'timeline' | 'chapter' | 'memory' | 'odyssey' | 'person' | 'place' | 'lesson' | 'letter' | 'achievement'
  | 'goal' | 'event'
  | 'decision' | 'reflection' | 'wisdom';

export interface Base {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface JournalEntry extends Base {
  title: string;
  body: string; // lightweight Markdown
  date: string;
  category: string;
  tags: string[];
  /** Drafts are auto-saved but not yet "kept". They are never lost. */
  status: 'draft' | 'saved';
  prompt?: string;
  attachmentIds: string[];
  promotedMemoryId?: string;
}

export interface Note extends Base {
  title: string;
  body: string;
  pinned: boolean;
  category: string;
  tags: string[];
  convertedJournalId?: string;
}

export interface TimelineEvent extends Base {
  title: string;
  date: string;
  endDate?: string;
  category: string;
  description: string;
  tags: string[];
  attachmentIds: string[];
}

export interface Chapter extends Base {
  title: string;
  startDate?: string;
  endDate?: string;
  summary: string;
  lessonsNote: string;
  tags: string[];
  attachmentIds: string[];
}

export interface Memory extends Base {
  title: string;
  date: string;
  description: string;
  whyItMattered: string;
  tags: string[];
  attachmentIds: string[];
  sourceJournalId?: string;
  sourceOdysseyId?: string;
}

export interface OdysseyItem extends Base {
  title: string;
  description: string;
  whyItMatters: string;
  destination: string;
  targetDate?: string;
  /** Free-form status; the allowed list is configurable in Settings. */
  status: string;
  experiencedOn?: string;
  tags: string[];
  attachmentIds: string[];
  promotedMemoryId?: string;
}

export interface Person extends Base {
  name: string;
  relationship: string;
  description: string;
  importantDates: string; // free text, one per line: "Birthday — 12 March"
  notes: string;
  tags: string[];
  attachmentIds: string[];
}

export interface Place extends Base {
  name: string;
  location: string;
  description: string;
  tags: string[];
  attachmentIds: string[];
}

export interface Lesson extends Base {
  title: string;
  principle: string;
  description: string;
  dateLearned?: string;
  reflection: string;
  tags: string[];
}

export interface Letter extends Base {
  title: string;
  recipient: string;
  recipientKind: string;
  writtenOn: string;
  body: string;
  /** Optional date on which Janice wants to be reminded to open it. */
  readOn?: string;
  openedAt?: number;
  tags: string[];
}

export interface Achievement extends Base {
  title: string;
  date: string;
  description: string;
  whyItMatters: string;
  evidence: string;
  tags: string[];
  attachmentIds: string[];
}

export interface GoalMilestone {
  id: string;
  title: string;
  targetDate?: string;
  done: boolean;
  doneAt?: string;
  note?: string;
}

export const GOAL_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Archived'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface Goal extends Base {
  title: string;
  description: string;
  category: string;
  startDate?: string;
  targetDate?: string;
  priority: 'Low' | 'Medium' | 'High';
  status: GoalStatus;
  progressMode: 'auto' | 'manual';
  manualProgress: number; // 0-100, used when progressMode === 'manual' or there are no milestones
  milestones: GoalMilestone[];
  notes: string;
  completedOn?: string;
  tags: string[];
  attachmentIds: string[];
}

export interface Recurrence {
  freq: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  /** 0 = Sunday … 6 = Saturday (weekly only) */
  byWeekday?: number[];
  until?: string;
  count?: number;
}

export interface CalendarEvent extends Base {
  title: string;
  date: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  description: string;
  location: string;
  url: string;
  category: string;
  /** Minutes before start. For all-day events the anchor is 09:00 on the day. */
  reminders: number[];
  recurrence: Recurrence;
  completed: boolean;
  completedDates: string[];
  excludedDates: string[];
  important: boolean;
  timezone: string;
}

export interface CustomReminder extends Base {
  title: string;
  note: string;
  date: string;
  time: string;
}

export interface ReminderState {
  key: string;
  status: 'fired' | 'dismissed' | 'snoozed';
  /** When the in-app engine first saw this reminder as due. */
  seenAt: number;
  /** True when the app was not running/awake when it became due. */
  missed: boolean;
  browserNotified: boolean;
  snoozeUntil?: number;
}

export interface DecisionOption {
  id: string;
  name: string;
  pros: string;
  cons: string;
}

export interface Decision extends Base {
  title: string;
  date: string;
  /** Drafts are editable. Once `recorded`, the reasoning is frozen. */
  status: 'draft' | 'recorded';
  recordedAt?: number;
  context: string;
  situation: string;
  objective: string;
  options: DecisionOption[];
  evidence: string;
  assumptions: string;
  constraints: string;
  risks: string;
  tradeoffs: string;
  chosenOptionId?: string;
  chosenText: string;
  reasoning: string;
  expectedOutcome: string;
  confidence: number; // 0-100
  reviewDate?: string;
  tags: string[];
}

export interface DecisionReflection extends Base {
  decisionId: string;
  /** outcome: later reflection · addendum: a clarification added later · replay: notes from a Decision Replay */
  kind: 'outcome' | 'addendum' | 'replay';
  date: string;
  happened: string;
  expectedAchieved: 'yes' | 'partly' | 'no' | 'unclear' | '';
  assumptionsRight: string;
  assumptionsWrong: string;
  surprised: string;
  wouldDoDifferently: string;
  taught: string;
  /** Free text — used by addenda and replay notes (including the prediction made before reveal). */
  text: string;
}

export interface WisdomItem extends Base {
  title: string;
  principle: string;
  body: string;
  kind: 'Principle' | 'Pattern' | 'Lesson' | 'Avoid' | 'Reflection';
  tags: string[];
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  createdAt: number;
}

export interface RecordRelationship {
  id: string;
  fromType: EntityType;
  fromId: string;
  toType: EntityType;
  toId: string;
  createdAt: number;
}

export interface LinkRef {
  type: EntityType;
  id: string;
}

export interface Settings {
  id: 'main';
  displayName: string;
  greetingLine: string;
  theme: 'mist' | 'tide' | 'deep';
  motion: 'full' | 'gentle' | 'off';
  intro: 'full' | 'short' | 'off';
  layout: 'immersive' | 'simple';
  timeFormat: '12h' | '24h';
  dateFormat: 'MDY' | 'DMY' | 'ISO';
  weekStart: 0 | 1;
  timezone: string;
  calendarView: 'month' | 'week' | 'day' | 'agenda';
  journalPrompts: { enabled: boolean; list: string[] };
  reminders: {
    inApp: boolean;
    browser: boolean; // preference; actual permission is checked live
    defaultOffsets: number[];
    digest: { enabled: boolean; time: string };
    journal: { enabled: boolean; time: string };
    goalMilestones: { enabled: boolean; leadDays: number };
    letters: boolean;
  };
  categories: {
    event: string[];
    goal: string[];
    journal: string[];
    timeline: string[];
    note: string[];
  };
  odysseyStatuses: string[];
  sound: { volume: number; wasOn: boolean };
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
}

export type AnyRecord = Base & Record<string, any>;
