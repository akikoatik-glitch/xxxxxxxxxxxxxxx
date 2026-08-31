import { fetchFeed, type RssItem } from "./rss";
import { NEWS_FEEDS, NEWS_CATEGORIES, feedsForCategory, type NewsCategoryId } from "./news-categories";

export interface NewsArticle extends RssItem {}

interface FeedCacheEntry {
  at: number;
  items: NewsArticle[];
  ok: boolean;
}

/**
 * Module-level feed cache. Keeps raw fetch results in memory for a TTL so we
 * don't hammer the source feeds (and their rate limits). A forced refresh
 * (via the cron /api/news/refresh) bypasses the TTL.
 */
const feedCache = new Map<string, FeedCacheEntry>();
const DEFAULT_TTL_MS = 1000 * 60 * 30; // 30 minutes

const state: { lastSyncAt: string | null; error: string | null } = {
  lastSyncAt: null,
  error: null
};

export function newsSyncStatus() {
  return { lastSyncAt: state.lastSyncAt, error: state.error };
}

function dedupe(items: NewsArticle[]): NewsArticle[] {
  const seen = new Map<string, NewsArticle>();
  for (const it of items) {
    const key = it.link || it.id;
    if (!key || seen.has(key)) continue;
    seen.set(key, it);
  }
  return [...seen.values()];
}

function sortNewest(items: NewsArticle[]): NewsArticle[] {
  return items
    .map((a) => {
      const t = Date.parse(a.pubDate);
      return { ...a, _t: Number.isNaN(t) ? 0 : t };
    })
    .sort((a, b) => b._t - a._t)
    .map(({ _t, ...rest }) => rest as NewsArticle);
}

async function fetchAndCache(category: NewsCategoryId): Promise<NewsArticle[]> {
  const feeds = feedsForCategory(category);
  const now = Date.now();
  const results = await Promise.all(
    feeds.map(async (f) => {
      const cacheKey = f.url;
      const cached = feedCache.get(cacheKey);
      if (cached && now - cached.at < DEFAULT_TTL_MS) {
        return cached.items;
      }
      const res = await fetchFeed(f.url, f.source, f.sourceUrl);
      const items = res.items.map((it) => ({ ...it, source: f.source, sourceUrl: f.sourceUrl }));
      feedCache.set(cacheKey, {
        at: now,
        items,
        ok: res.ok
      });
      return items;
    })
  );
  return sortNewest(dedupe(results.flat()));
}

/**
 * Returns the freshest articles, sorted by publication time.
 * Reads from the TTL cache when possible; otherwise fetches.
 */
export async function getNewsArticles(category: NewsCategoryId = "latest", limit = 40): Promise<NewsArticle[]> {
  const items = await fetchAndCache(category);
  return items.slice(0, limit);
}

export function getNewsCategories() {
  return NEWS_CATEGORIES;
}

export function getNewsCategoryById(id: string) {
  return NEWS_CATEGORIES.find((c) => c.id === id);
}

/**
 * Force a fresh fetch of every feed, ignoring the TTL. Called by the cron
 * /api/news/refresh so the news section self-updates throughout the day.
 */
export async function refreshNews(): Promise<{ articles: number; feeds: number; lastSyncAt: string }> {
  const now = Date.now();
  let total = 0;
  let feeds = 0;
  let firstError: string | null = null;
  for (const f of NEWS_FEEDS) {
    try {
      const res = await fetchFeed(f.url, f.source, f.sourceUrl);
      const items = res.items.map((it) => ({ ...it, source: f.source, sourceUrl: f.sourceUrl }));
      feedCache.set(f.url, { at: now, items, ok: res.ok });
      total += items.length;
      feeds += 1;
      if (!res.ok) firstError = firstError || `${f.source}: ${res.error}`;
    } catch (e) {
      feeds += 1;
      firstError = firstError || `${f.source}: ${e instanceof Error ? e.message : "error"}`;
    }
  }
  state.lastSyncAt = new Date(now).toISOString();
  state.error = firstError;
  return { articles: total, feeds, lastSyncAt: state.lastSyncAt };
}
