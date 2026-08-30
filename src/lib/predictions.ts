import type { EnrichedPrediction, HomeOverview, ModelStats, Prediction, RoiPoint, WeeklyAccuracy, Match } from "@/types";
import { predictionStore, getAllEvaluated } from "@/lib/predictionStore";
import type { FBMatch } from "@/data/types";
import { getUpcomingMatches, getFinishedMatches, getMatchById, getTodayMatches } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { getLeagueById } from "@/lib/data/leagues";
import { MODEL_VERSION } from "@/lib/engine";
import { dataStatus, getTodayByLeague } from "@/data/service";

const DAY_MS = 86400000;

export async function enrichAsync(match: Match): Promise<EnrichedPrediction | null> {
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  const league = getLeagueById(match.leagueSlug);
  if (!home || !away || !league) return null;

  const fbMatch: FBMatch = {
    id: match.id,
    providerId: match.id,
    leagueId: league.id,
    season: "",
    kickoffUtc: match.kickoffIso,
    dateKeyUtc: match.kickoffIso.slice(0, 10).replace(/-/g, ""),
    localDate: match.kickoffIso.slice(0, 10),
    timeUnknown: Boolean(match.timeUnknown),
    round: match.round,
    status: match.status === "finished" ? "finished" : "scheduled",
    home: { id: home.id, slug: home.id.split("-").slice(1).join("-"), name: home.name, short: home.short },
    away: { id: away.id, slug: away.id.split("-").slice(1).join("-"), name: away.name, short: away.short },
    homeGoals: match.homeScore,
    awayGoals: match.awayScore,
    htHome: match.htHome,
    htAway: match.htAway
  };

  const stored = await predictionStore.snapshotFor({ ...fbMatch, status: "scheduled" });
  if (!stored) return null;

  const prediction: Prediction = {
    matchId: stored.matchId,
    probabilities: stored.probabilities,
    predictedScore: stored.predictedScore,
    outcome: stored.outcome,
    confidence: stored.confidence,
    btts: stored.btts,
    over25: stored.over25,
    odds: stored.fairOdds,
    xG: stored.xG,
    factors: stored.factors,
    modelVersion: stored.modelVersion,
    generatedAt: stored.generatedAt
  };

  const result: EnrichedPrediction = { prediction, match, homeTeam: home, awayTeam: away, league };
  if (match.status === "finished" && match.homeScore !== undefined && match.awayScore !== undefined) {
    const ev = predictionStore.evaluate(stored, {
      ...fbMatch,
      status: "finished",
      homeGoals: match.homeScore,
      awayGoals: match.awayScore
    });
    if (ev) {
      result.evaluated = {
        actualScore: { home: match.homeScore, away: match.awayScore },
        hit: ev.hit,
        brier: ev.brier,
        fairProfit: ev.fairProfit
      };
    }
  }
  return result;
}

export async function getUpcomingPredictions(): Promise<EnrichedPrediction[]> {
  const out: EnrichedPrediction[] = [];
  for (const m of getUpcomingMatches()) {
    const e = await enrichAsync(m);
    if (e) out.push(e);
  }
  return out;
}

export async function getTodayPredictions(): Promise<EnrichedPrediction[]> {
  const out: EnrichedPrediction[] = [];
  for (const m of getTodayMatches()) {
    const e = await enrichAsync(m);
    if (e) out.push(e);
  }
  return out;
}

export async function getFinishedPredictions(): Promise<EnrichedPrediction[]> {
  const out: EnrichedPrediction[] = [];
  for (const m of getFinishedMatches().slice(0, 120)) {
    const e = await enrichAsync(m);
    if (e && e.evaluated) out.push(e);
  }
  return out;
}

export async function getPredictionById(id: string): Promise<EnrichedPrediction | undefined> {
  const match = getMatchById(id);
  if (!match) return undefined;
  return (await enrichAsync(match)) ?? undefined;
}

export interface PredictionFilters {
  league?: string;
  minConfidence?: number;
  search?: string;
  limit?: number;
}

export function filterPredictions(items: EnrichedPrediction[], filters: PredictionFilters): EnrichedPrediction[] {
  const league = filters.league;
  const minConfidence = filters.minConfidence ?? 0;
  const search = filters.search ?? "";
  let out = items;
  if (league && league !== "all") {
    out = out.filter((p) => p.league.slug === league);
  }
  if (minConfidence > 0) {
    out = out.filter((p) => p.prediction.confidence >= minConfidence);
  }
  if (search) {
    const q = search.toLowerCase();
    out = out.filter(
      (p) =>
        p.homeTeam.name.toLowerCase().includes(q) ||
        p.awayTeam.name.toLowerCase().includes(q) ||
        p.league.name.toLowerCase().includes(q)
    );
  }
  out = [...out].sort((a, b) => b.prediction.confidence - a.prediction.confidence);
  if (filters.limit) out = out.slice(0, filters.limit);
  return out;
}

export async function getTopPredictions(limit: number): Promise<EnrichedPrediction[]> {
  const items = await getUpcomingPredictions();
  return items
    .slice()
    .sort((a, b) => b.prediction.confidence - a.prediction.confidence)
    .slice(0, limit);
}

export { getPredictionType, PREDICTION_TYPE_LABELS, type PredictionType } from "@/lib/prediction-types";

const BUCKETS = [
  { bucket: "50-59%", min: 50, max: 60 },
  { bucket: "60-69%", min: 60, max: 70 },
  { bucket: "70-79%", min: 70, max: 80 },
  { bucket: "80%+", min: 80, max: 101 }
];

const PERFORMANCE_DISCLAIMER =
  "Performance is computed exclusively from predictions that were saved before kickoff and evaluated against real final results. ROI is simulated at model fair odds (no bookmaker margin) and is not a bookmaker return. Small samples are not statistically meaningful.";

export async function computeModelStats(): Promise<ModelStats> {
  const evaluated = await getAllEvaluated();
  const items = evaluated.slice().sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

  let correct = 0;
  let brierSum = 0;
  let confidenceSum = 0;
  let profit = 0;
  const leagueMap = new Map<string, { name: string; hits: number; picks: number }>();
  const weekMap = new Map<string, { hits: number; picks: number }>();
  const bucketStats = BUCKETS.map((b) => ({ ...b, hits: 0, picks: 0 }));
  const roiCurve: RoiPoint[] = [];

  items.forEach((item, index) => {
    const y = { HOME: 0, DRAW: 0, AWAY: 0 };
    y[item.actual.home > item.actual.away ? "HOME" : item.actual.home < item.actual.away ? "AWAY" : "DRAW"] = 1;
    const p = item.probabilities;
    brierSum += (Math.pow(p.home - y.HOME, 2) + Math.pow(p.draw - y.DRAW, 2) + Math.pow(p.away - y.AWAY, 2)) / 3;

    if (item.hit) correct++;
    confidenceSum += item.confidence;

    const lg = leagueMap.get(item.leagueId) ?? { name: item.leagueId, hits: 0, picks: 0 };
    lg.picks++;
    if (item.hit) lg.hits++;
    lg.name = lg.name === item.leagueId ? getLeagueById(item.leagueId)?.name ?? item.leagueId : lg.name;
    leagueMap.set(item.leagueId, lg);

    const kickoff = new Date(item.kickoffUtc);
    const weekStart = new Date(kickoff.getTime() - kickoff.getUTCDay() * DAY_MS);
    const weekKey = weekStart.toISOString().slice(5, 10);
    const wk = weekMap.get(weekKey) ?? { hits: 0, picks: 0 };
    wk.picks++;
    if (item.hit) wk.hits++;
    weekMap.set(weekKey, wk);

    const bucket = bucketStats.find((b) => item.confidence >= b.min && item.confidence < b.max);
    if (bucket) {
      bucket.picks++;
      if (item.hit) bucket.hits++;
    }

    profit += item.fairProfit;
    roiCurve.push({
      index: index + 1,
      date: item.kickoffUtc.slice(5, 10),
      profit: Math.round(profit * 100) / 100
    });
  });

  const total = items.length;
  const weekly: WeeklyAccuracy[] = [...weekMap.entries()]
    .map(([week, v]) => ({ week, accuracy: v.picks ? Math.round((v.hits / v.picks) * 1000) / 10 : null, picks: v.picks }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return {
    accuracy: total ? Math.round((correct / total) * 1000) / 10 : null,
    totalPicks: total,
    avgConfidence: total ? Math.round(confidenceSum / total) : 0,
    brierScore: total ? Math.round((brierSum / total) * 1000) / 1000 : null,
    byLeague: [...leagueMap.entries()].map(([slug, v]) => ({
      slug,
      name: v.name,
      accuracy: v.picks ? Math.round((v.hits / v.picks) * 1000) / 10 : null,
      picks: v.picks
    })),
    roiCurve,
    roiTotal: Math.round(profit * 100) / 100,
    weekly,
    confidenceBuckets: bucketStats.map((b) => ({
      bucket: b.bucket,
      accuracy: b.picks ? Math.round((b.hits / b.picks) * 1000) / 10 : null,
      picks: b.picks
    })),
    modelVersion: MODEL_VERSION,
    generatedAt: new Date().toISOString(),
    evaluated: total > 0,
    disclaimer: PERFORMANCE_DISCLAIMER
  };
}

export async function getHomeOverview(): Promise<HomeOverview> {
  const now = new Date();
  const status = dataStatus();
  const todayByLeague = getTodayByLeague(now);
  const todayPredictions = await getTodayPredictions();
  const upcoming = await getUpcomingPredictions();

  const avgConfidence = todayPredictions.length
    ? Math.round(todayPredictions.reduce((n, p) => n + p.prediction.confidence, 0) / todayPredictions.length)
    : null;
  const topConfidence = todayPredictions.length
    ? Math.max(...todayPredictions.map((p) => p.prediction.confidence))
    : null;

  return {
    status: status.status,
    source: `${status.provider} (${status.mode === "network" ? "live network refresh" : "bundled snapshot"})`,
    lastSyncAt: status.lastSyncAt,
    todayCount: [...todayByLeague.values()].reduce((n, list) => n + list.length, 0),
    upcomingCount: upcoming.length,
    competitions: status.leagueCount,
    liveCount: 0,
    avgConfidence,
    topConfidence
  };
}