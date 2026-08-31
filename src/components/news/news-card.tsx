import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import type { NewsArticle } from "@/lib/news";
import { articleSlug } from "@/lib/news-utils";
import { categoryById } from "@/lib/news-categories";

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function NewsCard({ article, featured = false }: { article: NewsArticle; featured?: boolean }) {
  const slug = articleSlug(article);
  const href = `/news/article/${slug}`;
  const fallback = categoryById(article.categories[0]) || categoryById("latest");

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#e6e2d8] bg-white shadow-[0_6px_24px_-12px_rgba(20,45,35,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(20,45,35,0.28)]">
      <Link href={href} className="flex h-full flex-col">
        <div className={`relative w-full overflow-hidden ${featured ? "aspect-[16/8]" : "aspect-[16/9]"}`}>
          {article.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.image}
              alt={article.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `linear-gradient(135deg, #0b3d2e 0%, #14734f 55%, #1d8a5f 100%)`
              }}
            >
              <div className="flex h-full w-full items-end p-4">
                <div className="rounded-md px-2 py-1 font-display text-xs font-bold uppercase tracking-wider text-white/90">
                  {fallback ? fallback.name : article.source}
                </div>
              </div>
            </div>
          )}
          {featured && (
            <span className="absolute left-3 top-3 rounded-md bg-[#0b3d2e] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg">
              Featured
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#14734f]">
            <span>{fallback ? fallback.short : "News"}</span>
            <span className="text-[#c9c4b6]">•</span>
            <span className="text-[#8a8577]">{article.source}</span>
          </div>
          <h3
            className={`font-display font-bold leading-snug text-[#12231b] line-clamp-3 group-hover:text-[#14734f] ${
              featured ? "text-xl sm:text-2xl" : "text-base"
            }`}
          >
            {article.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-[#6b756d]">{article.excerpt}</p>
          <div className="mt-auto flex items-center justify-between pt-2 text-xs text-[#8a8577]">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {timeAgo(article.pubDate) || formatDate(article.pubDate)}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-[#14734f] transition-transform group-hover:translate-x-0.5">
              Read on XWhiz <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
