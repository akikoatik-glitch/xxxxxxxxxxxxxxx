export interface RssItem {
  id: string;
  key?: string;
  title: string;
  link: string;
  description: string;
  excerpt: string;
  pubDate: string;
  image?: string;
  source: string;
  sourceUrl: string;
  categories: string[];
}

export interface RssFeedResult {
  source: string;
  sourceUrl: string;
  items: RssItem[];
  ok: boolean;
  error?: string;
}

function sanitize(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImageFromHtml(html: string, fallbackUrl?: string): string | undefined {
  if (fallbackUrl) return fallbackUrl;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : undefined;
}

function firstByTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return m[0];
}

export function parseRss(xml: string, source: string, sourceUrl: string): RssItem[] {
  const items: RssItem[] = [];
  const entryRe = /<(item|entry)[\s\S]*?<\/(item|entry)>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[0];
    const isAtom = m[1].toLowerCase() === "entry";

    const title = sanitize(
      firstByTag(block, "title").replace(/<\/?title[^>]*>/g, "")
    ) || sanitize(
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""
    );

    let link = "";
    if (isAtom) {
      const li = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      link = li ? li[1] : "";
    } else {
      link = sanitize(firstByTag(block, "link").replace(/<\/?link[^>]*>/g, ""));
    }
    if (!link) {
      const li = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      link = li ? li[1] : "";
    }
    try {
      link = new URL(link, sourceUrl).href;
    } catch {
      link = sourceUrl;
    }

    const guid =
      sanitize(
        firstByTag(block, "guid")
          .replace(/<\/?guid[^>]*>/g, "")
          .trim()
      ) ||
      sanitize(firstByTag(block, "id").replace(/<\/?id[^>]*>/g, "")) ||
      link;

    let description =
      sanitize(firstByTag(block, "description").replace(/<\/?description[^>]*>/g, "")) ||
      sanitize(firstByTag(block, "summary").replace(/<\/?summary[^>]*>/g, ""));

    const contentHtml =
      firstByTag(block, "content:encoded") ||
      firstByTag(block, "content") ||
      firstByTag(block, "description");

    const rawImage =
      block.match(
        /<media:content[^>]+url=["']([^"']+)["']/i
      )?.[1] ||
      block.match(
        /<media:thumbnail[^>]+url=["']([^"']+)["']/i
      )?.[1] ||
      block.match(
        /<enclosure[^>]+url=["']([^"']+)["']/i
      )?.[1] ||
      extractImageFromHtml(contentHtml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));

    const pubDateRaw =
      sanitize(firstByTag(block, "pubDate").replace(/<\/?pubDate[^>]*>/g, "")) ||
      sanitize(firstByTag(block, "published").replace(/<\/?published[^>]*>/g, "")) ||
      sanitize(firstByTag(block, "updated").replace(/<\/?updated[^>]*>/g, "")) ||
      sanitize(firstByTag(block, "dc:date").replace(/<\/?dc:date[^>]*>/g, ""));

    const cats: string[] = [];
    const catRe = /<category[^>]*>([\s\S]*?)<\/category>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = catRe.exec(block)) !== null) {
      const c = sanitize(cm[1]);
      if (c) cats.push(c);
    }

    if (!title || !link) continue;

    const excerpt = (description || sanitize(contentHtml)).slice(0, 320);

    items.push({
      id: guid || link,
      key: guid || link,
      title,
      link,
      description: excerpt,
      excerpt,
      pubDate: pubDateRaw || new Date().toISOString(),
      image: rawImage,
      source,
      sourceUrl,
      categories: cats.slice(0, 6)
    });
  }
  return items;
}

export async function fetchFeed(
  url: string,
  source: string,
  sourceUrl: string
): Promise<RssFeedResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "XWhiz-News/1.0 (+https://www.xwhiz.com)",
        Accept: "application/rss+xml, application/xml, text/xml, */*"
      },
      cache: "no-store"
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { source, sourceUrl, items: [], ok: false, error: `HTTP ${res.status}` };
    }
    const xml = await res.text();
    const items = parseRss(xml, source, sourceUrl);
    return { source, sourceUrl, items, ok: true };
  } catch (e) {
    return {
      source,
      sourceUrl,
      items: [],
      ok: false,
      error: e instanceof Error ? e.message : "fetch failed"
    };
  }
}
