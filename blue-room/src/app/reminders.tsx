import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { useSettings } from './settings';
import { useToast } from '../components/ui';
import { computeReminderInstances, evaluateReminders, type ReminderInstance, type ShownReminder } from '../lib/reminders';
import { notificationPermission, registerServiceWorker, showSystemNotification } from '../lib/notify';
import type { ReminderState } from '../data/types';

interface Ctx {
  due: ShownReminder[];
  upcoming: ReminderInstance[];
  dismiss: (key: string) => void;
  snooze: (key: string, minutes: number) => void;
  dismissAll: () => void;
  now: number;
}
const RemCtx = createContext<Ctx>({ due: [], upcoming: [], dismiss: () => {}, snooze: () => {}, dismissAll: () => {}, now: Date.now() });
export const useReminders = () => useContext(RemCtx);

const TICK_MS = 20_000;

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  const events = useLiveQuery(() => db.events.toArray(), []);
  const goals = useLiveQuery(() => db.goals.toArray(), []);
  const letters = useLiveQuery(() => db.letters.toArray(), []);
  const customs = useLiveQuery(() => db.customReminders.toArray(), []);
  const journalDates = useLiveQuery(async () => {
    const rows = await db.journal.toArray();
    return rows.filter((r) => r.body.trim() || r.title.trim()).map((r) => r.date);
  }, []);
  const states = useLiveQuery(() => db.reminderState.toArray(), []);
  const marked = useRef(new Set<string>());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, TICK_MS);
    const vis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('focus', tick); };
  }, []);

  // keep the service worker (used only to display notifications) registered once permission exists
  useEffect(() => { if (settings.reminders.browser && notificationPermission() === 'granted') registerServiceWorker(); }, [settings.reminders.browser]);

  const evaluation = useMemo(() => {
    if (!settings.reminders.inApp || !events || !goals || !letters || !customs || !journalDates || !states) return null;
    const instances = computeReminderInstances({ events, goals, letters, customReminders: customs, journalDates: new Set(journalDates), settings, now });
    const map = new Map<string, ReminderState>(states.map((s) => [s.key, s]));
    return evaluateReminders(instances, map, now);
  }, [events, goals, letters, customs, journalDates, states, settings, now]);

  // persist first-sight state and surface gentle alerts — once per reminder
  useEffect(() => {
    if (!evaluation || !evaluation.toMark.length) return;
    const fresh = evaluation.toMark.filter((s) => !marked.current.has(s.key + ':' + s.seenAt));
    if (!fresh.length) return;
    const rows: ReminderState[] = [];
    for (const s of fresh) {
      marked.current.add(s.key + ':' + s.seenAt);
      const inst = evaluation.due.find((d) => d.key === s.key);
      let browserNotified = false;
      if (inst && !s.missed && settings.reminders.browser && notificationPermission() === 'granted') {
        showSystemNotification(inst.title, inst.body, inst.key);
        browserNotified = true; // requested — the browser may still suppress it
      }
      if (inst && !s.missed) toast(inst.title);
      rows.push({ ...s, browserNotified });
    }
    db.reminderState.bulkPut(rows).catch(() => {});
  }, [evaluation, settings.reminders.browser, toast]);

  const dismiss = useCallback((key: string) => { db.reminderState.put({ key, status: 'dismissed', seenAt: Date.now(), missed: false, browserNotified: false }); }, []);
  const snooze = useCallback((key: string, minutes: number) => { db.reminderState.put({ key, status: 'snoozed', seenAt: Date.now(), missed: false, browserNotified: false, snoozeUntil: Date.now() + minutes * 60000 }); }, []);
  const dismissAll = useCallback(() => {
    if (!evaluation) return;
    db.reminderState.bulkPut(evaluation.due.map((d) => ({ key: d.key, status: 'dismissed' as const, seenAt: Date.now(), missed: false, browserNotified: false })));
  }, [evaluation]);

  const value = useMemo<Ctx>(() => ({ due: evaluation?.due ?? [], upcoming: evaluation?.upcoming ?? [], dismiss, snooze, dismissAll, now }), [evaluation, dismiss, snooze, dismissAll, now]);
  return <RemCtx.Provider value={value}>{children}</RemCtx.Provider>;
}
