import { openfootballProvider, type NormalizedSeason } from "@/data/providers/openfootball";
import { apiFootballProvider, apiFootballEnabled } from "@/data/providers/apifootball";
import { LEAGUE_BY_ID, FOOTBALL_LEAGUES, currentSeasonLabel, previousSeasonLabel } from "@/data/leagues";
import type { DataStatus, FBMatch, FBTeam, StandingRow, TeamMatchStats } from "@/data/types";
import { dateKeyUtcFromUtc } from "@/data/time";

export interface SyncReport {
  provider: string;
  status: "ok" | "unavailable";
  seasons: string[];
  matches: number;
  teams: number;
  leagues: number;
  lastSyncAt: string;
  mode: "network" | "snapshot";
}

interface ServiceState {
  bootedAt: Date;
  pool: Map<string, FBMatch>;
  teams: Map<string, FBTeam>;
  byLeague: Map<string, FBMatch[]>;
  lastSyncAt: string | null;
  dataStatus: "ok" | "unavailable";
  mode: "network" | "snapshot";
}

function buildState(seasons: NormalizedSeason[], at = new Date()): ServiceState {
  const pool = new Map<string, FBMatch>();
  const teams = new Map<string, FBTeam>();
  const byLeague = new Map<string, FBMatch[]>();

  for (const s of seasons) {
    for (const m of s.matches) {
      pool.set(m.id, m);
      for (const ref of [m.home, m.away]) {
        const t = s.teams.get(ref.id);
        if (t) teams.set(t.id, t);
      }
    }
  }

  const sortedLeagues = new Map<string, FBMatch[]>();
  for (const m of pool.values()) {
    const list = sortedLeagues.get(m.leagueId) ?? [];
    list.push(m);
    sortedLeagues.set(m.leagueId, list);
  }
  for (const list of sortedLeagues.values()) {
    // deterministic ordering: future first then past, by kickoff
    list.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  }

  // League average goals (real, from finished results).
  const totals = new Map<string, { goals: number; games: number }>();
  for (const m of pool.values()) {
    if (m.status !== "finished" || m.homeGoals === undefined || m.awayGoals === undefined) continue;
    const t = totals.get(m.leagueId) ?? { goals: 0, games: 0 };
    t.goals += m.homeGoals + m.awayGoals;
    t.games += 1;
    totals.set(m.leagueId, t);
  }
  for (const l of FOOTBALL_LEAGUES) {
    const t = totals.get(l.id);
    l.avgGoals = t && t.games > 0 ? +(t.goals / t.games).toFixed(2) : 2.6;
  }

  return {
    bootedAt: at,
    pool,
    teams,
    byLeague: sortedLeagues,
    lastSyncAt: at.toISOString(),
    dataStatus: pool.size > 0 ? "ok" : "unavailable",
    mode: (process.env.FOOTBALL_DATA_MODE ?? "network") as "network" | "snapshot"
  };
}

let state: ServiceState = buildState([...openfootballProvider.getBundledSync().values()]);

function matches(): FBMatch[] {
  return [...state.pool.values()];
}

export function dataStatus(): DataStatus {
  return {
    provider: apiFootballEnabled() ? "api-football" : "openfootball/football.json",
    status: state.dataStatus,
    lastSyncAt: state.lastSyncAt,
    loadedSeasons: [...new Set(matches().map((m) => m.season))],
    leagueCount: LEAGUE_BY_ID.size,
    matchCount: state.pool.size,
    mode: state.mode
  };
}

export function getTeam(id: string): FBTeam | undefined {
  return state.teams.get(id);
}

export function getTeamsByLeague(leagueId: string): FBTeam[] {
  const set = new Map<string, FBTeam>();
  for (const m of state.byLeague.get(leagueId) ?? []) {
    for (const ref of [m.home, m.away]) {
      const t = state.teams.get(ref.id);
      if (t) set.set(t.id, t);
    }
  }
  return [...set.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getAllTeams(): FBTeam[] {
  return [...state.teams.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getAllTeamSlugs(): string[] {
  return [...state.teams.values()].map((t) => t.slug).sort();
}

export function getTeamBySlug(slug: string): FBTeam | undefined {
  for (const t of state.teams.values()) {
    if (t.slug === slug) return t;
  }
  return undefined;
}

export function getTodayMatches(now = state.bootedAt): FBMatch[] {
  return matches()
    .filter((m) => m.status === "scheduled" && m.dateKeyUtc === dateKeyUtcFromUtc(now.toISOString()))
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
}

export function getTodayByLeague(now = state.bootedAt): Map<string, FBMatch[]> {
  const map = new Map<string, FBMatch[]>();
  for (const m of getTodayMatches(now)) {
    const list = map.get(m.leagueId) ?? [];
    list.push(m);
    map.set(m.leagueId, list);
  }
  return map;
}

export function getUpcomingMatches(now = state.bootedAt, days = 7): FBMatch[] {
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return matches()
    .filter((m) => m.status === "scheduled" && m.kickoffUtc >= now.toISOString() && m.kickoffUtc <= cutoff.toISOString())
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
}

export function getLiveMatches(): FBMatch[] {
  return [];
}

export function getFinishedMatches(limit = 80): FBMatch[] {
  return matches()
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.kickoffUtc.localeCompare(a.kickoffUtc))
    .slice(0, limit);
}

export function getHistoricalMatches(limit = 120): FBMatch[] {
  return matches()
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.kickoffUtc.localeCompare(a.kickoffUtc))
    .slice(0, limit);
}

export function getLeagueMatches(leagueId: string): FBMatch[] {
  return state.byLeague.get(leagueId) ?? [];
}

export function getMatchDetails(id: string): FBMatch | undefined {
  return state.pool.get(id);
}

export function getMatchesByIds(ids: string[]): FBMatch[] {
  const out: FBMatch[] = [];
  for (const id of ids) {
    const m = state.pool.get(id);
    if (m) out.push(m);
  }
  return out;
}

export function getStandings(leagueId: string): StandingRow[] {
  type Acc = {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    points: number;
    samples: Array<{ result: "W" | "D" | "L"; gf: number; ga: number }>;
  };
  const rows = new Map<string, Acc>();
  const touch = (teamId: string): Acc => {
    let r = rows.get(teamId);
    if (!r) {
      r = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, samples: [] };
      rows.set(teamId, r);
    }
    return r;
  };

  for (const m of state.byLeague.get(leagueId) ?? []) {
    if (m.status !== "finished" || m.homeGoals === undefined || m.awayGoals === undefined) continue;
    const h = touch(m.home.id);
    const a = touch(m.away.id);
    h.played += 1;
    a.played += 1;
    h.gf += m.homeGoals;
    h.ga += m.awayGoals;
    a.gf += m.awayGoals;
    a.ga += m.homeGoals;
    const homeWon = m.homeGoals > m.awayGoals;
    const draw = m.homeGoals === m.awayGoals;
    h.samples.push({ result: homeWon ? "W" : draw ? "D" : "L", gf: m.homeGoals, ga: m.awayGoals });
    a.samples.push({ result: homeWon ? "L" : draw ? "D" : "W", gf: m.awayGoals, ga: m.homeGoals });
    if (homeWon) {
      h.won += 1;
      a.lost += 1;
      h.points += 3;
    } else if (draw) {
      h.drawn += 1;
      a.drawn += 1;
      h.points += 1;
      a.points += 1;
    } else {
      a.won += 1;
      h.lost += 1;
      a.points += 3;
    }
  }

  return [...rows.entries()]
    .map(([teamId, r]) => {
      const team = state.teams.get(teamId);
      return {
        rank: 0,
        teamId,
        teamName: team?.name ?? teamId,
        played: r.played,
        won: r.won,
        drawn: r.drawn,
        lost: r.lost,
        gf: r.gf,
        ga: r.ga,
        gd: r.gf - r.ga,
        points: r.points,
        form: r.samples.slice(-5)
      };
    })
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function getTeamStats(teamId: string): TeamMatchStats | undefined {
  const team = state.teams.get(teamId);
  if (!team) return undefined;

  const results: TeamMatchStats["results"] = [];
  for (const m of state.byLeague.get(team.leagueId) ?? []) {
    if (m.status !== "finished" || m.homeGoals === undefined || m.awayGoals === undefined) continue;
    const isHome = m.home.id === teamId;
    if (!isHome && m.away.id !== teamId) continue;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    results.push({
      dateUtc: m.kickoffUtc,
      result: gf > ga ? "W" : gf === ga ? "D" : "L",
      for: gf,
      against: ga,
      opponent: isHome ? m.away.name : m.home.name,
      opponentId: isHome ? m.away.id : m.home.id,
      leagueId: team.leagueId,
      home: isHome
    });
  }
  results.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));

  const played = results.length;
  const scored = results.reduce((n, r) => n + r.for, 0);
  const conceded = results.reduce((n, r) => n + r.against, 0);
  const home = results.filter((r) => r.home);
  const away = results.filter((r) => !r.home);

  return {
    played,
    scored,
    conceded,
    avgScored: played ? +(scored / played).toFixed(2) : 0,
    avgConceded: played ? +(conceded / played).toFixed(2) : 0,
    home: {
      played: home.length,
      scored: home.reduce((n, r) => n + r.for, 0),
      conceded: home.reduce((n, r) => n + r.against, 0)
    },
    away: {
      played: away.length,
      scored: away.reduce((n, r) => n + r.for, 0),
      conceded: away.reduce((n, r) => n + r.against, 0)
    },
    results
  };
}

export function getTeamForm(teamId: string, n = 6): TeamMatchStats | undefined {
  const stats = getTeamStats(teamId);
  if (!stats) return undefined;
  return { ...stats, results: stats.results.slice(-n) };
}

export function getHeadToHead(teamIdA: string, teamIdB: string, count = 8): FBMatch[] {
  return matches()
    .filter((m) => {
      if (m.status !== "finished") return false;
      const ids = [m.home.id, m.away.id];
      return ids.includes(teamIdA) && ids.includes(teamIdB);
    })
    .sort((a, b) => b.kickoffUtc.localeCompare(a.kickoffUtc))
    .slice(0, count);
}

/** Replace the in-memory index with freshly fetched real data (used by the sync route). */
export async function refresh(): Promise<SyncReport> {
  const seasons = [currentSeasonLabel(), previousSeasonLabel(currentSeasonLabel())];
  const usingApi = apiFootballEnabled();
  const next: NormalizedSeason[] = [];
  for (const season of seasons) {
    let normalized: NormalizedSeason | null = null;
    if (usingApi) {
      // Live data via API-Football. Fall back to openfootball if it yields nothing.
      await apiFootballProvider.refresh(season);
      const apiResult = await apiFootballProvider.get(season);
      if (apiResult.matches.length > 0) {
        normalized = apiResult;
      } else {
        await openfootballProvider.refresh(season);
        normalized = await openfootballProvider.get(season);
      }
    } else {
      await openfootballProvider.refresh(season);
      normalized = await openfootballProvider.get(season);
    }
    if (normalized) next.push(normalized);
  }
  state = buildState(next, new Date());
  const reportedSeasons = [...new Set(matches().map((m) => m.season))];
  return {
    provider: usingApi ? "api-football" : "openfootball/football.json",
    status: state.dataStatus,
    seasons: reportedSeasons,
    matches: state.pool.size,
    teams: state.teams.size,
    leagues: LEAGUE_BY_ID.size,
    lastSyncAt: state.lastSyncAt ?? "",
    mode: state.mode
  };
}