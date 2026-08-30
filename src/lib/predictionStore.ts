import type { Outcome } from "@/types";
import { predictMatch, MODEL_VERSION } from "@/lib/engine";
import { getTeam } from "@/lib/data/teams";
import { getLeagueById } from "@/lib/data/leagues";
import type { FBMatch } from "@/data/types";

export interface StoredPrediction {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  leagueId: string;
  kickoffUtc: string;
  modelVersion: string;
  generatedAt: string;
  probabilities: { home: number; draw: number; away: number };
  predictedScore: { home: number; away: number };
  outcome: Outcome;
  confidence: number;
  btts: number;
  over25: number;
  fairOdds: { home: number; draw: number; away: number };
  xG: { home: number; away: number };
  factors: string[];
}

export interface EvaluatedPrediction extends StoredPrediction {
  actual: { home: number; away: number };
  hit: boolean;
  brier: number;
  fairProfit: number;
  evaluatedAt: string;
}

/**
 * Immutable prediction journal. A prediction is snapshotted once, before kickoff, and is
 * never modified afterwards. Evaluation attaches the real final result to the snapshot.
 *
 * Persistence stack (first available wins):
 *   1. Prisma (requires DATABASE_URL) — durable across instances.
 *   2. Local JSON file (./data/predictions.json) — durable on self-hosted Node.
 *   3. In-memory only — ephemeral per serverless instance.
 */
class PredictionStore {
  private byMatch = new Map<string, StoredPrediction>();
  private prisma: any = null;

  private async db(): Promise<any | null> {
    if (this.prisma) return this.prisma;
    if (!process.env.DATABASE_URL) return null;
    try {
      const { PrismaClient } = await import("@prisma/client");
      this.prisma = new PrismaClient();
      return this.prisma;
    } catch {
      return null;
    }
  }

  private async saveToDisk(): Promise<void> {
    if (process.env.VERCEL) return;
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const file = path.join(process.cwd(), "data", "predictions.json");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify([...this.byMatch.values()], null, 2));
    } catch {
      // non-fatal
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const file = path.join(process.cwd(), "data", "predictions.json");
      const raw = fs.readFileSync(file, "utf8");
      const rows = JSON.parse(raw) as StoredPrediction[];
      for (const r of rows) this.byMatch.set(r.matchId, r);
    } catch {
      // non-fatal
    }
  }

  private async loadFromDb(): Promise<void> {
    const db = await this.db();
    if (!db) return;
    try {
      const rows = await db.prediction.findMany();
      for (const r of rows) {
        try {
          const stored: StoredPrediction = {
            matchId: r.matchId,
            homeTeamId: r.homeTeamId,
            awayTeamId: r.awayTeamId,
            homeTeam: r.homeTeam,
            awayTeam: r.awayTeam,
            leagueId: r.leagueId,
            kickoffUtc: r.kickoffUtc,
            modelVersion: r.modelVersion,
            generatedAt: r.generatedAt,
            probabilities: JSON.parse(r.probabilities),
            predictedScore: JSON.parse(r.predictedScore),
            outcome: r.outcome as Outcome,
            confidence: r.confidence,
            btts: r.btts,
            over25: r.over25,
            fairOdds: JSON.parse(r.fairOdds),
            xG: JSON.parse(r.xG),
            factors: JSON.parse(r.factors)
          };
          this.byMatch.set(r.matchId, stored);
        } catch {
          // skip malformed row
        }
      }
    } catch {
      // non-fatal
    }
  }

  async warmUp(): Promise<void> {
    if (this.byMatch.size > 0) return;
    await this.loadFromDisk();
    if (process.env.DATABASE_URL) await this.loadFromDb();
  }

  /** Returns the immutable snapshot for a match, computing it once on first access. */
  async snapshotFor(match: FBMatch): Promise<StoredPrediction | null> {
    await this.warmUp();
    const existing = this.byMatch.get(match.id);
    if (existing) return existing;

    const home = getTeam(match.home.id);
    const away = getTeam(match.away.id);
    const league = getLeagueById(match.leagueId);
    if (!home || !away || !league) return null;

    const prediction = predictMatch(home, away, league, match.id, { xGoalHome: match.homeGoals, xGoalAway: match.awayGoals });

    const stored: StoredPrediction = {
      matchId: match.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeTeam: home.name,
      awayTeam: away.name,
      leagueId: league.id,
      kickoffUtc: match.kickoffUtc,
      modelVersion: prediction.modelVersion,
      generatedAt: prediction.generatedAt,
      probabilities: prediction.probabilities,
      predictedScore: prediction.predictedScore,
      outcome: prediction.outcome,
      confidence: prediction.confidence,
      btts: prediction.btts,
      over25: prediction.over25,
      fairOdds: prediction.odds,
      xG: prediction.xG,
      factors: prediction.factors
    };
    this.byMatch.set(match.id, stored);

    const db = await this.db();
    if (db) {
      try {
        await db.prediction.upsert({
          where: { matchId: match.id },
          update: {},
          create: {
            matchId: stored.matchId,
            homeTeamId: stored.homeTeamId,
            awayTeamId: stored.awayTeamId,
            homeTeam: stored.homeTeam,
            awayTeam: stored.awayTeam,
            leagueId: stored.leagueId,
            kickoffUtc: stored.kickoffUtc,
            modelVersion: stored.modelVersion,
            generatedAt: stored.generatedAt,
            probabilities: JSON.stringify(stored.probabilities),
            predictedScore: JSON.stringify(stored.predictedScore),
            outcome: stored.outcome,
            confidence: stored.confidence,
            btts: stored.btts,
            over25: stored.over25,
            fairOdds: JSON.stringify(stored.fairOdds),
            xG: JSON.stringify(stored.xG),
            factors: JSON.stringify(stored.factors)
          }
        });
      } catch {
        await this.saveToDisk();
      }
    } else {
      await this.saveToDisk();
    }
    return stored;
  }

  async get(matchId: string): Promise<StoredPrediction | undefined> {
    await this.warmUp();
    return this.byMatch.get(matchId);
  }

  async all(): Promise<StoredPrediction[]> {
    await this.warmUp();
    return [...this.byMatch.values()];
  }

  /** Evaluate a stored prediction against the real final result. Never modifies the snapshot. */
  evaluate(stored: StoredPrediction, match: FBMatch): EvaluatedPrediction | null {
    if (match.status !== "finished" || match.homeGoals === undefined || match.awayGoals === undefined) return null;
    const actualOutcome: Outcome = match.homeGoals > match.awayGoals ? "HOME" : match.homeGoals < match.awayGoals ? "AWAY" : "DRAW";
    const p = stored.probabilities;
    const y = { HOME: 0, DRAW: 0, AWAY: 0 };
    y[actualOutcome] = 1;
    const brier = (Math.pow(p.home - y.HOME, 2) + Math.pow(p.draw - y.DRAW, 2) + Math.pow(p.away - y.AWAY, 2)) / 3;
    const fairPrice = stored.fairOdds[stored.outcome.toLowerCase() as "home" | "draw" | "away"];
    const fairProfit = stored.outcome === actualOutcome ? fairPrice - 1 : -1;
    return {
      ...stored,
      actual: { home: match.homeGoals, away: match.awayGoals },
      hit: stored.outcome === actualOutcome,
      brier,
      fairProfit,
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const predictionStore = new PredictionStore();
export { MODEL_VERSION };

export async function getAllEvaluated(): Promise<EvaluatedPrediction[]> {
  const stored = await predictionStore.all();
  const out: EvaluatedPrediction[] = [];
  for (const s of stored) {
    const m = getMatchByProviderId(s.matchId);
    if (!m) continue;
    const ev = predictionStore.evaluate(s, m);
    if (ev) out.push(ev);
  }
  return out.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
}

import { getMatchDetails } from "@/data/service";
function getMatchByProviderId(id: string): FBMatch | undefined {
  return getMatchDetails(id);
}