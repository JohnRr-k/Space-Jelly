/** Pure date helpers (no Node APIs) — shared by the server and the single-file browser build. */
export const nowIso = () => new Date().toISOString();

/** The owner's local calendar day. Daily targets are about the owner's day, not UTC. */
export function localDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** UTC ISO bounds of a local day — used to count "published today". */
export function localDayBounds(day = localDay()) {
  const [y, m, d] = day.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
