import type { Metadata } from "next";
import { getNewsArticles } from "@/lib/news";
import { NewsCard } from "@/components/news/news-card";
import { NewsNav } from "@/components/news/news-nav";
import { NewsJsonLd } from "@/components/seo/news-json-ld";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Latest Football News Today",
  description:
    "Fresh worldwide football news updated every day — transfers, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, international, African and Algerian football. Headlines with summaries and links to the original sources.",
  alternates: { canonical: "/news" }
};

export default async function NewsPage() {
  const [latest, transfers, champions, premier, international, african, algerian] =
    await Promise.all([
      getNewsArticles("latest", 12),
      getNewsArticles("transfers", 6),
      getNewsArticles("champions-league", 6),
      getNewsArticles("premier-league", 6),
      getNewsArticles("international", 6),
      getNewsArticles("african", 6),
      getNewsArticles("algerian", 6)
    ]);

  const [featured, ...rest] = latest;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <NewsJsonLd url={siteConfig.url} articles={latest} />

      <header className="mb-8">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-[#0b3d2e]">
          Football News
        </p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-wide text-[#12231b] sm:text-5xl">
          Latest <span className="text-[#14734f]">Football News</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[#55645b]">
          Fresh headlines from the worldwide football ecosystem — transfers, every major league,
          the Champions League, international, African and Algerian football. Aggregated and
          attributed to the original sources, updated throughout the day.
        </p>
        <div className="mt-5">
          <NewsNav active="latest" />
        </div>
      </header>

      {latest.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#dfd9cc] bg-white p-14 text-center">
          <h2 className="font-display text-xl font-bold text-[#12231b]">No news right now</h2>
          <p className="mx-auto mt-2 max-w-md text-[#55645b]">
            Our news feeds refresh periodically. Please check back shortly for the latest football
            headlines.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {featured && <NewsCard article={featured} featured />}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((a) => (
              <NewsCard key={a.id} article={a} />
            ))}
          </div>

          <NewsRow title="Transfers & Rumours" href="/news/category/transfers" articles={transfers} />
          <NewsRow title="Champions League" href="/news/category/champions-league" articles={champions} />
          <NewsRow title="Premier League" href="/news/category/premier-league" articles={premier} />
          <NewsRow title="International Football" href="/news/category/international" articles={international} />
          <NewsRow title="African Football" href="/news/category/african" articles={african} />
          <NewsRow title="Algerian Football" href="/news/category/algerian" articles={algerian} />
        </div>
      )}
    </div>
  );
}

function NewsRow({
  title,
  href,
  articles
}: {
  title: string;
  href: string;
  articles: Awaited<ReturnType<typeof getNewsArticles>>;
}) {
  if (!articles.length) return null;
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold tracking-wide text-[#12231b]">{title}</h2>
        <a
          href={href}
          className="text-sm font-semibold text-[#14734f] hover:text-[#0b3d2e]"
        >
          View all →
        </a>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <NewsCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  );
}
