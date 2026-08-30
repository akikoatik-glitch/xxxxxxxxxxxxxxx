import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LEAGUES } from "@/lib/data/leagues";
import { getTeamsByLeague } from "@/lib/data/teams";
import { getUpcomingMatches } from "@/data/service";
import { SectionHeading } from "@/components/ui/kit";
import { LeagueBadge } from "@/components/ui/league-badge";

export const metadata: Metadata = {
  title: "Football Leagues Covered",
  description:
    "XWhiz covers the Premier League, La Liga, Serie A, Bundesliga and Ligue 1 with free, transparent football match predictions.",
  alternates: { canonical: "/leagues" }
};

export const revalidate = 3600;

export default function LeaguesPage() {
  const upcoming = getUpcomingMatches();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <SectionHeading
        align="left"
        kicker="Coverage"
        title={<>Leagues we <span className="text-gradient">predict</span></>}
        subtitle="Five elite domestic leagues. Every fixture modelled, every match graded."
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {LEAGUES.map((league) => {
          const teams = getTeamsByLeague(league.id);
          const count = upcoming.filter((m) => m.leagueId === league.id).length;
          return (
            <Link
              key={league.id}
              href={`/leagues/${league.slug}`}
              className="card-3d group flex flex-col gap-5 p-6"
            >
              <div className="flex items-center justify-between">
                <LeagueBadge league={league} size="lg" />
                <span className="font-mono text-xs text-mute">{count} upcoming fixtures</span>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold group-hover:text-accent">{league.name}</h2>
                <p className="text-sm text-mute">{league.country} · Tier {league.tier}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {teams.slice(0, 6).map((t) => (
                  <span
                    key={t.id}
                    className="rounded-md border border-line bg-elevated px-2 py-1 font-mono text-[10px] text-mute"
                  >
                    {t.short}
                  </span>
                ))}
                {teams.length > 6 && (
                  <span className="rounded-md border border-line bg-elevated px-2 py-1 font-mono text-[10px] text-mute">
                    +{teams.length - 6}
                  </span>
                )}
              </div>
              <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-accent">
                View league
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}