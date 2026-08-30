"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";
import type { EnrichedPrediction } from "@/types";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { TeamCrest } from "@/components/ui/team-crest";
import { formatMatchTime } from "@/lib/utils";
import { siteConfig } from "@/lib/config";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const }
  })
};

export function Hero({
  today,
  weekTotal,
  todayCount,
  competitions,
  avgConfidence
}: {
  today: EnrichedPrediction[];
  weekTotal: number;
  todayCount: number;
  competitions: number;
  avgConfidence: number | null;
}) {
  return (
    <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
      <div className="pitch-marks pb-8 lg:pr-10">
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 text-xs font-semibold text-accent">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% free · {siteConfig.modelVersion}
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="mt-6 font-display text-5xl font-black leading-[1.02] tracking-wide sm:text-6xl lg:text-7xl"
        >
          Free football
          <br />
          predictions <span className="text-gradient">for today</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
          className="mt-6 max-w-lg text-lg leading-relaxed text-mute"
        >
          Every match across Europe&apos;s top leagues graded by our Poisson xG engine from real
          fixtures, results and form — 1X2 probabilities, predicted scores and an honest confidence
          rating. No paywall, no hype.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-8 flex flex-wrap items-center gap-4"
        >
          <Link href="/predictions" className="btn-primary">
            View today&apos;s predictions
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/leagues" className="btn-secondary">
            <CalendarDays className="h-4 w-4" />
            Browse leagues
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="mt-10 flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs text-mute"
        >
          <span>· {todayCount} matches today</span>
          <span>· {weekTotal} predictions in the next 7 days</span>
          <span>· {competitions} leagues, every fixture graded</span>
          {avgConfidence !== null && <span>· avg confidence {avgConfidence}%</span>}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-accent/5 blur-2xl" />
        <div className="glass overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-pulse-ring rounded-full bg-accent" />
                <span className="h-2 w-2 rounded-full bg-accent" />
              </span>
              Today&apos;s fixtures
            </div>
            <Link href="/predictions" className="text-xs font-semibold text-accent hover:underline">
              View all
            </Link>
          </div>

          <div className="divide-y divide-line/60">
            {today.slice(0, 4).map((item) => {
              const { prediction, match, homeTeam, awayTeam } = item;
              return (
                <Link
                  key={match.id}
                  href={`/predictions/${match.id}`}
                  className="block px-5 py-4 transition-colors hover:bg-elevated/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <TeamCrest short={homeTeam.short} colors={homeTeam.colors} size="sm" />
                      <span className="truncate text-sm font-semibold">{homeTeam.short}</span>
                    </div>
                    <div className="text-center">
                      <p className={`font-display text-lg font-bold ${prediction.outcome === "HOME" ? "text-gold" : prediction.outcome === "DRAW" ? "text-warning" : "text-accent"}`}>
                        {prediction.predictedScore.home}-{prediction.predictedScore.away}
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 text-right">
                      <span className="truncate text-sm font-semibold">{awayTeam.short}</span>
                      <TeamCrest short={awayTeam.short} colors={awayTeam.colors} size="sm" />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-mute">{formatMatchTime(match.kickoffIso)}</span>
                    <ConfidenceBadge value={prediction.confidence} />
                  </div>
                </Link>
              );
            })}
            {today.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-mute">
                No kickoffs today — the next matches open tonight. Check tomorrow&apos;s slate.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}