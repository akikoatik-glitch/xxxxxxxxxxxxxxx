import type { Match } from "@/types";
import { getUpcomingMatches as sUp, getFinishedMatches as sFin, getMatchDetails, getMatchesByIds, getAllTeams } from "@/data/service";
import { getTeam } from "@/lib/data/teams";

function toMatch(m: ReturnType<typeof getMatchDetails>) {
  if (!m) return undefined;
  const home = getTeam(m.home.id);
  return {
    id: m.id,
    leagueSlug: m.leagueId,
    homeId: m.home.id,
    awayId: m.away.id,
    kickoffIso: m.kickoffUtc,
    venue: home?.venue ?? "TBA",
    status: m.status === "live" ? "scheduled" : m.status,
    homeScore: m.homeGoals,
    awayScore: m.awayGoals,
    weather: undefined
  } satisfies Match;
}

let UPCOMING_CACHE: Match[] | null = null;
let FINISHED_CACHE: Match[] | null = null;
let ALL_CACHE: Match[] | null = null;

export function getUpcomingMatches(): Match[] {
  if (!UPCOMING_CACHE) {
    UPCOMING_CACHE = sUp().reduce<Match[]>((acc, m) => {
      const t = toMatch(m);
      if (t) acc.push(t);
      return acc;
    }, []);
  }
  return UPCOMING_CACHE;
}

export function getFinishedMatches(): Match[] {
  if (!FINISHED_CACHE) {
    FINISHED_CACHE = sFin().reduce<Match[]>((acc, m) => {
      const t = toMatch(m);
      if (t) acc.push(t);
      return acc;
    }, []);
  }
  return FINISHED_CACHE;
}

export function getTodayMatches(): Match[] {
  return getUpcomingMatches().filter(
    (m) => m.kickoffIso.slice(0, 10).replace(/-/g, "") === new Date().toISOString().slice(0, 10).replace(/-/g, "")
  );
}

export function getAllMatches(): Match[] {
  if (!ALL_CACHE) {
    const ids = new Set<string>();
    const all: Match[] = [];
    for (const m of [...getFinishedMatches(), ...getUpcomingMatches()]) {
      if (!ids.has(m.id)) {
        ids.add(m.id);
        all.push(m);
      }
    }
    ALL_CACHE = all;
  }
  return ALL_CACHE;
}

export function getMatchById(id: string): Match | undefined {
  return getAllMatches().find((m) => m.id === id) ?? toMatch(getMatchDetails(id));
}

export function getMatchesByLeague(leagueId: string): { upcoming: Match[]; finished: Match[] } {
  return {
    upcoming: getUpcomingMatches().filter((m) => m.leagueSlug === leagueId),
    finished: getFinishedMatches().filter((m) => m.leagueSlug === leagueId)
  };
}

/** Invalidate caches after a data refresh. */
export function invalidateMatchCaches(): void {
  UPCOMING_CACHE = null;
  FINISHED_CACHE = null;
  ALL_CACHE = null;
}

// touch helpers so the service indexes are eagerly built for sync imports
export function _warmTeams(): string[] {
  return getAllTeams().map((t) => t.id);
}

export { getMatchesByIds };