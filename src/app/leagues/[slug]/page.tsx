import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LEAGUES, getLeagueBySlug } from "@/lib/data/leagues";
import { getTeamsByLeague } from "@/lib/data/teams";
import { getMatchesByLeague } from "@/lib/data/matches";
import { getUpcomingPredictions } from "@/lib/predictions";
import { getStandings } from "@/data/service";
import { PredictionMiniCard } from "@/components/predictions/prediction-card";
import { GlassCard } from "@/components/ui/kit";
import { LeagueBadge } from "@/components/ui/league-badge";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/config";
import { formatMatchDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const revalidate = 1800;

export function generateStaticParams() {
  return LEAGUES.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const league = getLeagueBySlug(params.slug);
  if (!league) return { title: "League not found" };
  return {
    title: `${league.name} Predictions & Standings`,
    description: `Free football predictions, model fixtures and standings for ${league.name} (${league.country}). Every fixture graded by the XWhiz Lite model.`,
    alternates: { canonical: `/leagues/${league.slug}` }
  };
}

export default async function LeaguePage({ params }: { params: { slug: string } }) {
  const league = getLeagueBySlug(params.slug);
  if (!league) notFound();

  const teams = getTeamsByLeague(league.id);
  const { finished } = getMatchesByLeague(league.id);
  const upcomingPredictions = (await getUpcomingPredictions())
    .filter((p) => p.league.slug === league.slug)
    .sort((a, b) => new Date(a.match.kickoffIso).getTime() - new Date(b.match.kickoffIso).getTime());

  const rows = getStandings(league.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteConfig.url },
          { name: "Leagues", url: `${siteConfig.url}/leagues` },
          { name: league.name, url: `${siteConfig.url}/leagues/${league.slug}` }
        ]}
      />
      <Link
        href="/leagues"
        className="mb-8 inline-flex items-center gap-2 text-sm text-mute transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        All leagues
      </Link>

      <div className="mb-10 flex items-center gap-5">
        <LeagueBadge league={league} size="lg" />
        <div>
          <h1 className="font-display text-3xl font-black tracking-wide">{league.name}</h1>
          <p className="text-sm text-mute">
            {league.country} · Avg {league.avgGoals.toFixed(2)} goals/game · {upcomingPredictions.length} upcoming picks
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <GlassCard className="overflow-x-auto">
          <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-widest">Standings</h2>
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-mute">
                <th className="pb-2 pr-2">#</th>
                <th className="pb-2 pr-2">Club</th>
                <th className="pb-2 px-1 text-center">P</th>
                <th className="pb-2 px-1 text-center">W</th>
                <th className="pb-2 px-1 text-center">D</th>
                <th className="pb-2 px-1 text-center">L</th>
                <th className="pb-2 px-1 text-center">GD</th>
                <th className="pb-2 px-1 text-center">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const team = teams.find((t) => t.id === row.teamId);
                const name = team?.name ?? row.teamName;
                return (
                  <tr key={row.teamId} className="border-b border-line/40 last:border-0">
                    <td className="py-2.5 pr-2 font-mono text-xs text-mute">{row.rank}</td>
                    <td className="py-2.5 pr-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: `linear-gradient(135deg, ${team?.colors[0] ?? "#888"}, ${team?.colors[1] ?? "#555"})` }}
                        />
                        <Link href={`/teams/${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`} className="font-medium text-ink transition-colors hover:text-accent">
                          {name}
                        </Link>
                      </span>
                    </td>
                    <td className="px-1 text-center font-mono text-xs">{row.played}</td>
                    <td className="px-1 text-center font-mono text-xs text-success">{row.won}</td>
                    <td className="px-1 text-center font-mono text-xs text-warning">{row.drawn}</td>
                    <td className="px-1 text-center font-mono text-xs text-danger">{row.lost}</td>
                    <td className="px-1 text-center font-mono text-xs">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                    <td className="px-1 text-center font-mono text-sm font-bold text-ink">{row.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </GlassCard>

        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-widest">
            Upcoming picks
          </h2>
          {upcomingPredictions.length === 0 && (
            <GlassCard>
              <p className="text-sm text-mute">No upcoming fixtures modelled for this league right now.</p>
            </GlassCard>
          )}
          {upcomingPredictions.slice(0, 10).map((p) => (
            <PredictionMiniCard key={p.match.id} item={p} />
          ))}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-widest">Recent results</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {finished.slice(0, 9).map((m) => {
            const home = teams.find((t) => t.id === m.homeId);
            const away = teams.find((t) => t.id === m.awayId);
            if (!home || !away) return null;
            return (
              <div key={m.id} className="glass flex items-center justify-between p-4">
                <span className="text-sm font-medium">
                  {home.short} <span className="text-mute">vs</span> {away.short}
                </span>
                <span
                  className={cn(
                    "font-mono font-bold",
                    (m.homeScore ?? 0) > (m.awayScore ?? 0) ? "text-success" : (m.homeScore ?? 0) < (m.awayScore ?? 0) ? "text-danger" : "text-warning"
                  )}
                >
                  {m.homeScore} - {m.awayScore}
                </span>
                <span className="font-mono text-[10px] text-mute">{formatMatchDate(m.kickoffIso)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
