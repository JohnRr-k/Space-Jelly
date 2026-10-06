/**
 * Operational intelligence — deterministic, explainable, no AI required.
 *  - bottleneck detection
 *  - next best action
 *  - resurface engine (dormant intelligence)
 *  - search + similarity (FTS5 / BM25; the SimilarityProvider seam is where embeddings can plug in later)
 */
import { STAGES, STAGE_META, PRE_RELEASE_STAGES, episodeCode, type Stage } from '../../shared/domain';
import type { Bottleneck, NextAction, StageFlow, ActivityItem } from '../../shared/api';
import { SEARCH_KINDS, type SearchKind } from '../schema';
import { localDay, localDayBounds, daysAgoIso, nowIso } from '../db';
import { db, settingNum, placeholders, daysBetween, notFound, invalid } from './core';
import { episodeItems, ftsQuery, episodeRow, recomputeEpisodes } from './episodes';
import { listProjects } from './projects';

const ACTIVE = `e.deleted_at IS NULL AND e.archived_at IS NULL`;
const IN_PRODUCTION = `e.phase IN ('RESEARCH','SCRIPT','VOICE','VISUAL','EDIT','QC')`;

// =============================================================== bottleneck

/**
 * Bottleneck = the stage where work waits longest (Little's law: work at station ÷ throughput).
 *  - "Work at station" = episodes whose prerequisites are done but the stage isn't (queued + in progress).
 *  - Caption/cover only count once they are on the critical path (production finished), otherwise
 *    every early-concept episode would look like it is "waiting" for a caption.
 *  - A queue with zero recent throughput is the worst case: nothing is moving.
 */
const PACKAGING = new Set<Stage>(['CAPTION', 'COVER']);
export function bottleneck(projectId?: number): Bottleneck {
  const d = db();
  const pf = projectId ? 'AND e.project_id = ?' : '';
  const pp = projectId ? [projectId] : [];
  const stages = PRE_RELEASE_STAGES;
  const cols = stages
    .map((s) => {
      const gate = PACKAGING.has(s) ? `e.phase = 'QC'` : `e.phase <> 'IDEA'`;
      return `sum(e.actionable LIKE '%,${s},%' AND ${gate} AND es_${s}.status = 'NOT_STARTED'),
              sum(e.actionable LIKE '%,${s},%' AND ${gate} AND es_${s}.status = 'IN_PROGRESS')`;
    })
    .join(', ');
  const joins = stages.map((s) => `JOIN episode_stages es_${s} ON es_${s}.episode_id = e.id AND es_${s}.stage = '${s}'`).join(' ');
  const raw = d.prepare(`SELECT ${cols} FROM episodes e ${joins} WHERE ${ACTIVE} ${pf}`).raw().get(...pp) as (number | null)[];
  const statusRows = d
    .prepare(
      `SELECT es.stage, sum(es.status = 'BLOCKED') AS bl, sum(es.status = 'DONE' AND es.completed_at >= ?) AS done14
       FROM episode_stages es JOIN episodes e ON e.id = es.episode_id WHERE ${ACTIVE} ${pf} GROUP BY es.stage`,
    )
    .all(daysAgoIso(14), ...pp) as { stage: Stage; bl: number; done14: number }[];
  const by = new Map(statusRows.map((r) => [r.stage, r]));
  const flows: StageFlow[] = stages.map((s, i) => {
    const waiting = raw[i * 2] ?? 0;
    const inProgress = raw[i * 2 + 1] ?? 0;
    const r = by.get(s);
    const done14d = r?.done14 ?? 0;
    const perDay = done14d / 14;
    const queue = waiting + inProgress;
    return {
      stage: s,
      waiting,
      inProgress,
      blocked: r?.bl ?? 0,
      done14d,
      clearDays: perDay > 0 ? Math.round((queue / perDay) * 10) / 10 : null,
      load: Math.round(queue * STAGE_META[s].weight * 10) / 10,
    };
  });
  // Rank: stalled queues first (work waiting, nothing completed recently), then longest queue time, then effort.
  const MIN_QUEUE = 3;
  const rankValue = (f: StageFlow) => {
    const q = f.waiting + f.inProgress;
    if (q < MIN_QUEUE) return -1;
    return f.clearDays === null ? 10_000 + f.load : f.clearDays;
  };
  const worst = [...flows].sort((a, b) => rankValue(b) - rankValue(a) || b.load - a.load)[0];
  if (!worst || rankValue(worst) < 0) {
    return { stage: null, flows, explanation: 'No production pile-ups. Every in-production episode is moving.' };
  }
  const meta = STAGE_META[worst.stage];
  const q = worst.waiting + worst.inProgress;
  const deps = PACKAGING.has(worst.stage) ? 'the edit' : meta.deps.map((x) => STAGE_META[x].label.toLowerCase()).join(' + ') || 'their prerequisites';
  const pace =
    worst.clearDays === null
      ? `Nothing was completed at this stage in the last 14 days — the queue isn't moving.`
      : `At your recent pace (${worst.done14d} done in 14 days) that's ~${worst.clearDays} days of queued work.`;
  return {
    stage: worst.stage,
    flows,
    explanation: `${q} episode${q === 1 ? ' has' : 's have'} ${deps} done and ${q === 1 ? 'is' : 'are'} sitting at ${meta.label.toLowerCase()} (${worst.waiting} not started, ${worst.inProgress} in progress). ${pace}`,
  };
}

// =============================================================== shared counts

function phaseCounts(projectId?: number) {
  const pf = projectId ? 'AND e.project_id = ?' : '';
  return db()
    .prepare(
      `SELECT count(*) AS total, sum(e.phase = 'IDEA') AS idea, sum(${IN_PRODUCTION}) AS in_production, sum(e.blocked) AS blocked,
         sum(e.phase = 'READY') AS ready, sum(e.phase = 'SCHEDULED') AS scheduled, sum(e.phase = 'PUBLISHED') AS published
       FROM episodes e WHERE ${ACTIVE} ${pf}`,
    )
    .get(...(projectId ? [projectId] : [])) as Record<string, number | null>;
}

function todayNumbers() {
  const { start, end } = localDayBounds();
  const d = db();
  const published = (d.prepare(`SELECT count(*) AS c FROM publications WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND published_at >= ? AND published_at < ?`).get(start, end) as { c: number }).c;
  const publishedEpisodes = (d.prepare(`SELECT count(DISTINCT episode_id) AS c FROM publications WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND published_at >= ? AND published_at < ?`).get(start, end) as { c: number }).c;
  const scheduledToday = (d.prepare(`SELECT count(*) AS c FROM publications WHERE deleted_at IS NULL AND status = 'SCHEDULED' AND scheduled_at >= ? AND scheduled_at < ?`).get(start, end) as { c: number }).c;
  const stageCompletions = (d.prepare(`SELECT count(*) AS c FROM episode_stages WHERE status = 'DONE' AND completed_at >= ? AND completed_at < ?`).get(start, end) as { c: number }).c;
  const target = settingNum('daily_target');
  // The daily target counts distinct episodes shipped: cross-posting one episode to three platforms is one piece of output.
  return { target, published: publishedEpisodes, publications: published, remaining: Math.max(0, target - publishedEpisodes), scheduledToday, stageCompletions, start, end };
}

// =============================================================== next best action

export function nextActions(): NextAction[] {
  const d = db();
  const today = todayNumbers();
  const counts = phaseCounts();
  const ready = counts.ready ?? 0;
  const bn = bottleneck();
  const out: NextAction[] = [];
  const day = localDay();

  // 1. Hit today's publishing target with what is already finished.
  if (today.remaining > 0 && ready > 0) {
    const n = Math.min(today.remaining, ready);
    out.push({
      id: 'publish-ready',
      kind: 'publish',
      title: `Publish ${n} ready episode${n > 1 ? 's' : ''}`,
      reason: `You're at ${today.published}/${today.target} today and ${ready} episode${ready > 1 ? 's are' : ' is'} fully produced. Shipping finished work is the highest-leverage move.`,
      score: 100 + n * 3,
      count: n,
      href: '/episodes?view=ready',
    });
  }

  // 2. Scheduled posts whose time has passed but were never confirmed.
  const overdueSched = (d.prepare(`SELECT count(*) AS c FROM publications WHERE deleted_at IS NULL AND status = 'SCHEDULED' AND scheduled_at < ?`).get(nowIso()) as { c: number }).c;
  if (overdueSched) {
    out.push({
      id: 'confirm-scheduled',
      kind: 'confirm',
      title: `Confirm ${overdueSched} scheduled post${overdueSched > 1 ? 's' : ''} went live`,
      reason: 'Their scheduled time has passed. Mark them published (or failed) so your numbers stay true.',
      score: 96,
      count: overdueSched,
      href: '/today#scheduled',
    });
  }

  // 3. Urgent / overdue single episodes.
  const urgent = d
    .prepare(
      `SELECT e.id FROM episodes e WHERE ${ACTIVE} AND e.phase NOT IN ('PUBLISHED','SCHEDULED') AND e.blocked = 0
       AND (e.priority = 0 OR (e.due_date IS NOT NULL AND e.due_date <= ?)) ORDER BY e.due_date IS NULL, e.due_date, e.priority, e.readiness DESC LIMIT 3`,
    )
    .all(day) as { id: number }[];
  for (const ep of episodeItems(urgent.map((r) => r.id))) {
    const stage = ep.actionable[0] ?? ep.nextStage;
    const overdue = ep.dueDate ? daysBetween(ep.dueDate + 'T12:00:00') ?? 0 : 0;
    const due = ep.dueDate ? (ep.dueDate < day ? `${overdue} day${overdue === 1 ? '' : 's'} overdue` : ep.dueDate === day ? 'due today' : `due ${ep.dueDate}`) : 'marked urgent';
    out.push({
      id: `urgent-${ep.id}`,
      kind: 'urgent',
      title: ep.phase === 'READY' ? `Publish ${ep.code} — ${ep.title}` : `${stage ? STAGE_META[stage].verb : 'Advance'} ${ep.code} — ${ep.title}`,
      reason: `${due[0].toUpperCase()}${due.slice(1)} · ${ep.readiness}% ready${stage ? ` · next: ${STAGE_META[stage].label}` : ''}.`,
      score: 82 + Math.min(overdue, 10) * 2 + (ep.priority === 0 ? 6 : 0) + ep.readiness / 20,
      episodeId: ep.id,
      stage: stage ?? undefined,
      href: `/episodes/${ep.id}`,
    });
  }

  // 4. Bottleneck batch.
  if (bn.stage) {
    const f = bn.flows.find((x) => x.stage === bn.stage)!;
    const downstream = STAGES.filter((s) => STAGE_META[s].deps.includes(bn.stage!)).map((s) => STAGE_META[s].label.toLowerCase());
    const starving = ready + (counts.scheduled ?? 0) < today.target * 2;
    const queued = f.waiting + f.inProgress;
    const batch = Math.min(queued, Math.max(3, today.target));
    out.push({
      id: `bottleneck-${bn.stage}`,
      kind: 'bottleneck',
      title: `${STAGE_META[bn.stage].verb} ${batch} episode${batch > 1 ? 's' : ''}`,
      reason: `${STAGE_META[bn.stage].label} is the bottleneck: ${queued} queued${f.clearDays ? ` (~${f.clearDays} days at your pace)` : ''}${downstream.length ? `, holding up ${downstream.join(' & ')}` : ''}.${starving ? ' Your ready queue is thin, so clearing it feeds publishing directly.' : ''} Batch them — same tools, same headspace.`,
      score: 72 + Math.min(queued, 25) + (starving ? 12 : 0),
      count: queued,
      stage: bn.stage,
      href: `/episodes?waitingFor=${bn.stage}`,
    });
  }

  // 5. Blocked episodes.
  const blocked = d
    .prepare(
      `SELECT es.stage, count(*) AS c, min(es.updated_at) AS oldest FROM episode_stages es JOIN episodes e ON e.id = es.episode_id
       WHERE ${ACTIVE} AND es.status = 'BLOCKED' GROUP BY es.stage ORDER BY c DESC`,
    )
    .all() as { stage: Stage; c: number; oldest: string }[];
  const blockedTotal = counts.blocked ?? 0;
  if (blockedTotal) {
    const top = blocked[0];
    const age = daysBetween(blocked.reduce((m, b) => (b.oldest < m ? b.oldest : m), top.oldest)) ?? 0;
    out.push({
      id: 'unblock',
      kind: 'unblock',
      title: `Resolve ${blockedTotal} blocked episode${blockedTotal > 1 ? 's' : ''}`,
      reason: `Most are stuck at ${STAGE_META[top.stage].label.toLowerCase()} (${top.c}). The oldest has been blocked ${age} day${age === 1 ? '' : 's'}. Blockers rarely fix themselves.`,
      score: 58 + Math.min(blockedTotal, 10) * 3 + Math.min(age, 14),
      count: blockedTotal,
      href: '/episodes?view=blocked',
    });
  }

  // 6. Nearly finished — one push away from Ready.
  const near = d
    .prepare(`SELECT e.id FROM episodes e WHERE ${ACTIVE} AND ${IN_PRODUCTION} AND e.blocked = 0 AND e.readiness >= 75 ORDER BY e.readiness DESC, e.priority LIMIT 2`)
    .all() as { id: number }[];
  for (const ep of episodeItems(near.map((r) => r.id))) {
    const left = PRE_RELEASE_STAGES.filter((s) => ep.stages[s] && ep.stages[s] !== 'DONE' && ep.stages[s] !== 'SKIPPED' && ep.actionable.includes(s));
    out.push({
      id: `finish-${ep.id}`,
      kind: 'finish',
      title: `Finish ${ep.code} — ${ep.title}`,
      reason: `${ep.readiness}% ready. ${left.length ? `Only ${left.map((s) => STAGE_META[s].label.toLowerCase()).join(', ')} left.` : 'Almost there.'}`,
      score: 62 + ep.readiness / 5 + (ready < today.target ? 8 : 0),
      episodeId: ep.id,
      href: `/episodes/${ep.id}`,
    });
  }

  // 7. Stalled work.
  const stuckDays = settingNum('stuck_episode_days');
  const stalled = (d.prepare(`SELECT count(*) AS c FROM episodes e WHERE ${ACTIVE} AND ${IN_PRODUCTION} AND coalesce(e.progress_at, e.created_at) < ?`).get(daysAgoIso(stuckDays)) as { c: number }).c;
  if (stalled) {
    out.push({
      id: 'stalled',
      kind: 'stalled',
      title: `Revive or archive ${stalled} stalled episode${stalled > 1 ? 's' : ''}`,
      reason: `No progress in ${stuckDays}+ days. Decide: push forward, park, or archive — half-finished work is a silent tax.`,
      score: 45 + Math.min(stalled, 20),
      count: stalled,
      href: '/episodes?view=stalled',
    });
  }

  // 8. Idea inbox processing.
  const inbox = (d.prepare(`SELECT count(*) AS c FROM ideas WHERE deleted_at IS NULL AND archived_at IS NULL AND status = 'INBOX'`).get() as { c: number }).c;
  if (inbox >= 5) {
    out.push({
      id: 'ideas',
      kind: 'ideas',
      title: `Process ${inbox} inbox ideas`,
      reason: 'Convert the strong ones to episodes, park the rest. An unprocessed inbox is where good ideas go to die.',
      score: 36 + Math.min(inbox, 40) / 2,
      count: inbox,
      href: '/ideas?view=inbox',
    });
  }

  // 9. Pipeline is running dry.
  const inProd = counts.in_production ?? 0;
  if (inProd < today.target * 3 && (counts.idea ?? 0) > 0) {
    const n = Math.min(counts.idea ?? 0, today.target);
    out.push({
      id: 'start',
      kind: 'start',
      title: `Start research on ${n} planned episode${n > 1 ? 's' : ''}`,
      reason: `Only ${inProd} episodes are in production — less than 3 days of output at ${today.target}/day. Keep the front of the pipeline fed.`,
      score: 50 + (today.target * 3 - inProd),
      count: n,
      href: '/episodes?view=unstarted',
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

// =============================================================== activity

export function listActivity(opts: { limit?: number; before?: string; episodeId?: number; projectId?: number }): ActivityItem[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.before) {
    where.push('at < ?');
    params.push(opts.before);
  }
  if (opts.episodeId) {
    where.push('episode_id = ?');
    params.push(opts.episodeId);
  }
  if (opts.projectId) {
    where.push('project_id = ?');
    params.push(opts.projectId);
  }
  const rows = db()
    .prepare(`SELECT * FROM activity ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY at DESC, id DESC LIMIT ?`)
    .all(...params, Math.min(opts.limit ?? 30, 200)) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as number,
    at: r.at as string,
    actor: r.actor as string,
    action: r.action as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as number,
    episodeId: r.episode_id as number | null,
    projectId: r.project_id as number | null,
    summary: r.summary as string,
  }));
}

// =============================================================== dashboard

export function dashboard() {
  const d = db();
  const counts = phaseCounts();
  const today = todayNumbers();
  const projects = listProjects().map((p) => ({ id: p.id, name: p.name, code: p.code, color: p.color, status: p.status, stats: p.stats }));
  const attention = {
    blocked: episodeItems((d.prepare(`SELECT e.id FROM episodes e WHERE ${ACTIVE} AND e.blocked = 1 ORDER BY e.priority, e.progress_at LIMIT 6`).all() as { id: number }[]).map((r) => r.id)),
    overdue: episodeItems(
      (d.prepare(`SELECT e.id FROM episodes e WHERE ${ACTIVE} AND e.due_date < ? AND e.phase NOT IN ('PUBLISHED','SCHEDULED') ORDER BY e.due_date LIMIT 6`).all(localDay()) as { id: number }[]).map((r) => r.id),
    ),
    stalled: episodeItems(
      (
        d
          .prepare(`SELECT e.id FROM episodes e WHERE ${ACTIVE} AND ${IN_PRODUCTION} AND e.blocked = 0 AND coalesce(e.progress_at, e.created_at) < ? ORDER BY coalesce(e.progress_at, e.created_at) LIMIT 6`)
          .all(daysAgoIso(settingNum('stuck_episode_days'))) as { id: number }[]
      ).map((r) => r.id),
    ),
  };
  const overdueCount = (d.prepare(`SELECT count(*) AS c FROM episodes e WHERE ${ACTIVE} AND e.due_date < ? AND e.phase NOT IN ('PUBLISHED','SCHEDULED')`).get(localDay()) as { c: number }).c;
  const upcoming = d
    .prepare(
      `SELECT p.id, p.platform, p.scheduled_at, e.id AS episode_id, e.title, e.number, pr.code FROM publications p
       JOIN episodes e ON e.id = p.episode_id JOIN projects pr ON pr.id = e.project_id
       WHERE p.deleted_at IS NULL AND e.deleted_at IS NULL AND p.status = 'SCHEDULED' ORDER BY p.scheduled_at LIMIT 8`,
    )
    .all() as Record<string, unknown>[];
  const published7 = d
    .prepare(
      `SELECT substr(published_at, 1, 10) AS day, count(*) AS c FROM publications WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND published_at >= ? GROUP BY day ORDER BY day`,
    )
    .all(daysAgoIso(14)) as { day: string; c: number }[];
  const ideas = d
    .prepare(
      `SELECT sum(status = 'INBOX') AS inbox, sum(status IN ('INBOX','DEVELOPING','PARKED') AND touched_at < ?) AS dormant FROM ideas WHERE deleted_at IS NULL AND archived_at IS NULL`,
    )
    .get(daysAgoIso(settingNum('dormant_idea_days'))) as { inbox: number | null; dormant: number | null };

  return {
    counts: {
      total: counts.total ?? 0,
      idea: counts.idea ?? 0,
      inProduction: counts.in_production ?? 0,
      blocked: counts.blocked ?? 0,
      ready: counts.ready ?? 0,
      scheduled: counts.scheduled ?? 0,
      published: counts.published ?? 0,
      overdue: overdueCount,
    },
    today,
    bottleneck: bottleneck(),
    actions: nextActions(),
    projects,
    attention,
    upcoming: upcoming.map((u) => ({ ...u, code: episodeCode(u.code as string, u.number as number) })),
    publishedByDay: published7,
    ideas: { inbox: ideas.inbox ?? 0, dormant: ideas.dormant ?? 0 },
    activity: listActivity({ limit: 14 }),
  };
}

// =============================================================== today

export function todayView() {
  const d = db();
  const day = localDay();
  const today = todayNumbers();
  const queueIds = (d.prepare('SELECT q.episode_id FROM today_queue q JOIN episodes e ON e.id = q.episode_id WHERE q.day = ? AND e.deleted_at IS NULL ORDER BY q.position').all(day) as { episode_id: number }[]).map((r) => r.episode_id);
  const queue = episodeItems(queueIds);
  const notIn = queueIds.length ? `AND e.id NOT IN (${placeholders(queueIds)})` : '';
  const ready = episodeItems(
    (d.prepare(`SELECT e.id FROM episodes e WHERE ${ACTIVE} AND e.phase = 'READY' ${notIn} ORDER BY e.priority, e.due_date IS NULL, e.due_date, e.readiness DESC LIMIT 40`).all(...queueIds) as { id: number }[]).map((r) => r.id),
  );
  const scheduled = d
    .prepare(
      `SELECT p.*, e.title, e.number, pr.code AS project_code, pr.color AS project_color FROM publications p
       JOIN episodes e ON e.id = p.episode_id JOIN projects pr ON pr.id = e.project_id
       WHERE p.deleted_at IS NULL AND e.deleted_at IS NULL AND p.status = 'SCHEDULED' AND p.scheduled_at < ? ORDER BY p.scheduled_at`,
    )
    .all(today.end) as Record<string, unknown>[];
  const publishedToday = d
    .prepare(
      `SELECT p.*, e.title, e.number, pr.code AS project_code, pr.color AS project_color FROM publications p
       JOIN episodes e ON e.id = p.episode_id JOIN projects pr ON pr.id = e.project_id
       WHERE p.deleted_at IS NULL AND p.status = 'PUBLISHED' AND p.published_at >= ? AND p.published_at < ? ORDER BY p.published_at DESC`,
    )
    .all(today.start, today.end) as Record<string, unknown>[];
  const due = episodeItems(
    (d.prepare(`SELECT e.id FROM episodes e WHERE ${ACTIVE} AND e.due_date <= ? AND e.phase NOT IN ('PUBLISHED','SCHEDULED','READY') ${notIn} ORDER BY e.due_date, e.priority LIMIT 20`).all(day, ...queueIds) as { id: number }[]).map((r) => r.id),
  );
  const blocked = episodeItems((d.prepare(`SELECT e.id FROM episodes e WHERE ${ACTIVE} AND e.blocked = 1 ORDER BY e.priority, e.progress_at LIMIT 10`).all() as { id: number }[]).map((r) => r.id));
  const bn = bottleneck();
  const bnIds = bn.stage
    ? (d.prepare(`SELECT e.id FROM episodes e WHERE ${ACTIVE} AND e.actionable LIKE ? AND e.phase <> 'IDEA' ${notIn} ORDER BY e.priority, e.readiness DESC LIMIT 12`).all(`%,${bn.stage},%`, ...queueIds) as { id: number }[]).map((r) => r.id)
    : [];
  const doneToday = d
    .prepare(
      `SELECT es.stage, count(*) AS c FROM episode_stages es WHERE es.status = 'DONE' AND es.completed_at >= ? AND es.completed_at < ? GROUP BY es.stage`,
    )
    .all(today.start, today.end);
  return {
    day,
    today,
    queue,
    ready,
    scheduled: scheduled.map((s) => ({ ...s, code: episodeCode(s.project_code as string, s.number as number) })),
    publishedToday: publishedToday.map((s) => ({ ...s, code: episodeCode(s.project_code as string, s.number as number) })),
    due,
    blocked,
    bottleneck: bn,
    bottleneckEpisodes: episodeItems(bnIds),
    doneToday,
    actions: nextActions(),
  };
}

export function queueAdd(ids: number[]) {
  const day = localDay();
  const max = (db().prepare('SELECT coalesce(max(position), -1) AS m FROM today_queue WHERE day = ?').get(day) as { m: number }).m;
  const ins = db().prepare('INSERT OR IGNORE INTO today_queue (day, episode_id, position) VALUES (?, ?, ?)');
  ids.forEach((id, i) => ins.run(day, id, max + 1 + i));
}
export function queueRemove(id: number) {
  db().prepare('DELETE FROM today_queue WHERE day = ? AND episode_id = ?').run(localDay(), id);
}
export function queueOrder(ids: number[]) {
  const up = db().prepare('UPDATE today_queue SET position = ? WHERE day = ? AND episode_id = ?');
  const day = localDay();
  db().transaction(() => ids.forEach((id, i) => up.run(i, day, id)))();
}

// =============================================================== resurface engine

export function resurface() {
  const d = db();
  const dormantDays = settingNum('dormant_idea_days');
  const stuckDays = settingNum('stuck_episode_days');
  const quietDays = settingNum('quiet_project_days');
  const now = nowIso();

  const forgottenIdeas = (
    d
      .prepare(
        `SELECT i.id, i.title, i.thought, i.status, i.created_at, i.touched_at, i.priority, p.name AS project_name, p.color AS project_color, s.title AS source_title
         FROM ideas i LEFT JOIN projects p ON p.id = i.project_id LEFT JOIN sources s ON s.id = i.source_id
         WHERE i.deleted_at IS NULL AND i.archived_at IS NULL AND i.status IN ('INBOX','DEVELOPING','PARKED')
           AND i.touched_at < ? AND (i.snoozed_until IS NULL OR i.snoozed_until < ?)
         ORDER BY i.touched_at LIMIT 24`,
      )
      .all(daysAgoIso(dormantDays), now) as Record<string, string>[]
  ).map((i) => ({
    ...i,
    ageDays: daysBetween(i.created_at),
    untouchedDays: daysBetween(i.touched_at),
    message:
      i.status === 'DEVELOPING'
        ? `Started developing ${daysBetween(i.touched_at)} days ago, then left unfinished.`
        : `Created ${daysBetween(i.created_at)} days ago and never developed.`,
  }));

  const stalledEpisodes = episodeItems(
    (
      d
        .prepare(`SELECT e.id FROM episodes e WHERE ${ACTIVE} AND ${IN_PRODUCTION} AND coalesce(e.progress_at, e.created_at) < ? ORDER BY coalesce(e.progress_at, e.created_at) LIMIT 20`)
        .all(daysAgoIso(stuckDays)) as { id: number }[]
    ).map((r) => r.id),
  );

  const quietProjects = (
    d
      .prepare(
        `SELECT p.id, p.name, p.color, p.status, (SELECT max(at) FROM activity a WHERE a.project_id = p.id) AS last_at,
           (SELECT count(*) FROM episodes e WHERE e.project_id = p.id AND ${ACTIVE} AND e.phase <> 'PUBLISHED') AS open
         FROM projects p WHERE p.deleted_at IS NULL AND p.archived_at IS NULL AND p.status = 'ACTIVE'`,
      )
      .all() as { id: number; name: string; color: string; status: string; last_at: string | null; open: number }[]
  )
    .filter((p) => !p.last_at || p.last_at < daysAgoIso(quietDays))
    .map((p) => ({ ...p, quietDays: daysBetween(p.last_at), message: p.last_at ? `No progress for ${daysBetween(p.last_at)} days · ${p.open} open episodes.` : `No recorded activity yet · ${p.open} open episodes.` }));

  const underusedSources = (
    d
      .prepare(
        `SELECT s.id, s.title, s.type, s.author, s.status, s.potential,
           (SELECT count(*) FROM episode_sources x JOIN episodes e ON e.id = x.episode_id AND e.deleted_at IS NULL WHERE x.source_id = s.id) AS episodes,
           (SELECT count(*) FROM insights n WHERE n.source_id = s.id AND n.deleted_at IS NULL) AS insights,
           (SELECT count(*) FROM insights n WHERE n.source_id = s.id AND n.deleted_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM episode_insights x WHERE x.insight_id = n.id)
              AND NOT EXISTS (SELECT 1 FROM ideas i WHERE i.insight_id = n.id AND i.deleted_at IS NULL)) AS unused_insights
         FROM sources s WHERE s.deleted_at IS NULL AND s.archived_at IS NULL AND s.status <> 'EXHAUSTED'`,
      )
      .all() as { id: number; title: string; type: string; author: string; status: string; potential: number | null; episodes: number; insights: number; unused_insights: number }[]
  )
    .map((s) => {
      const headroom = s.potential ? s.potential - s.episodes : 0;
      const score = Math.max(headroom, 0) + s.unused_insights * 1.5;
      const parts: string[] = [];
      if (s.potential && headroom > 0) parts.push(`has produced ${s.episodes} of an estimated ${s.potential} episodes`);
      else parts.push(`has produced ${s.episodes} episode${s.episodes === 1 ? '' : 's'}`);
      if (s.unused_insights) parts.push(`${s.unused_insights} captured insight${s.unused_insights === 1 ? ' has' : 's have'} never been used`);
      return { ...s, score, message: `This source ${parts.join(' and ')}.` };
    })
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  // Dormant ideas that belong to projects you're actively working on right now.
  const relatedToActive = d
    .prepare(
      `SELECT p.id AS project_id, p.name AS project_name, p.color AS project_color, count(i.id) AS ideas, min(i.touched_at) AS oldest
       FROM ideas i JOIN projects p ON p.id = i.project_id
       WHERE i.deleted_at IS NULL AND i.archived_at IS NULL AND i.status IN ('INBOX','PARKED','DEVELOPING') AND i.touched_at < ?
         AND EXISTS (SELECT 1 FROM activity a WHERE a.project_id = p.id AND a.at >= ?)
       GROUP BY p.id ORDER BY ideas DESC`,
    )
    .all(daysAgoIso(dormantDays), daysAgoIso(7)) as { project_id: number; project_name: string; project_color: string; ideas: number; oldest: string }[];
  const relatedSeries = d
    .prepare(
      `SELECT sr.id AS series_id, sr.title AS series_title, p.name AS project_name, p.color AS project_color, count(DISTINCT i.id) AS ideas
       FROM series sr JOIN projects p ON p.id = sr.project_id
       JOIN series_tags st ON st.series_id = sr.id JOIN idea_tags it ON it.tag_id = st.tag_id JOIN ideas i ON i.id = it.idea_id
       WHERE sr.deleted_at IS NULL AND sr.archived_at IS NULL AND i.deleted_at IS NULL AND i.archived_at IS NULL
         AND i.status IN ('INBOX','PARKED','DEVELOPING') AND i.touched_at < ?
         AND EXISTS (SELECT 1 FROM episodes e JOIN activity a ON a.episode_id = e.id WHERE e.series_id = sr.id AND a.at >= ?)
       GROUP BY sr.id HAVING count(DISTINCT i.id) >= 2 ORDER BY ideas DESC LIMIT 6`,
    )
    .all(daysAgoIso(dormantDays), daysAgoIso(14)) as Record<string, unknown>[];

  return {
    thresholds: { dormantDays, stuckDays, quietDays },
    forgottenIdeas,
    stalledEpisodes,
    quietProjects,
    underusedSources,
    relatedToActive: [
      ...relatedSeries.map((r) => ({ ...r, message: `You have ${r.ideas} old idea${r.ideas === 1 ? '' : 's'} related to the active series “${r.series_title}”.` })),
      ...relatedToActive.map((r) => ({ ...r, message: `${r.ideas} dormant idea${r.ideas === 1 ? '' : 's'} belong to ${r.project_name}, which you're actively working on.` })),
    ],
  };
}

export function randomIdea() {
  const r = db()
    .prepare(
      `SELECT id FROM ideas WHERE deleted_at IS NULL AND archived_at IS NULL AND status IN ('INBOX','PARKED','DEVELOPING')
       AND (snoozed_until IS NULL OR snoozed_until < ?) ORDER BY random() LIMIT 1`,
    )
    .get(nowIso()) as { id: number } | undefined;
  return r?.id ?? null;
}

// =============================================================== search

export interface SearchHit {
  kind: SearchKind;
  id: number;
  title: string;
  subtitle: string;
  archived: boolean;
  href: string;
  meta?: Record<string, unknown>;
}

const KIND_HREF: Record<SearchKind, (id: number, extra: Record<string, unknown>) => string> = {
  episode: (id) => `/episodes/${id}`,
  idea: (id) => `/ideas?open=${id}`,
  source: (id) => `/sources/${id}`,
  insight: (_id, x) => (x.source_id ? `/sources/${x.source_id}` : '/sources'),
  project: (id) => `/projects/${id}`,
  series: (id) => `/series/${id}`,
  person: (id) => `/sources?person=${id}`,
  asset: (_id, x) => `/episodes/${x.episode_id}?tab=assets`,
};

export function search(q: string, opts: { kinds?: SearchKind[]; limit?: number } = {}): SearchHit[] {
  const d = db();
  const text = q.trim();
  if (!text) return [];
  const hits: SearchHit[] = [];
  const limit = Math.min(opts.limit ?? 30, 100);

  // Exact episode code: "BIB-041", "bib 41"
  const code = text.match(/^([a-z]{1,8})[-\s#]?(\d{1,5})$/i);
  if (code && (!opts.kinds || opts.kinds.includes('episode'))) {
    const e = d.prepare(`SELECT e.id FROM episodes e JOIN projects p ON p.id = e.project_id WHERE p.code = ? AND e.number = ? AND e.deleted_at IS NULL`).get(code[1], Number(code[2])) as { id: number } | undefined;
    if (e) {
      const it = episodeItems([e.id])[0];
      hits.push({ kind: 'episode', id: e.id, title: `${it.code} · ${it.title}`, subtitle: `${it.projectName} · ${it.phase.toLowerCase()} · ${it.readiness}%`, archived: !!it.archivedAt, href: `/episodes/${e.id}` });
    }
  }

  const fts = ftsQuery(text);
  if (!fts) return hits;
  const kindFilter = opts.kinds?.length ? `AND kind IN (${placeholders(opts.kinds)})` : '';
  const rows = d
    .prepare(
      `SELECT kind, ref_id, title, archived, bm25(search_index, 8.0, 1.0) AS rank,
         snippet(search_index, 3, '', '', '…', 10) AS snip
       FROM search_index WHERE search_index MATCH ? ${kindFilter} ORDER BY archived, rank LIMIT ?`,
    )
    .all(fts, ...(opts.kinds ?? []), limit) as { kind: SearchKind; ref_id: number; title: string; archived: number; rank: number; snip: string }[];

  // Enrich in one query per kind.
  const byKind = new Map<SearchKind, number[]>();
  for (const r of rows) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.ref_id]);
  const extra = new Map<string, Record<string, unknown>>();
  const enrich = (kind: SearchKind, sql: string) => {
    const ids = byKind.get(kind);
    if (!ids?.length) return;
    for (const r of d.prepare(sql.replace('$IDS', placeholders(ids))).all(...ids) as Record<string, unknown>[]) extra.set(`${kind}:${r.id}`, r);
  };
  enrich('episode', `SELECT e.id, p.code, e.number, p.name AS project, e.phase, e.readiness FROM episodes e JOIN projects p ON p.id = e.project_id WHERE e.id IN ($IDS)`);
  enrich('idea', `SELECT i.id, i.status, p.name AS project FROM ideas i LEFT JOIN projects p ON p.id = i.project_id WHERE i.id IN ($IDS)`);
  enrich('source', `SELECT s.id, s.type, s.author FROM sources s WHERE s.id IN ($IDS)`);
  enrich('insight', `SELECT n.id, n.source_id, s.title AS source FROM insights n LEFT JOIN sources s ON s.id = n.source_id WHERE n.id IN ($IDS)`);
  enrich('project', `SELECT id, code, status FROM projects WHERE id IN ($IDS)`);
  enrich('series', `SELECT s.id, p.name AS project FROM series s JOIN projects p ON p.id = s.project_id WHERE s.id IN ($IDS)`);
  enrich('person', `SELECT id, kind FROM people WHERE id IN ($IDS)`);
  enrich('asset', `SELECT a.id, a.episode_id, a.kind, e.title AS episode FROM assets a JOIN episodes e ON e.id = a.episode_id WHERE a.id IN ($IDS)`);

  for (const r of rows) {
    if (r.kind === 'episode' && hits.some((h) => h.kind === 'episode' && h.id === r.ref_id)) continue;
    const x = extra.get(`${r.kind}:${r.ref_id}`) ?? {};
    let title = r.title;
    let subtitle = '';
    switch (r.kind) {
      case 'episode':
        title = `${episodeCode(x.code as string, x.number as number)} · ${r.title}`;
        subtitle = `${x.project} · ${String(x.phase).toLowerCase()} · ${x.readiness}%`;
        break;
      case 'idea':
        subtitle = `Idea · ${String(x.status ?? '').toLowerCase()}${x.project ? ` · ${x.project}` : ''}`;
        break;
      case 'source':
        subtitle = `${String(x.type ?? '').toLowerCase()}${x.author ? ` · ${x.author}` : ''}`;
        break;
      case 'insight':
        subtitle = `Insight${x.source ? ` · ${x.source}` : ''}`;
        break;
      case 'project':
        subtitle = `Project · ${x.code}`;
        break;
      case 'series':
        subtitle = `Series · ${x.project}`;
        break;
      case 'person':
        subtitle = `Person · ${String(x.kind ?? '').toLowerCase()}`;
        break;
      case 'asset':
        subtitle = `Asset · ${String(x.kind ?? '').toLowerCase()} · ${x.episode}`;
        break;
    }
    if (r.snip && r.snip.trim() && r.kind !== 'episode') subtitle += ` — ${r.snip.trim().slice(0, 90)}`;
    hits.push({ kind: r.kind, id: r.ref_id, title, subtitle, archived: !!r.archived, href: KIND_HREF[r.kind](r.ref_id, x) });
  }
  return hits;
}

// =============================================================== similarity

/**
 * Similarity provider seam. V1 uses BM25 over the FTS index with an OR-query of the most
 * distinctive terms. A future provider can use the `embeddings` table instead without
 * changing callers.
 */
export interface SimilarityProvider {
  similarEpisodes(text: string, opts: { excludeId?: number; limit: number }): { id: number; score: number }[];
}

const STOP = new Set(
  'a an and are as at be but by for from has have he her his how i if in into is it its me my no not of on or our she so that the their them they this to us was we what when where which who why will with you your do does did can could should would people about'.split(' '),
);

export const ftsSimilarity: SimilarityProvider = {
  similarEpisodes(text, { excludeId, limit }) {
    const terms = [...new Set(text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)))].slice(0, 16);
    if (!terms.length) return [];
    const q = terms.map((t) => `"${t}"`).join(' OR ');
    const rows = db()
      .prepare(`SELECT ref_id AS id, bm25(search_index, 6.0, 1.0) AS rank FROM search_index WHERE search_index MATCH ? AND kind = 'episode' ORDER BY rank LIMIT ?`)
      .all(q, limit + 1) as { id: number; rank: number }[];
    return rows.filter((r) => r.id !== excludeId).slice(0, limit).map((r) => ({ id: r.id, score: -r.rank }));
  },
};

export function similarEpisodes(input: { episodeId?: number; text?: string; limit?: number }, provider: SimilarityProvider = ftsSimilarity) {
  let text = input.text ?? '';
  if (input.episodeId) {
    const e = episodeRow(input.episodeId);
    text = `${e.title} ${e.title} ${e.core_idea} ${e.hook} ${e.description}`;
  }
  if (!text.trim()) throw invalid('Nothing to compare.');
  const res = provider.similarEpisodes(text, { excludeId: input.episodeId, limit: input.limit ?? 8 });
  if (!res.length) return [];
  const max = res[0].score || 1;
  const items = episodeItems(res.map((r) => r.id));
  const scores = new Map(res.map((r) => [r.id, Math.round((r.score / max) * 100)]));
  return items.map((it) => ({ ...it, similarity: scores.get(it.id) ?? 0 }));
}

// =============================================================== archive & trash

const TRASH: Record<string, { table: string; title: string; kind: SearchKind }> = {
  episode: { table: 'episodes', title: 'title', kind: 'episode' },
  idea: { table: 'ideas', title: 'title', kind: 'idea' },
  source: { table: 'sources', title: 'title', kind: 'source' },
  project: { table: 'projects', title: 'name', kind: 'project' },
  series: { table: 'series', title: 'title', kind: 'series' },
};

export function archiveAndTrash() {
  const d = db();
  const out: Record<string, { archived: unknown[]; deleted: unknown[] }> = {};
  for (const [kind, t] of Object.entries(TRASH)) {
    out[kind] = {
      archived: d.prepare(`SELECT id, ${t.title} AS title, archived_at AS at FROM ${t.table} WHERE archived_at IS NOT NULL AND deleted_at IS NULL ORDER BY archived_at DESC LIMIT 200`).all(),
      deleted: d.prepare(`SELECT id, ${t.title} AS title, deleted_at AS at FROM ${t.table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200`).all(),
    };
  }
  return out;
}

export function restoreFromTrash(kind: string, id: number) {
  const t = TRASH[kind];
  if (!t) throw invalid('Unknown kind');
  const n = db().prepare(`UPDATE ${t.table} SET deleted_at = NULL WHERE id = ?`).run(id).changes;
  if (!n) throw notFound(kind, id);
  if (kind === 'episode') recomputeEpisodes([id]);
}

/** Permanent deletion. Only allowed for items already in the trash. */
export function purge(kind: string, id: number) {
  const t = TRASH[kind];
  if (!t) throw invalid('Unknown kind');
  const row = db().prepare(`SELECT deleted_at FROM ${t.table} WHERE id = ?`).get(id) as { deleted_at: string | null } | undefined;
  if (!row) throw notFound(kind, id);
  if (!row.deleted_at) throw invalid('Move it to the trash first. Permanent deletion only works from the trash.');
  db().transaction(() => {
    if (kind === 'project') {
      const n = (db().prepare('SELECT count(*) AS c FROM episodes WHERE project_id = ?').get(id) as { c: number }).c;
      if (n) throw invalid('This project still owns episodes (some may be in the trash). Purge those first.');
      db().prepare('DELETE FROM series WHERE project_id = ? AND deleted_at IS NOT NULL').run(id);
    }
    if (kind === 'series') db().prepare('UPDATE episodes SET series_id = NULL WHERE series_id = ?').run(id);
    db().prepare(`DELETE FROM ${t.table} WHERE id = ?`).run(id);
  })();
}

export { SEARCH_KINDS };
