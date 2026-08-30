import { cn } from "@/lib/utils";

export function PredictionPulse({ active, className }: { active: boolean; className?: string }) {
  if (!active) return null;
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-visible", className)}
      aria-hidden="true"
    >
      <span className="absolute inset-0 rounded-2xl border-2 border-accent/60 shadow-glow animate-pulse-ring" />
    </div>
  );
}
