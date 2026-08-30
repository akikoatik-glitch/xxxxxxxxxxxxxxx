import type { FBLeagueMeta } from "./types";

/** Competitions XWhiz actually analyzes. Coverage is driven by the openfootball provider. */
export const FOOTBALL_LEAGUES: FBLeagueMeta[] = [
  {
    id: "epl",
    code: "en.1",
    slug: "premier-league",
    name: "Premier League",
    country: "England",
    tier: 1,
    colors: ["#38BDF8", "#1D4ED8"],
    timezone: "Europe/London",
    avgGoals: 0
  },
  {
    id: "laliga",
    code: "es.1",
    slug: "la-liga",
    name: "La Liga",
    country: "Spain",
    tier: 1,
    colors: ["#F97316", "#B91C1C"],
    timezone: "Europe/Madrid",
    avgGoals: 0
  },
  {
    id: "seriea",
    code: "it.1",
    slug: "serie-a",
    name: "Serie A",
    country: "Italy",
    tier: 1,
    colors: ["#22D3EE", "#0E7490"],
    timezone: "Europe/Rome",
    avgGoals: 0
  },
  {
    id: "bundesliga",
    code: "de.1",
    slug: "bundesliga",
    name: "Bundesliga",
    country: "Germany",
    tier: 1,
    colors: ["#FACC15", "#DC2626"],
    timezone: "Europe/Berlin",
    avgGoals: 0
  },
  {
    id: "ligue1",
    code: "fr.1",
    slug: "ligue-1",
    name: "Ligue 1",
    country: "France",
    tier: 1,
    colors: ["#A3E635", "#15803D"],
    timezone: "Europe/Paris",
    avgGoals: 0
  }
];

export const LEAGUE_BY_ID = new Map<string, FBLeagueMeta>(FOOTBALL_LEAGUES.map((l) => [l.id, l]));
export const LEAGUE_BY_CODE = new Map<string, FBLeagueMeta>(FOOTBALL_LEAGUES.map((l) => [l.code, l]));
export const LEAGUE_BY_SLUG = new Map<string, FBLeagueMeta>(FOOTBALL_LEAGUES.map((l) => [l.slug, l]));

/** "2026-27" style season label for the current football season. */
export function currentSeasonLabel(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  if (m >= 7) return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  return `${y - 1}-${String(y % 100).padStart(2, "0")}`;
}

export function previousSeasonLabel(season: string): string {
  const [a, b] = season.split("-").map(Number);
  return `${a - 1}-${String(b - 1).padStart(2, "0")}`;
}