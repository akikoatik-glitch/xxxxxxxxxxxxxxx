import type { H2HEntry, League, Team, Outcome } from "@/types";
import { clamp, poissonPmf } from "@/lib/seed";
import { getTeamStats, getHeadToHead } from "@/data/service";

export const MODEL_VERSION = "XWhiz Poisson v3.0";
const HOME_ADVANTAGE = 1.15;
const MAX_GOALS = 7;
const MIN_PLAYED_FOR_OBSERVED = 2;

export function formScore(team: Team): number {
  const points = team.form.map((f): number => (f.result === "W" ? 3 : f.result === "D" ? 1 : 0));
  return points.reduce((a, b) => a + b, 0);
}

function observedRates(teamId: string) {
  const stats = getTeamStats(teamId);
  if (!stats || stats.played < MIN_PLAYED_FOR_OBSERVED) return null;
  return { scored: stats.avgScored, conceded: stats.avgConceded };
}

export function predictMatch(
  home: Team,
  away: Team,
  league: League,
  matchId: string,
  opts?: { xGoalHome?: number; xGoalAway?: number }
) {
  const base = league.avgGoals / 2;

  const oh = observedRates(home.id);
  const oa = observedRates(away.id);

  const priorHome = (0.5 * home.att + 0.25 * away.def + 0.25 * base) * HOME_ADVANTAGE;
  const priorAway = 0.5 * away.att + 0.25 * home.def + 0.25 * base;

  let rawHome = priorHome;
  let rawAway = priorAway;
  if (oh && oa) {
    const observedHome = 0.6 * oh.scored + 0.4 * oa.conceded;
    const observedAway = 0.6 * oa.scored + 0.4 * oh.conceded;
    rawHome = 0.6 * priorHome + 0.4 * observedHome;
    rawAway = 0.6 * priorAway + 0.4 * observedAway;
  }

  const fh = formScore(home);
  const fa = formScore(away);
  const formFactor = 1 + ((fh - fa) / 15) * 0.09;
  const ratingFactorHome = 1 + ((home.rating - away.rating) / 100) * 0.14;
  const ratingFactorAway = 1 + ((away.rating - home.rating) / 100) * 0.10;

  const lambdaHome = clamp(rawHome * formFactor * ratingFactorHome, 0.2, 3.8);
  const lambdaAway = clamp(rawAway * formFactor * ratingFactorAway, 0.2, 3.8);

  const matrix: number[][] = [];
  let total = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    matrix[h] = [];
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
      matrix[h][a] = p;
      total += p;
    }
  }

  let pH = 0;
  let pD = 0;
  let pA = 0;
  let over25 = 0;
  let bttsH = 0;
  let bttsA = 0;
  let bestH = 0;
  let bestA = 0;
  let bestP = 0;

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = matrix[h][a] / total;
      if (h > a) pH += p;
      else if (h === a) pD += p;
      else pA += p;
      if (h + a > 2) over25 += p;
      if (h > 0) bttsH += p;
      if (a > 0) bttsA += p;
      if (p > bestP) {
        bestP = p;
        bestH = h;
        bestA = a;
      }
    }
  }

  const outcome: Outcome = pH >= pA && pH >= pD ? "HOME" : pA > pD ? "AWAY" : "DRAW";
  const maxP = Math.max(pH, pD, pA);
  const confidence = Math.round(clamp(50 + maxP * 46, 51, 93));

  const probs = { home: pH, draw: pD, away: pA };
  // Model fair odds (no bookmaker margin) — never presented as bookmaker prices.
  const odds = {
    home: round2(1 / Math.max(pH, 0.04)),
    draw: round2(1 / Math.max(pD, 0.04)),
    away: round2(1 / Math.max(pA, 0.04))
  };

  const factors: string[] = [];
  if (oh && oa) {
    if (oh.scored >= oa.conceded + 0.7) factors.push(`${home.short} score ${(oh.scored - oa.conceded).toFixed(1)} more goals/game than ${away.short} concede (${oh.scored.toFixed(2)} vs ${oa.conceded.toFixed(2)})`);
    if (oa.scored >= oh.conceded + 0.7) factors.push(`${away.short} score ${(oa.scored - oh.conceded).toFixed(1)} more goals/game than ${home.short} concede (${oa.scored.toFixed(2)} vs ${oh.conceded.toFixed(2)})`);
    if (oh.scored <= 1.05 && oa.scored <= 1.05) factors.push(`Both defences are tight this season (${oh.conceded.toFixed(2)} and ${oa.conceded.toFixed(2)} goals conceded/game)`);
  }
  if (fh - fa >= 4) factors.push(`${home.short} carry better recent form (${fh}/15 vs ${fa}/15 from last 5)`);
  else if (fa - fh >= 4) factors.push(`${away.short} carry better recent form (${fa}/15 vs ${fh}/15 from last 5)`);
  if (home.rating - away.rating >= 5) factors.push(`Squad rating edge: ${home.name} (${home.rating}) vs ${away.name} (${away.rating})`);
  if (away.rating - home.rating >= 5) factors.push(`Squad rating edge: ${away.name} (${away.rating}) vs ${home.name} (${home.rating})`);
  if (o2(over25) >= 0.6) factors.push(`${league.name} averages ${league.avgGoals.toFixed(2)} goals/game — model leans over 2.5 (${Math.round(over25 * 100)}%)`);
  if (factors.length < 3) factors.push(`Model projects xG ${lambdaHome.toFixed(2)} - ${lambdaAway.toFixed(2)} for this fixture`);
  if (factors.length < 4) factors.push(`Home advantage factor ${HOME_ADVANTAGE.toFixed(2)} applied to the home side`);

  return {
    matchId,
    probabilities: probs,
    predictedScore: { home: bestH, away: bestA },
    outcome,
    confidence,
    btts: bttsH * bttsA,
    over25,
    odds,
    xG: { home: lambdaHome, away: lambdaAway },
    factors,
    modelVersion: MODEL_VERSION,
    generatedAt: new Date().toISOString()
  };
}

function o2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getH2H(home: Team, away: Team, count = 5): H2HEntry[] {
  return getHeadToHead(home.id, away.id, count).map((m) => ({
    dateIso: m.kickoffUtc,
    homeShort: m.home.short,
    awayShort: m.away.short,
    homeGoals: m.homeGoals ?? 0,
    awayGoals: m.awayGoals ?? 0
  }));
}