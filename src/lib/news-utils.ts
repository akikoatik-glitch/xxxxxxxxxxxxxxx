import type { NewsArticle } from "./news";

export function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

export function slugifyTitle(title: string, max = 64): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/**
 * Human-readable, SEO-friendly, deterministic slug for an article.
 * Reversible via `slugToArticleKey`.
 */
export function articleSlug(
  article: Pick<NewsArticle, "title" | "link" | "id" | "key">
): string {
  const key = article.key ?? article.link ?? article.id ?? "";
  const base = slugifyTitle(article.title) || "story";
  return `${base}-${hashString(key)}`;
}

export function slugToArticleKey(slug: string): string | null {
  const m = slug.match(/-([0-9a-f]{16})$/);
  return m ? m[1] : null;
}

/**
 * Brute-force safe: returns the article whose slug hash matches, or undefined.
 * Only meaningful against the current in-memory article set.
 */
export function findBySlug(articles: NewsArticle[], slug: string): NewsArticle | undefined {
  const hash = slugToArticleKey(slug);
  if (!hash) return undefined;
  return articles.find((a) => hashString(a.key ?? a.link ?? a.id ?? "") === hash);
}
