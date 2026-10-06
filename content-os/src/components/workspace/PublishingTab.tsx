import { useState } from 'react';
import { BarChart3, ExternalLink, Plus, Radio, Trash2 } from 'lucide-react';
import { PLATFORMS, PLATFORM_LABEL, PUBLICATION_STATUSES, type Platform } from '../../../shared/domain';
import { api } from '../../lib/api';
import { useAction, useMeta } from '../../lib/hooks';
import type { EpisodeDetail, Publication } from '../../lib/types';
import { compact, fromLocalInput, shortDate, time, titleCase, toLocalInput } from '../../lib/format';
import { Button, Empty, Field, IconButton, Input, Modal, Select, Textarea, cx, useConfirm } from '../ui';

const TONE: Record<string, string> = {
  PUBLISHED: 'bg-ink text-surface',
  SCHEDULED: 'bg-sched-bg text-sched-text',
  READY: 'bg-done-bg text-done-text',
  DRAFT: 'bg-hover text-ink-2',
  FAILED: 'bg-blocked-bg text-blocked-text',
  ARCHIVED: 'bg-hover text-ink-3',
};

/** One episode → many platform publications. The episode is never duplicated per platform. */
export function PublishingTab({ d }: { d: EpisodeDetail }) {
  const [editing, setEditing] = useState<Partial<Publication> | null>(null);
  const [metricsFor, setMetricsFor] = useState<Publication | null>(null);
  const confirm = useConfirm();
  const quick = useAction((a: { id: number; patch: Record<string, unknown> }) => api.patch(`/publications/${a.id}`, a.patch), { success: (_r, a) => (a.patch.status === 'PUBLISHED' ? 'Marked published' : 'Saved') });
  const remove = useAction((id: number) => api.del(`/publications/${id}`), { success: 'Publication removed' });
  const caption = d.publications.find((p) => p.caption)?.caption ?? `${d.episode.hook || d.episode.title}\n\n${d.episode.core_idea}`.trim();
  const hashtags = d.publications.find((p) => p.hashtags)?.hashtags ?? d.episode.tags.map((t) => `#${t.replace(/-/g, '')}`).join(' ');

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-ui-sm text-ink-3">
          {d.readiness.ready ? 'Production is complete — this episode can go out.' : `Not production-ready yet (${d.readiness.readiness}%). You can still prepare captions and drafts.`}
        </p>
        <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setEditing({ platform: (d.contentType.defaultPlatforms[0] as Platform) ?? 'INSTAGRAM', status: 'DRAFT', caption, hashtags })}>
          Add publication
        </Button>
      </div>
      {d.publications.length === 0 ? (
        <Empty compact icon={<Radio className="size-5" />} title="Not published anywhere yet">
          Add one record per platform. Scheduling or publishing here updates the Schedule/Publish stages automatically.
        </Empty>
      ) : (
        <div className="grid gap-2">
          {d.publications.map((p) => (
            <div key={p.id} className="rounded-md border border-line px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ui font-semibold">{PLATFORM_LABEL[p.platform as Platform] ?? p.platform}</span>
                {p.account && <span className="text-ui-sm text-ink-3">{p.account}</span>}
                <span className={cx('rounded px-1.5 py-px text-caption font-medium', TONE[p.status])}>{titleCase(p.status)}</span>
                <span className="text-ui-sm text-ink-2 tabular">
                  {p.status === 'PUBLISHED' && p.published_at ? `${shortDate(p.published_at)}, ${time(p.published_at)}` : p.scheduled_at ? `${shortDate(p.scheduled_at)}, ${time(p.scheduled_at)}` : ''}
                </span>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ui-sm text-accent-text hover:underline">
                    View post <ExternalLink className="size-3" />
                  </a>
                )}
                <span className="ml-auto flex items-center gap-1">
                  {p.status !== 'PUBLISHED' && (
                    <Button size="sm" onClick={() => quick.mutate({ id: p.id, patch: { status: 'PUBLISHED' } })}>
                      Mark published
                    </Button>
                  )}
                  {p.status === 'PUBLISHED' && (
                    <IconButton label="Log metrics" onClick={() => setMetricsFor(p)}>
                      <BarChart3 className="size-3.5" />
                    </IconButton>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  <IconButton
                    label="Remove publication"
                    onClick={async () => {
                      if (await confirm.ask('Remove this publication record?', 'It is hidden from the episode; the post itself is not affected.', 'Remove')) remove.mutate(p.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </span>
              </div>
              {p.caption && <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-ui-sm text-ink-2">{p.caption}</p>}
              {p.metrics && (
                <div className="mt-1.5 flex flex-wrap gap-x-4 text-caption text-ink-3 tabular">
                  <span>
                    <b className="font-medium text-ink-2">{compact(p.metrics.views)}</b> views
                  </span>
                  <span>
                    <b className="font-medium text-ink-2">{compact(p.metrics.likes)}</b> likes
                  </span>
                  <span>
                    <b className="font-medium text-ink-2">{compact(p.metrics.saves)}</b> saves
                  </span>
                  <span>
                    <b className="font-medium text-ink-2">{compact(p.metrics.shares)}</b> shares
                  </span>
                  {p.metrics.completion_rate !== null && <span>{Math.round(p.metrics.completion_rate * 100)}% completion</span>}
                  <span>as of {shortDate(p.metrics.captured_at)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {confirm.node}
      <PublicationDialog episodeId={d.episode.id} value={editing} onClose={() => setEditing(null)} />
      <MetricsDialog pub={metricsFor} onClose={() => setMetricsFor(null)} />
    </div>
  );
}

function PublicationDialog({ episodeId, value, onClose }: { episodeId: number; value: Partial<Publication> | null; onClose: () => void }) {
  const meta = useMeta();
  const [f, setF] = useState<Partial<Publication>>({});
  const [last, setLast] = useState<typeof value>(null);
  if (value !== last) {
    setLast(value);
    if (value) setF({ account: meta.data?.settings.default_account ?? '', ...value });
  }
  const save = useAction(
    () => {
      const body = {
        platform: f.platform,
        account: f.account ?? '',
        status: f.status,
        scheduledAt: f.scheduled_at ?? null,
        publishedAt: f.published_at ?? null,
        url: f.url ?? '',
        caption: f.caption ?? '',
        hashtags: f.hashtags ?? '',
        notes: f.notes ?? '',
      };
      return f.id ? api.patch(`/publications/${f.id}`, body) : api.post(`/episodes/${episodeId}/publications`, body);
    },
    { success: 'Publication saved', onDone: onClose },
  );
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={f.id ? 'Edit publication' : 'New publication'}
      width="max-w-xl"
      footer={
        <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
          Save
        </Button>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Platform">
            <Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Account">
            <Input value={f.account ?? ''} onChange={(e) => setF({ ...f, account: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {PUBLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Scheduled for" hint={f.status === 'SCHEDULED' ? 'Required for scheduled posts' : undefined}>
            <Input type="datetime-local" value={toLocalInput(f.scheduled_at)} onChange={(e) => setF({ ...f, scheduled_at: fromLocalInput(e.target.value) })} />
          </Field>
          <Field label="Published at" hint="Defaults to now when marked published">
            <Input type="datetime-local" value={toLocalInput(f.published_at)} onChange={(e) => setF({ ...f, published_at: fromLocalInput(e.target.value) })} />
          </Field>
        </div>
        <Field label="Post URL">
          <Input value={f.url ?? ''} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" />
        </Field>
        <Field label="Caption">
          <Textarea rows={5} value={f.caption ?? ''} onChange={(e) => setF({ ...f, caption: e.target.value })} />
        </Field>
        <Field label="Hashtags">
          <Input value={f.hashtags ?? ''} onChange={(e) => setF({ ...f, hashtags: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function MetricsDialog({ pub, onClose }: { pub: Publication | null; onClose: () => void }) {
  const fields = ['views', 'likes', 'comments', 'shares', 'saves', 'followers_gained'] as const;
  const [m, setM] = useState<Record<string, string>>({});
  const save = useAction(
    () => {
      const body: Record<string, number | null> = {};
      for (const k of fields) body[k] = m[k] ? Number(m[k]) : null;
      body.completion_rate = m.completion_rate ? Number(m.completion_rate) / 100 : null;
      return api.post(`/publications/${pub!.id}/metrics`, body);
    },
    { success: 'Metrics logged', onDone: () => (setM({}), onClose()) },
  );
  return (
    <Modal
      open={!!pub}
      onClose={onClose}
      title="Log performance snapshot"
      width="max-w-md"
      footer={
        <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
          Save snapshot
        </Button>
      }
    >
      <p className="mb-3 text-ui-sm text-ink-3">Snapshots are kept over time, so later analysis can compare growth curves. Platform APIs can fill this automatically later.</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((k) => (
          <Field key={k} label={titleCase(k)}>
            <Input type="number" min={0} inputMode="numeric" value={m[k] ?? ''} onChange={(e) => setM({ ...m, [k]: e.target.value })} />
          </Field>
        ))}
        <Field label="Completion %">
          <Input type="number" min={0} max={100} value={m.completion_rate ?? ''} onChange={(e) => setM({ ...m, completion_rate: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
