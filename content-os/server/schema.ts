/**
 * Versioned schema migrations. Each migration runs once, inside a transaction, and the
 * database file is backed up before any pending migration is applied (see db.ts).
 *
 * Conventions
 *  - INTEGER PRIMARY KEY ids (fast, URL-friendly, local-first).
 *  - Timestamps are ISO-8601 UTC TEXT (sortable, human-readable); calendar dates are 'YYYY-MM-DD'.
 *  - Soft delete: `deleted_at` (hidden everywhere, restorable from Trash, purge = hard delete).
 *  - Archive: `archived_at` (out of the way, still searchable, one click to restore).
 *  - Enums are TEXT with CHECK constraints so bad data cannot enter, even from automation.
 *  - Episode "computed" columns (phase, readiness, …) are a denormalised cache of the readiness
 *    engine so the library can filter/sort 10k+ episodes in SQL. They are only ever written by
 *    recomputeEpisodes() in services.
 */

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
const ts = `created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT NOT NULL DEFAULT ${NOW}`;
const stageCheck = `CHECK (stage IN ('RESEARCH','CONCEPT','SCRIPT','VOICE','VISUAL','EDIT','QC','CAPTION','COVER','SCHEDULE','PUBLISH'))`;

/** FTS rowid namespace: rowid = KIND_CODE * 1e10 + entity id, so trigger updates are O(log n). */
export const SEARCH_KINDS = {
  episode: 1,
  idea: 2,
  source: 3,
  insight: 4,
  project: 5,
  series: 6,
  person: 7,
  asset: 8,
} as const;
export type SearchKind = keyof typeof SEARCH_KINDS;
const NS = 10_000_000_000;

function ftsTriggers(table: string, kind: SearchKind, titleExpr: string, bodyExpr: string, watched: string[], softDelete = true) {
  const rid = (ref: 'new' | 'old') => `(${SEARCH_KINDS[kind]} * ${NS} + ${ref}.id)`;
  const alive = softDelete ? `new.deleted_at IS NULL` : `1`;
  const archived = table === 'episodes' || table === 'ideas' || table === 'sources' || table === 'projects' || table === 'series'
    ? `CASE WHEN new.archived_at IS NULL THEN 0 ELSE 1 END`
    : `0`;
  const ins = `INSERT INTO search_index(rowid, kind, ref_id, title, body, archived)
    SELECT ${rid('new')}, '${kind}', new.id, ${titleExpr.replaceAll('$', 'new')}, ${bodyExpr.replaceAll('$', 'new')}, ${archived} WHERE ${alive};`;
  return `
CREATE TRIGGER ${table}_fts_ai AFTER INSERT ON ${table} BEGIN ${ins} END;
CREATE TRIGGER ${table}_fts_au AFTER UPDATE OF ${watched.join(', ')} ON ${table} BEGIN
  DELETE FROM search_index WHERE rowid = ${rid('old')};
  ${ins}
END;
CREATE TRIGGER ${table}_fts_ad AFTER DELETE ON ${table} BEGIN
  DELETE FROM search_index WHERE rowid = ${rid('old')};
END;`;
}

const M1 = /* sql */ `
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------- content types
CREATE TABLE content_types (
  id                    INTEGER PRIMARY KEY,
  key                   TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  default_duration_sec  INTEGER,
  default_platforms     TEXT NOT NULL DEFAULT 'INSTAGRAM',        -- comma-separated Platform values
  checklist             TEXT NOT NULL DEFAULT '[]',               -- JSON array of task titles (template only)
  color                 TEXT,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  archived_at           TEXT,
  ${ts}
);

CREATE TABLE content_type_stages (
  content_type_id INTEGER NOT NULL REFERENCES content_types(id) ON DELETE CASCADE,
  stage           TEXT NOT NULL ${stageCheck},
  mode            TEXT NOT NULL CHECK (mode IN ('REQUIRED','OPTIONAL','NONE')),
  PRIMARY KEY (content_type_id, stage)
) WITHOUT ROWID;

-- ---------------------------------------------------------------- people
CREATE TABLE people (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'THINKER',                    -- free label: thinker, entrepreneur, biblical figure…
  bio         TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  ${ts},
  deleted_at  TEXT
);
CREATE INDEX people_name ON people(name COLLATE NOCASE);

-- ---------------------------------------------------------------- projects & series
CREATE TABLE projects (
  id                      INTEGER PRIMARY KEY,
  name                    TEXT NOT NULL,
  code                    TEXT NOT NULL UNIQUE COLLATE NOCASE,    -- short prefix for episode codes: BIB → BIB-041
  description             TEXT NOT NULL DEFAULT '',
  goal                    TEXT NOT NULL DEFAULT '',
  status                  TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','PLANNING','COMPLETED')),
  target_count            INTEGER,
  color                   TEXT NOT NULL DEFAULT '#3d6b5c',
  default_content_type_id INTEGER REFERENCES content_types(id) ON DELETE SET NULL,
  notes                   TEXT NOT NULL DEFAULT '',
  sort_order              INTEGER NOT NULL DEFAULT 0,
  ${ts},
  archived_at             TEXT,
  deleted_at              TEXT
);

CREATE TABLE ideas (
  id              INTEGER PRIMARY KEY,
  title           TEXT NOT NULL,
  thought         TEXT NOT NULL DEFAULT '',
  project_id      INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  series_id       INTEGER REFERENCES series(id) ON DELETE SET NULL,
  source_id       INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  insight_id      INTEGER REFERENCES insights(id) ON DELETE SET NULL,
  priority        INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 0 AND 3),
  status          TEXT NOT NULL DEFAULT 'INBOX' CHECK (status IN ('INBOX','DEVELOPING','CONVERTED','PARKED','DISCARDED')),
  touched_at      TEXT NOT NULL DEFAULT ${NOW},                   -- last time a human looked at / worked on it
  snoozed_until   TEXT,                                           -- resurface engine ignores it until this date
  ${ts},
  archived_at     TEXT,
  deleted_at      TEXT
);
CREATE INDEX ideas_status ON ideas(status, touched_at) WHERE deleted_at IS NULL;
CREATE INDEX ideas_project ON ideas(project_id);
CREATE INDEX ideas_source ON ideas(source_id);
CREATE INDEX ideas_insight ON ideas(insight_id);

CREATE TABLE series (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  target_count  INTEGER,
  notes         TEXT NOT NULL DEFAULT '',
  idea_id       INTEGER REFERENCES ideas(id) ON DELETE SET NULL,  -- origin idea, if converted from one
  sort_order    INTEGER NOT NULL DEFAULT 0,
  ${ts},
  archived_at   TEXT,
  deleted_at    TEXT
);
CREATE INDEX series_project ON series(project_id, sort_order);

-- ---------------------------------------------------------------- sources & insights
CREATE TABLE sources (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('BOOK','PERSON','INTERVIEW','PODCAST','ARTICLE','PAPER','SCRIPTURE','VIDEO','NOTE','OTHER')),
  author      TEXT NOT NULL DEFAULT '',
  person_id   INTEGER REFERENCES people(id) ON DELETE SET NULL,
  project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL, -- primary project (optional; lineage is via episodes)
  description TEXT NOT NULL DEFAULT '',
  citation    TEXT NOT NULL DEFAULT '',                           -- e.g. "Genesis 37–50", ISBN, episode #
  url         TEXT NOT NULL DEFAULT '',
  year        INTEGER,
  status      TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','IN_PROGRESS','PROCESSED','EXHAUSTED')),
  potential   INTEGER,                                            -- estimated number of episodes this source can yield
  notes       TEXT NOT NULL DEFAULT '',
  ${ts},
  archived_at TEXT,
  deleted_at  TEXT
);
CREATE INDEX sources_person ON sources(person_id);
CREATE INDEX sources_project ON sources(project_id);
CREATE INDEX sources_type ON sources(type);

CREATE TABLE insights (
  id          INTEGER PRIMARY KEY,
  source_id   INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  statement   TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  locator     TEXT NOT NULL DEFAULT '',                           -- page, chapter, verse, timestamp
  ${ts},
  deleted_at  TEXT
);
CREATE INDEX insights_source ON insights(source_id);

-- ---------------------------------------------------------------- episodes
CREATE TABLE episodes (
  id                  INTEGER PRIMARY KEY,
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  series_id           INTEGER REFERENCES series(id) ON DELETE SET NULL,
  content_type_id     INTEGER NOT NULL REFERENCES content_types(id) ON DELETE RESTRICT,
  idea_id             INTEGER REFERENCES ideas(id) ON DELETE SET NULL,   -- origin idea (lineage)
  number              INTEGER,                                            -- episode number within the project
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  core_idea           TEXT NOT NULL DEFAULT '',
  hook                TEXT NOT NULL DEFAULT '',
  script              TEXT NOT NULL DEFAULT '',
  target_duration_sec INTEGER,
  priority            INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 0 AND 3),
  due_date            TEXT,
  notes               TEXT NOT NULL DEFAULT '',

  -- computed cache (readiness engine) ------------------------------------
  phase               TEXT NOT NULL DEFAULT 'IDEA',
  readiness           INTEGER NOT NULL DEFAULT 0,
  next_stage          TEXT,
  actionable          TEXT NOT NULL DEFAULT '',  -- ',VOICE,CAPTION,' — stages workable right now (LIKE-filterable)
  blocked             INTEGER NOT NULL DEFAULT 0,
  published_at        TEXT,      -- first publication date
  scheduled_at        TEXT,      -- next scheduled publication
  progress_at         TEXT,      -- last time any stage changed

  ${ts},
  archived_at         TEXT,
  deleted_at          TEXT,
  UNIQUE (project_id, number)
);
CREATE INDEX episodes_project ON episodes(project_id, number) WHERE deleted_at IS NULL;
CREATE INDEX episodes_series ON episodes(series_id) WHERE deleted_at IS NULL;
CREATE INDEX episodes_phase ON episodes(phase, priority) WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX episodes_next ON episodes(next_stage) WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX episodes_blocked ON episodes(blocked) WHERE blocked = 1 AND deleted_at IS NULL;
CREATE INDEX episodes_updated ON episodes(updated_at);
CREATE INDEX episodes_due ON episodes(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX episodes_idea ON episodes(idea_id);
CREATE INDEX episodes_type ON episodes(content_type_id);

CREATE TABLE episode_stages (
  episode_id   INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  stage        TEXT NOT NULL ${stageCheck},
  status       TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED','IN_PROGRESS','BLOCKED','DONE','SKIPPED')),
  note         TEXT NOT NULL DEFAULT '',                          -- blocker reason / stage notes
  started_at   TEXT,
  completed_at TEXT,
  updated_at   TEXT NOT NULL DEFAULT ${NOW},
  PRIMARY KEY (episode_id, stage)
) WITHOUT ROWID;
CREATE INDEX episode_stages_stage ON episode_stages(stage, status);
CREATE INDEX episode_stages_completed ON episode_stages(completed_at) WHERE completed_at IS NOT NULL;

CREATE TABLE episode_sources (
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  source_id  INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  locator    TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (episode_id, source_id)
) WITHOUT ROWID;
CREATE INDEX episode_sources_source ON episode_sources(source_id);

CREATE TABLE episode_insights (
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  insight_id INTEGER NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  PRIMARY KEY (episode_id, insight_id)
) WITHOUT ROWID;
CREATE INDEX episode_insights_insight ON episode_insights(insight_id);

CREATE TABLE episode_relations (
  from_id    INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  to_id      INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'RELATED' CHECK (kind IN ('RELATED','SEQUEL','PREREQUISITE','VARIANT','DUPLICATE')),
  created_at TEXT NOT NULL DEFAULT ${NOW},
  PRIMARY KEY (from_id, to_id),
  CHECK (from_id <> to_id)
) WITHOUT ROWID;
CREATE INDEX episode_relations_to ON episode_relations(to_id);

-- ---------------------------------------------------------------- tags
CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT
);
CREATE TABLE episode_tags (episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (episode_id, tag_id)) WITHOUT ROWID;
CREATE TABLE idea_tags    (idea_id    INTEGER NOT NULL REFERENCES ideas(id)    ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (idea_id, tag_id)) WITHOUT ROWID;
CREATE TABLE source_tags  (source_id  INTEGER NOT NULL REFERENCES sources(id)  ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (source_id, tag_id)) WITHOUT ROWID;
CREATE TABLE series_tags  (series_id  INTEGER NOT NULL REFERENCES series(id)   ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (series_id, tag_id)) WITHOUT ROWID;
CREATE TABLE project_tags (project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (project_id, tag_id)) WITHOUT ROWID;
CREATE INDEX episode_tags_tag ON episode_tags(tag_id);
CREATE INDEX idea_tags_tag ON idea_tags(tag_id);
CREATE INDEX source_tags_tag ON source_tags(tag_id);
CREATE INDEX series_tags_tag ON series_tags(tag_id);
CREATE INDEX project_tags_tag ON project_tags(tag_id);

-- ---------------------------------------------------------------- assets
CREATE TABLE assets (
  id          INTEGER PRIMARY KEY,
  episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('VOICEOVER','AUDIO','VIDEO','IMAGE','ANIMATION','COVER','THUMBNAIL','SCRIPT_FILE','PDF','REFERENCE','EXPORT','OTHER')),
  name        TEXT NOT NULL,                                      -- versions share kind + name
  version     INTEGER NOT NULL DEFAULT 1,
  label       TEXT NOT NULL DEFAULT '',                           -- "final", "alt cut", …
  status      TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','FINAL','REJECTED')),
  stage       TEXT ${stageCheck.replace('CHECK (stage IN', 'CHECK (stage IS NULL OR stage IN')},
  file_ref    TEXT NOT NULL DEFAULT '',                           -- path, URL, or /files/<stored name> for uploads
  file_size   INTEGER,
  mime        TEXT,
  notes       TEXT NOT NULL DEFAULT '',
  ${ts},
  deleted_at  TEXT,
  UNIQUE (episode_id, kind, name, version)
);
CREATE INDEX assets_episode ON assets(episode_id, kind);

-- ---------------------------------------------------------------- tasks / checklist
CREATE TABLE tasks (
  id           INTEGER PRIMARY KEY,
  episode_id   INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  stage        TEXT ${stageCheck.replace('CHECK (stage IN', 'CHECK (stage IS NULL OR stage IN')},
  title        TEXT NOT NULL,
  done         INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT ${NOW},
  completed_at TEXT
);
CREATE INDEX tasks_episode ON tasks(episode_id, sort_order);

-- ---------------------------------------------------------------- publications & analytics
CREATE TABLE publications (
  id              INTEGER PRIMARY KEY,
  episode_id      INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('INSTAGRAM','TIKTOK','YOUTUBE','FACEBOOK','X','THREADS','LINKEDIN','OTHER')),
  account         TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','READY','SCHEDULED','PUBLISHED','FAILED','ARCHIVED')),
  scheduled_at    TEXT,
  published_at    TEXT,
  url             TEXT NOT NULL DEFAULT '',
  caption         TEXT NOT NULL DEFAULT '',
  hashtags        TEXT NOT NULL DEFAULT '',
  cover_asset_id  INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  notes           TEXT NOT NULL DEFAULT '',
  ${ts},
  deleted_at      TEXT
);
CREATE INDEX publications_episode ON publications(episode_id);
CREATE INDEX publications_sched ON publications(status, scheduled_at) WHERE deleted_at IS NULL;
CREATE INDEX publications_published ON publications(published_at) WHERE deleted_at IS NULL;

CREATE TABLE publication_metrics (
  id               INTEGER PRIMARY KEY,
  publication_id   INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  captured_at      TEXT NOT NULL DEFAULT ${NOW},
  views            INTEGER,
  likes            INTEGER,
  comments         INTEGER,
  shares           INTEGER,
  saves            INTEGER,
  followers_gained INTEGER,
  watch_time_sec   INTEGER,
  completion_rate  REAL
);
CREATE INDEX publication_metrics_pub ON publication_metrics(publication_id, captured_at);

-- ---------------------------------------------------------------- operations
CREATE TABLE activity (
  id          INTEGER PRIMARY KEY,
  at          TEXT NOT NULL DEFAULT ${NOW},
  actor       TEXT NOT NULL DEFAULT 'you',                        -- 'you' or 'automation:<agent>' (X-Actor header)
  action      TEXT NOT NULL,                                      -- created, stage, published, archived, …
  entity_type TEXT NOT NULL,
  entity_id   INTEGER NOT NULL,
  episode_id  INTEGER,
  project_id  INTEGER,
  summary     TEXT NOT NULL,
  data        TEXT                                                -- small JSON diff
);
CREATE INDEX activity_at ON activity(at DESC);
CREATE INDEX activity_episode ON activity(episode_id, at DESC);
CREATE INDEX activity_project ON activity(project_id, at DESC);

CREATE TABLE saved_views (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  query       TEXT NOT NULL,                                      -- JSON EpisodeQuery (a view config, not data)
  system      INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE today_queue (
  day         TEXT NOT NULL,                                      -- YYYY-MM-DD (local day of the owner)
  episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  added_at    TEXT NOT NULL DEFAULT ${NOW},
  PRIMARY KEY (day, episode_id)
) WITHOUT ROWID;

-- Future AI layer: vectors are an optional add-on keyed by content hash, never a dependency.
CREATE TABLE embeddings (
  entity_type  TEXT NOT NULL,
  entity_id    INTEGER NOT NULL,
  model        TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  vector       BLOB NOT NULL,
  updated_at   TEXT NOT NULL DEFAULT ${NOW},
  PRIMARY KEY (entity_type, entity_id, model)
) WITHOUT ROWID;

-- ---------------------------------------------------------------- search
CREATE VIRTUAL TABLE search_index USING fts5(
  kind UNINDEXED, ref_id UNINDEXED, title, body, archived UNINDEXED,
  tokenize = 'porter unicode61 remove_diacritics 2',
  prefix = '2 3'
);
${ftsTriggers('episodes', 'episode', '$.title', `$.core_idea || ' ' || $.hook || ' ' || $.description || ' ' || $.script || ' ' || $.notes`, ['title', 'core_idea', 'hook', 'description', 'script', 'notes', 'archived_at', 'deleted_at'])}
${ftsTriggers('ideas', 'idea', '$.title', '$.thought', ['title', 'thought', 'archived_at', 'deleted_at'])}
${ftsTriggers('sources', 'source', '$.title', `$.author || ' ' || $.description || ' ' || $.citation || ' ' || $.notes`, ['title', 'author', 'description', 'citation', 'notes', 'archived_at', 'deleted_at'])}
${ftsTriggers('insights', 'insight', '$.statement', `$.detail || ' ' || $.locator`, ['statement', 'detail', 'locator', 'deleted_at'])}
${ftsTriggers('projects', 'project', '$.name', `$.code || ' ' || $.description || ' ' || $.goal`, ['name', 'code', 'description', 'goal', 'archived_at', 'deleted_at'])}
${ftsTriggers('series', 'series', '$.title', `$.description || ' ' || $.notes`, ['title', 'description', 'notes', 'archived_at', 'deleted_at'])}
${ftsTriggers('people', 'person', '$.name', `$.kind || ' ' || $.bio`, ['name', 'kind', 'bio', 'deleted_at'])}
${ftsTriggers('assets', 'asset', `$.name || ' v' || $.version`, `$.kind || ' ' || $.label || ' ' || $.notes || ' ' || $.file_ref`, ['name', 'version', 'label', 'notes', 'file_ref', 'deleted_at'])}
`;

export const MIGRATIONS: { version: number; name: string; sql: string }[] = [{ version: 1, name: 'initial schema', sql: M1 }];
