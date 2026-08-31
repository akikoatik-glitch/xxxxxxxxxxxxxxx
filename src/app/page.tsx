import { Hero } from "@/components/home/hero";
import {
  StatsStrip,
  LeaguesStrip,
  HowItWorks,
  Features,
  AffiliateBanner
} from "@/components/home/sections";
import { HomeNewsStrip } from "@/components/home/home-news";
import { FeaturedPredictions } from "@/components/home/featured-predictions";
import { WebSiteJsonLd, ItemListJsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/config";
import { getTodayPredictions, getHomeOverview } from "@/lib/predictions";

export const revalidate = 3600;

export default async function HomePage() {
  const today = await getTodayPredictions();
  const overview = await getHomeOverview();

  return (
    <>
      <WebSiteJsonLd
        name={siteConfig.name}
        url={siteConfig.url}
        description={siteConfig.description}
      />
      <ItemListJsonLd
        items={today
          .slice()
          .sort((a, b) => b.prediction.confidence - a.prediction.confidence)
          .slice(0, 8)
          .map((p) => ({
            name: `${p.homeTeam.name} vs ${p.awayTeam.name}`,
            url: `${siteConfig.url}/predictions/${p.match.id}`
          }))}
      />
      <Hero
        today={today}
        weekTotal={overview.upcomingCount}
        todayCount={overview.todayCount}
        competitions={overview.competitions}
        avgConfidence={overview.avgConfidence}
      />
      <StatsStrip />
      <FeaturedPredictions />
      <LeaguesStrip />
      <HomeNewsStrip />
      <HowItWorks />
      <Features />
      <AffiliateBanner />
    </>
  );
}