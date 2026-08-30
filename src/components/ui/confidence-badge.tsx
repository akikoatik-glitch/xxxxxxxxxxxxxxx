import { cn } from "@/lib/utils";

export function ConfidenceBadge({ value, className }: { value: number; className?: string }) {
  const tier =
    value >= 70
      ? { label: "Hot", tone: "border-gold/50 bg-gold/10 text-gold" }
      : value >= 60
        ? { label: "Solid", tone: "border-accent/50 bg-accent/10 text-accent" }
        : { label: "Balanced", tone: "border-line bg-elevated text-mute" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-bold tracking-wider",
        tier.tone,
        className
      )}
    >
      {tier.label} · {value}%
    </span>
  );
}