"use client";

import Link from "next/link";
import { useState } from "react";
import { Send, ShieldAlert, TrendingUp, Newspaper, BarChart3, Trophy, Users } from "lucide-react";
import { siteConfig } from "@/lib/config";

const PRODUCT_LINKS = [
  { href: siteConfig.links.home, label: "Home", icon: null },
  { href: siteConfig.links.predictions, label: "Football Predictions", icon: null },
  { href: siteConfig.links.news, label: "Football News", icon: Newspaper },
  { href: siteConfig.links.leagues, label: "League Standings", icon: null },
  { href: siteConfig.links.teams, label: "Club Analysis", icon: null },
  { href: siteConfig.links.stats, label: "Model Performance", icon: BarChart3 }
];

const NEWS_CATEGORIES = [
  { href: "/news/category/premier-league", label: "Premier League News" },
  { href: "/news/category/la-liga", label: "La Liga News" },
  { href: "/news/category/champions-league", label: "Champions League News" },
  { href: "/news/category/african", label: "African Football News" },
  { href: "/news/category/algerian", label: "Algerian Football News" },
  { href: "/news/category/transfers", label: "Transfer News" }
];

const RESOURCES = [
  { href: "/stats", label: "Accuracy Reports" },
  { href: "/leagues", label: "League Standings" },
  { href: "/teams", label: "Club Analysis" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/admin", label: "System Status" }
];

export function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      setStatus(res.ok ? "ok" : "error");
      if (res.ok) setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <footer className="relative z-10 mt-24 border-t border-pitch-700/60 bg-pitch-900 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href={siteConfig.links.home} className="font-display text-xl tracking-wider">
              <span className="font-bold text-white">XWHIZ</span>{" "}
              <span className="font-medium text-grass-400">.COM</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
              Football predictions and worldwide football news — AI-driven analytics, live
              data, transparent models and fresh daily stories.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-white/45">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Predictions are statistical estimates, not guarantees. Never risk money you cannot
                afford to lose. 18+.
              </span>
            </div>
          </div>

          {/* Football News */}
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-white">
              <span className="flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-grass-400" />
                Football News
              </span>
            </h4>
            <ul className="mt-4 space-y-2.5">
              {NEWS_CATEGORIES.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/55 transition-colors hover:text-grass-400">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Predictions */}
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-white">
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-grass-400" />
                Predictions &amp; Stats
              </span>
            </h4>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/55 transition-colors hover:text-grass-400">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources + Partner */}
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-white">
              Resources
            </h4>
            <ul className="mt-4 space-y-2.5">
              {RESOURCES.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/55 transition-colors hover:text-grass-400">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center gap-2 text-xs text-white/45">
              <TrendingUp className="h-4 w-4 shrink-0 text-grass-400" />
              <span>
                Betting partner:{" "}
                <a
                  href={siteConfig.affiliate.url}
                  target="_blank"
                  rel="sponsored noopener noreferrer nofollow"
                  className="text-grass-400 hover:underline"
                >
                  {siteConfig.affiliate.label}
                </a>{" "}
                · promo <span className="font-mono text-gold">{siteConfig.affiliate.promoCode}</span>
              </span>
            </div>

            {/* Newsletter */}
            <h4 className="mt-6 font-display text-sm font-bold uppercase tracking-widest text-white">
              Weekly Picks
            </h4>
            <p className="mt-2 text-sm text-white/50">
              Highest-confidence picks every week, straight to your inbox.
            </p>
            <form onSubmit={subscribe} className="mt-3 flex gap-2">
              <label htmlFor="footer-newsletter" className="sr-only">Email</label>
              <input
                id="footer-newsletter"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-grass-400"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="rounded-lg bg-grass-500 px-3.5 py-2.5 font-semibold text-white transition-colors hover:bg-grass-400"
                aria-label="Subscribe"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            {status === "ok" && <p className="mt-2 text-xs text-grass-300">Subscribed. Check your inbox.</p>}
            {status === "error" && <p className="mt-2 text-xs text-red">Something went wrong. Try again.</p>}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p className="font-mono">
            Model: {siteConfig.modelVersion} &middot; For entertainment purposes only
          </p>
        </div>
      </div>
    </footer>
  );
}
