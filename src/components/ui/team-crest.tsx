import { cn } from "@/lib/utils";

export function TeamCrest({ short, colors, size = "md" }: { short: string; colors: [string, string]; size?: "sm" | "md" | "lg" }) {
  const dims = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-11 w-11 text-xs",
    lg: "h-14 w-14 text-sm"
  } as const;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-white/10 font-display font-bold text-black shadow-inner3d",
        dims[size]
      )}
      style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
    >
      {short}
    </div>
  );
}
