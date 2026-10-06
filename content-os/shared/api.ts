/** Wire types shared by the API and the client. */
import type { Phase, Stage, StageMode, StageStatus } from './domain';

export interface EpisodeQuery {
  q?: string;
  projectIds?: number[];
  seriesIds?: number[];
  contentTypeIds?: number[];
  phases?: Phase[];
  /** Episodes that can be worked on at this stage right now ("waiting for voice"). */
  waitingFor?: Stage[];
  /** Raw stage-status filter: e.g. { stage: 'VISUAL', statuses: ['IN_PROGRESS'] } */
  stageStatus?: { stage: Stage; statuses: StageStatus[] };
  priorities?: number[];
  tags?: string[];
  sourceId?: number;
  insightId?: number;
  ideaId?: number;
  blocked?: boolean;
  published?: boolean;
  due?: 'overdue' | 'today' | 'week' | 'none' | 'any';
  createdWithinDays?: number;
  updatedWithinDays?: number;
  /** No stage progress for at least N days. */
  staleDays?: number;
  archived?: 'exclude' | 'only' | 'include';
  sort?: 'updated' | 'created' | 'priority' | 'readiness' | 'due' | 'number' | 'title' | 'progress' | 'published' | 'scheduled';
  dir?: 'asc' | 'desc';
  group?: 'none' | 'project' | 'series' | 'phase' | 'priority' | 'type';
  limit?: number;
  offset?: number;
}

export interface EpisodeListItem {
  id: number;
  number: number | null;
  code: string;
  title: string;
  projectId: number;
  projectName: string;
  projectCode: string;
  projectColor: string;
  seriesId: number | null;
  seriesTitle: string | null;
  contentTypeId: number;
  contentTypeName: string;
  priority: number;
  dueDate: string | null;
  phase: Phase;
  readiness: number;
  nextStage: Stage | null;
  actionable: Stage[];
  blocked: boolean;
  blockedNote: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  progressAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  stages: Partial<Record<Stage, StageStatus>>;
  tags: string[];
  groupKey?: string;
}

export interface EpisodeListResult {
  items: EpisodeListItem[];
  total: number;
  groups?: { key: string; label: string; count: number }[];
}

export interface ContentTypeDTO {
  id: number;
  key: string;
  name: string;
  description: string;
  defaultDurationSec: number | null;
  defaultPlatforms: string[];
  checklist: string[];
  color: string | null;
  modes: Record<Stage, StageMode>;
  episodeCount: number;
  archivedAt: string | null;
}

export interface NextAction {
  id: string;
  kind: 'publish' | 'confirm' | 'unblock' | 'bottleneck' | 'urgent' | 'finish' | 'ideas' | 'stalled' | 'start';
  title: string;
  reason: string;
  score: number;
  count?: number;
  stage?: Stage;
  episodeId?: number;
  /** Client route to open, e.g. "/episodes?view=ready" or "/episodes/42" */
  href: string;
}

export interface StageFlow {
  stage: Stage;
  waiting: number;
  inProgress: number;
  blocked: number;
  done14d: number;
  /** Estimated days to clear the waiting pile at the recent pace (null = no recent throughput). */
  clearDays: number | null;
  load: number;
}

export interface Bottleneck {
  stage: Stage | null;
  flows: StageFlow[];
  explanation: string;
}

export interface ActivityItem {
  id: number;
  at: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: number;
  episodeId: number | null;
  projectId: number | null;
  summary: string;
}

export interface ProjectStats {
  total: number;
  idea: number;
  inProduction: number;
  blocked: number;
  ready: number;
  scheduled: number;
  published: number;
  readinessSum: number;
  target: number | null;
  /** created / target */
  coverage: number | null;
  /** effort-weighted completion toward the target (or the created set if no target) */
  completion: number;
  lastActivityAt: string | null;
}
