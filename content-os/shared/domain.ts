/**
 * Core domain vocabulary for the Content OS.
 *
 * This module is shared by the server (persistence + computed fields) and the
 * client (rendering + optimistic UI). It intentionally has zero dependencies so
 * automation agents can import it too.
 */

// ---------------------------------------------------------------------------
// Production stages
// ---------------------------------------------------------------------------

export const STAGES = [
  'RESEARCH',
  'CONCEPT',
  'SCRIPT',
  'VOICE',
  'VISUAL',
  'EDIT',
  'QC',
  'CAPTION',
  'COVER',
  'SCHEDULE',
  'PUBLISH',
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'SKIPPED'] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

/** How a content type treats a stage. NONE = the stage does not exist for this type. */
export const STAGE_MODES = ['REQUIRED', 'OPTIONAL', 'NONE'] as const;
export type StageMode = (typeof STAGE_MODES)[number];

export interface StageMeta {
  label: string;
  short: string;
  /** Imperative verb phrase used by the Next Best Action engine: "Record VO for 8 episodes". */
  verb: string;
  /** Relative effort. Readiness is effort-weighted, so a finished visual counts more than a finished caption. */
  weight: number;
  /** Prerequisite stages. Only prerequisites that are REQUIRED for the content type are enforced. */
  deps: Stage[];
  /** Stages that belong to "making the thing" vs. "shipping the thing". */
  phase: 'production' | 'packaging' | 'release';
}

/**
 * Dependency graph. Deliberately NOT linear:
 *  - VOICE and VISUAL both start from SCRIPT and run in parallel.
 *  - CAPTION and COVER only need the CONCEPT, so they can be written while the edit happens.
 *  - EDIT needs both VOICE and VISUAL.
 */
export const STAGE_META: Record<Stage, StageMeta> = {
  RESEARCH: { label: 'Research', short: 'RES', verb: 'Research', weight: 1, deps: [], phase: 'production' },
  CONCEPT: { label: 'Concept', short: 'CON', verb: 'Develop the concept for', weight: 1, deps: ['RESEARCH'], phase: 'production' },
  SCRIPT: { label: 'Script', short: 'SCR', verb: 'Write the script for', weight: 2, deps: ['CONCEPT'], phase: 'production' },
  VOICE: { label: 'Voice', short: 'VO', verb: 'Record VO for', weight: 1.5, deps: ['SCRIPT'], phase: 'production' },
  VISUAL: { label: 'Visual', short: 'VIS', verb: 'Produce visuals for', weight: 3, deps: ['SCRIPT'], phase: 'production' },
  EDIT: { label: 'Edit', short: 'EDT', verb: 'Edit', weight: 2, deps: ['VOICE', 'VISUAL'], phase: 'production' },
  QC: { label: 'QC', short: 'QC', verb: 'QC', weight: 0.5, deps: ['EDIT'], phase: 'packaging' },
  CAPTION: { label: 'Caption', short: 'CAP', verb: 'Write captions for', weight: 0.5, deps: ['CONCEPT'], phase: 'packaging' },
  COVER: { label: 'Cover', short: 'CVR', verb: 'Design covers for', weight: 0.5, deps: ['CONCEPT'], phase: 'packaging' },
  SCHEDULE: { label: 'Schedule', short: 'SCH', verb: 'Schedule', weight: 0.25, deps: ['QC', 'CAPTION', 'COVER'], phase: 'release' },
  PUBLISH: { label: 'Publish', short: 'PUB', verb: 'Publish', weight: 0.25, deps: ['QC', 'CAPTION', 'COVER'], phase: 'release' },
};

/** Stages that must be complete for an episode to count as READY to post. */
export const PRE_RELEASE_STAGES: Stage[] = STAGES.filter((s) => STAGE_META[s].phase !== 'release');

// ---------------------------------------------------------------------------
// Board columns (a VIEW over stage state — never the source of truth)
// ---------------------------------------------------------------------------

export const PHASES = ['IDEA', 'RESEARCH', 'SCRIPT', 'VOICE', 'VISUAL', 'EDIT', 'QC', 'READY', 'SCHEDULED', 'PUBLISHED'] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_META: Record<Phase, { label: string; hint: string }> = {
  IDEA: { label: 'Idea', hint: 'Nothing started yet' },
  RESEARCH: { label: 'Research', hint: 'Research + concept' },
  SCRIPT: { label: 'Script', hint: 'Waiting for a finished script' },
  VOICE: { label: 'Voice', hint: 'Waiting for voiceover' },
  VISUAL: { label: 'Visual', hint: 'Waiting for visuals' },
  EDIT: { label: 'Edit', hint: 'Waiting for the edit' },
  QC: { label: 'QC', hint: 'QC, caption and cover' },
  READY: { label: 'Ready', hint: 'Everything done — can be posted' },
  SCHEDULED: { label: 'Scheduled', hint: 'Has a scheduled publication' },
  PUBLISHED: { label: 'Published', hint: 'Live on at least one platform' },
};

/** Which stage "owns" each work column. Board moves use this to update stage state. */
export const STAGE_TO_PHASE: Partial<Record<Stage, Phase>> = {
  RESEARCH: 'RESEARCH',
  CONCEPT: 'RESEARCH',
  SCRIPT: 'SCRIPT',
  VOICE: 'VOICE',
  VISUAL: 'VISUAL',
  EDIT: 'EDIT',
  QC: 'QC',
  CAPTION: 'QC',
  COVER: 'QC',
};
export const PHASE_PRIMARY_STAGES: Partial<Record<Phase, Stage[]>> = {
  RESEARCH: ['RESEARCH', 'CONCEPT'],
  SCRIPT: ['SCRIPT'],
  VOICE: ['VOICE'],
  VISUAL: ['VISUAL'],
  EDIT: ['EDIT'],
  QC: ['QC', 'CAPTION', 'COVER'],
};

// ---------------------------------------------------------------------------
// Other enums
// ---------------------------------------------------------------------------

export const PRIORITIES = [0, 1, 2, 3] as const; // 0 = urgent
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<number, string> = { 0: 'Urgent', 1: 'High', 2: 'Normal', 3: 'Low' };

export const PROJECT_STATUSES = ['ACTIVE', 'PAUSED', 'PLANNING', 'COMPLETED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const IDEA_STATUSES = ['INBOX', 'DEVELOPING', 'CONVERTED', 'PARKED', 'DISCARDED'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const SOURCE_TYPES = ['BOOK', 'PERSON', 'INTERVIEW', 'PODCAST', 'ARTICLE', 'PAPER', 'SCRIPTURE', 'VIDEO', 'NOTE', 'OTHER'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_STATUSES = ['QUEUED', 'IN_PROGRESS', 'PROCESSED', 'EXHAUSTED'] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const ASSET_KINDS = [
  'VOICEOVER',
  'AUDIO',
  'VIDEO',
  'IMAGE',
  'ANIMATION',
  'COVER',
  'THUMBNAIL',
  'SCRIPT_FILE',
  'PDF',
  'REFERENCE',
  'EXPORT',
  'OTHER',
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'FINAL', 'REJECTED'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/** Which asset kinds are evidence that a stage was really done. Used for integrity warnings, not blocking. */
export const STAGE_EVIDENCE: Partial<Record<Stage, AssetKind[]>> = {
  VOICE: ['VOICEOVER', 'AUDIO'],
  VISUAL: ['IMAGE', 'ANIMATION', 'VIDEO'],
  EDIT: ['EXPORT', 'VIDEO'],
  COVER: ['COVER', 'THUMBNAIL', 'IMAGE'],
};

export const PLATFORMS = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'X', 'THREADS', 'LINKEDIN', 'OTHER'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABEL: Record<Platform, string> = {
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  FACEBOOK: 'Facebook',
  X: 'X',
  THREADS: 'Threads',
  LINKEDIN: 'LinkedIn',
  OTHER: 'Other',
};

export const PUBLICATION_STATUSES = ['DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const RELATION_KINDS = ['RELATED', 'SEQUEL', 'PREREQUISITE', 'VARIANT', 'DUPLICATE'] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

// ---------------------------------------------------------------------------
// Readiness engine
// ---------------------------------------------------------------------------

export type StageModes = Partial<Record<Stage, StageMode>>;
export type StageStates = Partial<Record<Stage, StageStatus>>;

export interface ReadinessInput {
  modes: StageModes;
  states: StageStates;
  /** Number of publications with status PUBLISHED / SCHEDULED. Publications are stronger evidence than the stage flag. */
  publishedCount?: number;
  scheduledCount?: number;
}

export interface Readiness {
  /** 0–100, effort-weighted over REQUIRED stages. In-progress counts for 40%. */
  readiness: number;
  phase: Phase;
  /** The earliest unfinished required stage. "What is this episode waiting for?" */
  nextStage: Stage | null;
  /** Stages that can be worked on right now (prerequisites satisfied). Supports parallel work. */
  actionable: Stage[];
  blocked: boolean;
  blockedStages: Stage[];
  /** Ready to post: every required pre-release stage is DONE/SKIPPED. */
  ready: boolean;
  doneCount: number;
  requiredCount: number;
}

const isComplete = (s: StageStatus | undefined) => s === 'DONE' || s === 'SKIPPED';

export function isRequired(modes: StageModes, stage: Stage) {
  return (modes[stage] ?? 'REQUIRED') === 'REQUIRED';
}

export function isPresent(modes: StageModes, stage: Stage) {
  return (modes[stage] ?? 'REQUIRED') !== 'NONE';
}

/** Prerequisites that actually apply for this content type (non-required deps are ignored, transitively). */
export function effectiveDeps(modes: StageModes, stage: Stage): Stage[] {
  const out = new Set<Stage>();
  const visit = (s: Stage) => {
    for (const d of STAGE_META[s].deps) {
      if (isRequired(modes, d)) out.add(d);
      else visit(d); // skip over a non-required stage to its own prerequisites
    }
  };
  visit(stage);
  return [...out];
}

export function depsSatisfied(modes: StageModes, states: StageStates, stage: Stage) {
  return effectiveDeps(modes, stage).every((d) => isComplete(states[d]));
}

export function computeReadiness({ modes, states, publishedCount = 0, scheduledCount = 0 }: ReadinessInput): Readiness {
  const required = STAGES.filter((s) => isRequired(modes, s));
  let total = 0;
  let earned = 0;
  let doneCount = 0;
  const blockedStages: Stage[] = [];
  const actionable: Stage[] = [];

  const published = publishedCount > 0 || isComplete(states.PUBLISH);

  for (const s of required) {
    const w = STAGE_META[s].weight;
    total += w;
    let st = states[s] ?? 'NOT_STARTED';
    if (s === 'PUBLISH' && publishedCount > 0) st = 'DONE';
    if (s === 'SCHEDULE' && (scheduledCount > 0 || published)) st = st === 'NOT_STARTED' ? 'DONE' : st;
    if (isComplete(st)) {
      earned += w;
      doneCount++;
    } else if (st === 'IN_PROGRESS') earned += w * 0.4;
    if (st === 'BLOCKED') blockedStages.push(s);
    if (!isComplete(st) && st !== 'BLOCKED' && depsSatisfied(modes, states, s)) actionable.push(s);
  }

  const preRelease = required.filter((s) => STAGE_META[s].phase !== 'release');
  const ready = preRelease.every((s) => isComplete(states[s]));
  const nextStage = required.find((s) => !isComplete(states[s])) ?? null;

  let phase: Phase;
  if (published) phase = 'PUBLISHED';
  else if (ready && (scheduledCount > 0 || states.SCHEDULE === 'DONE')) phase = 'SCHEDULED';
  else if (ready) phase = 'READY';
  else if (required.every((s) => (states[s] ?? 'NOT_STARTED') === 'NOT_STARTED')) phase = 'IDEA';
  else {
    const firstOpen = preRelease.find((s) => !isComplete(states[s]))!;
    phase = STAGE_TO_PHASE[firstOpen] ?? 'QC';
  }

  return {
    readiness: total === 0 ? 100 : published ? 100 : Math.min(99, Math.round((earned / total) * 100)),
    phase,
    nextStage: published ? null : nextStage,
    actionable: published ? [] : actionable,
    blocked: blockedStages.length > 0,
    blockedStages,
    ready,
    doneCount,
    requiredCount: required.length,
  };
}

/**
 * Board move semantics. Returns the stage changes needed so the episode lands in `target`
 * WITHOUT destroying parallel progress:
 *  - Moving forward completes required stages that precede the target column and opens the
 *    target column's primary stage. Stages after the target are left untouched.
 *  - Moving backward re-opens the target column's primary stage (IN_PROGRESS) so it becomes the
 *    earliest unfinished stage. Later DONE stages are preserved (they may still be valid).
 *  - SCHEDULED / PUBLISHED are handled by the publication system (they need a date / platform).
 */
export function planBoardMove(modes: StageModes, states: StageStates, target: Phase): Partial<Record<Stage, StageStatus>> {
  const changes: Partial<Record<Stage, StageStatus>> = {};
  const required = STAGES.filter((s) => isRequired(modes, s));

  if (target === 'IDEA') {
    for (const s of required) if ((states[s] ?? 'NOT_STARTED') !== 'NOT_STARTED') changes[s] = 'NOT_STARTED';
    return changes;
  }

  const completeUpTo = (stages: Stage[]) => {
    for (const s of stages) if (isRequired(modes, s) && !isComplete(states[s])) changes[s] = 'DONE';
  };

  if (target === 'READY' || target === 'SCHEDULED' || target === 'PUBLISHED') {
    completeUpTo(PRE_RELEASE_STAGES);
    if (target === 'PUBLISHED') completeUpTo(['SCHEDULE', 'PUBLISH']);
    if (target === 'SCHEDULED') completeUpTo(['SCHEDULE']);
    if (target === 'READY') {
      // Moving back from Scheduled/Published re-opens release stages.
      for (const s of ['SCHEDULE', 'PUBLISH'] as Stage[]) if (states[s] === 'DONE') changes[s] = 'NOT_STARTED';
    }
    return changes;
  }

  const primary = PHASE_PRIMARY_STAGES[target] ?? [];
  // Everything the primary stages depend on (transitively) must be complete to work on them.
  const prereqs = new Set<Stage>();
  const collect = (s: Stage) => {
    for (const d of effectiveDeps(modes, s)) {
      if (!prereqs.has(d)) {
        prereqs.add(d);
        collect(d);
      }
    }
  };
  primary.forEach(collect);
  // Pipeline order also defines the column: anything in an earlier column must be complete
  // or the card would immediately render in that earlier column.
  const targetIdx = PHASES.indexOf(target);
  for (const s of PRE_RELEASE_STAGES) {
    const ph = STAGE_TO_PHASE[s];
    if (ph && PHASES.indexOf(ph) < targetIdx) prereqs.add(s);
  }
  for (const s of primary) prereqs.delete(s);
  completeUpTo([...prereqs]);

  const openPrimary = primary.filter((s) => isRequired(modes, s));
  for (const s of openPrimary) {
    const st = states[s] ?? 'NOT_STARTED';
    if (st === 'NOT_STARTED') changes[s] = 'IN_PROGRESS';
  }
  // Moving backwards into a column whose primary stages are all complete: re-open the first one.
  if (openPrimary.length && openPrimary.every((s) => isComplete(states[s]))) changes[openPrimary[0]] = 'IN_PROGRESS';
  // Leaving release state when moving back into production.
  for (const s of ['SCHEDULE', 'PUBLISH'] as Stage[]) if (states[s] === 'DONE') changes[s] = 'NOT_STARTED';
  return changes;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function episodeCode(prefix: string | null | undefined, n: number | null | undefined) {
  if (!n) return prefix ? `${prefix}-—` : '—';
  return `${prefix ?? 'EP'}-${String(n).padStart(3, '0')}`;
}

export function formatDuration(sec: number | null | undefined) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m${s ? ` ${s}s` : ''}` : `${s}s`;
}
