"use client";

import { useEffect, useState } from "react";
import { BookmarkPlus, BookmarkCheck } from "lucide-react";
import { getWatchlist, toggleWatchlist, WATCHLIST_EVENT } from "@/lib/watchlist";
import { cn } from "@/lib/utils";

export function WatchlistButton({ matchId, className }: { matchId: string; className?: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(getWatchlist().includes(matchId));
    const onChange = () => setSaved(getWatchlist().includes(matchId));
    window.addEventListener(WATCHLIST_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(WATCHLIST_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [matchId]);

  return (
    <button
      onClick={() => setSaved(toggleWatchlist(matchId).includes(matchId))}
      className={cn(
        saved ? "btn-accent w-full" : "btn-ghost w-full hover:border-accent/50",
        "w-full"
      )}
    >
      {saved ? (
        <>
          <BookmarkCheck className="h-4 w-4" />
          Saved to watchlist
        </>
      ) : (
        <>
          <BookmarkPlus className="h-4 w-4" />
          Add to watchlist
        </>
      )}
    </button>
  );
}
