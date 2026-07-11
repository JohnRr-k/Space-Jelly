import { useEffect, useState } from "react";
import { useAscension } from "../data/store";
import { DailyScreen } from "../features/daily/DailyScreen";
import { ProgressScreen } from "../features/progress/ProgressScreen";
import { SystemScreen } from "../features/system/SystemScreen";
import { TabBar } from "./TabBar";
import type { Tab } from "./TabBar";
import { useNow } from "./useNow";

export function App() {
  const [tab, setTab] = useState<Tab>("daily");
  const nowCtx = useNow();
  const ensureDay = useAscension((s) => s.ensureDay);

  // Guarantee a record exists for the current calendar day — including the
  // rollover at midnight while the app stays open.
  useEffect(() => {
    ensureDay(nowCtx.dateKey);
  }, [ensureDay, nowCtx.dateKey]);

  return (
    <div className="shell">
      {tab === "daily" && <DailyScreen nowCtx={nowCtx} />}
      {tab === "progress" && <ProgressScreen nowCtx={nowCtx} />}
      {tab === "system" && <SystemScreen />}
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
