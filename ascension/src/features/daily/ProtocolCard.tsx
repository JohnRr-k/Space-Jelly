import type { ReactNode } from "react";
import { countDone } from "../../domain/day";
import type { ProtocolStepDef } from "../../domain/types";
import { Card } from "../../ui/Card";
import { CheckRow } from "../../ui/CheckRow";

interface ProtocolCardProps {
  label: string;
  steps: ProtocolStepDef[];
  checked: Record<string, boolean>;
  disabled?: boolean;
  onToggle: (stepId: string) => void;
  /** Extra ritual content — intention input, seal button. */
  children?: ReactNode;
}

/** One protocol, one card: the Morning and Night rituals share this shape. */
export function ProtocolCard({
  label,
  steps,
  checked,
  disabled = false,
  onToggle,
  children,
}: ProtocolCardProps) {
  const { done, total } = countDone(checked);
  // Render only steps that exist in today's snapshot, in ritual order.
  const visible = steps.filter((step) => step.id in checked);
  return (
    <Card label={label} meta={`${done}/${total}`} metaComplete={done === total}>
      <div>
        {visible.map((step) => (
          <CheckRow
            key={step.id}
            title={step.title}
            detail={step.detail}
            checked={checked[step.id]}
            disabled={disabled}
            onToggle={() => onToggle(step.id)}
          />
        ))}
      </div>
      {children}
    </Card>
  );
}
