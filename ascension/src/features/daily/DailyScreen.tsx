import { useState } from "react";
import type { ReactNode } from "react";
import type { NowContext } from "../../app/useNow";
import { useAscension } from "../../data/store";
import { greeting, phaseDirective } from "../../domain/context";
import { formatLongDate } from "../../domain/dates";
import { primeBreakdown, primeState } from "../../domain/prime";
import { AppearanceCard } from "./AppearanceCard";
import { HydrationCard } from "./HydrationCard";
import { IntentionInput } from "./IntentionInput";
import { PrimeCard } from "./PrimeCard";
import { ProtocolCard } from "./ProtocolCard";
import { ReflectionSheet } from "./ReflectionSheet";
import { StandardsCard } from "./StandardsCard";

interface DailyScreenProps {
  nowCtx: NowContext;
}

/**
 * The heart of ASCENSION — the screen Russ opens every morning and every
 * night. It reads the clock and reorders itself: protocol first at dawn,
 * standards through the day, the closing ritual after dark.
 */
export function DailyScreen({ nowCtx }: DailyScreenProps) {
  const { now, dateKey, phase } = nowCtx;

  const day = useAscension((s) => s.days[dateKey]);
  const days = useAscension((s) => s.days);
  const profile = useAscension((s) => s.profile);
  const morningSteps = useAscension((s) => s.morningSteps);
  const nightSteps = useAscension((s) => s.nightSteps);
  const standards = useAscension((s) => s.standards);
  const outfits = useAscension((s) => s.outfits);
  const fragrances = useAscension((s) => s.fragrances);

  const toggleMorning = useAscension((s) => s.toggleMorning);
  const toggleNight = useAscension((s) => s.toggleNight);
  const toggleStandard = useAscension((s) => s.toggleStandard);
  const addHydration = useAscension((s) => s.addHydration);
  const setOutfit = useAscension((s) => s.setOutfit);
  const setFragrance = useAscension((s) => s.setFragrance);
  const setIntention = useAscension((s) => s.setIntention);
  const sealDay = useAscension((s) => s.sealDay);
  const reopenDay = useAscension((s) => s.reopenDay);

  const [sealOpen, setSealOpen] = useState(false);

  // The App effect creates today's record; this guards the first paint only.
  if (!day) return null;

  const sealed = Boolean(day.sealedAt);
  const live = primeBreakdown(day);
  const isEveningside = phase === "evening" || phase === "night";

  const morningCard = (
    <ProtocolCard
      key="morning"
      label="Morning Protocol"
      steps={morningSteps}
      checked={day.morning}
      disabled={sealed}
      onToggle={(id) => toggleMorning(dateKey, id)}
    >
      {!(sealed && !day.intention) && (
        <IntentionInput
          value={day.intention ?? ""}
          disabled={sealed}
          onCommit={(text) => setIntention(dateKey, text)}
        />
      )}
    </ProtocolCard>
  );

  const nightCard = (
    <ProtocolCard
      key="night"
      label="Night Protocol"
      steps={nightSteps}
      checked={day.night}
      disabled={sealed}
      onToggle={(id) => toggleNight(dateKey, id)}
    >
      {sealed ? (
        <div className="sealed-banner">
          <span className="sealed-text">
            Sealed · <span className="display">{day.sealedScore}</span> —{" "}
            {primeState(day.sealedScore ?? 0)}
          </span>
          <button
            type="button"
            className="textbtn is-muted"
            onClick={() => reopenDay(dateKey)}
          >
            Reopen
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary seal-cta"
          onClick={() => setSealOpen(true)}
        >
          Close the day
        </button>
      )}
    </ProtocolCard>
  );

  const standardsCard = (
    <StandardsCard
      key="standards"
      standards={standards}
      day={day}
      disabled={sealed}
      onToggle={(id) => toggleStandard(dateKey, id)}
    />
  );

  const hydrationCard = (
    <HydrationCard
      key="hydration"
      day={day}
      stepMl={profile.hydrationStepMl}
      disabled={sealed}
      onAdd={(delta) => addHydration(dateKey, delta)}
    />
  );

  const appearanceCard = (
    <AppearanceCard
      key="appearance"
      day={day}
      now={now}
      phase={phase}
      outfits={outfits}
      fragrances={fragrances}
      disabled={sealed}
      onSwapOutfit={(id) => setOutfit(dateKey, id)}
      onSwapFragrance={(id) => setFragrance(dateKey, id)}
    />
  );

  // Context-aware composition: what matters now sits on top.
  let cards: ReactNode[];
  if (isEveningside || sealed) {
    cards = [nightCard, standardsCard, hydrationCard, morningCard, appearanceCard];
  } else if (phase === "morning") {
    cards = [morningCard, appearanceCard, standardsCard, hydrationCard];
  } else {
    cards = [standardsCard, hydrationCard, appearanceCard, morningCard];
  }

  return (
    <div className="screen">
      <header className="daily-header">
        <div className="wordmark">Ascension</div>
        <div className="smallcaps daily-date">{formatLongDate(dateKey)}</div>
        <h1 className="daily-greeting">{greeting(phase, profile.name)}</h1>
        <p className="daily-directive">{phaseDirective(phase)}</p>
        {day.intention && phase !== "morning" && (
          <p className="daily-intention">“{day.intention}”</p>
        )}
      </header>

      <PrimeCard day={day} days={days} />
      {cards}

      <ReflectionSheet
        open={sealOpen}
        liveScore={live.score}
        liveState={primeState(live.score)}
        onClose={() => setSealOpen(false)}
        onSeal={(reflection) => {
          sealDay(dateKey, reflection);
          setSealOpen(false);
        }}
      />
    </div>
  );
}
