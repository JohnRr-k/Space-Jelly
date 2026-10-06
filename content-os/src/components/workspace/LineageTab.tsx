import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronRight, Lightbulb, Link2, ListVideo, Plus, Quote, X } from 'lucide-react';
import { RELATION_KINDS } from '../../../shared/domain';
import { api } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import type { EpisodeDetail, EpisodeListItem, Source } from '../../lib/types';
import { shortDate, titleCase } from '../../lib/format';
import { Button, Empty, Input, Select, Spinner } from '../ui';
import { EpisodeList } from '../EpisodeList';
import { Code, PhaseBadge } from '../status';

/** "Where did this episode come from?" — source → insight → idea → episode, plus attached research. */
export function LineageTab({ d }: { d: EpisodeDetail }) {
  const [adding, setAdding] = useState(false);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [locator, setLocator] = useState('');
  const sources = useQuery({ queryKey: ['sources', 'all'], queryFn: () => api.get<Source[]>('/sources'), enabled: adding });
  const link = useAction(() => api.post(`/episodes/${d.episode.id}/sources`, { sourceIds: [sourceId], locator }), { success: 'Source attached', onDone: () => (setAdding(false), setSourceId(null), setLocator('')) });
  const unlink = useAction((sid: number) => api.del(`/episodes/${d.episode.id}/sources/${sid}`), { success: 'Source detached' });
  const unlinkInsight = useAction((iid: number) => api.del(`/episodes/${d.episode.id}/insights/${iid}`));

  const chain: { icon: typeof BookOpen; label: string; title: string; href?: string }[] = [];
  if (d.idea?.source_id) chain.push({ icon: BookOpen, label: 'Source', title: d.idea.source_title ?? '', href: `/sources/${d.idea.source_id}` });
  else if (d.sources[0]) chain.push({ icon: BookOpen, label: 'Source', title: d.sources[0].title, href: `/sources/${d.sources[0].id}` });
  if (d.idea?.insight_statement) chain.push({ icon: Quote, label: 'Insight', title: d.idea.insight_statement });
  else if (d.insights[0]) chain.push({ icon: Quote, label: 'Insight', title: d.insights[0].statement, href: d.insights[0].source_id ? `/sources/${d.insights[0].source_id}` : undefined });
  if (d.idea) chain.push({ icon: Lightbulb, label: `Idea · ${shortDate(d.idea.created_at)}`, title: d.idea.title, href: `/ideas?open=${d.idea.id}` });
  chain.push({ icon: ListVideo, label: 'Episode', title: d.episode.title });

  return (
    <div className="grid gap-5">
      <div>
        <h3 className="mb-2 text-ui-sm font-semibold text-ink-2">Origin</h3>
        {chain.length === 1 ? (
          <p className="text-ui-sm text-ink-3">No recorded origin. Attach a source below, or create future episodes from ideas and insights so lineage is captured automatically.</p>
        ) : (
          <ol className="flex flex-wrap items-stretch gap-1.5">
            {chain.map((c, i) => {
              const body = (
                <>
                  <span className="flex items-center gap-1 text-caption text-ink-3">
                    <c.icon className="size-3" /> {c.label}
                  </span>
                  <span className="line-clamp-2 text-ui-sm text-ink">{c.title}</span>
                </>
              );
              return (
                <li key={i} className="flex items-center gap-1.5">
                  {c.href ? (
                    <Link to={c.href} className="block max-w-60 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 hover:border-line-strong hover:bg-hover">
                      {body}
                    </Link>
                  ) : (
                    <div className="max-w-60 rounded-md border border-line bg-surface-2 px-2.5 py-1.5">{body}</div>
                  )}
                  {i < chain.length - 1 && <ChevronRight className="size-4 text-ink-3" />}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-ui-sm font-semibold text-ink-2">Sources</h3>
          {!adding && (
            <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
              Attach source
            </Button>
          )}
        </div>
        {adding && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-2 p-2">
            <Select className="min-w-60 flex-1" value={sourceId ?? ''} onChange={(e) => setSourceId(Number(e.target.value) || null)} data-autofocus>
              <option value="">{sources.isLoading ? 'Loading…' : 'Choose a source…'}</option>
              {sources.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                  {s.author ? ` — ${s.author}` : ''}
                </option>
              ))}
            </Select>
            <Input className="w-48" placeholder="Page, chapter, verse…" value={locator} onChange={(e) => setLocator(e.target.value)} />
            <Button variant="primary" size="sm" disabled={!sourceId} loading={link.isPending} onClick={() => link.mutate(undefined)}>
              Attach
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        )}
        {d.sources.length === 0 ? (
          <p className="text-ui-sm text-ink-3">No sources attached.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {d.sources.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                <BookOpen className="size-3.5 text-ink-3" />
                <Link to={`/sources/${s.id}`} className="min-w-0 truncate text-ui font-medium hover:underline">
                  {s.title}
                </Link>
                <span className="text-caption text-ink-3">
                  {titleCase(s.type)}
                  {s.author ? ` — ${s.author}` : ''}
                  {s.locator ? ` — ${s.locator}` : ''}
                </span>
                <button className="ml-auto rounded p-1 text-ink-3 hover:bg-hover hover:text-ink" aria-label={`Detach ${s.title}`} onClick={() => unlink.mutate(s.id)}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-ui-sm font-semibold text-ink-2">Insights used</h3>
        {d.insights.length === 0 ? (
          <p className="text-ui-sm text-ink-3">No insights linked. Capture insights on a source page, then turn them into ideas or link them here.</p>
        ) : (
          <ul className="grid gap-2">
            {d.insights.map((i) => (
              <li key={i.id} className="flex items-start gap-2 rounded-md border-l-2 border-accent/50 bg-surface-2 px-3 py-2">
                <Quote className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <p className="text-ui text-ink">{i.statement}</p>
                  {i.source_title && (
                    <Link to={`/sources/${i.source_id}`} className="text-caption text-ink-3 hover:underline">
                      {i.source_title}
                      {i.locator ? ` — ${i.locator}` : ''}
                    </Link>
                  )}
                </div>
                <button className="rounded p-1 text-ink-3 hover:bg-hover hover:text-ink" aria-label="Unlink insight" onClick={() => unlinkInsight.mutate(i.id)}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function RelatedTab({ d }: { d: EpisodeDetail }) {
  const similar = useQuery({
    queryKey: ['similar', d.episode.id],
    queryFn: () => api.post<(EpisodeListItem & { similarity: number })[]>('/similar', { episodeId: d.episode.id, limit: 8 }),
  });
  const relate = useAction((a: { otherId: number; kind: string }) => api.post(`/episodes/${d.episode.id}/relations`, a), { success: 'Linked' });
  const unrelate = useAction((otherId: number) => api.del(`/episodes/${d.episode.id}/relations/${otherId}`), { success: 'Unlinked' });
  const [kind, setKind] = useState('RELATED');
  const relatedIds = new Set(d.related.map((r) => r.episode.id));

  return (
    <div className="grid gap-5">
      <div>
        <h3 className="mb-2 text-ui-sm font-semibold text-ink-2">Linked episodes</h3>
        <EpisodeList
          items={d.related.map((r) => r.episode)}
          showStrip={false}
          dense
          empty={<p className="text-ui-sm text-ink-3">No linked episodes. Link sequels, variants, duplicates or related ideas from the suggestions below.</p>}
          right={(e) => {
            const r = d.related.find((x) => x.episode.id === e.id)!;
            return (
              <span className="flex items-center gap-1">
                <span className="rounded bg-hover px-1.5 text-caption text-ink-2">
                  {titleCase(r.kind)}
                  {r.kind !== 'RELATED' && r.kind !== 'DUPLICATE' ? (r.dir === 'out' ? ' →' : ' ←') : ''}
                </span>
                <button className="relative z-10 rounded p-1 text-ink-3 hover:bg-active hover:text-ink" aria-label="Unlink" onClick={() => unrelate.mutate(e.id)}>
                  <X className="size-3.5" />
                </button>
              </span>
            );
          }}
        />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-ui-sm font-semibold text-ink-2">Similar content</h3>
          <span className="flex items-center gap-2 text-caption text-ink-3">
            Link as
            <Select className="h-7 w-auto text-ui-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
              {RELATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {titleCase(k)}
                </option>
              ))}
            </Select>
          </span>
        </div>
        <p className="mb-2 text-caption text-ink-3">Matched on title, core idea, hook and script text. High matches may be duplicates worth merging or differentiating.</p>
        {similar.isLoading ? (
          <Spinner />
        ) : !similar.data?.length ? (
          <Empty compact title="Nothing similar found" />
        ) : (
          <ul className="divide-y divide-line">
            {similar.data.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2">
                <span className="tabular w-10 text-right text-caption text-ink-3">{e.similarity}%</span>
                <Code>{e.code}</Code>
                <Link to={`/episodes/${e.id}`} className="min-w-0 flex-1 truncate text-ui hover:underline">
                  {e.title}
                </Link>
                <PhaseBadge phase={e.phase} blocked={e.blocked} />
                <Button size="sm" variant="ghost" icon={<Link2 className="size-3.5" />} disabled={relatedIds.has(e.id)} onClick={() => relate.mutate({ otherId: e.id, kind })}>
                  {relatedIds.has(e.id) ? 'Linked' : 'Link'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
