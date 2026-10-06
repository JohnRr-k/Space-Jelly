import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAction } from '../lib/hooks';
import { relative } from '../lib/format';
import { Button, ErrorState, PageHeader, Panel, Skeleton, Tabs, useConfirm } from '../components/ui';
import { PageShell } from '../components/Layout';

type Kind = 'episode' | 'idea' | 'source' | 'project' | 'series';
type Data = Record<Kind, { archived: { id: number; title: string; at: string }[]; deleted: { id: number; title: string; at: string }[] }>;
const LABEL: Record<Kind, string> = { episode: 'Episodes', idea: 'Ideas', source: 'Sources', project: 'Projects', series: 'Series' };
const HREF: Record<Kind, (id: number) => string> = { episode: (id) => `/episodes/${id}`, idea: (id) => `/ideas?open=${id}`, source: (id) => `/sources/${id}`, project: (id) => `/projects/${id}`, series: (id) => `/series/${id}` };
const UNARCHIVE: Record<Kind, (id: number) => Promise<unknown>> = {
  episode: (id) => api.post(`/episodes/${id}/archive`, { archived: false }),
  idea: (id) => api.patch(`/ideas/${id}`, { archived: false }),
  source: (id) => api.patch(`/sources/${id}`, { archived: false }),
  project: (id) => api.patch(`/projects/${id}`, { archived: false }),
  series: (id) => api.patch(`/series/${id}`, { archived: false }),
};

/** Archived = out of the way but searchable. Trash = soft-deleted, restorable. Purge = permanent, only from trash. */
export default function ArchivePage() {
  const [tab, setTab] = useState<'archived' | 'deleted'>('archived');
  const q = useQuery({ queryKey: ['archive'], queryFn: () => api.get<Data>('/archive') });
  const confirm = useConfirm();
  const unarchive = useAction((a: { kind: Kind; id: number }) => UNARCHIVE[a.kind](a.id), { success: 'Restored' });
  const restore = useAction((a: { kind: Kind; id: number }) => api.post(`/trash/${a.kind}/${a.id}/restore`), { success: 'Restored from trash' });
  const purge = useAction((a: { kind: Kind; id: number }) => api.del(`/trash/${a.kind}/${a.id}`), { success: 'Permanently deleted' });
  const count = (t: 'archived' | 'deleted') => (q.data ? Object.values(q.data).reduce((n, v) => n + v[t].length, 0) : null);
  return (
    <PageShell>
      <PageHeader title="Archive & trash" subtitle="Archived items stay searchable and can come back any time. Trash is restorable too; permanent deletion only happens from here." />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'archived', label: 'Archived', count: count('archived') }, { value: 'deleted', label: 'Trash', count: count('deleted') }]} />
      {q.error ? (
        <ErrorState error={q.error} />
      ) : !q.data ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(Object.keys(LABEL) as Kind[]).map((k) => {
            const items = q.data[k][tab];
            return (
              <Panel key={k} title={`${LABEL[k]} (${items.length})`}>
                {items.length === 0 ? (
                  <p className="text-ui-sm text-ink-3">Nothing {tab === 'archived' ? 'archived' : 'in the trash'}.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 py-1.5">
                        {tab === 'archived' ? <Archive className="size-3.5 text-ink-3" /> : <Trash2 className="size-3.5 text-ink-3" />}
                        {tab === 'archived' ? (
                          <Link to={HREF[k](it.id)} className="min-w-0 flex-1 truncate text-ui hover:underline">
                            {it.title}
                          </Link>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-ui">{it.title}</span>
                        )}
                        <span className="text-caption text-ink-3">{relative(it.at)}</span>
                        {tab === 'archived' ? (
                          <Button size="sm" variant="ghost" onClick={() => unarchive.mutate({ kind: k, id: it.id })}>
                            Unarchive
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" onClick={() => restore.mutate({ kind: k, id: it.id })}>
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blocked-text"
                              onClick={async () => {
                                if (await confirm.ask(`Permanently delete “${it.title}”?`, 'This cannot be undone. Related stage history, assets and publications of this item are deleted with it.', 'Delete forever')) purge.mutate({ kind: k, id: it.id });
                              }}
                            >
                              Delete forever
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
      )}
      {confirm.node}
    </PageShell>
  );
}
