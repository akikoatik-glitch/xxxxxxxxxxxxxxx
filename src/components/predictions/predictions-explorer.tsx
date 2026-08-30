"use client";

import { useMemo, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import type { EnrichedPrediction } from "@/types";
import { PredictionCard } from "./prediction-card";
import { groupByDay, formatMatchDate, dayKey } from "@/lib/utils";
import { LEAGUES } from "@/lib/data/leagues";
import { getPredictionType, PREDICTION_TYPE_LABELS, type PredictionType } from "@/lib/prediction-types";

const CONFIDENCE_OPTIONS = [
  { value: "0", label: "All confidence" },
  { value: "60", label: "Solid+ (60%+)" },
  { value: "65", label: "High confidence (65%+)" }
];

const TYPE_OPTIONS: Array<{ value: PredictionType | "all"; label: string }> = [
  { value: "all", label: "All prediction types" },
  { value: "pick", label: "1X2 picks" },
  { value: "over25", label: "Over 2.5 goals" },
  { value: "btts", label: "Both teams to score" }
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const DATE_OPTIONS = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" }
];

export function PredictionsExplorer({
  items,
  initialLeague
}: {
  items: EnrichedPrediction[];
  initialLeague?: string;
}) {
  const [league, setLeague] = useState(initialLeague ?? "all");
  const [minConfidence, setMinConfidence] = useState("0");
  const [type, setType] = useState<PredictionType | "all">("all");
  const [when, setWhen] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return items
      .filter((p) => {
        if (league !== "all" && p.league.slug !== league) return false;
        if (Number(minConfidence) > 0 && p.prediction.confidence < Number(minConfidence)) return false;
        if (type !== "all" && getPredictionType(p.prediction) !== type) return false;
        if (when !== "all") {
          const key = dayKey(p.match.kickoffIso);
          if (when === "today" && key !== todayKey()) return false;
          if (when === "tomorrow" && key !== tomorrowKey()) return false;
        }
        if (search) {
          const q = search.toLowerCase();
          return (
            p.homeTeam.name.toLowerCase().includes(q) ||
            p.awayTeam.name.toLowerCase().includes(q) ||
            p.league.name.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.match.kickoffIso !== b.match.kickoffIso) {
          return a.match.kickoffIso.localeCompare(b.match.kickoffIso);
        }
        return b.prediction.confidence - a.prediction.confidence;
      });
  }, [items, league, minConfidence, type, when, search]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);
  const days = [...grouped.keys()].sort();
  const isToday = (iso: string) => dayKey(iso) === todayKey();

  return (
    <div>
      <div className="glass mb-8 flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams or leagues..."
            aria-label="Search teams or leagues"
            className="w-full rounded-lg border border-line bg-elevated py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-mute focus:border-accent/60"
          />
        </div>

        <div className="flex items-center gap-2 text-mute">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden text-xs uppercase tracking-widest sm:inline">Filters</span>
        </div>

        <FilterSelect value={when} onChange={setWhen} options={DATE_OPTIONS} triggerClassName="lg:w-40" />
        <FilterSelect
          value={league}
          onChange={setLeague}
          options={[{ value: "all", label: "All leagues" }, ...LEAGUES.map((l) => ({ value: l.slug, label: l.name }))]}
          triggerClassName="lg:w-52"
        />
        <FilterSelect
          value={type}
          onChange={(v) => setType(v as PredictionType | "all")}
          options={TYPE_OPTIONS}
          triggerClassName="lg:w-52"
        />
        <FilterSelect
          value={minConfidence}
          onChange={setMinConfidence}
          options={CONFIDENCE_OPTIONS}
          triggerClassName="lg:w-48"
        />
      </div>

      <p className="mb-6 font-mono text-xs uppercase tracking-widest text-mute">
        {filtered.length} free predictions · this week
      </p>

      {filtered.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 p-16 text-center">
          <p className="font-display text-lg font-bold">No predictions match your filters</p>
          <p className="text-sm text-mute">Try widening the confidence range or clearing the search.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {days.map((day) => {
            const dayItems = grouped.get(day)!;
            const label = formatMatchDate(dayItems[0].match.kickoffIso);
            return (
              <section key={day}>
                <div className="mb-5 flex items-center gap-4">
                  <h2 className="font-display text-lg font-bold uppercase tracking-widest text-ink">
                    {label}
                    {isToday(dayItems[0].match.kickoffIso) && (
                      <span className="ml-3 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 align-middle text-xs normal-case tracking-normal text-accent">
                        Today
                      </span>
                    )}
                  </h2>
                  <span className="font-mono text-xs text-mute">{dayItems.length} matches</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-accent/30 to-transparent" />
                </div>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {dayItems.map((item) => (
                    <PredictionCard key={item.match.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  triggerClassName
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  triggerClassName?: string;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        className={`inline-flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm outline-none transition-colors hover:border-accent/40 focus:border-accent/60 ${triggerClassName ?? ""}`}
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="h-4 w-4 text-mute" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 overflow-hidden rounded-lg border border-line bg-elevated shadow-card">
          <Select.Viewport className="p-1">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-accent/10 data-[highlighted]:text-accent"
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check className="h-4 w-4 text-accent" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}