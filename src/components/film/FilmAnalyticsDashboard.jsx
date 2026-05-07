import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Clock, Filter, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

function fmtMin(secs) {
  if (!secs) return "0m";
  const m = Math.floor(secs / 60);
  return `${m}m`;
}

function fmtFull(secs) {
  if (!secs) return "0 min";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m} min ${s > 0 ? s + "s" : ""}`.trim() : `${s}s`;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-primary mt-0.5">{fmtFull(d.seconds)} watched</p>
      <p className="text-muted-foreground">{d.clips} clip{d.clips !== 1 ? "s" : ""} viewed</p>
    </div>
  );
};

export default function FilmAnalyticsDashboard({ teams, players }) {
  const [selectedTeam, setSelectedTeam] = useState("all");

  const { data: filmViews = [] } = useQuery({
    queryKey: ["film-views-all"],
    queryFn: () => base44.entities.FilmView.list("-last_watched_at", 500),
  });

  const { data: filmAssignments = [] } = useQuery({
    queryKey: ["film-assignments"],
    queryFn: () => base44.entities.FilmAssignment.list("-created_date"),
  });

  const filteredPlayers = selectedTeam === "all"
    ? players.filter(p => p.is_active !== false)
    : players.filter(p => p.team_id === selectedTeam && p.is_active !== false);

  // Aggregate seconds per player
  const chartData = filteredPlayers.map(p => {
    const views = filmViews.filter(v => v.player_id === p.id);
    const totalSeconds = views.reduce((sum, v) => sum + (v.seconds_watched || 0), 0);
    const clips = new Set(views.map(v => v.film_clip_id)).size;
    return {
      name: `${p.first_name} ${p.last_name[0]}.`,
      fullName: `${p.first_name} ${p.last_name}`,
      seconds: totalSeconds,
      clips,
      team: p.team_name,
    };
  }).sort((a, b) => b.seconds - a.seconds);

  const totalMinutes = Math.floor(filmViews.reduce((s, v) => s + (v.seconds_watched || 0), 0) / 60);
  const activeAthletes = new Set(filmViews.map(v => v.player_id).filter(Boolean)).size;
  const avgSeconds = chartData.length > 0 ? chartData.reduce((s, d) => s + d.seconds, 0) / chartData.length : 0;

  const maxSeconds = Math.max(...chartData.map(d => d.seconds), 1);

  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Film Minutes", value: `${totalMinutes}m`, icon: Clock, color: "text-primary" },
          { label: "Active Athletes", value: activeAthletes, icon: TrendingUp, color: "text-green-400" },
          { label: "Avg Per Athlete", value: fmtFull(Math.floor(avgSeconds)), icon: BarChart2, color: "text-blue-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
            <Icon className={`w-5 h-5 mx-auto mb-1.5 ${color}`} />
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
          className="text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-foreground">
          <option value="all">All Teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Bar chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" /> Film Watch Time by Athlete
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Total minutes watched across all film assignments</p>

        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No watch data yet.</p>
        ) : (
          <div style={{ height: Math.max(250, chartData.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 18%)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `${Math.floor(v / 60)}m`}
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90}
                  tick={{ fill: "hsl(43 30% 90%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(0 0% 14%)" }} />
                <Bar dataKey="seconds" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.seconds >= avgSeconds ? "hsl(43 55% 54%)" : "hsl(43 40% 35%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Leaderboard table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Athlete Detail</h3>
        </div>
        <div className="divide-y divide-border">
          {chartData.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>
          )}
          {chartData.map((d, i) => (
            <div key={d.fullName} className="flex items-center gap-3 px-5 py-3">
              <span className="w-5 text-xs text-muted-foreground font-mono">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{d.fullName}</p>
                <p className="text-xs text-muted-foreground">{d.team}</p>
              </div>
              <div className="flex-1 mx-3 hidden sm:block">
                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(d.seconds / maxSeconds) * 100}%` }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{fmtFull(d.seconds)}</p>
                <p className="text-xs text-muted-foreground">{d.clips} clip{d.clips !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}