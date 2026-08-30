"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkPlus, Sparkles } from "lucide-react";
import { getWatchlist, WATCHLIST_EVENT } from "@/lib/watchlist";
import type { EnrichedPrediction } from "@/types";
import { PredictionMiniCard } from "@/components/predictions/prediction-card";
import { GlassCard } from "@/components/ui/kit";

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [items, setItems] = useState<EnrichedPrediction[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/predictions?limit=200")
      .then((r) => r.json())
      .then((data) => {
        if (active) setItems(data.predictions ?? []);
      })
      .catch(() => {
        /* non-fatal */
      });

    const sync = () => setWatchlist(getWatchlist());
    sync();
    window.addEventListener(WATCHLIST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      active = false;
      window.removeEventListener(WATCHLIST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const saved = items
    .filter((p) => watchlist.includes(p.match.id))
    .sort((a, b) => new Date(a.match.kickoffIso).getTime() - new Date(b.match.kickoffIso).getTime());

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">My watchlist</p>
          <h1 className="mt-2 font-display text-3xl font-black">Saved predictions</h1>
          <p className="mt-2 max-w-xl text-sm text-mute">
            Your watchlist is stored on this device — no account needed. Open any prediction and tap
            &quot;Add to watchlist&quot;.
          </p>
        </div>
        <Link href="/predictions" className="btn-primary">
          <BookmarkPlus className="h-4 w-4" />
          Add more predictions
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <GlassCard>
          <p className="text-xs uppercase tracking-widest text-mute">Saved fixtures</p>
          <p className="mt-2 font-display text-3xl font-bold text-accent">{saved.length}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs uppercase tracking-widest text-mute">Hot picks (70%+)</p>
          <p className="mt-2 font-display text-3xl font-bold text-gold">
            {saved.filter((p) => p.prediction.confidence >= 70).length}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs uppercase tracking-widest text-mute">Next kickoff</p>
          <p className="mt-2 font-mono text-lg font-bold text-ink">
            {saved[0]
              ? new Date(saved[0].match.kickoffIso).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                  day: "numeric",
                  month: "short"
                })
              : "—"}
          </p>
        </GlassCard>
      </div>

      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest">
        <Bookmark className="h-5 w-5 text-accent" />
        Your fixtures
      </h2>
      {saved.length === 0 ? (
        <GlassCard className="py-14 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-mute" />
          <p className="mt-3 text-sm text-mute">
            Nothing saved yet. Browse predictions and hit{" "}
            <span className="font-semibold text-ink">Add to watchlist</span> on any match.
          </p>
          <Link href="/predictions" className="btn-primary mt-5">
            Browse predictions
          </Link>
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {saved.map((p) => (
            <PredictionMiniCard key={p.match.id} item={p} />
          ))}
        </div>
      )}
    </div>
  );
}