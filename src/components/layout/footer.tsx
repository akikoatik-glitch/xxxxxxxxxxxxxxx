"use client";

import Link from "next/link";
import { useState } from "react";
import { Send, ShieldAlert, TrendingUp } from "lucide-react";
import { siteConfig } from "@/lib/config";

const PRODUCT_LINKS = [
  { href: "/predictions", label: "Today's Predictions" },
  { href: "/leagues", label: "Leagues" },
  { href: "/teams", label: "Teams" },
  { href: "/stats", label: "Model Performance" }
];

const RESOURCES = [
  { href: "/stats", label: "Accuracy Reports" },
  { href: "/predictions", label: "Value Bet Finder" },
  { href: "/predictions", label: "Daily Value Picks" },
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
    <footer className="relative z-10 mt-24 border-t border-line/70 bg-surface/40 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="font-display text-xl tracking-wider">
              <span className="font-bold">XWHIZ</span>{" "}
              <span className="font-medium text-accent">LITE</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-mute">
              Free football predictions built on a transparent Poisson xG model with honest confidence
              ratings — no paywalls, no hype.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-mute">
              <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
              <span>
                Predictions are statistical estimates, not guarantees. Never risk money you cannot
                afford to lose. 18+.
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-ink">Product</h4>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-mute transition-colors hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-ink">Resources</h4>
            <ul className="mt-4 space-y-2.5">
              {RESOURCES.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-mute transition-colors hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-2 text-xs text-mute">
              <TrendingUp className="h-4 w-4 shrink-0 text-accent" />
              <span>
                Betting partner:{" "}
                <a
                  href={siteConfig.affiliate.url}
                  rel="sponsored noopener nofollow"
                  className="text-accent hover:underline"
                >
                  {siteConfig.affiliate.label}
                </a>{" "}
                · promo <span className="font-mono">{siteConfig.affiliate.promoCode}</span>
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-ink">
              Free Weekly Picks
            </h4>
            <p className="mt-4 text-sm text-mute">
              A round-up of our highest-confidence predictions every week, straight to your inbox.
            </p>
            <form onSubmit={subscribe} className="mt-4 flex gap-2">
              <label htmlFor="footer-email" className="sr-only">
                Email address
              </label>
              <input
                id="footer-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-mute focus:border-accent/60"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="btn-primary !px-3.5 !py-2.5"
                aria-label="Subscribe"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            {status === "ok" && <p className="mt-2 text-xs text-success">Subscribed. Check your inbox.</p>}
            {status === "error" && <p className="mt-2 text-xs text-danger">Something went wrong. Try again.</p>}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line/60 pt-6 text-xs text-mute sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p className="font-mono">
            Model: {siteConfig.modelVersion} · For entertainment purposes only
          </p>
        </div>
      </div>
    </footer>
  );
}