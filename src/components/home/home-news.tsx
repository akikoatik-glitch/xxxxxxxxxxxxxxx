import Link from "next/link";
import { Newspaper, ArrowRight } from "lucide-react";
import { getNewsArticles } from "@/lib/news";
import { SectionHeading } from "@/components/ui/kit";
import { NewsCard } from "@/components/news/news-card";
import { siteConfig } from "@/lib/config";

export async function HomeNewsStrip() {
  let articles: Awaited<ReturnType<typeof getNewsArticles>> = [];
  try {
    articles = await getNewsArticles("latest", 8);
  } catch {
    articles = [];
  }
  if (articles.length === 0) return null;

  const [featured, ...rest] = articles;
  return (
    <section className="border-y border-line/60 bg-surface/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading
            kicker="Football News"
            title={<>Worldwide <span className="text-gradient">football headlines</span></>}
            subtitle="Fresh daily stories across the Premier League, Champions League, international football and more — with our predictions alongside."
          />
          <Link
            href={siteConfig.links.news}
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent/50 hover:text-accent sm:inline-flex"
          >
            All news <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="pitch-marks">
            <NewsCard article={featured} featured />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {rest.slice(0, 4).map((article) => (
              <NewsCard key={article.link || article.id} article={article} />
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center lg:hidden">
          <Link
            href={siteConfig.links.news}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink"
          >
            <Newspaper className="h-4 w-4" />
            All news <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
