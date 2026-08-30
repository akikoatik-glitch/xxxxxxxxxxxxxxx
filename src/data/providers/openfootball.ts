import { BUNDLED_SEASONS } from "@/data/snapshots/registry";
import { LEAGUE_BY_CODE } from "@/data/leagues";
import type { FBMatch, FBTeam, FBTeamRef } from "@/data/types";
import { slugify, wallClockToUtc, dateKeyUtcFromUtc } from "@/data/time";

/** Raw shape coming out of openfootball/football.json */
export interface RawSeason {
  name: string;
  matches: Array<{
    round?: string;
    date: string;
    time?: string;
    team1: string;
    team2: string;
    score?: { ft?: number[]; ht?: number[] };
  }>;
}

const RAW_BASE = "https://raw.githubusercontent.com/openfootball/football.json/master";

const NETWORK_TTL_MS = 6 * 60 * 60 * 1000;
const netCache = new Map<string, { at: number; data: RawSeason }>();

async function fetchRaw(season: string, code: string): Promise<RawSeason | null> {
  const key = `${season}/${code}`;
  const cached = netCache.get(key);
  if (cached && Date.now() - cached.at < NETWORK_TTL_MS) return cached.data;

  try {
    const res = await fetch(`${RAW_BASE}/${season}/${code}.json`, {
      headers: { "User-Agent": "xwhiz-football/1.0 (data sync)", Accept: "application/json" },
      cache: "no-store"
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RawSeason;
    if (!Array.isArray(data?.matches)) return null;
    netCache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

export function deriveShort(name: string): string {
  const words = name.replace(/AFC|FC|CF|SC|of|the/gi, " ").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  return name.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
}

export interface NormalizedSeason {
  season: string;
  matches: FBMatch[];
  teams: Map<string, FBTeam>;
}

export function normalizeSeason(season: string, code: string, raw: RawSeason): NormalizedSeason {
  const league = LEAGUE_BY_CODE.get(code);
  if (!league) return { season, matches: [], teams: new Map() };

  const matches: FBMatch[] = [];
  const teams = new Map<string, FBTeam>();

  raw.matches.forEach((m, i) => {
    const timeUnknown = !m.time;
    const kickoffUtc = wallClockToUtc(m.date, m.time, league.timezone);
    const homeSlug = slugify(m.team1);
    const awaySlug = slugify(m.team2);
    const homeId = `${league.id}-${homeSlug}`;
    const awayId = `${league.id}-${awaySlug}`;
    const finished = Boolean(m.score?.ft);

      const ref = (id: string, slug: string, name: string): FBTeamRef => ({
    id,
    slug,
    name,
    short: deriveShort(name)
  });

  matches.push({
    id: `${league.id}-${homeSlug}-vs-${awaySlug}-${dateKeyUtcFromUtc(kickoffUtc)}`,
    providerId: `${season}/${code}#${i}`,
    leagueId: league.id,
    season,
    kickoffUtc,
    dateKeyUtc: dateKeyUtcFromUtc(kickoffUtc),
    localDate: m.date,
    timeUnknown,
    round: m.round,
    status: finished ? "finished" : "scheduled",
    home: ref(homeId, homeSlug, m.team1),
    away: ref(awayId, awaySlug, m.team2),
    homeGoals: finished ? m.score?.ft?.[0] : undefined,
    awayGoals: finished ? m.score?.ft?.[1] : undefined,
    htHome: m.score?.ht?.[0],
    htAway: m.score?.ht?.[1]
  });

  for (const t of [
    { id: homeId, slug: homeSlug, name: m.team1 },
    { id: awayId, slug: awaySlug, name: m.team2 }
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
});

  return { season, matches, teams };
}

export class OpenFootballProvider {
  private normalized = new Map<string, NormalizedSeason>();

  /** Synchronous build from the bundled snapshots — always available, no network. */
  getBundledSync(): Map<string, NormalizedSeason> {
    const out = new Map<string, NormalizedSeason>();
    for (const [season, leagues] of Object.entries(BUNDLED_SEASONS)) {
      const matches: FBMatch[] = [];
      const teams = new Map<string, FBTeam>();
      for (const code of Object.keys(leagues)) {
        const raw = leagues[code] as unknown as RawSeason;
        const normalized = normalizeSeason(season, code, raw);
        matches.push(...normalized.matches);
        for (const t of normalized.teams.values()) teams.set(t.id, t);
      }
      out.set(season, { season, matches, teams });
    }
    return out;
  }

  private async loadSeason(season: string): Promise<void> {
    if (this.normalized.has(season)) return;

    const matches: FBMatch[] = [];
    const teams = new Map<string, FBTeam>();

    for (const code of ["en.1", "es.1", "de.1", "it.1", "fr.1"]) {
      const league = LEAGUE_BY_CODE.get(code);
      if (!league) continue;

      let raw: RawSeason | null = null;
      if (process.env.FOOTBALL_DATA_MODE !== "snapshot") {
        raw = await fetchRaw(season, code);
      }
      if (!raw) {
        const bundled = (BUNDLED_SEASONS[season] ?? {})[code] as unknown as RawSeason | undefined;
        if (bundled) raw = bundled;
      }
      if (!raw) continue;

      const normalized = normalizeSeason(season, code, raw);
      matches.push(...normalized.matches);
      for (const t of normalized.teams.values()) teams.set(t.id, t);
    }

    this.normalized.set(season, { season, matches, teams });
  }

  async get(season: string, codes?: string[]): Promise<NormalizedSeason> {
    if (this.normalized.has(season) && !codes) return this.normalized.get(season)!;
    await this.loadSeason(season);
    return this.normalized.get(season) ?? { season, matches: [], teams: new Map() };
  }

  /** Force re-fetch from network for the given season (used by the sync route). */
  async refresh(season: string): Promise<void> {
    netCache.clear();
    this.normalized.delete(season);
    await this.loadSeason(season);
  }
}

export const openfootballProvider = new OpenFootballProvider();