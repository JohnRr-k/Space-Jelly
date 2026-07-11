import { recommendFragrance, recommendOutfit } from "../../domain/recommend";
import type {
  DayPhase,
  DayRecord,
  Fragrance,
  Outfit,
} from "../../domain/types";
import { Card } from "../../ui/Card";

/**
 * The day's look, already decided. The recommendation applies automatically;
 * "Swap" cycles the collection for the rare day Russ disagrees. Zero
 * decisions required, one escape hatch offered.
 */

interface AppearanceCardProps {
  day: DayRecord;
  now: Date;
  phase: DayPhase;
  outfits: Outfit[];
  fragrances: Fragrance[];
  disabled?: boolean;
  onSwapOutfit: (nextId: string) => void;
  onSwapFragrance: (nextId: string) => void;
}

function cycle<T extends { id: string }>(items: T[], currentId: string): T {
  const index = items.findIndex((i) => i.id === currentId);
  return items[(index + 1) % items.length];
}

export function AppearanceCard({
  day,
  now,
  phase,
  outfits,
  fragrances,
  disabled = false,
  onSwapOutfit,
  onSwapFragrance,
}: AppearanceCardProps) {
  const chosenOutfit = day.outfitId
    ? outfits.find((o) => o.id === day.outfitId)
    : undefined;
  const outfit = chosenOutfit ?? recommendOutfit(outfits, now);

  const chosenFragrance = day.fragranceId
    ? fragrances.find((f) => f.id === day.fragranceId)
    : undefined;
  const fragrance = chosenFragrance ?? recommendFragrance(fragrances, now, phase);

  return (
    <Card label="Appearance">
      <div className="hairline-rows">
        <div className="wear-row">
          <div className="wear-body">
            <div className="wear-kind">Outfit</div>
            {outfit ? (
              <>
                <div className="wear-name">{outfit.name}</div>
                {outfit.note && <div className="wear-note">{outfit.note}</div>}
              </>
            ) : (
              <div className="wear-note">Add outfits in System.</div>
            )}
          </div>
          {outfit && <span className="tag">{outfit.occasion}</span>}
          {outfit && outfits.length > 1 && !disabled && (
            <button
              type="button"
              className="textbtn"
              onClick={() => onSwapOutfit(cycle(outfits, outfit.id).id)}
            >
              Swap
            </button>
          )}
        </div>
        <div className="wear-row">
          <div className="wear-body">
            <div className="wear-kind">Fragrance</div>
            {fragrance ? (
              <>
                <div className="wear-name">{fragrance.name}</div>
                {fragrance.note && (
                  <div className="wear-note">{fragrance.note}</div>
                )}
              </>
            ) : (
              <div className="wear-note">Add fragrances in System.</div>
            )}
          </div>
          {fragrance && <span className="tag">{fragrance.profile}</span>}
          {fragrance && fragrances.length > 1 && !disabled && (
            <button
              type="button"
              className="textbtn"
              onClick={() => onSwapFragrance(cycle(fragrances, fragrance.id).id)}
            >
              Swap
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
