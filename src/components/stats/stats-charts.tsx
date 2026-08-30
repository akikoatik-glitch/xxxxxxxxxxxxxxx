"use client";

import * as Tabs from "@radix-ui/react-tabs";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ModelStats } from "@/types";

const tooltipStyle = {
  backgroundColor: "#14201A",
  border: "1px solid #1E3027",
  borderRadius: "12px",
  color: "#F1F5F9",
  fontSize: "12px"
};

const PIE_COLORS = ["#34D399", "#F5C518", "#10B981", "#3B82F6", "#F59E0B", "#F06057"];

export function StatsCharts({ stats }: { stats: ModelStats }) {
  const picksByLeague = stats.byLeague.map((l) => ({ name: l.name, picks: l.picks }));

  return (
    <Tabs.Root defaultValue="roi" className="w-full">
      <Tabs.List className="mb-6 flex flex-wrap gap-2">
        {[
          { value: "roi", label: "ROI Simulation" },
          { value: "weekly", label: "Weekly Accuracy" },
          { value: "league", label: "By League" },
          { value: "conf", label: "Confidence Bands" }
        ].map((t) => (
          <Tabs.Trigger
            key={t.value}
            value={t.value}
            className="rounded-lg border border-line bg-elevated px-4 py-2.5 text-sm font-medium text-mute transition-colors data-[state=active]:border-accent/50 data-[state=active]:bg-accent/10 data-[state=active]:text-accent"
          >
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="roi">
        <div className="glass p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-widest">Cumulative ROI — 1 unit flat stake</h3>
            <span className={`font-mono text-sm font-bold ${stats.roiTotal >= 0 ? "text-success" : "text-danger"}`}>
              {stats.roiTotal >= 0 ? "+" : ""}
              {stats.roiTotal.toFixed(2)}u
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.roiCurve}>
                <defs>
                  <linearGradient id="roiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1E3027" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="profit" stroke="#34D399" strokeWidth={2} fill="url(#roiGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Tabs.Content>

      <Tabs.Content value="weekly">
        <div className="glass p-6">
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-widest">Hit rate per week (%)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weekly}>
                <CartesianGrid stroke="#1E3027" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="accuracy" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Tabs.Content>

      <Tabs.Content value="league">
<div className="grid gap-6 lg:grid-cols-2">
          <div className="glass p-6">
            <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-widest">Accuracy by league (%)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byLeague}>
                  <CartesianGrid stroke="#1E3027" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={10} interval={0} />
                  <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                    {stats.byLeague.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass p-6">
            <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-widest">Evaluated picks by league</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={picksByLeague}>
                  <CartesianGrid stroke="#1E3027" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={10} interval={0} />
                  <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="picks" fill="#34D399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Tabs.Content>

      <Tabs.Content value="conf">
        <div className="glass p-6">
<h3 className="mb-4 font-display text-sm font-bold uppercase tracking-widest">
            Hit rate by confidence band (%)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.confidenceBuckets}>
                <CartesianGrid stroke="#1E3027" strokeDasharray="3 3" />
                <XAxis dataKey="bucket" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="accuracy" fill="#F5C518" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}

