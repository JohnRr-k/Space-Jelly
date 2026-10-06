import type { ContentTypeDTO, EpisodeListItem, EpisodeQuery, ActivityItem, Bottleneck, NextAction, ProjectStats } from '../../shared/api';
import type { Stage, StageStatus, Phase, StageMode, Readiness } from '../../shared/domain';

export type { ContentTypeDTO, EpisodeListItem, EpisodeQuery, ActivityItem, Bottleneck, NextAction, ProjectStats };

export interface Meta {
  settings: Record<string, string>;
  contentTypes: ContentTypeDTO[];
  projects: { id: number; name: string; code: string; color: string; status: string; defaultContentTypeId: number | null; archivedAt: string | null }[];
  series: { id: number; projectId: number; title: string; archivedAt: string | null }[];
  tags: { id: number; name: string; color: string | null; count: number }[];
  views: SavedView[];
}

export interface SavedView {
  id: number;
  name: string;
  query: EpisodeQuery;
  system: boolean;
}

export interface StageRow {
  stage: Stage;
  status: StageStatus;
  note: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface Asset {
  id: number;
  episode_id: number;
  kind: string;
  name: string;
  version: number;
  label: string;
  status: string;
  stage: Stage | null;
  file_ref: string;
  file_size: number | null;
  mime: string | null;
  notes: string;
  created_at: string;
}

export interface Publication {
  id: number;
  episode_id: number;
  platform: string;
  account: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  url: string;
  caption: string;
  hashtags: string;
  cover_asset_id: number | null;
  notes: string;
  metrics: { views: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; followers_gained: number | null; completion_rate: number | null; captured_at: string } | null;
}

export interface EpisodeDetail {
  episode: {
    id: number;
    code: string;
    project_id: number;
    series_id: number | null;
    content_type_id: number;
    idea_id: number | null;
    number: number | null;
    title: string;
    description: string;
    core_idea: string;
    hook: string;
    script: string;
    target_duration_sec: number | null;
    priority: number;
    due_date: string | null;
    notes: string;
    phase: Phase;
    readiness: number;
    progress_at: string | null;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
    deleted_at: string | null;
    tags: string[];
  };
  project: { id: number; name: string; code: string; color: string };
  series: { id: number; title: string } | null;
  contentType: ContentTypeDTO;
  modes: Record<Stage, StageMode>;
  stages: StageRow[];
  readiness: Readiness;
  warnings: string[];
  assets: Asset[];
  publications: Publication[];
  sources: { id: number; title: string; type: string; author: string; locator: string }[];
  insights: { id: number; statement: string; locator: string; source_id: number | null; source_title: string | null }[];
  related: { kind: string; dir: 'in' | 'out'; episode: EpisodeListItem }[];
  tasks: { id: number; title: string; done: number; stage: Stage | null }[];
  idea: { id: number; title: string; thought: string; created_at: string; source_id: number | null; source_title: string | null; insight_id: number | null; insight_statement: string | null } | null;
  activity: { id: number; at: string; actor: string; action: string; summary: string }[];
}

export interface UndoPayload {
  snapshot: { episodeId: number; stages: { stage: Stage; status: StageStatus; note: string }[] }[];
  publicationIds: number[];
}

export interface ProjectRow {
  id: number;
  name: string;
  code: string;
  description: string;
  goal: string;
  status: string;
  target_count: number | null;
  color: string;
  default_content_type_id: number | null;
  notes: string;
  archived_at: string | null;
  tags: string[];
  seriesCount?: number;
  stats: ProjectStats;
}

export interface SeriesRow {
  id: number;
  project_id: number;
  project_name?: string;
  project_code?: string;
  project_color?: string;
  title: string;
  description: string;
  target_count: number | null;
  notes: string;
  archived_at: string | null;
  tags: string[];
  stats: ProjectStats;
}

export interface Idea {
  id: number;
  title: string;
  thought: string;
  project_id: number | null;
  series_id: number | null;
  source_id: number | null;
  insight_id: number | null;
  priority: number;
  status: string;
  touched_at: string;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  project_name?: string | null;
  project_code?: string | null;
  project_color?: string | null;
  source_title?: string | null;
  series_title?: string | null;
  episode_count?: number;
  tags: string[];
}

export interface Source {
  id: number;
  title: string;
  type: string;
  author: string;
  person_id: number | null;
  person_name?: string | null;
  project_id: number | null;
  project_name?: string | null;
  project_color?: string | null;
  description: string;
  citation: string;
  url: string;
  year: number | null;
  status: string;
  potential: number | null;
  notes: string;
  archived_at: string | null;
  episode_count?: number;
  published_count?: number;
  insight_count?: number;
  idea_count?: number;
  tags: string[];
}
