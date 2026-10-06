import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ActivityItem } from '../lib/types';
import { Button, ErrorState, PageHeader, Panel, Skeleton } from '../components/ui';
import { ActivityFeed } from './Dashboard';
import { PageShell } from '../components/Layout';

export default function ActivityPage() {
  const q = useInfiniteQuery({
    queryKey: ['activity'],
    queryFn: ({ pageParam }) => api.get<ActivityItem[]>(`/activity?limit=60${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (last) => (last.length === 60 ? last[last.length - 1].at : undefined),
  });
  const items = q.data?.pages.flat() ?? [];
  const byDay = new Map<string, ActivityItem[]>();
  for (const a of items) {
    const day = new Date(a.at).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
    byDay.set(day, [...(byDay.get(day) ?? []), a]);
  }
  return (
    <PageShell>
      <PageHeader title="Activity" subtitle="Meaningful changes only: creation, stage progress, blocks, publishing, assets, priorities and dates." />
      {q.error ? (
        <ErrorState error={q.error} />
      ) : !q.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid max-w-3xl gap-4">
          {[...byDay.entries()].map(([day, list]) => (
            <Panel key={day} title={day}>
              <ActivityFeed items={list} />
            </Panel>
          ))}
          {q.hasNextPage && (
            <Button onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage} className="justify-self-start">
              Load older activity
            </Button>
          )}
        </div>
      )}
    </PageShell>
  );
}
