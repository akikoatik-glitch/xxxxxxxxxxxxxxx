import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTopPredictions } from "@/lib/predictions";
import { PredictionCard } from "@/components/predictions/prediction-card";
import { SectionHeading } from "@/components/ui/kit";

export async function FeaturedPredictions() {
  const items = await getTopPredictions(6);
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <SectionHeading
        kicker="Top picks"
        title={<>Highest confidence <span className="text-gradient">this week</span></>}
        subtitle="Our strongest signals across every league — graded by the model and free to view in full."
      />
      {items.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <PredictionCard key={item.match.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface/40 p-10 text-center">
          <p className="text-sm text-mute">
            No fixtures in the current window. Fixtures usually appear a few days before kick-off —
            check back soon.
          </p>
        </div>
      )}
      <div className="mt-10 text-center">
        <Link href="/predictions" className="btn-ghost">
          View all predictions
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}