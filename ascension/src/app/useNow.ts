import { useEffect, useState } from "react";
import { dayPhase } from "../domain/context";
import { todayKey } from "../domain/dates";
import type { DateKey, DayPhase } from "../domain/types";

export interface NowContext {
  now: Date;
  dateKey: DateKey;
  phase: DayPhase;
}

/**
 * The app's sense of time. Refreshes on an interval and whenever the tab
 * regains focus, so a phone left open overnight rolls into the new day the
 * moment Russ picks it up.
 */
export function useNow(intervalMs = 30_000): NowContext {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [intervalMs]);

  return { now, dateKey: todayKey(now), phase: dayPhase(now) };
}
