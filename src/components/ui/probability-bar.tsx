"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  probabilities: { home: number; draw: number; away: number };
  showLegend?: boolean;
  className?: string;
}

export function ProbabilityBar({ probabilities, showLegend = true, className }: Props) {
  const segments = [
    { key: "HOME", value: probabilities.home, color: "from-success to-[#34d399]", label: "1", text: "text-success" },
    { key: "DRAW", value: probabilities.draw, color: "from-warning to-[#fbbf24]", label: "X", text: "text-warning" },
    { key: "AWAY", value: probabilities.away, color: "from-danger to-[#f87171]", label: "2", text: "text-danger" }
  ];
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;

  return (
    <div className={className}>
      <div className="cyl-bar flex h-4 w-full gap-px bg-[#070d0a] p-0">
        {segments.map((s) => (
          <motion.div
            key={s.key}
            className={cn("cyl-bar-fill bg-gradient-to-b first:rounded-l-full last:rounded-r-full", s.color)}
            initial={{ width: 0 }}
            whileInView={{ width: `${(s.value / total) * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ minWidth: s.value / total > 0.08 ? undefined : 6 }}
          />
        ))}
      </div>
      {showLegend && (
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {segments.map((s) => (
            <div key={s.key} className="flex flex-col items-center gap-0.5">
              <span className={cn("font-mono text-sm font-bold", s.text)}>{(s.value * 100).toFixed(0)}%</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-mute">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
