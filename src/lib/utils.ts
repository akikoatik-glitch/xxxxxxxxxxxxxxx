import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const UTC = { timeZone: "UTC" } as const;

export function formatMatchDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    ...UTC,
    weekday: "short",
    day: "numeric",
    month: "short"
  });
}

export function formatMatchTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { ...UTC, hour: "2-digit", minute: "2-digit" }) + " UTC";
}

export function formatFullKickoff(iso: string): string {
  return `${formatMatchDate(iso)} · ${formatMatchTime(iso)}`;
}

export function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function groupByDay<T extends { match: { kickoffIso: string } }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKey(item.match.kickoffIso);
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export function pct(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function outcomeLabel(outcome: "HOME" | "DRAW" | "AWAY"): string {
  return outcome === "HOME" ? "Home Win" : outcome === "DRAW" ? "Draw" : "Away Win";
}

export function outcomeColor(outcome: "HOME" | "DRAW" | "AWAY"): string {
  return outcome === "HOME" ? "text-success" : outcome === "DRAW" ? "text-warning" : "text-danger";
}

export function teamUrl(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
