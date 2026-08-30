import type { Metadata } from "next";
import { computeModelStats, getFinishedPredictions } from "@/lib/predictions";
import { StatsCharts } from "@/components/stats/stats-charts";
import { CountUp } from "@/components/ui/count-up";
import { SectionHeading, GlassCard, Chip } from "@/components/ui/kit";

export const metadata: Metadata = {
  title: "Model Performance & Accuracy",
  description:
    "XWhiz model performance: hit rate, Brier score and fair-odds ROI simulation, computed only from predictions logged before kickoff and evaluated against real results.",
  alternates: { canonical: "/stats" }
};

export const revalidate = 3600;

export default async function StatsPage() {
  const stats = await computeModelStats();
  const sample = await getFinishedPredictions();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <SectionHeading
        align="left"
        kicker="Transparency"
        title={<>Model <span className="text-gradient">performance</span></>}
        subtitle="Computed only from predictions saved before kickoff and evaluated against real final results. We publish the losses too."
      />

      {!stats.evaluated ? (
        <GlassCard className="mx-auto mb-10 max-w-3xl p-10 text-center">
          <p className="font-display text-lg font-bold">Collecting evaluated picks…</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-mute">
            The first settled fixtures need to be logged and evaluated before performance numbers
            become meaningful. Check back once live matches have finished.
          </p>
        </GlassCard>
      ) : (
        <>
          <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <GlassCard className="text-center">
              <p className="font-display text-3xl font-bold text-accent">
                <CountUp end={stats.accuracy ?? 0} decimals={1} suffix="%" />
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest text-mute">Hit rate ({stats.totalPicks} picks)</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="font-display text-3xl font-bold text-gold">
                <CountUp end={stats.avgConfidence} suffix="%" />
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest text-mute">Avg confidence</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className={`font-display text-3xl font-bold ${stats.roiTotal >= 0 ? "text-success" : "text-danger"}`}>
                <CountUp end={stats.roiTotal} decimals={2} prefix={stats.roiTotal >= 0 ? "+" : ""} suffix="u" />
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest text-mute">ROI (fair odds, 1u flat)</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="font-display text-3xl font-bold text-warning">
                <CountUp end={stats.brierScore ?? 0} decimals={3} />
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest text-mute">Brier score</p>
            </GlassCard>
          </div>

          <StatsCharts stats={stats} />
        </>
      )}

      <p className="mx-auto mt-8 max-w-3xl text-center text-[11px] leading-relaxed text-mute">
        {stats.disclaimer}
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-widest">By league</h3>
          {stats.byLeague.length === 0 ? (
            <p className="text-sm text-mute">No evaluated picks yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.byLeague.map((l) => (
                <div key={l.slug} className="flex items-center justify-between rounded-lg border border-line/60 bg-elevated/50 px-4 py-3">
                  <span className="text-sm font-medium">{l.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-mute">{l.picks} picks</span>
                    {l.accuracy === null ? (
                      <span className="text-xs text-mute">—</span>
                    ) : (
                      <Chip tone={l.accuracy >= 60 ? "success" : l.accuracy >= 45 ? "warning" : "danger"}>
                        {l.accuracy.toFixed(1)}%
                      </Chip>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
        <GlassCard>
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-widest">
            Latest graded results
          </h3>
          <div className="space-y-2.5">
            {sample.length === 0 ? (
              <p className="text-sm text-mute">No settled predictions logged yet.</p>
            ) : (
              sample.slice(0, 8).map((p) => {
                const hs = p.match.homeScore ?? 0;
                const as = p.match.awayScore ?? 0;
                const actual = hs > as ? "HOME" : hs < as ? "AWAY" : "DRAW";
                const hit = actual === p.prediction.outcome;
                return (
                  <div
                    key={p.match.id}
                    className="flex items-center justify-between rounded-lg border border-line/60 bg-elevated/50 px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium">
                      {p.homeTeam.short} {hs}-{as} {p.awayTeam.short}
                    </span>
                    <span className="font-mono text-xs text-mute">pick {p.prediction.confidence}%</span>
                    <span className={hit ? "font-mono text-xs font-bold text-success" : "font-mono text-xs font-bold text-danger"}>
                      {hit ? "HIT" : "MISS"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}