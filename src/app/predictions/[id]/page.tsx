import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { getPredictionById } from "@/lib/predictions";
import { getH2H } from "@/lib/engine";
import { MatchDetailTabs } from "@/components/predictions/match-detail-tabs";
import { PredictionPulse } from "@/components/ui/prediction-pulse";
import { ProbabilityBar } from "@/components/ui/probability-bar";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { LeagueBadge } from "@/components/ui/league-badge";
import { TeamCrest } from "@/components/ui/team-crest";
import { Chip, GlassCard } from "@/components/ui/kit";
import { SportsEventJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { WatchlistButton } from "@/components/predictions/watchlist-button";
import { formatFullKickoff, outcomeLabel, outcomeColor, teamUrl } from "@/lib/utils";
import { siteConfig } from "@/lib/config";

export const revalidate = 1800;
export const dynamicParams = true;

export async function generateMetadata({
  params
}: {
  params: { id: string };
}): Promise<Metadata> {
  const item = await getPredictionById(params.id);
  if (!item) return { title: "Prediction not found" };
  const title = `${item.homeTeam.name} vs ${item.awayTeam.name} Prediction | ${siteConfig.name}`;
  return {
    title,
    description: `Free ${item.prediction.outcome === "HOME" ? "home win" : item.prediction.outcome === "AWAY" ? "away win" : "draw"} prediction for ${item.homeTeam.name} vs ${item.awayTeam.name} (${item.league.name}) at ${item.prediction.confidence}% model confidence. Kickoff ${formatFullKickoff(item.match.kickoffIso)}.`,
    alternates: { canonical: `/predictions/${item.match.id}` },
    openGraph: {
      title,
      description: `Free prediction for ${item.homeTeam.name} vs ${item.awayTeam.name}. ${outcomeLabel(item.prediction.outcome)} at ${item.prediction.confidence}% model confidence.`,
      url: `/predictions/${item.match.id}`
    }
  };
}

export default async function MatchPage({ params }: { params: { id: string } }) {
  const item = await getPredictionById(params.id);
  if (!item) notFound();

  const { prediction, match, homeTeam, awayTeam, league } = item;
  const h2h = getH2H(homeTeam, awayTeam);
  const outcomeProb =
    prediction.outcome === "HOME"
      ? prediction.probabilities.home
      : prediction.outcome === "DRAW"
        ? prediction.probabilities.draw
        : prediction.probabilities.away;

  const siteUrl = siteConfig.url;
  const homeSlug = teamUrl(homeTeam.name);
  const awaySlug = teamUrl(awayTeam.name);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SportsEventJsonLd
        name={`${homeTeam.name} vs ${awayTeam.name}`}
        startDate={match.kickoffIso}
        location={match.venue}
        homeTeam={homeTeam.name}
        awayTeam={awayTeam.name}
        url={`${siteUrl}/predictions/${match.id}`}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Predictions", url: `${siteUrl}/predictions` },
          { name: `${homeTeam.short} vs ${awayTeam.short}`, url: `${siteUrl}/predictions/${match.id}` }
        ]}
      />

      <Link
        href="/predictions"
        className="mb-8 inline-flex items-center gap-2 text-sm text-mute transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        All predictions
      </Link>

      <div className="glass relative mb-8 overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <LeagueBadge league={league} />
          <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
            <span className="font-semibold text-ink">{league.name}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatFullKickoff(match.kickoffIso)}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {match.venue}
            </span>
          </div>
        </div>

        <div className="relative mt-8 grid items-center gap-6 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center justify-end gap-4 sm:justify-start sm:flex-row-reverse sm:text-left">
            <div className="sm:text-left">
              <Link href={`/teams/${homeSlug}`} className="font-display text-xl font-bold transition-colors hover:text-accent">
                {homeTeam.name}
              </Link>
              <p className="text-xs text-mute">Home · rating {homeTeam.rating}</p>
            </div>
            <TeamCrest short={homeTeam.short} colors={homeTeam.colors} size="lg" />
          </div>
          <div className="text-center">
            <p className="font-display text-4xl font-black tracking-widest text-mute">VS</p>
            {match.status === "finished" && item.evaluated && (
              <p className="mt-1 font-display text-2xl font-black text-ink">
                {item.evaluated.actualScore.home} - {item.evaluated.actualScore.away}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 sm:flex-row">
            <TeamCrest short={awayTeam.short} colors={awayTeam.colors} size="lg" />
            <div>
              <Link href={`/teams/${awaySlug}`} className="font-display text-xl font-bold transition-colors hover:text-accent">
                {awayTeam.name}
              </Link>
              <p className="text-xs text-mute">Away · rating {awayTeam.rating}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative">
          <PredictionPulse active={prediction.confidence >= 70} />
          <GlassCard className="relative z-10 h-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold uppercase tracking-widest">Model Verdict</h2>
              <ConfidenceBadge value={prediction.confidence} />
            </div>

            <div className="mt-8">
              <div className="mb-6 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-line/60 bg-elevated/60 p-5">
                <TeamCrest short={homeTeam.short} colors={homeTeam.colors} size="sm" />
                <p className="font-display text-4xl font-black tracking-wider text-glow">
                  {prediction.predictedScore.home} <span className="text-mute">-</span> {prediction.predictedScore.away}
                </p>
                <TeamCrest short={awayTeam.short} colors={awayTeam.colors} size="sm" />
              </div>

              <ProbabilityBar probabilities={prediction.probabilities} />
              <p className="mt-6 text-center text-sm text-mute">
                Model calls{" "}
                <span className={`font-bold ${outcomeColor(prediction.outcome)}`}>
                  {outcomeLabel(prediction.outcome)}
                </span>{" "}
                at <span className="font-mono font-bold text-ink">{(outcomeProb * 100).toFixed(1)}%</span> ·
                Over 2.5 <span className="font-mono font-bold text-ink">{(prediction.over25 * 100).toFixed(0)}%</span> ·
                BTTS <span className="font-mono font-bold text-ink">{(prediction.btts * 100).toFixed(0)}%</span> ·
                Projected xG <span className="font-mono font-bold text-ink">{prediction.xG.home.toFixed(2)}-{prediction.xG.away.toFixed(2)}</span>
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px] text-mute">
                <span>Model: <span className="font-mono">{item.prediction.modelVersion}</span></span>
                <span>
                  Prediction saved:{" "}
                  <span className="font-mono">{new Date(item.prediction.generatedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</span>
                </span>
              </div>
            </div>

            {match.status === "finished" && item.evaluated && (
              <div
                className={`mt-6 flex items-center gap-3 rounded-xl border p-4 ${
                  item.evaluated.hit ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5"
                }`}
              >
                {item.evaluated.hit ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
                ) : (
                  <XCircle className="h-6 w-6 shrink-0 text-danger" />
                )}
                <p className="text-sm text-mute">
                  Final: <span className="font-mono font-bold text-ink">{item.evaluated.actualScore.home}-{item.evaluated.actualScore.away}</span>.
                  The {item.evaluated.hit ? "pick hit" : "pick missed"} — hit rate and accuracy are logged on the{" "}
                  <Link href="/stats" className="text-accent underline decoration-dotted underline-offset-2">stats page</Link>.
                </p>
              </div>
            )}
          </GlassCard>
        </div>

        <GlassCard>
          <h2 className="mb-1 font-display text-lg font-bold uppercase tracking-widest">Model Fair Odds</h2>
          <p className="mb-5 text-[11px] leading-relaxed text-mute">
            Fair prices from our probabilities (no bookmaker margin). Not bookmaker odds.
          </p>
          <div className="space-y-3">
            {[
              { label: `${homeTeam.short} — Home`, odds: prediction.odds.home, prob: prediction.probabilities.home, tone: "success" as const },
              { label: "Draw", odds: prediction.odds.draw, prob: prediction.probabilities.draw, tone: "warning" as const },
              { label: `${awayTeam.short} — Away`, odds: prediction.odds.away, prob: prediction.probabilities.away, tone: "danger" as const }
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg border border-line/60 bg-elevated/50 px-4 py-3"
              >
                <Chip tone={row.tone}>{row.label}</Chip>
                <div className="text-right">
                  <p className="font-mono text-lg font-bold text-ink">{row.odds.toFixed(2)}</p>
                  <p className="font-mono text-[11px] text-mute">{(row.prob * 100).toFixed(1)}% implied</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <WatchlistButton matchId={match.id} />
          </div>
          <Link
            href={`/leagues/${league.slug}`}
            className="mt-2 block text-center text-xs text-mute transition-colors hover:text-accent"
          >
            More {league.name} predictions →
          </Link>
        </GlassCard>
      </div>

      <MatchDetailTabs item={item} h2h={h2h} />

      <GlassCard className="mx-auto mt-10 max-w-3xl text-center">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-ink">
          Check the available odds &amp; bet responsibly
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-mute">
          Our betting partner{" "}
          <a
            href={siteConfig.affiliate.url}
            target="_blank"
            rel="sponsored noopener noreferrer nofollow"
            className="font-semibold text-accent underline decoration-dotted underline-offset-2"
          >
            {siteConfig.affiliate.label}
          </a>{" "}
          offers markets on these fixtures — use promo code{" "}
          <span className="font-mono font-semibold text-ink">{siteConfig.affiliate.promoCode}</span>. We may
          earn a commission if you sign up.
        </p>
        <a href={siteConfig.affiliate.url} target="_blank" rel="sponsored noopener noreferrer nofollow" className="btn-gold mt-4">
          Check odds at {siteConfig.affiliate.label}
          <ExternalLink className="h-4 w-4" />
        </a>
        <p className="mx-auto mt-3 max-w-xl text-[11px] leading-relaxed text-mute">
          Predictions are statistical estimates, not guarantees. Football outcomes are unpredictable.
          Never risk money you cannot afford to lose. 18+.
        </p>
      </GlassCard>
    </div>
  );
}