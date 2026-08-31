import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getNewsArticles, getNewsCategoryById } from "@/lib/news";
import { NewsCard } from "@/components/news/news-card";
import { NewsNav } from "@/components/news/news-nav";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const cat = getNewsCategoryById(params.slug);
  if (!cat) notFound();

  const articles = await getNewsArticles(cat.id, 60);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Breadcrumbs category={cat.name} />
      <header className="mb-8">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-[#0b3d2e]">
          Football News
        </p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-wide text-[#12231b] sm:text-5xl">
          {cat.name}
        </h1>
        <p className="mt-3 max-w-2xl text-[#55645b]">{cat.description}</p>
        <div className="mt-5">
          <NewsNav active={cat.id} />
        </div>
      </header>

      {articles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#dfd9cc] bg-white p-14 text-center">
          <h2 className="font-display text-xl font-bold text-[#12231b]">No stories in this section yet</h2>
          <p className="mx-auto mt-2 max-w-md text-[#55645b]">
            We refresh this category regularly. Please check back soon for the latest {cat.name} news.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <NewsCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function Breadcrumbs({ category }: { category: string }) {
  return (
    <nav className="mb-6 text-sm text-[#8a8577]" aria-label="Breadcrumb">
      <a href="/" className="hover:text-[#14734f]">Home</a>
      <span className="mx-2">/</span>
      <a href="/news" className="hover:text-[#14734f]">News</a>
      <span className="mx-2">/</span>
      <span className="text-[#3c4a41]">{category}</span>
    </nav>
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = getNewsCategoryById(params.slug);
  if (!cat) return {};
  return {
    title: `${cat.name} News`,
    description: `${cat.description} Fresh headlines from ${siteConfig.name}, updated daily, aggregated with links to the original sources.`,
    alternates: { canonical: `/news/category/${cat.id}` },
    openGraph: {
      title: `${cat.name} News | ${siteConfig.name}`,
      description: cat.description,
      url: `${siteConfig.url}/news/category/${cat.id}`,
      type: "website"
    }
  };
}
