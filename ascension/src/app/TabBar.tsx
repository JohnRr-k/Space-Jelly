export type Tab = "daily" | "progress" | "system";

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  {
    id: "daily",
    label: "Daily",
    // Sun over a horizon — the day itself.
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="11" r="4" />
        <path d="M12 2.5v2M4.6 4.6l1.4 1.4M19.4 4.6 18 6M2.5 11h2M19.5 11h2M3 17.5h18M7 21h10" />
      </svg>
    ),
  },
  {
    id: "progress",
    label: "Progress",
    // An ascending line.
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3.5 19.5 9 13l4 3.5 7-8" />
        <path d="M15.5 8.5H20V13" />
      </svg>
    ),
  },
  {
    id: "system",
    label: "System",
    // Calibration sliders.
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4.5 7.5h9M17.5 7.5h2M4.5 16.5h2M10.5 16.5h9" />
        <circle cx="15.2" cy="7.5" r="2.2" />
        <circle cx="8.2" cy="16.5" r="2.2" />
      </svg>
    ),
  },
];

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={active === tab.id ? "tabbar-item is-active" : "tabbar-item"}
          aria-current={active === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          <span className="tabbar-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
