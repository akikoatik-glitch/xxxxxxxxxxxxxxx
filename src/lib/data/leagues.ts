import type { League } from "@/types";
import { FOOTBALL_LEAGUES } from "@/data/leagues";
import { BUNDLED_SEASONS } from "@/data/snapshots/registry";

function realAvgGoals(leagueId: string): number {
  let goals = 0;
  let games = 0;
  for (const season of Object.values(BUNDLED_SEASONS)) {
    const raw = season[leagueId] as unknown as { matches: Array<{ score?: { ft?: number[] } }> } | undefined;
    if (!raw) continue;
    for (const m of raw.matches) {
      const ft = m.score?.ft;
      if (ft && ft.length === 2) {
        goals += ft[0] + ft[1];
        games += 1;
      }
    }
  }
  return games > 0 ? +(goals / games).toFixed(2) : 2.6;
}

export const LEAGUES: League[] = FOOTBALL_LEAGUES.map((l) => ({
  id: l.id,
  slug: l.slug,
  name: l.name,
  country: l.country,
  code: l.code.toUpperCase().replace(".", ""),
  tier: l.tier,
  colors: l.colors,
  avgGoals: realAvgGoals(l.code)
}));

export function getLeagueBySlug(slug: string): League | undefined {
  return LEAGUES.find((l) => l.slug === slug);
}

export function getLeagueById(id: string): League | undefined {
  return LEAGUES.find((l) => l.id === id);
}