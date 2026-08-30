export type FBMatchStatus = "scheduled" | "live" | "finished";

export interface FBLeagueMeta {
  id: string;
  code: string;
  slug: string;
  name: string;
  country: string;
  tier: number;
  colors: [string, string];
  timezone: string;
  avgGoals: number;
}

export interface FBTeamRef {
  id: string;
  slug: string;
  name: string;
  short: string;
}

export interface FBTeam {
  id: string;
  slug: string;
  name: string;
  short: string;
  leagueId: string;
  colors: [string, string];
  venue?: string;
}

export interface FBMatch {
  id: string;
  providerId: string;
  leagueId: string;
  season: string;
  kickoffUtc: string;
  dateKeyUtc: string;
  localDate: string;
  timeUnknown: boolean;
  round?: string;
  status: FBMatchStatus;
  home: FBTeamRef;
  away: FBTeamRef;
  homeGoals?: number;
  awayGoals?: number;
  htHome?: number;
  htAway?: number;
}

export interface StandingRow {
  rank: number;
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: Array<{ result: "W" | "D" | "L"; gf: number; ga: number }>;
}

export interface TeamMatchStats {
  played: number;
  scored: number;
  conceded: number;
  avgScored: number;
  avgConceded: number;
  home: { played: number; scored: number; conceded: number };
  away: { played: number; scored: number; conceded: number };
  results: Array<{
    dateUtc: string;
    result: "W" | "D" | "L";
    for: number;
    against: number;
    opponent: string;
    opponentId: string;
    leagueId: string;
    home: boolean;
  }>;
}

export interface DataStatus {
  provider: string;
  status: "ok" | "unavailable";
  lastSyncAt: string | null;
  loadedSeasons: string[];
  leagueCount: number;
  matchCount: number;
  mode: "network" | "snapshot";
}