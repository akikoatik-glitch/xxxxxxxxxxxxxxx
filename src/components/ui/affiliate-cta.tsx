import { TrendingUp, Gift, ShieldCheck } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Prominent, high-visibility affiliate call-to-action.
 * Used near the top of the predictions experience.
 */
export function AffiliateCta({ className }: { className?: string }) {
  const { label, promoCode, url } = siteConfig.affiliate;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-gold/40 bg-elevated",
        "shadow-[0_0_40px_-14px_rgba(245,158,11,0.45)]",
        className
      )}
    >
      <div className="pointer-events-none absolute -left-10 -top-16 h-44 w-44 rounded-full bg-gold/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-4 h-44 w-44 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-7 lg:px-9">
        <div className="min-w-0">
          <p className="kicker flex items-center gap-2 !text-gold">
            <Gift className="h-4 w-4" /> Betting partner
          </p>
          <h2 className="mt-2 font-display text-xl font-black tracking-wide text-ink sm:text-2xl">
            Claim your{" "}
            <span className="text-gradient-gold">welcome bonus</span> at {label}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Compare our predicted scores and 1X2 calls against real markets at our partner and use
            promo code{" "}
            <span className="rounded-md border border-gold/50 bg-gold/10 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-gold">
              {promoCode}
            </span>{" "}
            when you sign up.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-mute">
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-accent" /> Check match odds
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Fast payouts
            </span>
          </div>
        </div>

        <a
          href={url}
          rel="sponsored noopener nofollow"
          className="btn-gold shrink-0 text-center sm:px-7"
        >
          Visit {label} · Use{" "}
          <span className="font-mono tracking-wider">{promoCode}</span>
          <TrendingUp className="h-4 w-4" />
        </a>
      </div>

      <p className="relative border-t border-gold/15 px-6 py-3 text-[11px] leading-relaxed text-mute sm:px-7 lg:px-9">
        Disclosure: this is a {label} affiliate link — if you sign up through it, XWhiz may earn a
        commission at no extra cost to you. Statistical estimates only, not guarantees. 18+. Gamble
        responsibly.
      </p>
    </div>
  );
}
