import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Meta, UndoPayload } from './types';
import type { Phase, Stage, StageStatus } from '../../shared/domain';
import { useToast } from '../components/toast';

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api.get<Meta>('/meta'), staleTime: 30_000 });
}

/** After any write, everything derived (readiness, counts, bottleneck) may change. Local server → refetch is cheap. */
export function useRefresh() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries(), [qc]);
}

export function useUndo() {
  const refresh = useRefresh();
  const toast = useToast();
  return useCallback(
    async (undo: UndoPayload) => {
      try {
        await api.post('/episodes/undo', undo);
        toast.success('Undone');
        refresh();
      } catch (e) {
        toast.error(e);
      }
    },
    [refresh, toast],
  );
}

/** Generic mutation wrapper: toasts errors, refreshes data, optional success message. */
export function useAction<TArgs, TResult = unknown>(fn: (args: TArgs) => Promise<TResult>, opts: { success?: string | ((r: TResult, a: TArgs) => string | null); onDone?: (r: TResult, a: TArgs) => void } = {}) {
  const refresh = useRefresh();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, a) => {
      refresh();
      const msg = typeof opts.success === 'function' ? opts.success(r, a) : opts.success;
      if (msg) toast.success(msg);
      opts.onDone?.(r, a);
    },
    onError: (e) => toast.error(e),
  });
}

export function useStageChange() {
  const refresh = useRefresh();
  const toast = useToast();
  const undo = useUndo();
  return useMutation({
    mutationFn: (a: { episodeId: number; stage: Stage; status: StageStatus; note?: string }) =>
      api.put<{ warnings: string[]; undo: UndoPayload }>(`/episodes/${a.episodeId}/stages`, { changes: [{ stage: a.stage, status: a.status, note: a.note }] }),
    onSuccess: (r) => {
      refresh();
      if (r.warnings.length) toast.show({ tone: 'warning', message: r.warnings[0], action: { label: 'Undo', onClick: () => undo(r.undo) } });
    },
    onError: (e) => toast.error(e),
  });
}

export function useMoveEpisode() {
  const refresh = useRefresh();
  const toast = useToast();
  const undo = useUndo();
  return useMutation({
    mutationFn: (a: { episodeId: number; phase: Phase; scheduledAt?: string; platform?: string; title?: string }) =>
      api.post<{ phase: Phase; warnings: string[]; undo: UndoPayload }>(`/episodes/${a.episodeId}/move`, a),
    onSuccess: (r, a) => {
      refresh();
      const changed = r.undo.snapshot.reduce((n, s) => n + s.stages.length, 0);
      toast.show({
        tone: r.warnings.length ? 'warning' : 'success',
        message: `${a.title ? `${a.title} → ` : 'Moved to '}${r.phase.toLowerCase()}`,
        detail: [changed ? `${changed} stage${changed > 1 ? 's' : ''} updated` : null, ...r.warnings].filter(Boolean).join(' · ') || undefined,
        action: changed || r.undo.publicationIds.length ? { label: 'Undo', onClick: () => undo(r.undo) } : undefined,
      });
    },
    onError: (e) => toast.error(e),
  });
}

/** Persist small UI preferences per browser. */
export function useLocalState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`cos:${key}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`cos:${key}`, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  }, [key, v]);
  return [v, setV] as const;
}

export function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
