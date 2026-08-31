import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ExternalLink, Newspaper } from "lucide-react";
import { getNewsArticles } from "@/lib/news";
import { findBySlug } from "@/lib/news-utils";
import { categoryById } from "@/lib/news-categories";
import { NewsArticleJsonLd } from "@/components/seo/news-json-ld";
import { NewsCard } from "@/components/news/news-card";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const all = await getNewsArticles("latest", 300);
  const article = findBySlug(all, params.slug);
  if (!article) notFound();

  const cat = categoryById(article.categories[0]) || categoryById("latest");

  const formatDate = (iso: string) => {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return "";
    return new Date(t).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const related = all.filter((a) => a.key !== article.key).slice(0, 6);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <NewsArticleJsonLd
        article={article}
        url={`${siteConfig.url}/news/article/${params.slug}`}
      />

      <nav className="mb-6 text-sm text-[#8a8577]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#14734f]">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/news" className="hover:text-[#14734f]">News</Link>
        <span className="mx-2">/</span>
        <span className="text-[#3c4a41]">Article</span>
      </nav>

      <article className="overflow-hidden rounded-2xl border border-[#e6e2d8] bg-white shadow-[0_10px_40px_-20px_rgba(20,45,35,0.28)]">
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          {article.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.image} alt={article.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: "linear-gradient(135deg,#0b3d2e 0%,#14734f 55%,#1d8a5f 100%)" }}>
              <div className="flex h-full items-center justify-center text-white/80">
                <Newspaper className="h-12 w-12" />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <span className="rounded-md bg-[#0b3d2e] px-2.5 py-1 text-white">
              {cat ? cat.name : "News"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#8a8577]">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(article.pubDate)}
            </span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-black leading-tight tracking-wide text-[#12231b] sm:text-4xl">
            {article.title}
          </h1>

          <div className="mt-4 flex items-center gap-3 border-y border-[#eee9dd] py-3 text-sm text-[#55645b]">
            <span>Written / published by</span>
            <a href={article.sourceUrl} rel="noopener noreferrer" className="font-semibold text-[#14734f] hover:underline">
              {article.source}
            </a>
          </div>

          <p className="mt-6 text-lg leading-relaxed text-[#2c3a32]">{article.excerpt}</p>

          <div className="mt-8 rounded-xl border border-[#e6e2d8] bg-[#faf8f2] p-5">
            <p className="text-sm leading-relaxed text-[#55645b]">
              This is a preview of an article originally published by{" "}
              <strong className="text-[#2c3a32]">{article.source}</strong>. To read the full story,
              continue on the original publication.
            </p>
            <a
              href={article.link}
              rel="noopener noreferrer sponsored"
              target="_blank"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0b3d2e] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#14734f]"
            >
              Read full article on {article.source}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 font-display text-2xl font-bold tracking-wide text-[#12231b]">
            More football news
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((a) => (
              <NewsCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const all = await getNewsArticles("latest", 300);
  const article = findBySlug(all, params.slug);
  if (!article) return { robots: { index: false } };

  const title = article.title;
  const cat = categoryById(article.categories[0])?.name || "Football News";
  const excerpt = article.excerpt?.slice(0, 160) || "";
  const canonical = `${siteConfig.url}/news/article/${params.slug}`;

  return {
    title,
    description: excerpt,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description: excerpt,
      url: canonical,
      siteName: siteConfig.name,
      publishedTime: new Date(article.pubDate).toISOString(),
      modifiedTime: new Date(article.pubDate).toISOString(),
      section: cat,
      authors: [article.source],
      images: article.image ? [{ url: article.image }] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: excerpt,
      images: article.image ? [article.image] : undefined
    }
  };
}
