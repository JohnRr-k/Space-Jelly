import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { EpisodeQuery } from '../lib/types';
import { num } from '../lib/format';
import { Panel, Spinner } from './ui';
import { EpisodeList } from './EpisodeList';

/** A bounded episode list for detail pages, with a link into the full library for the same query. */
export function EpisodeTablePreview({ query, title, href, limit = 50 }: { query: EpisodeQuery; title: string; href: string; limit?: number }) {
  const q = useQuery({ queryKey: ['episodes', 'preview', query, limit], queryFn: () => api.episodes({ ...query, limit }) });
  return (
    <Panel
      title={`${title}${q.data ? ` (${num(q.data.total)})` : ''}`}
      action={
        <Link to={href} className="text-ui-sm text-accent-text hover:underline">
          Open in library
        </Link>
      }
    >
      {q.isLoading ? <Spinner /> : <EpisodeList items={q.data?.items ?? []} empty={<p className="py-6 text-center text-ui-sm text-ink-3">No episodes yet.</p>} />}
      {q.data && q.data.total > q.data.items.length && (
        <Link to={href} className="mt-2 inline-block text-ui-sm text-accent-text hover:underline">
          {num(q.data.total - q.data.items.length)} more in the library
        </Link>
      )}
    </Panel>
  );
}
