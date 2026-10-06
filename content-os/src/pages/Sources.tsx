import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus, Search, UserPlus } from 'lucide-react';
import { SOURCE_STATUSES, SOURCE_TYPES } from '../../shared/domain';
import { api } from '../lib/api';
import { useAction, useDebounced, useMeta } from '../lib/hooks';
import type { Source } from '../lib/types';
import { num, titleCase } from '../lib/format';
import { Button, Empty, ErrorState, Field, Input, Modal, Select, Skeleton, Tabs, cx } from '../components/ui';
import { SourceDialog } from '../components/forms';
import { PageShell } from '../components/Layout';

const STATUS_TONE: Record<string, string> = { QUEUED: 'bg-hover text-ink-2', IN_PROGRESS: 'bg-progress-bg text-progress-text', PROCESSED: 'bg-done-bg text-done-text', EXHAUSTED: 'bg-ink text-surface' };

export default function Sources() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'people' || params.get('person') ? 'people' : 'sources';
  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDebounced(q, 200);
  const type = params.get('type') ?? '';
  const status = params.get('status') ?? '';
  const project = params.get('project') ?? '';
  const sort = params.get('sort') ?? 'episodes';
  const meta = useMeta();
  const [creating, setCreating] = useState(false);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const list = useQuery({
    queryKey: ['sources', dq, type, status, project, sort],
    queryFn: () => api.get<Source[]>(`/sources?sort=${sort}&q=${encodeURIComponent(dq)}&type=${type}&status=${status}&projectId=${project}`),
    placeholderData: (p) => p,
    enabled: tab === 'sources',
  });

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading font-semibold">Source library</h1>
          <p className="mt-0.5 text-ui text-ink-2">Books, people, scripture, interviews — and exactly what each one has produced.</p>
        </div>
        <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
          Add source
        </Button>
      </div>
      <Tabs
        className="mb-3"
        value={tab}
        onChange={(t) => setParams(t === 'people' ? { tab: 'people' } : {})}
        tabs={[
          { value: 'sources', label: 'Sources' },
          { value: 'people', label: 'People' },
        ]}
      />
      {tab === 'people' ? (
        <People />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author, notes…" className="pl-8" />
            </div>
            <Select value={type} onChange={(e) => set('type', e.target.value)} className="w-auto" aria-label="Type">
              <option value="">All types</option>
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => set('status', e.target.value)} className="w-auto" aria-label="Processing status">
              <option value="">Any status</option>
              {SOURCE_STATUSES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </Select>
            <Select value={project} onChange={(e) => set('project', e.target.value)} className="w-auto" aria-label="Project">
              <option value="">All projects</option>
              {meta.data?.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => set('sort', e.target.value)} className="w-auto" aria-label="Sort">
              <option value="episodes">Most episodes</option>
              <option value="title">Title</option>
              <option value="recent">Recently updated</option>
            </Select>
          </div>
          {list.error ? (
            <ErrorState error={list.error} />
          ) : !list.data ? (
            <Skeleton className="h-96" />
          ) : list.data.length === 0 ? (
            <Empty icon={<BookOpen className="size-6" />} title="No sources match" action={<Button onClick={() => setCreating(true)}>Add a source</Button>} />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
              <table className="w-full min-w-[760px] text-ui">
                <thead className="border-b border-line bg-surface-2 text-left text-caption font-medium text-ink-3">
                  <tr>
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Processing</th>
                    <th className="px-2 py-2 font-medium" title="Episodes produced vs. your estimated potential">
                      Episodes produced
                    </th>
                    <th className="px-2 py-2 text-right font-medium">Published</th>
                    <th className="px-2 py-2 text-right font-medium">Insights</th>
                    <th className="px-4 py-2 text-right font-medium">Ideas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.data.map((s) => {
                    const pot = s.potential ?? 0;
                    const eps = s.episode_count ?? 0;
                    return (
                      <tr key={s.id} className="hover:bg-hover">
                        <td className="max-w-80 px-4 py-2">
                          <Link to={`/sources/${s.id}`} className="block truncate font-medium hover:underline">
                            {s.title}
                          </Link>
                          <span className="block truncate text-caption text-ink-3">{[s.author, s.citation, s.project_name].filter(Boolean).join(' — ') || '—'}</span>
                        </td>
                        <td className="px-2 py-2 text-ui-sm text-ink-2">{titleCase(s.type)}</td>
                        <td className="px-2 py-2">
                          <span className={cx('rounded px-1.5 py-px text-caption font-medium', STATUS_TONE[s.status])}>{titleCase(s.status)}</span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="tabular w-14 text-ui-sm">
                              {num(eps)}
                              {pot ? <span className="text-ink-3"> / {num(pot)}</span> : ''}
                            </span>
                            {pot > 0 && (
                              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-track" title={`${Math.round((eps / pot) * 100)}% of potential used`}>
                                <span className="block h-full rounded-full bg-seq-3" style={{ width: `${Math.min(100, (eps / pot) * 100)}%` }} />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="tabular px-2 py-2 text-right text-ui-sm">{num(s.published_count ?? 0)}</td>
                        <td className="tabular px-2 py-2 text-right text-ui-sm">{num(s.insight_count ?? 0)}</td>
                        <td className="tabular px-4 py-2 text-right text-ui-sm">{num(s.idea_count ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <SourceDialog open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  );
}

interface Person {
  id: number;
  name: string;
  kind: string;
  bio: string;
  source_count: number;
  episode_count: number;
}

function People() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 200);
  const list = useQuery({ queryKey: ['people', dq], queryFn: () => api.get<Person[]>(`/people?q=${encodeURIComponent(dq)}`) });
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', kind: 'Thinker', bio: '' });
  const save = useAction(() => api.post('/people', f), { success: 'Person added', onDone: () => (setAdding(false), setF({ name: '', kind: 'Thinker', bio: '' })) });
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="pl-8" />
        </div>
        <Button icon={<UserPlus className="size-3.5" />} onClick={() => setAdding(true)}>
          Add person
        </Button>
      </div>
      {!list.data ? (
        <Skeleton className="h-60" />
      ) : list.data.length === 0 ? (
        <Empty title="No people yet">People are thinkers, authors and figures your sources are about.</Empty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.data.map((p) => (
            <li key={p.id} className="rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
              <div className="text-ui font-medium">{p.name}</div>
              <div className="text-caption text-ink-3">{p.kind}</div>
              <div className="mt-1.5 flex gap-4 text-ui-sm text-ink-2">
                <Link to={`/sources?q=${encodeURIComponent(p.name)}`} className="hover:underline">
                  {p.source_count} source{p.source_count === 1 ? '' : 's'}
                </Link>
                <span>{p.episode_count} episodes</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add person"
        width="max-w-md"
        footer={
          <Button variant="primary" disabled={!f.name.trim()} loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Add person
          </Button>
        }
      >
        <div className="grid gap-3">
          <Field label="Name">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Kind">
            <Input value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} placeholder="Thinker, investor, biblical figure…" />
          </Field>
          <Field label="Bio">
            <Input value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
