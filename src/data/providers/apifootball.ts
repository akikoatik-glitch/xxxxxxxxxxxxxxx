import { FOOTBALL_LEAGUES, LEAGUE_BY_CODE, currentSeasonLabel } from "@/data/leagues";
import type { FBMatch, FBTeam, FBTeamRef } from "@/data/types";
import { slugify, dateKeyUtcFromUtc } from "@/data/time";

/**
 * API-Football league ids (api-football / RapidAPI proxy).
 * Coverage mirrors the 5 leagues XWhiz analyzes.
 */
const API_LEAGUE_IDS: Record<string, number> = {
  "en.1": 39, // Premier League
  "es.1": 140, // La Liga
  "it.1": 135, // Serie A
  "de.1": 78, // Bundesliga
  "fr.1": 61 // Ligue 1
};

interface RawFixture {
  fixture: {
    id: number;
    date: string; // ISO UTC
    status: { short: string }; // FT, AET, PEN, LIVE, NS, ...
  };
  league: { id: number; round: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
  score?: {
    halftime?: { home?: number | null; away?: number | null };
  };
}

const NETWORK_TTL_MS = 10 * 60 * 1000;
const netCache = new Map<string, { at: number; data: RawFixture[] }>();

function apiConfig() {
  const key = process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY;
  let host = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
  host = host.replace(/^https?:\/\//, "");
  return { key, host, enabled: Boolean(key) };
}

/** API-Football uses the calendar start year for a season (2025 for 2025-26). */
function apiSeasonYear(seasonLabel: string): string {
  return seasonLabel.split("-")[0];
}

async function fetchLeagueFixtures(apiLeagueId: number, seasonYear: string): Promise<RawFixture[]> {
  const cfg = apiConfig();
  if (!cfg.key) return [];

  const headers: Record<string, string> = {
    Accept: "application/json"
  };
  const base = cfg.host.includes("rapidapi")
    ? `https://${cfg.host}`
    : `https://${cfg.host}`;
  if (cfg.host.includes("rapidapi")) {
    headers["X-RapidAPI-Key"] = cfg.key;
    headers["X-RapidAPI-Host"] = cfg.host;
  } else {
    headers["x-apisports-key"] = cfg.key;
  }

  const out: RawFixture[] = [];
  // Current season + last season so standings / form / head-to-head have history.
  const years = [seasonYear, String(Number(seasonYear) - 1)];
  for (const year of years) {
    let page = 1;
    let paging = { current: 0, total: 1 };
    let pageData: RawFixture[] = [];
    do {
      const cacheKey = `${apiLeagueId}/${year}/page${page}`;
      const cached = netCache.get(cacheKey);
      if (cached && Date.now() - cached.at < NETWORK_TTL_MS) {
        pageData = cached.data;
      } else {
        const url = `${base}/v3/fixtures?league=${apiLeagueId}&season=${year}&page=${page}`;
        const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(20000) });
        if (!res.ok) break;
        const json = (await res.json()) as {
          response?: RawFixture[];
          paging?: { current: number; total: number };
        };
        pageData = Array.isArray(json.response) ? json.response : [];
        paging = json.paging ?? { current: page, total: page };
        netCache.set(cacheKey, { at: Date.now(), data: pageData });
      }

      out.push(...pageData);
      page += 1;
      if (page > 60) break; // safety cap
    } while (page <= paging.total && pageData.length > 0);
  }
  return out;
}

function isFinished(short: string): boolean {
  return ["FT", "AET", "PEN", "HT", "PST"].includes(short);
}

function isUpcoming(short: string): boolean {
  return ["NS", "TBD", "SUSP", "ABD", "CANC", "POST"].includes(short);
}

export interface NormalizedSeason {
  season: string;
  matches: FBMatch[];
  teams: Map<string, FBTeam>;
}

export function deriveShort(name: string): string {
  const words = name.replace(/AFC|FC|CF|SC|of|the/gi, " ").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  return name.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
}

function normalize(season: string, code: string, fixtures: RawFixture[]): NormalizedSeason {
  const league = LEAGUE_BY_CODE.get(code);
  if (!league) return { season, matches: [], teams: new Map() };

  const matches: FBMatch[] = [];
  const teams = new Map<string, FBTeam>();

  for (const f of fixtures) {
    const kickoffUtc = f.fixture.date;
    if (!kickoffUtc) continue;

    const homeName = f.teams.home.name;
    const awayName = f.teams.away.name;
    const homeSlug = slugify(homeName);
    const awaySlug = slugify(awayName);
    const homeId = `${league.id}-${homeSlug}`;
    const awayId = `${league.id}-${awaySlug}`;
    const dateKeyUtc = dateKeyUtcFromUtc(kickoffUtc);

    const finished = isFinished(f.fixture.status.short);
    const scheduled = isUpcoming(f.fixture.status.short);
    const status: FBMatch["status"] = finished ? "finished" : scheduled ? "scheduled" : "live";

    const ref = (id: string, slug: string, name: string): FBTeamRef => ({
      id,
      slug,
      name,
      short: deriveShort(name)
    });

    matches.push({
      id: `${league.id}-${homeSlug}-vs-${awaySlug}-${dateKeyUtc}`,
      providerId: `apifootball:${f.fixture.id}`,
      leagueId: league.id,
      season,
      kickoffUtc,
      dateKeyUtc,
      localDate: dateKeyUtc,
      timeUnknown: false,
      round: f.league.round,
      status,
      home: ref(homeId, homeSlug, homeName),
      away: ref(awayId, awaySlug, awayName),
      homeGoals: finished && f.goals.home != null ? f.goals.home : undefined,
      awayGoals: finished && f.goals.away != null ? f.goals.away : undefined,
      htHome: finished && f.score?.halftime?.home != null ? f.score.halftime.home : undefined,
      htAway: finished && f.score?.halftime?.away != null ? f.score.halftime.away : undefined
    });

    for (const t of [
      { id: homeId, slug: homeSlug, name: homeName },
      { id: awayId, slug: awaySlug, name: awayName }
    ]) {
      if (!teams.has(t.id)) {
        teams.set(t.id, {
          id: t.id,
          slug: t.slug,
          name: t.name,
          short: deriveShort(t.name),
          leagueId: league.id,
          colors: league.colors
        });
      }
    }
  }

  return { season, matches, teams };
}

export class ApiFootballProvider {
  private normalized = new Map<string, NormalizedSeason>();

  get enabled(): boolean {
    return apiConfig().enabled;
  }

  enabledFor(season: string): boolean {
    return Boolean(apiConfig().key);
  }

  private async loadSeason(season: string): Promise<void> {
    if (this.normalized.has(season)) return;
    const cfg = apiConfig();
    if (!cfg.key) return;

    const matches: FBMatch[] = [];
    const teams = new Map<string, FBTeam>();
    const seasonYear = apiSeasonYear(season);

    for (const league of FOOTBALL_LEAGUES) {
      const apiId = API_LEAGUE_IDS[league.code];
      if (!apiId) continue;
      try {
        const fixtures = await fetchLeagueFixtures(apiId, seasonYear);
        const normalized = normalize(season, league.code, fixtures);
        matches.push(...normalized.matches);
        for (const t of normalized.teams.values()) teams.set(t.id, t);
      } catch {
        // skip league on failure; keep whatever we already have
      }
    }

    this.normalized.set(season, { season, matches, teams });
  }

  async get(season: string): Promise<NormalizedSeason> {
    await this.loadSeason(season);
    return this.normalized.get(season) ?? { season, matches: [], teams: new Map() };
  }

  async refresh(season: string): Promise<void> {
    netCache.clear();
    this.normalized.delete(season);
    await this.loadSeason(season);
  }
}

export const apiFootballProvider = new ApiFootballProvider();
export function apiFootballEnabled(): boolean {
  return apiConfig().enabled;
}
