import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  elevated
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <div className={cn(elevated ? "glass-elevated" : "glass", "p-6 shadow-card", className)}>
      {children}
    </div>
  );
}

export function SectionHeading({
  kicker,
  title,
  subtitle,
  align = "center"
}: {
  kicker: string;
  title: ReactNode;
  subtitle?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("mb-12", align === "center" ? "text-center" : "text-left")}>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.3em] text-accent">{kicker}</p>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-wide text-ink sm:text-4xl">{title}</h2>
      {subtitle ? (
        <p className={cn("mt-4 max-w-2xl text-base leading-relaxed text-mute", align === "center" && "mx-auto")}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function Chip({
  children,
  tone = "default",
  className
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "danger" | "gold" | "royal";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "border-line bg-elevated text-mute",
    accent: "border-accent/40 bg-accent/10 text-accent",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
    danger: "border-danger/40 bg-danger/10 text-danger",
    gold: "border-gold/40 bg-gold/10 text-gold",
    royal: "border-royal/50 bg-royal/15 text-amber-200"
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
