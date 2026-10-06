import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Ban, CalendarClock, CheckCircle2, Clock, Hourglass, Lightbulb, RotateCcw } from 'lucide-react';
import { STAGE_META, PLATFORM_LABEL, type Platform } from '../../shared/domain';
import { api } from '../lib/api';
import type { ActivityItem, Bottleneck, EpisodeListItem, NextAction, ProjectStats } from '../lib/types';
import { fullDate, num, relative, shortDate, time } from '../lib/format';
import { Button, ErrorState, Panel, Skeleton, Tabs, cx } from '../components/ui';
import { FlowChart, ProgressBar, ProgressLegend, TargetMeter } from '../components/charts';
import { EpisodeList } from '../components/EpisodeList';
import { Code, ProjectDot } from '../components/status';
import { PageShell } from '../components/Layout';

export interface DashboardData {
  counts: { total: number; idea: number; inProduction: number; blocked: number; ready: number; scheduled: number; published: number; overdue: number };
  today: { target: number; published: number; publications: number; remaining: number; scheduledToday: number; stageCompletions: number };
  bottleneck: Bottleneck;
  actions: NextAction[];
  projects: { id: number; name: string; code: string; color: string; status: string; stats: ProjectStats }[];
  attention: { blocked: EpisodeListItem[]; overdue: EpisodeListItem[]; stalled: EpisodeListItem[] };
  upcoming: { id: number; platform: Platform; scheduled_at: string; episode_id: number; title: string; code: string }[];
  ideas: { inbox: number; dormant: number };
  activity: ActivityItem[];
}

export function Dashboard() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard'), refetchInterval: 60_000 });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <PageShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-heading font-semibold">Command center</h1>
          <p className="mt-0.5 text-ui text-ink-2">
            {fullDate()}
            {d && (
              <>
                {' — '}
                {num(d.counts.total)} episodes across {d.projects.length} projects
              </>
            )}
          </p>
        </div>
      </div>
      {!d ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-5">
          <KpiStrip d={d} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <NextActions actions={d.actions} />
            <div className="grid min-w-0 content-start gap-5">
              <TodayPanel d={d} />
              <Panel
                title={
                  <span className="flex items-center gap-2">
                    Bottleneck
                    {d.bottleneck.stage && <span className="rounded bg-accent-subtle px-1.5 text-caption font-semibold text-accent-text">{STAGE_META[d.bottleneck.stage].label}</span>}
                  </span>
                }
                action={
                  d.bottleneck.stage && (
                    <Link to={`/episodes?waitingFor=${d.bottleneck.stage}`} className="text-ui-sm text-accent-text hover:underline">
                      See the queue
                    </Link>
                  )
                }
              >
                <p className="mb-3 text-ui-sm text-ink-2 text-pretty">{d.bottleneck.explanation}</p>
                <FlowChart data={d.bottleneck} />
              </Panel>
            </div>
          </div>
          <ProjectsPanel projects={d.projects} />
          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-[1.2fr_1fr_0.9fr]">
            <AttentionPanel d={d} />
            <ActivityPanel items={d.activity} />
            <UpcomingPanel d={d} />
          </div>
        </div>
      )}
    </PageShell>
  );
}

function KpiStrip({ d }: { d: DashboardData }) {
  const items: { label: string; value: number; href: string; tone?: string; sub?: string }[] = [
    { label: 'Total episodes', value: d.counts.total, href: '/episodes' },
    { label: 'Planned', value: d.counts.idea, href: '/episodes?view=unstarted' },
    { label: 'In production', value: d.counts.inProduction, href: '/board' },
    { label: 'Blocked', value: d.counts.blocked, href: '/episodes?view=blocked', tone: d.counts.blocked ? 'text-blocked-text' : undefined },
    { label: 'Ready to post', value: d.counts.ready, href: '/episodes?view=ready', tone: d.counts.ready ? 'text-done-text' : undefined },
    { label: 'Scheduled', value: d.counts.scheduled, href: '/episodes?view=scheduled' },
    { label: 'Published', value: d.counts.published, href: '/episodes?view=published' },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card sm:grid-cols-4 lg:grid-cols-7">
      {items.map((it) => (
        <Link key={it.label} to={it.href} className="group bg-surface px-4 py-3 transition-colors hover:bg-surface-2">
          <div className="text-caption text-ink-3 group-hover:text-ink-2">{it.label}</div>
          <div className={cx('tabular mt-0.5 text-display font-semibold tracking-tight', it.tone ?? 'text-ink')}>{num(it.value)}</div>
        </Link>
      ))}
      <div className="bg-surface lg:hidden" aria-hidden />
    </div>
  );
}

const ACTION_ICON: Record<NextAction['kind'], typeof Clock> = {
  publish: CheckCircle2,
  confirm: CalendarClock,
  unblock: Ban,
  bottleneck: Hourglass,
  urgent: Clock,
  finish: CheckCircle2,
  ideas: Lightbulb,
  stalled: RotateCcw,
  start: ArrowRight,
};

export function NextActions({ actions, title = 'Next best action' }: { actions: NextAction[]; title?: string }) {
  const navigate = useNavigate();
  if (!actions.length)
    return (
      <Panel title={title}>
        <p className="text-ui text-ink-2">Nothing urgent. Pick something from the board or capture new ideas.</p>
      </Panel>
    );
  const [top, ...rest] = actions;
  const TopIcon = ACTION_ICON[top.kind];
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <div className="border-b border-line bg-accent-subtle/60 p-5">
        <div className="flex items-center gap-2 text-ui-sm font-medium text-accent-text">
          <TopIcon className="size-4" /> {title}
        </div>
        <p className="mt-2 text-[1.5rem] leading-tight font-semibold tracking-tight text-ink text-balance">{top.title}</p>
        <p className="mt-1.5 max-w-2xl text-ui text-ink-2 text-pretty">{top.reason}</p>
        <Button variant="primary" className="mt-4" onClick={() => navigate(top.href)} icon={<ArrowRight className="size-3.5" />}>
          Do this now
        </Button>
      </div>
      <ul className="divide-y divide-line">
        {rest.map((a) => {
          const Icon = ACTION_ICON[a.kind];
          return (
            <li key={a.id}>
              <Link to={a.href} className="group flex items-start gap-3 px-5 py-2.5 hover:bg-hover">
                <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui font-medium text-ink">{a.title}</span>
                  <span className="block truncate text-ui-sm text-ink-3" title={a.reason}>
                    {a.reason}
                  </span>
                </span>
                <ArrowRight className="mt-1 size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TodayPanel({ d }: { d: DashboardData }) {
  return (
    <Panel
      title="Today"
      action={
        <Link to="/today" className="text-ui-sm text-accent-text hover:underline">
          Open Today
        </Link>
      }
    >
      <div className="flex items-baseline gap-2">
        <span className="tabular text-display font-semibold">{d.today.published}</span>
        <span className="text-ui text-ink-2">of {d.today.target} episodes published</span>
        <span className={cx('ml-auto tabular text-ui font-medium', d.today.remaining ? 'text-ink' : 'text-done-text')}>{d.today.remaining ? `${d.today.remaining} to go` : 'Target hit'}</span>
      </div>
      <TargetMeter done={d.today.published} target={d.today.target} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-ui-sm">
        <div>
          <div className="text-caption text-ink-3">Ready now</div>
          <div className="tabular font-medium">{d.counts.ready}</div>
        </div>
        <div>
          <div className="text-caption text-ink-3">Scheduled today</div>
          <div className="tabular font-medium">{d.today.scheduledToday}</div>
        </div>
        <div>
          <div className="text-caption text-ink-3">Stages finished</div>
          <div className="tabular font-medium">{d.today.stageCompletions}</div>
        </div>
      </div>
      {d.counts.ready < d.today.remaining && (
        <p className="mt-3 rounded-md bg-progress-bg px-2.5 py-1.5 text-ui-sm text-progress-text">
          Only {d.counts.ready} ready — {d.today.remaining - d.counts.ready} short of today’s target. Finish near-ready episodes first.
        </p>
      )}
    </Panel>
  );
}

function ProjectsPanel({ projects }: { projects: DashboardData['projects'] }) {
  return (
    <Panel
      title="Project progress"
      action={<ProgressLegend className="hidden md:flex" />}
      bodyClass="px-0 pb-1"
    >
      <div className="divide-y divide-line">
        {projects.map((p) => {
          const s = p.stats;
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="grid grid-cols-1 gap-x-6 gap-y-1.5 px-4 py-3 hover:bg-hover md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] md:items-center">
              <div className="flex min-w-0 items-center gap-2">
                <ProjectDot color={p.color} />
                <span className="truncate text-ui font-medium">{p.name}</span>
              </div>
              <div className="min-w-0">
                <ProgressBar stats={s} />
                <div className="mt-1 flex flex-wrap gap-x-3 text-caption text-ink-3">
                  <span className="tabular">
                    <b className="font-medium text-ink-2">{num(s.total)}</b>
                    {s.target ? ` of ${num(s.target)}` : ''} created
                  </span>
                  <span className="tabular">{num(s.inProduction)} in production</span>
                  {s.blocked > 0 && <span className="tabular text-blocked-text">{s.blocked} blocked</span>}
                  <span className="tabular">{num(s.ready)} ready</span>
                </div>
              </div>
              <div className="flex gap-5 text-right md:justify-end">
                <div>
                  <div className="text-caption text-ink-3">Published</div>
                  <div className="tabular text-ui font-semibold">{num(s.published)}</div>
                </div>
                <div title="Effort-weighted production completion against the full target">
                  <div className="text-caption text-ink-3">Completion</div>
                  <div className="tabular text-ui font-semibold">{(s.completion * 100).toFixed(s.completion < 0.1 ? 1 : 0)}%</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

function AttentionPanel({ d }: { d: DashboardData }) {
  const [tab, setTab] = useState<'blocked' | 'overdue' | 'stalled'>(d.attention.blocked.length ? 'blocked' : d.attention.overdue.length ? 'overdue' : 'stalled');
  const items = d.attention[tab];
  const href = tab === 'blocked' ? '/episodes?view=blocked' : tab === 'overdue' ? '/episodes?due=overdue' : '/episodes?view=stalled';
  return (
    <Panel title="Needs attention" action={<Link to={href} className="text-ui-sm text-accent-text hover:underline">View all</Link>}>
      <Tabs
        className="-mx-4 mb-2 px-2"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'blocked', label: 'Blocked', count: d.counts.blocked },
          { value: 'overdue', label: 'Overdue', count: d.counts.overdue },
          { value: 'stalled', label: 'Stalled', count: d.attention.stalled.length >= 6 ? null : d.attention.stalled.length },
        ]}
      />
      <EpisodeList items={items} showStrip={false} dense empty={<p className="py-6 text-center text-ui-sm text-ink-3">Nothing {tab}. Good.</p>} />
    </Panel>
  );
}

export function ActivityPanel({ items, title = 'Recent activity' }: { items: ActivityItem[]; title?: string }) {
  return (
    <Panel title={title} action={<Link to="/activity" className="text-ui-sm text-accent-text hover:underline">All activity</Link>}>
      <ActivityFeed items={items} />
    </Panel>
  );
}

export function ActivityFeed({ items }: { items: { id: number; at: string; actor: string; action: string; summary: string; episodeId?: number | null; episode_id?: number | null }[] }) {
  if (!items.length) return <p className="py-6 text-center text-ui-sm text-ink-3">No activity yet.</p>;
  return (
    <ol className="relative space-y-2.5">
      {items.map((a) => {
        const ep = a.episodeId ?? a.episode_id;
        const dot = a.action === 'published' ? 'bg-accent' : a.action === 'blocked' ? 'bg-blocked' : a.action === 'stage' ? 'bg-done' : 'bg-ink-3/50';
        const body = (
          <>
            <span className={cx('mt-1.5 size-1.5 shrink-0 rounded-full', dot)} />
            <span className="min-w-0 flex-1">
              <span className="block text-ui-sm text-ink line-clamp-2">{a.summary}</span>
              <span className="text-caption text-ink-3">
                {relative(a.at)}
                {a.actor !== 'you' && <span className="ml-1.5 rounded bg-hover px-1">{a.actor}</span>}
              </span>
            </span>
          </>
        );
        return (
          <li key={a.id}>
            {ep ? (
              <Link to={`/episodes/${ep}`} className="-mx-1 flex gap-2.5 rounded px-1 hover:bg-hover">
                {body}
              </Link>
            ) : (
              <div className="flex gap-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function UpcomingPanel({ d }: { d: DashboardData }) {
  return (
    <Panel title="Scheduled next" action={<Link to="/episodes?view=scheduled" className="text-ui-sm text-accent-text hover:underline">All scheduled</Link>}>
      {d.upcoming.length === 0 ? (
        <p className="py-6 text-center text-ui-sm text-ink-3">Nothing scheduled. Ready episodes can be scheduled in bulk from the library.</p>
      ) : (
        <ul className="space-y-2">
          {d.upcoming.map((u) => {
            const overdue = new Date(u.scheduled_at).getTime() < Date.now();
            return (
              <li key={u.id}>
                <Link to={`/episodes/${u.episode_id}`} className="-mx-1 flex items-center gap-3 rounded px-1 py-0.5 hover:bg-hover">
                  <span className={cx('w-16 shrink-0 text-caption tabular', overdue ? 'font-medium text-blocked-text' : 'text-ink-2')}>
                    {shortDate(u.scheduled_at)}
                    <span className="block text-ink-3">{overdue ? 'unconfirmed' : time(u.scheduled_at)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui-sm text-ink">{u.title}</span>
                    <span className="flex items-center gap-1.5 text-caption text-ink-3">
                      <Code>{u.code}</Code> {PLATFORM_LABEL[u.platform]}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {(d.ideas.inbox > 0 || d.ideas.dormant > 0) && (
        <div className="mt-4 border-t border-line pt-3 text-ui-sm text-ink-2">
          <Link to="/ideas" className="hover:underline">
            {d.ideas.inbox} ideas in the inbox
          </Link>
          {' · '}
          <Link to="/resurface" className="hover:underline">
            {d.ideas.dormant} dormant
          </Link>
        </div>
      )}
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-20" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
