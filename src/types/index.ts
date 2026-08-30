export interface League {
  id: string;
  slug: string;
  name: string;
  country: string;
  code: string;
  tier: number;
  colors: [string, string];
  avgGoals: number;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  leagueSlug: string;
  att: number;
  def: number;
  rating: number;
  colors: [string, string];
  venue: string;
  form: FormEntry[];
}

export interface FormEntry {
  result: "W" | "D" | "L";
  gf: number;
  ga: number;
}

export interface MatchWeather {
  tempC: number;
  condition: "Clear" | "Clouds" | "Rain" | "Wind";
  windKph: number;
}

export interface Match {
  id: string;
  leagueSlug: string;
  homeId: string;
  awayId: string;
  kickoffIso: string;
  venue: string;
  status: "scheduled" | "finished";
  homeScore?: number;
  awayScore?: number;
  timeUnknown?: boolean;
  htHome?: number;
  htAway?: number;
  round?: string;
  weather?: MatchWeather;
}

export type Outcome = "HOME" | "DRAW" | "AWAY";

export interface Prediction {
  matchId: string;
  probabilities: { home: number; draw: number; away: number };
  predictedScore: { home: number; away: number };
  outcome: Outcome;
  confidence: number;
  btts: number;
  over25: number;
  /** Model fair odds (no margin). Never bookmaker prices. */
  odds: { home: number; draw: number; away: number };
  xG: { home: number; away: number };
  factors: string[];
  modelVersion: string;
  generatedAt: string;
}

export interface EnrichedPrediction {
  prediction: Prediction;
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  league: League;
  evaluated?: {
    actualScore: { home: number; away: number };
    hit: boolean;
    brier: number;
    fairProfit: number;
  };
}

export interface H2HEntry {
  dateIso: string;
  homeShort: string;
  awayShort: string;
  homeGoals: number;
  awayGoals: number;
}

export interface LeagueAccuracy {
  slug: string;
  name: string;
  accuracy: number | null;
  picks: number;
}

export interface RoiPoint {
  index: number;
  date: string;
  profit: number;
}

export interface WeeklyAccuracy {
  week: string;
  accuracy: number | null;
  picks: number;
}

export interface ConfidenceBucket {
  bucket: string;
  accuracy: number | null;
  picks: number;
}

export interface ModelStats {
  /** Accuracy over evaluated (finished) predictions. Null until enough data. */
  accuracy: number | null;
  totalPicks: number;
  avgConfidence: number;
  brierScore: number | null;
  byLeague: LeagueAccuracy[];
  roiCurve: RoiPoint[];
  roiTotal: number;
  weekly: WeeklyAccuracy[];
  confidenceBuckets: ConfidenceBucket[];
  modelVersion: string;
  generatedAt: string;
  evaluated: boolean;
  disclaimer: string;
}

export interface HomeOverview {
  status: "ok" | "unavailable";
  source: string;
  lastSyncAt: string | null;
  todayCount: number;
  upcomingCount: number;
  competitions: number;
  liveCount: number;
  avgConfidence: number | null;
  topConfidence: number | null;
}