import type { Metadata } from "next";
import Link from "next/link";
import { LEAGUES } from "@/lib/data/leagues";
import { getTeamsByLeague, teamSlug } from "@/lib/data/teams";
import { getUpcomingMatches } from "@/data/service";
import { SectionHeading } from "@/components/ui/kit";
import { TeamCrest } from "@/components/ui/team-crest";

export const metadata: Metadata = {
  title: "Football Teams Covered",
  description:
    "Browse every football club covered by XWhiz — form, ratings, upcoming fixtures and recent results for teams across the Premier League, La Liga, Serie A, Bundesliga and Ligue 1.",
  alternates: { canonical: "/teams" }
};

export const revalidate = 3600;

export default function TeamsPage() {
  const upcoming = getUpcomingMatches();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <SectionHeading
        align="left"
        kicker="Squad coverage"
        title={<>Every club. <span className="text-gradient">One profile.</span></>}
        subtitle="View a team's fixture list, predicted lines and recent results. Clubs are organised by competition."
      />

      <div className="space-y-12">
        {LEAGUES.map((league) => {
          const teams = getTeamsByLeague(league.id);
          return (
            <section key={league.id}>
              <div className="mb-5 flex items-center gap-4">
                <h2 className="font-display text-xl font-bold uppercase tracking-widest text-ink">
                  {league.name}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-accent/30 to-transparent" />
                <span className="font-mono text-xs text-mute">{teams.length} clubs</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {teams.map((team) => {
                  const count = upcoming.filter(
                    (m) => m.home.id === team.id || m.away.id === team.id
                  ).length;
                  return (
                    <Link
                      key={team.id}
                      href={`/teams/${teamSlug(team)}`}
                      className="card group flex items-center gap-3 p-4"
                    >
                      <TeamCrest short={team.short} colors={team.colors} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink group-hover:text-accent">
                          {team.name}
                        </span>
                        <span className="block font-mono text-[11px] text-mute">
                          Rating {team.rating} · {count} fixtures in 7 days
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}