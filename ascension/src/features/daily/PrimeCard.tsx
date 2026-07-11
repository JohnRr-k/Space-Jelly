import { primeScore, primeState } from "../../domain/prime";
import { currentStreak } from "../../domain/streaks";
import type { DateKey, DayRecord } from "../../domain/types";
import { Card } from "../../ui/Card";
import { ProgressRing } from "../../ui/ProgressRing";

const STATE_NOTES: Record<string, string> = {
  Drifting: "Far from the line. Move.",
  Building: "Momentum is forming.",
  Ascending: "Above the line. Hold it.",
  Prime: "This is the standard. Keep it.",
};

interface PrimeCardProps {
  day: DayRecord;
  days: Record<DateKey, DayRecord>;
}

export function PrimeCard({ day, days }: PrimeCardProps) {
  const score = primeScore(day);
  const state = primeState(score);
  const streak = currentStreak(days, day.date);

  return (
    <Card>
      <div className="prime-card">
        <ProgressRing
          value={score / 100}
          label={`Prime status ${score} out of 100`}
        >
          <span className="prime-score">{score}</span>
          <span className="prime-score-cap">Prime</span>
        </ProgressRing>
        <div className="prime-side">
          <span
            className={
              state === "Prime" ? "prime-state is-prime" : "prime-state"
            }
          >
            {state}
          </span>
          <span className="prime-note">{STATE_NOTES[state]}</span>
          <span className="prime-streak">
            {streak > 0 ? (
              <>
                <b>▲ {streak}-day</b> streak
              </>
            ) : (
              "Start the streak today"
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
