import { JsonLd } from "./json-ld";
import type { NewsArticle } from "@/lib/news";
import { NEWS_CATEGORIES } from "@/lib/news-categories";
import { articleSlug } from "@/lib/news-utils";

export function NewsJsonLd({ url, articles }: { url: string; articles: NewsArticle[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "XWhiz Football News",
        url: `${url}/news`,
        hasPart: articles.slice(0, 12).map((a, i) => ({
          "@type": "NewsArticle",
          position: i + 1,
          headline: a.title,
          datePublished: new Date(a.pubDate).toISOString(),
          author: { "@type": "Organization", name: a.source },
          publisher: { "@type": "Organization", name: "XWhiz", url },
          url: `${url}/news/article/${articleSlug(a)}`
        }))
      }}
    />
  );
}

export function NewsArticleJsonLd({
  article,
  url
}: {
  article: NewsArticle;
  url: string;
}) {
  const cat = NEWS_CATEGORIES.find((c) => c.id === article.categories[0]);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: article.title,
        description: article.excerpt?.slice(0, 200),
        image: article.image,
        datePublished: new Date(article.pubDate).toISOString(),
        dateModified: new Date(article.pubDate).toISOString(),
        author: { "@type": "Organization", name: article.source, url: article.sourceUrl },
        publisher: { "@type": "Organization", name: "XWhiz", url },
        category: cat?.name || "Football News",
        articleSection: cat?.name || "Football News",
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        isAccessibleForFree: true
      }}
    />
  );
}
