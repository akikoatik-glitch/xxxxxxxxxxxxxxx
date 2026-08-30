"use client";

import * as Tabs from "@radix-ui/react-tabs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { TrendingUp, Swords, BarChart3, Brain } from "lucide-react";
import type { EnrichedPrediction, H2HEntry } from "@/types";
import { GlassCard } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "form", label: "Form Guide", icon: TrendingUp },
  { value: "h2h", label: "Head to Head", icon: Swords },
  { value: "stats", label: "Team Stats", icon: BarChart3 },
  { value: "model", label: "Model Factors", icon: Brain }
];

const chartTooltipStyle = {
  backgroundColor: "#14201A",
  border: "1px solid #1E3027",
  borderRadius: "12px",
  color: "#F1F5F9",
  fontSize: "12px"
};

export function MatchDetailTabs({
  item,
  h2h
}: {
  item: EnrichedPrediction;
  h2h: H2HEntry[];
}) {
  const { homeTeam, awayTeam, prediction } = item;

  const homeForm = homeTeam.form.map((f, i) => ({
    game: `G${i + 1}`,
    scored: f.gf,
    conceded: f.ga,
    result: f.result
  }));
  const awayForm = awayTeam.form.map((f, i) => ({
    game: `G${i + 1}`,
    scored: f.gf,
    conceded: f.ga,
    result: f.result
  }));

const teamStats = [
    { metric: "Model attack prior", home: homeTeam.att, away: awayTeam.att },
    { metric: "Model defence prior", home: homeTeam.def, away: awayTeam.def },
    { metric: "Squad rating", home: homeTeam.rating, away: awayTeam.rating },
    {
      metric: "Form points (5g)",
      home: homeTeam.form.reduce((a, f) => a + (f.result === "W" ? 3 : f.result === "D" ? 1 : 0), 0),
      away: awayTeam.form.reduce((a, f) => a + (f.result === "W" ? 3 : f.result === "D" ? 1 : 0), 0)
    }
  ].map((row) => ({ ...row, metricLabel: row.metric, key: row.metric.replace(/\W/g, "") }));

  const factorData = [
    { name: "Home win", value: Math.round(prediction.probabilities.home * 100) },
    { name: "Draw", value: Math.round(prediction.probabilities.draw * 100) },
    { name: "Away win", value: Math.round(prediction.probabilities.away * 100) },
    { name: "Over 2.5", value: Math.round(prediction.over25 * 100) },
    { name: "BTTS", value: Math.round(prediction.btts * 100) }
  ];

  return (
    <Tabs.Root defaultValue="form" className="mt-10">
      <Tabs.List className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Tabs.Trigger
            key={t.value}
            value={t.value}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-elevated px-4 py-2.5 text-sm font-medium text-mute transition-colors data-[state=active]:border-accent/50 data-[state=active]:bg-accent/10 data-[state=active]:text-accent"
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="form" className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <p className="mb-1 font-display text-sm font-bold uppercase tracking-widest text-ink">
            {homeTeam.name} — last 5
          </p>
          <FormPills form={homeTeam.form} />
          <div className="mt-5 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={homeForm}>
                <CartesianGrid stroke="#1E3027" strokeDasharray="3 3" />
                <XAxis dataKey="game" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="scored" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="conceded" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard>
          <p className="mb-1 font-display text-sm font-bold uppercase tracking-widest text-ink">
            {awayTeam.name} — last 5
          </p>
          <FormPills form={awayTeam.form} />
          <div className="mt-5 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={awayForm}>
                <CartesianGrid stroke="#1E3027" strokeDasharray="3 3" />
                <XAxis dataKey="game" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="scored" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="conceded" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </Tabs.Content>

      <Tabs.Content value="h2h">
        <GlassCard>
<p className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-ink">
            Last {h2h.length} meetings
          </p>
          {h2h.length === 0 ? (
            <p className="rounded-lg border border-line/60 bg-elevated/50 px-4 py-6 text-center text-sm text-mute">
              No recorded meetings in our historical data (current and previous season).
            </p>
          ) : (
          <div className="space-y-3">
            {h2h.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-line/60 bg-elevated/50 px-4 py-3"
              >
                <span className="font-mono text-xs text-mute">{m.dateIso.slice(0, 10)}</span>
                <span className="text-sm font-semibold">
                  {m.homeShort} <span className="font-display text-accent">{m.homeGoals} - {m.awayGoals}</span> {m.awayShort}
                </span>
                <span className="w-16 text-right text-xs text-mute">
                  {m.homeGoals === m.awayGoals ? "Draw" : m.homeGoals > m.awayGoals ? `${m.homeShort} win` : `${m.awayShort} win`}
                </span>
              </div>
            ))}
          </div>
          )}
        </GlassCard>
      </Tabs.Content>

      <Tabs.Content value="stats">
        <GlassCard>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamStats} layout="vertical" barGap={4}>
                <CartesianGrid stroke="#1E3027" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="metricLabel"
                  stroke="#64748B"
                  fontSize={11}
                  width={150}
                />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="home" name={homeTeam.short} fill="#10B981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="away" name={awayTeam.short} fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </Tabs.Content>

      <Tabs.Content value="model">
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <p className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-ink">
              Probability breakdown (%)
            </p>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={factorData}>
                  <CartesianGrid stroke="#1E3027" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="value" fill="#34D399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
          <GlassCard>
            <p className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-ink">
              Key factors
            </p>
            <ul className="space-y-3">
              {prediction.factors.map((f, i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-line/60 bg-elevated/50 px-4 py-3 text-sm text-ink">
                  <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                  {f}
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}

function FormPills({ form }: { form: Array<{ result: "W" | "D" | "L"; gf: number; ga: number }> }) {
  const tone = {
    W: "bg-success/15 text-success border-success/40",
    D: "bg-warning/15 text-warning border-warning/40",
    L: "bg-danger/15 text-danger border-danger/40"
  };
  return (
    <div className="mt-3 flex gap-2">
      {form.map((f, i) => (
        <span
          key={i}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border font-display text-sm font-bold",
            tone[f.result]
          )}
          title={`${f.gf}-${f.ga}`}
        >
          {f.result}
        </span>
      ))}
    </div>
  );
}

