import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { GlassCard, Chip } from "@/components/ui/kit";
import { computeModelStats, getUpcomingPredictions, getFinishedPredictions } from "@/lib/predictions";
import { LEAGUES } from "@/lib/data/leagues";
import { TEAMS } from "@/lib/data/teams";
import { siteConfig } from "@/lib/config";
import { dataStatus } from "@/data/service";

export const metadata: Metadata = {
  title: "System Status (Admin)",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const stats = await computeModelStats();
  const upcoming = await getUpcomingPredictions();
  const finished = await getFinishedPredictions();
  const status = dataStatus();

  const integrations = [
    { name: "Football data (openfootball)", ok: status.status === "ok" },
    { name: "Postgres (Prisma)", ok: Boolean(process.env.DATABASE_URL) },
    { name: "Resend Email", ok: Boolean(process.env.RESEND_API_KEY) },
    { name: "Google Analytics", ok: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) }
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Internal</p>
      <h1 className="mt-2 font-display text-3xl font-black">System Status</h1>
      <p className="mt-2 text-sm text-mute">
        Private admin overview of the prediction engine and deployment integrations.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-widest">Engine</h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Model version", siteConfig.modelVersion],
              ["Data source", `${status.provider} (${status.mode})`],
              ["Loaded matches", String(status.matchCount)],
              ["Leagues", String(LEAGUES.length)],
              ["Teams", String(TEAMS.length)],
              ["Upcoming fixtures", String(upcoming.length)],
              ["Settled predictions logged", String(finished.length)],
              ["Hit rate", stats.evaluated ? `${stats.accuracy}%` : "collecting data…"],
              ["Brier score", stats.evaluated ? String(stats.brierScore) : "collecting data…"],
              ["Generated at", new Date(stats.generatedAt).toISOString()]
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-line/50 pb-2 last:border-0">
                <dt className="text-mute">{k}</dt>
                <dd className="font-mono text-xs text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-widest">Integrations</h2>
          <div className="space-y-2.5">
            {integrations.map((i) => (
              <div key={i.name} className="flex items-center justify-between rounded-lg border border-line/60 bg-elevated/50 px-4 py-2.5">
                <span className="text-sm">{i.name}</span>
                {i.ok ? (
                  <Chip tone="success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> configured
                  </Chip>
                ) : (
                  <Chip tone="warning">
                    <XCircle className="h-3.5 w-3.5" /> not configured
                  </Chip>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-mute">
            Football fixtures and results are real data from the openfootball project (freely
            licensed, no API key). The network feed falls back to a bundled snapshot if unavailable.
            A database (DATABASE_URL) additionally persists the immutable prediction journal.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}