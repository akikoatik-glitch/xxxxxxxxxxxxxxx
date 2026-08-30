import type { Metadata } from "next";
import { PredictionsExplorer } from "@/components/predictions/predictions-explorer";
import { getUpcomingPredictions } from "@/lib/predictions";

export const metadata: Metadata = {
  title: "Football Predictions Today & This Week",
  description:
    "Free football predictions for the Premier League, La Liga, Serie A, Bundesliga and Ligue 1. Every fixture graded with 1X2 probabilities, predicted scores and confidence ratings, from real match data.",
  alternates: { canonical: "/predictions" }
};

export const revalidate = 1800;

export default async function PredictionsPage({
  searchParams
}: {
  searchParams?: { league?: string };
}) {
  const items = await getUpcomingPredictions();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-10">
        <p className="kicker">Prediction engine</p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-wide">
          All Football Predictions
        </h1>
        <p className="mt-3 max-w-2xl text-mute">
          Every fixture for today and the coming week, sorted by kickoff and graded by model
          confidence. Filter by league, date, prediction type or team — every pick is free.
        </p>
      </div>
      <PredictionsExplorer items={items} initialLeague={searchParams?.league} />
    </div>
  );
}