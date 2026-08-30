import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Home, MapPin, TrendingUp } from "lucide-react";
import { getTeamBySlug, getAllTeamSlugs } from "@/lib/data/teams";
import { getLeagueById } from "@/lib/data/leagues";
import { getUpcomingPredictions, getFinishedPredictions } from "@/lib/predictions";
import { PredictionMiniCard } from "@/components/predictions/prediction-card";
import { GlassCard } from "@/components/ui/kit";
import { TeamCrest } from "@/components/ui/team-crest";
import { SportsTeamJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/config";
import { formatMatchDate, cn } from "@/lib/utils";

export const revalidate = 1800;
export const dynamicParams = true;

export function generateStaticParams() {
  return getAllTeamSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const team = getTeamBySlug(params.slug);
  if (!team) return { title: "Team not found" };
  const league = getLeagueById(team.leagueSlug);
  return {
    title: `${team.name} • Predictions, Form & Fixtures`,
    description: `${team.name} football predictions, form guide, ratings and upcoming fixtures (${
      league?.name ?? "European football"
    }). Free ${team.name} match predictions from the XWhiz Lite model.`,
    alternates: { canonical: `/teams/${params.slug}` }
  };
}

export default async function TeamPage({ params }: { params: { slug: string } }) {
  const team = getTeamBySlug(params.slug);
  if (!team) notFound();

  const league = getLeagueById(team.leagueSlug);
  const upcoming = (await getUpcomingPredictions())
    .filter((p) => p.match.homeId === team.id || p.match.awayId === team.id)
    .sort((a, b) => a.match.kickoffIso.localeCompare(b.match.kickoffIso));
  const results = (await getFinishedPredictions())
    .filter((p) => p.match.homeId === team.id || p.match.awayId === team.id)
    .sort((a, b) => b.match.kickoffIso.localeCompare(a.match.kickoffIso))
    .slice(0, 8);

  const homeGames = upcoming.filter((p) => p.match.homeId === team.id).length;
  const awayGames = upcoming.filter((p) => p.match.awayId === team.id).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SportsTeamJsonLd
        name={team.name}
        url={`${siteConfig.url}/teams/${params.slug}`}
        address={team.venue}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteConfig.url },
          { name: "Teams", url: `${siteConfig.url}/teams` },
          { name: team.name, url: `${siteConfig.url}/teams/${params.slug}` }
        ]}
      />

      <Link
        href="/teams"
        className="mb-8 inline-flex items-center gap-2 text-sm text-mute transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        All teams
      </Link>

      <div className="glass relative mb-8 overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <TeamCrest short={team.short} colors={team.colors} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-black tracking-wide sm:text-4xl">{team.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mute">
              {league ? (
                <Link href={`/leagues/${league.slug}`} className="font-semibold text-accent hover:underline">
                  {league.name}
                </Link>
              ) : (
                <span>European football</span>
              )}
              <span className="flex items-center gap-1">
                <Home className="h-3.5 w-3.5" />
                {team.venue}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {homeGames} home / {awayGames} away upcoming
              </span>
            </p>
          </div>
          <div className="flex gap-3">
            <span className="rounded-xl border border-line bg-elevated px-4 py-2 text-center">
              <span className="block font-display text-2xl font-bold text-accent">{team.rating}</span>
              <span className="text-[10px] uppercase tracking-widest text-mute">Rating</span>
            </span>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Attack prior (model)", value: team.att.toFixed(2) },
            { label: "Defence prior (model)", value: team.def.toFixed(2) },
            {
              label: "Form points (last 5)",
              value: String(
                team.form.reduce((a, f) => a + (f.result === "W" ? 3 : f.result === "D" ? 1 : 0), 0)
              )
            }
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-line/60 bg-elevated/50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-mute">{s.label}</p>
              <p className="mt-1 font-mono text-lg font-bold text-ink">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="relative mt-5">
          <p className="mb-2 flex items-center gap-2 text-xs text-mute">
            <TrendingUp className="h-3.5 w-3.5" />
            Recent form
          </p>
          <div className="flex gap-2">
            {team.form.map((f, i) => (
              <span
                key={i}
                title={`${f.gf}-${f.ga}`}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border font-display text-sm font-bold",
                  f.result === "W"
                    ? "border-success/40 bg-success/15 text-success"
                    : f.result === "D"
                      ? "border-warning/40 bg-warning/15 text-warning"
                      : "border-danger/40 bg-danger/15 text-danger"
                )}
              >
                {f.result}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-widest">
            Upcoming fixtures & predictions
          </h2>
          {upcoming.length === 0 ? (
            <GlassCard>
              <p className="text-sm text-mute">No upcoming fixtures modelled for this team right now.</p>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              {upcoming.slice(0, 8).map((p) => (
                <PredictionMiniCard key={p.match.id} item={p} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-widest">Recent results</h2>
          {results.length === 0 ? (
            <GlassCard>
              <p className="text-sm text-mute">No recent graded results to show yet.</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {results.map((p) => {
                const hs = p.match.homeScore ?? 0;
                const as = p.match.awayScore ?? 0;
                const isHome = p.match.homeId === team.id;
                const teamGoals = isHome ? hs : as;
                const oppGoals = isHome ? as : hs;
                const result = teamGoals > oppGoals ? "W" : teamGoals === oppGoals ? "D" : "L";
                const tone =
                  result === "W"
                    ? "text-success"
                    : result === "D"
                      ? "text-warning"
                      : "text-danger";
                return (
                  <div
                    key={p.match.id}
                    className="glass flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-sm font-medium">
                      {p.homeTeam.short} <span className="mx-1 text-mute">vs</span> {p.awayTeam.short}
                    </span>
                    <span className="font-mono text-xs text-mute">{formatMatchDate(p.match.kickoffIso)}</span>
                    <span className={cn("font-mono font-bold", tone)}>
                      {hs}-{as}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}