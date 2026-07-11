import type { DayRecord } from "../../domain/types";
import { Card } from "../../ui/Card";

interface HydrationCardProps {
  day: DayRecord;
  stepMl: number;
  disabled?: boolean;
  onAdd: (deltaMl: number) => void;
}

function litres(ml: number): string {
  const l = ml / 1000;
  return `${Number.isInteger(l) ? l : l.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} L`;
}

export function HydrationCard({
  day,
  stepMl,
  disabled = false,
  onAdd,
}: HydrationCardProps) {
  const pct =
    day.hydrationTargetMl > 0
      ? Math.min(1, day.hydrationMl / day.hydrationTargetMl)
      : 1;
  return (
    <Card
      label="Hydration"
      meta={`${Math.round(pct * 100)}%`}
      metaComplete={pct >= 1}
    >
      <div className="hydration-top">
        <div>
          <div className="hydration-amount">{litres(day.hydrationMl)}</div>
          <div className="hydration-target">
            of {litres(day.hydrationTargetMl)}
          </div>
        </div>
        <div className="hydration-buttons">
          <button
            type="button"
            className="hydration-btn is-sub"
            aria-label={`Remove ${stepMl}ml`}
            disabled={disabled || day.hydrationMl === 0}
            onClick={() => onAdd(-stepMl)}
          >
            −
          </button>
          <button
            type="button"
            className="hydration-btn is-add"
            aria-label={`Add ${stepMl}ml`}
            disabled={disabled}
            onClick={() => onAdd(stepMl)}
          >
            +
          </button>
        </div>
      </div>
      <div className="meter" aria-hidden="true">
        <div className="meter-fill" style={{ width: `${pct * 100}%` }} />
      </div>
    </Card>
  );
}
