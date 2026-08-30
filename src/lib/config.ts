export const siteConfig = {
  name: "XWhiz Lite",
  tagline: "Free Football Predictions",
  description:
    "Free football predictions for the Premier League, La Liga, Serie A, Bundesliga and Ligue 1 — 1X2 probabilities, predicted scores and transparent confidence, built from real match data.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://xwhizliteeeeeeeeeeee.vercel.app",
  modelVersion: "XWhiz Poisson v3.0",
  coverage:
    "XWhiz analyzes the top 5 European domestic leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1). Predictions are for entertainment and information only.",
  affiliate: {
    label: "Melbet",
    promoCode: "kikos77",
    url: "https://refpa3665.com/L?tag=d_5217846m_2170c_&site=5217846&ad=2170"
  },
  links: {
    predictions: "/predictions",
    leagues: "/leagues",
    teams: "/teams",
    stats: "/stats"
  }
};

export type SiteConfig = typeof siteConfig;