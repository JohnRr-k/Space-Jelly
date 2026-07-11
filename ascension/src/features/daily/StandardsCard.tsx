import { countDone } from "../../domain/day";
import type { DayRecord, StandardDef } from "../../domain/types";
import { Card } from "../../ui/Card";
import { CheckRow } from "../../ui/CheckRow";

interface StandardsCardProps {
  standards: StandardDef[];
  day: DayRecord;
  disabled?: boolean;
  onToggle: (id: string) => void;
}

/** The behaviors Russ holds every day — marked as they are lived. */
export function StandardsCard({
  standards,
  day,
  disabled = false,
  onToggle,
}: StandardsCardProps) {
  const { done, total } = countDone(day.standards);
  const visible = standards.filter((s) => s.id in day.standards);
  return (
    <Card label="Standards" meta={`${done}/${total}`} metaComplete={done === total}>
      <div>
        {visible.map((standard) => (
          <CheckRow
            key={standard.id}
            title={standard.title}
            detail={standard.detail}
            checked={day.standards[standard.id]}
            disabled={disabled}
            onToggle={() => onToggle(standard.id)}
          />
        ))}
      </div>
    </Card>
  );
}
