import { useState } from "react";
import type { Reflection } from "../../domain/types";
import { Chip } from "../../ui/Chip";
import { Sheet } from "../../ui/Sheet";

interface ReflectionSheetProps {
  open: boolean;
  liveScore: number;
  liveState: string;
  onClose: () => void;
  onSeal: (reflection: Reflection) => void;
}

/**
 * The closing ritual. Three short prompts and a self-assessment, then the
 * day is sealed and its score frozen. Nothing is mandatory — showing up is.
 */
export function ReflectionSheet({
  open,
  liveScore,
  liveState,
  onClose,
  onSeal,
}: ReflectionSheetProps) {
  const [win, setWin] = useState("");
  const [friction, setFriction] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [rating, setRating] = useState<number | undefined>(undefined);

  const seal = () => {
    onSeal({
      win: win.trim(),
      friction: friction.trim(),
      tomorrow: tomorrow.trim(),
      rating,
    });
  };

  return (
    <Sheet
      open={open}
      title="Close the day"
      subtitle={`Tonight seals at ${liveScore} — ${liveState}.`}
      onClose={onClose}
    >
      <div className="sheet-field">
        <label className="smallcaps" htmlFor="refl-win">
          Today's win
        </label>
        <textarea
          id="refl-win"
          className="textarea"
          value={win}
          placeholder="What did you do like Prime?"
          onChange={(e) => setWin(e.target.value)}
        />
      </div>
      <div className="sheet-field">
        <label className="smallcaps" htmlFor="refl-friction">
          The friction
        </label>
        <textarea
          id="refl-friction"
          className="textarea"
          value={friction}
          placeholder="Where did you slip, and why?"
          onChange={(e) => setFriction(e.target.value)}
        />
      </div>
      <div className="sheet-field">
        <label className="smallcaps" htmlFor="refl-tomorrow">
          Tomorrow's one focus
        </label>
        <textarea
          id="refl-tomorrow"
          className="textarea"
          value={tomorrow}
          placeholder="One thing. Name it."
          onChange={(e) => setTomorrow(e.target.value)}
        />
      </div>
      <div className="sheet-field">
        <span className="smallcaps">How close to Prime today?</span>
        <div className="chip-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip
              key={n}
              label={String(n)}
              selected={rating === n}
              onSelect={() => setRating(rating === n ? undefined : n)}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 8 }}
        onClick={seal}
      >
        Seal the day
      </button>
    </Sheet>
  );
}
