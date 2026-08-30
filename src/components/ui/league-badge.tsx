import type { League } from "@/types";
import { cn } from "@/lib/utils";

export function LeagueBadge({ league, size = "md" }: { league: League; size?: "sm" | "md" | "lg" }) {
  const dims = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-11 w-11 text-xs",
    lg: "h-16 w-16 text-sm"
  } as const;
  return (
    <div className="group/badge [perspective:600px]" title={`${league.name} — ${league.country}`}>
      <div
        className={cn(
          "relative transition-transform duration-500 [transform-style:preserve-3d] group-hover/badge:[transform:rotateY(180deg)]",
          dims[size]
        )}
      >
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-lg border border-white/10 font-display font-bold text-black shadow-inner3d [backface-visibility:hidden]",
            dims[size]
          )}
          style={{ background: `linear-gradient(135deg, ${league.colors[0]}, ${league.colors[1]})` }}
        >
          {league.code}
        </div>
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-lg border border-line bg-elevated px-1 text-center font-display font-bold text-ink [backface-visibility:hidden] [transform:rotateY(180deg)]",
            dims[size]
          )}
        >
          <span className="leading-tight">{league.name.split(" ").map((w) => w[0]).join("")}</span>
        </div>
      </div>
    </div>
  );
}
