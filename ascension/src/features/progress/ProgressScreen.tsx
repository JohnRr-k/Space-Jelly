import type { NowContext } from "../../app/useNow";
import { useAscension } from "../../data/store";
import { addDays, formatShortDate, fromDateKey } from "../../domain/dates";
import {
  PRIME_THRESHOLD,
  primeBreakdown,
  primeScore,
  primeState,
} from "../../domain/prime";
import { bestStreak, currentStreak } from "../../domain/streaks";
import type { DateKey, DayRecord } from "../../domain/types";
import { Card } from "../../ui/Card";

interface ProgressScreenProps {
  nowCtx: NowContext;
}

/** Calendar window ending today: oldest first. */
function windowKeys(today: DateKey, length: number): DateKey[] {
  return Array.from({ length }, (_, i) => addDays(today, i - (length - 1)));
}

const PILLARS = [
  { key: "morning", label: "Morning" },
  { key: "night", label: "Night" },
  { key: "standards", label: "Standards" },
  { key: "hydration", label: "Hydration" },
] as const;

export function ProgressScreen({ nowCtx }: ProgressScreenProps) {
  const days = useAscension((s) => s.days);
  const today = nowCtx.dateKey;

  const streak = currentStreak(days, today);
  const best = bestStreak(days);

  const last7: DayRecord[] = windowKeys(today, 7)
    .map((k) => days[k])
    .filter((d): d is DayRecord => Boolean(d));
  const avg7 =
    last7.length > 0
      ? Math.round(
          last7.reduce((sum, d) => sum + primeScore(d), 0) / last7.length,
        )
      : null;

  const trend = windowKeys(today, 14).map((key) => {
    const record = days[key];
    const score = record ? primeScore(record) : null;
    return {
      key,
      score,
      held: score !== null && score >= PRIME_THRESHOLD,
      isToday: key === today,
      initial: fromDateKey(key)
        .toLocaleDateString("en-GB", { weekday: "narrow" })
        .toUpperCase(),
    };
  });

  const pillarAvg = PILLARS.map((pillar) => {
    if (last7.length === 0) return { ...pillar, pct: 0 };
    const total = last7.reduce(
      (sum, d) => sum + primeBreakdown(d)[pillar.key],
      0,
    );
    return { ...pillar, pct: Math.round((total / last7.length) * 100) };
  });

  // Today only joins history once it has been sealed — until then it lives
  // on the Daily screen, not in the record.
  const history = windowKeys(today, 30)
    .reverse()
    .map((k) => days[k])
    .filter((d): d is DayRecord => Boolean(d))
    .filter((d) => d.date !== today || Boolean(d.sealedAt))
    .slice(0, 14);

  return (
    <div className="screen">
      <div className="wordmark">Ascension</div>
      <div>
        <h1 className="screen-title">Progress</h1>
        <p className="screen-sub">The climb, measured.</p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">{streak}</div>
          <div className="stat-label">Streak</div>
        </div>
        <div className="stat">
          <div className="stat-value">{best}</div>
          <div className="stat-label">Best</div>
        </div>
        <div className="stat">
          <div className="stat-value">{avg7 ?? "—"}</div>
          <div className="stat-label">7-day avg</div>
        </div>
      </div>

      <Card label="Last 14 days">
        <div className="trend">
          {trend.map((t) => (
            <div
              key={t.key}
              className={t.isToday ? "trend-col is-today" : "trend-col"}
            >
              <div className="trend-barwrap">
                <div
                  className={
                    t.score === null
                      ? "trend-bar is-empty"
                      : t.held
                        ? "trend-bar is-held"
                        : "trend-bar"
                  }
                  style={{
                    height:
                      t.score === null ? "6%" : `${Math.max(5, t.score)}%`,
                  }}
                  title={t.score === null ? "No record" : `${t.score}`}
                />
              </div>
              <span className="trend-day">{t.initial}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card label="Pillars · last 7 days">
        {last7.length === 0 ? (
          <p className="empty-note">
            Live your first day and the pillars appear here.
          </p>
        ) : (
          <div>
            {pillarAvg.map((p) => (
              <div key={p.key} className="pillar">
                <span className="pillar-label">{p.label}</span>
                <div className="meter">
                  <div className="meter-fill" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="pillar-pct">{p.pct}%</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card label="History">
        {history.length === 0 ? (
          <p className="empty-note">Your first day will appear here tonight.</p>
        ) : (
          <div className="hairline-rows">
            {history.map((d) => {
              const score = primeScore(d);
              return (
                <div key={d.date} className="history-row">
                  <span className="history-date">
                    {formatShortDate(d.date)}
                  </span>
                  <span className="history-state">
                    {d.sealedAt ? primeState(score) : "Unsealed"}
                  </span>
                  <span
                    className={
                      score >= PRIME_THRESHOLD
                        ? "history-score is-held"
                        : "history-score"
                    }
                  >
                    {score}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
