import currentEn from "@/data/snapshots/2026-27/en.1.json";
import currentEs from "@/data/snapshots/2026-27/es.1.json";
import currentDe from "@/data/snapshots/2026-27/de.1.json";
import currentIt from "@/data/snapshots/2026-27/it.1.json";
import currentFr from "@/data/snapshots/2026-27/fr.1.json";
import prevEn from "@/data/snapshots/2025-26/en.1.json";
import prevEs from "@/data/snapshots/2025-26/es.1.json";
import prevDe from "@/data/snapshots/2025-26/de.1.json";
import prevIt from "@/data/snapshots/2025-26/it.1.json";
import prevFr from "@/data/snapshots/2025-26/fr.1.json";

interface OpenFootballSeason {
  name: string;
  matches: Array<{
    round?: string;
    date: string;
    time?: string;
    team1: string;
    team2: string;
    score?: unknown;
  }>;
}

/** Bundled, real openfootball snapshots so the app works offline and on any serverless runtime. */
export const BUNDLED_SEASONS: Record<string, Record<string, OpenFootballSeason>> = {
  "2026-27": {
    "en.1": currentEn,
    "es.1": currentEs,
    "de.1": currentDe,
    "it.1": currentIt,
    "fr.1": currentFr
  },
  "2025-26": {
    "en.1": prevEn,
    "es.1": prevEs,
    "de.1": prevDe,
    "it.1": prevIt,
    "fr.1": prevFr
  }
};

export const BUNDLED_SEASON_KEYS = Object.keys(BUNDLED_SEASONS);
export const BUNDLED_LEAGUE_KEYS = Object.keys(BUNDLED_SEASONS["2026-27"]);