import Link from "next/link";
import {
  Database,
  Cpu,
  Target,
  LineChart,
  BarChart3,
  ShieldCheck,
  ExternalLink,
  ArrowRight
} from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import { SectionHeading, GlassCard } from "@/components/ui/kit";
import { LEAGUES } from "@/lib/data/leagues";
import { getHomeOverview } from "@/lib/predictions";
import { getUpcomingMatches } from "@/data/service";
import { siteConfig } from "@/lib/config";

const STAT_TONES = ["text-accent", "text-white", "text-gold", "text-accent"] as const;

export async function StatsStrip() {
  const overview = await getHomeOverview();
  const items = [
    { end: overview.todayCount, suffix: "", label: "Matches today" },
    { end: overview.upcomingCount, suffix: "", label: "Predictions in 7 days" },
    { end: overview.competitions, suffix: "", label: "Leagues covered" },
    { end: overview.avgConfidence ?? 0, decimals: 1, suffix: "%", label: "Avg confidence today" }
  ];
  return (
    <section className="border-y border-line/60 bg-surface/40 py-10">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 sm:px-6 lg:grid-cols-4">
        {items.map((s, i) => (
          <div key={s.label} className="text-center">
            <p className={`font-display text-3xl font-bold sm:text-4xl ${STAT_TONES[i]}`}>
              {overview.avgConfidence === null && s.label.includes("confidence") ? (
                <span className="text-mute">—</span>
              ) : (
                <>
                  <CountUp end={s.end} decimals={s.decimals ?? 0} suffix={s.suffix} />
                </>
              )}
            </p>
            <p className="mt-1.5 text-xs uppercase tracking-widest text-mute">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-3xl px-4 text-center text-[11px] leading-relaxed text-mute">
        Data refresh {overview.source}. Model output is published transparently. Predictions are
        statistical estimates, not guarantees — football is unpredictable. 18+.
      </p>
    </section>
  );
}

export async function LeaguesStrip() {
  const upcoming = getUpcomingMatches();
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <SectionHeading
        kicker="Competitions"
        title={<>Every top league. <span className="text-gradient">Every fixture.</span></>}
        subtitle="Five elite domestic leagues modelled daily — pick a league to see its fixtures, predictions and live standings."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LEAGUES.map((league) => {
          const count = upcoming.filter((m) => m.leagueId === league.id).length;
          const colors = league.colors;
          return (
            <Link
              key={league.id}
              href={`/leagues/${league.slug}`}
              className="card group flex items-center gap-4 p-5"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 font-display text-xs font-bold text-black shadow-inner3d"
                style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
              >
                {league.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base font-bold text-ink group-hover:text-accent">
                  {league.name}
                </span>
                <span className="block text-xs text-mute">
                  {league.country} · {count} fixtures in the next 7 days
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-mute transition-transform group-hover:translate-x-1 group-hover:text-accent" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    {
      icon: Database,
      title: "Real fixtures & results in",
      body: "Fixtures, kick-offs, final results and recent form feed the model from an open football data source."
    },
    {
      icon: Cpu,
      title: "Engine simulates",
      body: "A Poisson-based xG engine estimates true win/draw/lose probabilities for every fixture."
    },
    {
      icon: Target,
      title: "Graded picks out",
      body: "Every fixture gets a 1X2 call, predicted score and a transparent confidence rating — all free."
    }
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <SectionHeading
        kicker="How it works"
        title={<>From raw data to <span className="text-gradient">free, honest picks</span></>}
        subtitle="No gut feeling, no mystery tipsters. One transparent pipeline, three steps."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((step, i) => (
          <div key={step.title} className="animate-fade-up" style={{ animationDelay: `${i * 90}ms` }}>
            <GlassCard className="group relative h-full overflow-hidden">
              <div className="absolute -right-6 -top-6 font-display text-8xl font-black text-elevated transition-colors group-hover:text-accent/10">
                {i + 1}
              </div>
              <step.icon className="h-10 w-10 text-accent" />
              <h3 className="mt-5 font-display text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{step.body}</p>
            </GlassCard>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Features() {
  const features = [
    { icon: LineChart, title: "1X2 probabilities", body: "Clear home / draw / away percentages plus predicted score and model fair odds on every fixture." },
    { icon: BarChart3, title: "Honest confidence", body: "Every pick is graded Balanced → Solid → Hot with a confidence percentage you can verify." },
    { icon: Database, title: "Real match data", body: "Fixtures and results come from an open, freely licensed football data source — nothing invented." },
    { icon: ShieldCheck, title: "Published track record", body: "Hit rate, Brier score and a fair-odds ROI simulation are public on the stats page — warts and all." },
    { icon: Target, title: "Full match analysis", body: "Recent form, head-to-head history and the model's key factors on every match page." },
    { icon: LineChart, title: "Prediction journal", body: "Each pick is snapshotted before kick-off with its model version, then scored against the real result." }
  ];
  return (
    <section className="border-y border-line/60 bg-surface/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          kicker="Features"
          title={<>Built for <span className="text-gradient">football fans</span></>}
          subtitle="Everything on this site is free. No accounts, no paywalls, no pay-to-win picks."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div key={f.title} className="animate-fade-up" style={{ animationDelay: `${(i % 3) * 80}ms` }}>
              <GlassCard className="h-full transition-colors hover:border-accent/30">
                <f.icon className="h-8 w-8 text-accent" />
                <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-mute">{f.body}</p>
              </GlassCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AffiliateBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <GlassCard className="relative overflow-hidden p-8 sm:p-12">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="kicker">Betting partner</p>
            <h2 className="mt-3 font-display text-3xl font-black tracking-wide sm:text-4xl">
              Compare available odds at <span className="text-gradient-gold">{siteConfig.affiliate.label}</span>
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute sm:text-base">
              Take our predicted scores and 1X2 calls and compare them against the markets available
              at our partner. Use promo code{" "}
              <span className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono font-bold text-gold">
                {siteConfig.affiliate.promoCode}
              </span>{" "}
              when you sign up.
            </p>
            <a
              href={siteConfig.affiliate.url}
              rel="sponsored noopener nofollow"
              className="btn-gold mt-6"
            >
              Visit {siteConfig.affiliate.label}
              <ExternalLink className="h-4 w-4" />
            </a>
            <p className="mt-4 max-w-xl text-[11px] leading-relaxed text-mute">
              Disclosure: this is a {siteConfig.affiliate.label} affiliate link. If you sign up through
              it, XWhiz Lite may earn a commission at no extra cost to you. Predictions are
              statistical estimates, not guarantees. Football outcomes are unpredictable. Never risk
              money you cannot afford to lose. 18+.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {["65+ leagues at Melbet", "Check match odds", "Fast payouts", `Promo: ${siteConfig.affiliate.promoCode}`].map((t) => (
              <span
                key={t}
                className="rounded-full border border-accent/30 bg-elevated px-4 py-2 font-mono text-xs text-accent"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </GlassCard>
    </section>
  );
}