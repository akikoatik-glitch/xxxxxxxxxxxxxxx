import Link from "next/link";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import type { EnrichedPrediction } from "@/types";
import { ProbabilityBar } from "@/components/ui/probability-bar";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { LeagueBadge } from "@/components/ui/league-badge";
import { TeamCrest } from "@/components/ui/team-crest";
import { formatMatchDate, formatMatchTime, outcomeColor, outcomeLabel, teamUrl } from "@/lib/utils";

export function PredictionCard({ item, className }: { item: EnrichedPrediction; className?: string }) {
  const { prediction, match, homeTeam, awayTeam, league } = item;
  const outcomeProb =
    prediction.outcome === "HOME"
      ? prediction.probabilities.home
      : prediction.outcome === "DRAW"
        ? prediction.probabilities.draw
        : prediction.probabilities.away;

  return (
    <article className={className}>
      <Link
        href={`/predictions/${match.id}`}
        className="card group flex h-full flex-col gap-4 p-5 hover:border-accent/40"
      >
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <LeagueBadge league={league} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">{league.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-mute">{league.country}</p>
            </div>
          </div>
          <div className="shrink-0 text-right font-mono text-[11px] leading-5 text-mute">
            <p>{formatMatchDate(match.kickoffIso)}</p>
            <p className="text-accent/80">{formatMatchTime(match.kickoffIso)}</p>
          </div>
        </header>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <TeamCrest short={homeTeam.short} colors={homeTeam.colors} size="sm" />
            <span className="truncate text-sm font-semibold">{homeTeam.name}</span>
          </div>
          <span className="shrink-0 font-display text-xs font-bold text-mute">VS</span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 text-right">
            <span className="truncate text-sm font-semibold">{awayTeam.name}</span>
            <TeamCrest short={awayTeam.short} colors={awayTeam.colors} size="sm" />
          </div>
        </div>

        <div>
          <ProbabilityBar probabilities={prediction.probabilities} />
          <div className="mt-4 flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-mute">Predicted score</p>
              <p className="font-display text-2xl font-bold text-ink">
                {prediction.predictedScore.home} <span className="text-mute">-</span>{" "}
                {prediction.predictedScore.away}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-mute">Model call</p>
              <p className={`font-display text-sm font-bold ${outcomeColor(prediction.outcome)}`}>
                {outcomeLabel(prediction.outcome)} · {(outcomeProb * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-auto flex items-center justify-between border-t border-line/70 pt-4">
          <ConfidenceBadge value={prediction.confidence} />
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] text-mute sm:inline">
              O2.5 <span className="text-accent">{prediction.over25.toFixed(0)}%</span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-mute transition-colors group-hover:text-accent">
              Full analysis <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </footer>
      </Link>
    </article>
  );
}

export function PredictionMiniCard({ item }: { item: EnrichedPrediction }) {
  const { prediction, match, homeTeam, awayTeam, league } = item;
  return (
    <Link
      href={`/predictions/${match.id}`}
      className="glass flex items-center gap-4 p-4 transition-all hover:border-accent/40 hover:shadow-glow"
    >
      <LeagueBadge league={league} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {homeTeam.short} <span className="text-mute">vs</span> {awayTeam.short}
        </p>
        <p className="flex items-center gap-1 font-mono text-[11px] text-mute">
          <Clock className="h-3 w-3" />
          {formatMatchDate(match.kickoffIso)} {formatMatchTime(match.kickoffIso)}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-bold text-accent">{prediction.confidence}%</p>
        <p className="flex items-center justify-end gap-1 text-[10px] text-mute">
          <MapPin className="h-3 w-3" />
          {match.venue.split(" ")[0]}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-mute" />
    </Link>
  );
}