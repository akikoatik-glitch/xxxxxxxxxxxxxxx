export type NewsCategoryId =
  | "latest"
  | "premier-league"
  | "la-liga"
  | "serie-a"
  | "bundesliga"
  | "ligue-1"
  | "champions-league"
  | "international"
  | "african"
  | "algerian"
  | "transfers";

export interface NewsCategory {
  id: NewsCategoryId;
  name: string;
  short: string;
  description: string;
}

export interface NewsFeed {
  url: string;
  source: string;
  sourceUrl: string;
  categories: NewsCategoryId[];
}

/**
 * Curated public RSS feeds from legitimate football publishers.
 * Each article is displayed as headline + short excerpt + attribution +
 * a link back to the original source (no full-text republishing).
 * Coverage reflects what these feeds provide — worldwide for the big
 * leagues and international football, lighter for African/Algerian.
 */
export const NEWS_CATEGORIES: NewsCategory[] = [
  { id: "latest", name: "Latest Football News", short: "Latest", description: "The freshest football headlines from across the world." },
  { id: "premier-league", name: "Premier League", short: "Premier League", description: "News, transfers and match coverage for the English Premier League." },
  { id: "la-liga", name: "La Liga", short: "La Liga", description: "Spanish football news — La Liga, teams and players." },
  { id: "serie-a", name: "Serie A", short: "Serie A", description: "Italian football news — Serie A clubs and stories." },
  { id: "bundesliga", name: "Bundesliga", short: "Bundesliga", description: "German football news — Bundesliga coverage." },
  { id: "ligue-1", name: "Ligue 1", short: "Ligue 1", description: "French football news — Ligue 1 and Ligue 2." },
  { id: "champions-league", name: "Champions League", short: "Champions League", description: "UEFA Champions League and European club football." },
  { id: "international", name: "International Football", short: "International", description: "National teams, World Cup, Euros and international fixtures." },
  { id: "african", name: "African Football", short: "African", description: "African football — AFCON, CAF competitions and African clubs." },
  { id: "algerian", name: "Algerian Football", short: "Algerian", description: "Algerian football — the national team and Ligue Professionnelle 1." },
  { id: "transfers", name: "Transfers & Rumours", short: "Transfers", description: "Transfer news, market rumours and deals." }
];

export const NEWS_FEEDS: NewsFeed[] = [
  // --- The Guardian (global football, official RSS) ---
  { url: "https://www.theguardian.com/football/rss", source: "The Guardian", sourceUrl: "https://www.theguardian.com/football", categories: ["latest", "transfers", "international", "premier-league", "african"] },

  // --- BBC Sport Football (official RSS; also covers African football) ---
  { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", source: "BBC Sport", sourceUrl: "https://www.bbc.com/sport/football", categories: ["latest", "premier-league", "international", "african"] },

  // --- Sky Sports Football (official RSS) ---
  { url: "https://www.skysports.com/rss/12040", source: "Sky Sports", sourceUrl: "https://www.skysports.com/football", categories: ["latest", "premier-league"] },

  // --- Sky Sports Transfers (official RSS) ---
  { url: "https://www.skysports.com/rss/11096", source: "Sky Sports", sourceUrl: "https://www.skysports.com/transfer-centre", categories: ["transfers", "latest"] },

  // --- ESPN football (official RSS) ---
  { url: "https://www.espn.com/espn/rss/soccer/news", source: "ESPN", sourceUrl: "https://www.espn.com/soccer/", categories: ["latest", "international", "transfers"] },

  // --- La Liga / Spanish football ---
  { url: "https://www.football-espana.net/feed", source: "Football España", sourceUrl: "https://www.football-espana.net", categories: ["la-liga", "latest"] },

  // --- Serie A / Italian football ---
  { url: "https://football-italia.net/feed/", source: "Football Italia", sourceUrl: "https://football-italia.net", categories: ["serie-a", "latest"] },

  // --- Bundesliga / German football ---
  { url: "https://www.bavarianfootballworks.com/rss/index.xml", source: "Bavarian Football Works", sourceUrl: "https://www.bavarianfootballworks.com", categories: ["bundesliga", "latest"] },

  // --- Ligue 1 / French football ---
  { url: "https://www.getfootballnewsfrance.com/feed/", source: "Get French Football News", sourceUrl: "https://www.getfootballnewsfrance.com", categories: ["ligue-1", "latest"] },

  // --- Champions League / European (official Guardian section feed) ---
  { url: "https://www.theguardian.com/football/championsleague/rss", source: "The Guardian", sourceUrl: "https://www.theguardian.com/football/championsleague", categories: ["champions-league", "latest"] },

  // --- Algerian football ---
  { url: "https://www.dzfoot.com/feed/", source: "DZfoot", sourceUrl: "https://www.dzfoot.com", categories: ["algerian", "african", "latest"] }
];

export function categoryById(id: string): NewsCategory | undefined {
  return NEWS_CATEGORIES.find((c) => c.id === id);
}

export function feedsForCategory(id: NewsCategoryId): NewsFeed[] {
  if (id === "latest") return NEWS_FEEDS;
  return NEWS_FEEDS.filter((f) => f.categories.includes(id));
}
