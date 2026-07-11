import { useEffect, useState } from "react";
import { useAscension } from "../../data/store";
import type { FragranceProfile, OutfitOccasion } from "../../domain/types";
import { Card } from "../../ui/Card";
import { CollectionEditor } from "./CollectionEditor";

/**
 * System — the machine behind the man. Everything ASCENSION recommends and
 * tracks is configured here, and nowhere near the Daily flow.
 */

interface FieldProps {
  name: string;
  type: "text" | "time" | "number";
  value: string;
  step?: number;
  min?: number;
  onCommit: (value: string) => void;
}

/** Inline profile field: looks like text, becomes an input on focus. */
function Field({ name, type, value, step, min, onCommit }: FieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="field-row">
      <span className="field-name">{name}</span>
      <input
        className="input"
        type={type}
        value={draft}
        step={step}
        min={min}
        aria-label={name}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

const OCCASIONS: { value: OutfitOccasion; label: string }[] = [
  { value: "training", label: "Training" },
  { value: "casual", label: "Casual" },
  { value: "smart", label: "Smart" },
  { value: "sharp", label: "Sharp" },
];

const PROFILES: { value: FragranceProfile; label: string }[] = [
  { value: "fresh", label: "Fresh" },
  { value: "warm", label: "Warm" },
  { value: "intense", label: "Intense" },
];

export function SystemScreen() {
  const profile = useAscension((s) => s.profile);
  const morningSteps = useAscension((s) => s.morningSteps);
  const nightSteps = useAscension((s) => s.nightSteps);
  const standards = useAscension((s) => s.standards);
  const outfits = useAscension((s) => s.outfits);
  const fragrances = useAscension((s) => s.fragrances);

  const updateProfile = useAscension((s) => s.updateProfile);
  const addMorningStep = useAscension((s) => s.addMorningStep);
  const removeMorningStep = useAscension((s) => s.removeMorningStep);
  const addNightStep = useAscension((s) => s.addNightStep);
  const removeNightStep = useAscension((s) => s.removeNightStep);
  const addStandard = useAscension((s) => s.addStandard);
  const removeStandard = useAscension((s) => s.removeStandard);
  const addOutfit = useAscension((s) => s.addOutfit);
  const removeOutfit = useAscension((s) => s.removeOutfit);
  const addFragrance = useAscension((s) => s.addFragrance);
  const removeFragrance = useAscension((s) => s.removeFragrance);
  const resetAll = useAscension((s) => s.resetAll);

  const commitNumber = (raw: string, fallback: number): number => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  };

  return (
    <div className="screen">
      <div className="wordmark">Ascension</div>
      <div>
        <h1 className="screen-title">System</h1>
        <p className="screen-sub">The machine behind the man.</p>
      </div>

      <Card label="Identity">
        <div className="hairline-rows">
          <Field
            name="Name"
            type="text"
            value={profile.name}
            onCommit={(v) => updateProfile({ name: v.trim() || profile.name })}
          />
          <Field
            name="Wake"
            type="time"
            value={profile.wakeTime}
            onCommit={(v) => updateProfile({ wakeTime: v || profile.wakeTime })}
          />
          <Field
            name="Lights out"
            type="time"
            value={profile.sleepTime}
            onCommit={(v) =>
              updateProfile({ sleepTime: v || profile.sleepTime })
            }
          />
          <Field
            name="Hydration target (ml)"
            type="number"
            step={250}
            min={250}
            value={String(profile.hydrationTargetMl)}
            onCommit={(v) =>
              updateProfile({
                hydrationTargetMl: commitNumber(v, profile.hydrationTargetMl),
              })
            }
          />
          <Field
            name="Glass size (ml)"
            type="number"
            step={50}
            min={50}
            value={String(profile.hydrationStepMl)}
            onCommit={(v) =>
              updateProfile({
                hydrationStepMl: commitNumber(v, profile.hydrationStepMl),
              })
            }
          />
        </div>
      </Card>

      <CollectionEditor
        label="Morning Protocol"
        addLabel="Add step"
        items={morningSteps.map((s) => ({
          id: s.id,
          primary: s.title,
          secondary: s.detail,
        }))}
        fields={[
          { key: "title", placeholder: "Step" },
          { key: "detail", placeholder: "Why it matters (optional)" },
        ]}
        onAdd={(v) => addMorningStep({ title: v.title, detail: v.detail })}
        onRemove={removeMorningStep}
      />

      <CollectionEditor
        label="Night Protocol"
        addLabel="Add step"
        items={nightSteps.map((s) => ({
          id: s.id,
          primary: s.title,
          secondary: s.detail,
        }))}
        fields={[
          { key: "title", placeholder: "Step" },
          { key: "detail", placeholder: "Why it matters (optional)" },
        ]}
        onAdd={(v) => addNightStep({ title: v.title, detail: v.detail })}
        onRemove={removeNightStep}
      />

      <CollectionEditor
        label="Standards"
        addLabel="Add standard"
        items={standards.map((s) => ({
          id: s.id,
          primary: s.title,
          secondary: s.detail,
        }))}
        fields={[
          { key: "title", placeholder: "Standard" },
          { key: "detail", placeholder: "Why it matters (optional)" },
        ]}
        onAdd={(v) => addStandard({ title: v.title, detail: v.detail })}
        onRemove={removeStandard}
      />

      <CollectionEditor
        label="Wardrobe"
        addLabel="Add outfit"
        items={outfits.map((o) => ({
          id: o.id,
          primary: o.name,
          secondary: o.note,
          tag: o.occasion,
        }))}
        fields={[
          { key: "name", placeholder: "Outfit name" },
          { key: "note", placeholder: "What it is (optional)" },
        ]}
        select={{
          key: "occasion",
          options: OCCASIONS.map((o) => ({ value: o.value, label: o.label })),
        }}
        onAdd={(v) =>
          addOutfit({
            name: v.name,
            note: v.note,
            occasion: (v.occasion as OutfitOccasion) ?? "smart",
          })
        }
        onRemove={removeOutfit}
      />

      <CollectionEditor
        label="Fragrances"
        addLabel="Add fragrance"
        items={fragrances.map((f) => ({
          id: f.id,
          primary: f.name,
          secondary: f.note,
          tag: f.profile,
        }))}
        fields={[
          { key: "name", placeholder: "Fragrance name" },
          { key: "note", placeholder: "When to wear it (optional)" },
        ]}
        select={{
          key: "profile",
          options: PROFILES.map((p) => ({ value: p.value, label: p.label })),
        }}
        onAdd={(v) =>
          addFragrance({
            name: v.name,
            note: v.note,
            profile: (v.profile as FragranceProfile) ?? "fresh",
          })
        }
        onRemove={removeFragrance}
      />

      <div className="danger-zone">
        <button
          type="button"
          className="textbtn is-muted"
          onClick={() => {
            if (
              window.confirm(
                "Reset ASCENSION? This erases all history and restores the default system.",
              )
            ) {
              resetAll();
            }
          }}
        >
          Reset ASCENSION
        </button>
      </div>
    </div>
  );
}
