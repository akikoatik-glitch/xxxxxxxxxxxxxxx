const KEY = "xwhiz:watchlist";
export const WATCHLIST_EVENT = "xwhiz:watchlist-changed";

export function getWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function toggleWatchlist(matchId: string): string[] {
  const list = getWatchlist();
  const next = list.includes(matchId)
    ? list.filter((id) => id !== matchId)
    : [matchId, ...list].slice(0, 50);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(WATCHLIST_EVENT));
  } catch {
    return list;
  }
  return next;
}

export function isWatched(matchId: string): boolean {
  return getWatchlist().includes(matchId);
}
