import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Target, Zap } from "lucide-react";

// ── small helpers ────────────────────────────────────────────────────────────
const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

const HITTING_FIELDS = [
  { key: "hitting_avg", label: "AVG" },
  { key: "hitting_ab",  label: "AB"  },
  { key: "hitting_h",   label: "H"   },
  { key: "hitting_r",   label: "R"   },
  { key: "hitting_rbi", label: "RBI" },
  { key: "hitting_hr",  label: "HR"  },
  { key: "hitting_bb",  label: "BB"  },
  { key: "hitting_k",   label: "K"   },
  { key: "hitting_obp", label: "OBP" },
  { key: "hitting_slg", label: "SLG" },
];

const PITCHING_FIELDS = [
  { key: "pitching_era",  label: "ERA"  },
  { key: "pitching_ip",   label: "IP"   },
  { key: "pitching_w",    label: "W"    },
  { key: "pitching_l",    label: "L"    },
  { key: "pitching_so",   label: "SO"   },
  { key: "pitching_bb",   label: "BB"   },
  { key: "pitching_whip", label: "WHIP" },
];

const COLORS = [
  "#C9A84C", "#60a5fa", "#34d399", "#f87171",
  "#a78bfa", "#fb923c", "#38bdf8", "#f472b6",
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="flex gap-2 justify-between">
          <span>{p.name}</span><span className="font-bold">{p.value ?? "—"}</span>
        </p>
      ))}
    </div>
  );
};

// ── Team comparison bar chart ─────────────────────────────────────────────────
function TeamComparisonChart({ players, allStats }) {
  const [metric, setMetric] = useState("hitting_avg");
  const allFields = [...HITTING_FIELDS, ...PITCHING_FIELDS];

  const data = useMemo(() => {
    return players
      .map(p => {
        const statRec = allStats.find(s => s.player_id === p.id && s.stat_type === (metric.startsWith("pitching") ? "pitching" : "hitting"));
        const val = statRec ? num(statRec[metric]) : null;
        return { name: `${p.first_name} ${p.last_name[0]}.`, value: val };
      })
      .filter(d => d.value !== null)
      .sort((a, b) => b.value - a.value);
  }, [players, allStats, metric]);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Team Comparison</span>
        </div>
        <Select value={metric} onValueChange={setMetric}>
          <SelectTrigger className="h-7 text-xs w-36 bg-surface border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__hitting" disabled className="text-xs text-muted-foreground">— Hitting —</SelectItem>
            {HITTING_FIELDS.map(f => <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>)}
            <SelectItem value="__pitching" disabled className="text-xs text-muted-foreground">— Pitching —</SelectItem>
            {PITCHING_FIELDS.map(f => <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No data for this metric.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 18%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name={allFields.find(f=>f.key===metric)?.label || metric} fill="hsl(43 55% 54%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Player radar chart ────────────────────────────────────────────────────────
function PlayerRadarChart({ players, allStats }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const toggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const hittingPlayers = players.filter(p =>
    allStats.some(s => s.player_id === p.id && s.stat_type === "hitting")
  );

  const radarFields = [
    { key: "hitting_avg", label: "AVG", scale: 1000 },
    { key: "hitting_obp", label: "OBP", scale: 1000 },
    { key: "hitting_slg", label: "SLG", scale: 1000 },
    { key: "hitting_rbi", label: "RBI", scale: 10  },
    { key: "hitting_hr",  label: "HR",  scale: 5   },
    { key: "hitting_h",   label: "H",   scale: 5   },
  ];

  const radarData = radarFields.map(f => {
    const row = { metric: f.label };
    selectedIds.forEach((id, i) => {
      const p = players.find(pl => pl.id === id);
      const rec = allStats.find(s => s.player_id === id && s.stat_type === "hitting");
      row[`${p?.first_name} ${p?.last_name}`] = rec ? Math.min(100, (num(rec[f.key]) || 0) * f.scale) : 0;
    });
    return row;
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Hitting Radar</span>
        <span className="text-xs text-muted-foreground">(select up to 4)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hittingPlayers.map((p, i) => {
          const idx = selectedIds.indexOf(p.id);
          const selected = idx !== -1;
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className="text-xs px-2 py-0.5 rounded-full border transition-colors"
              style={{
                borderColor: selected ? COLORS[idx] : "hsl(0 0% 25%)",
                backgroundColor: selected ? COLORS[idx] + "22" : "transparent",
                color: selected ? COLORS[idx] : "hsl(0 0% 55%)",
              }}
            >
              {p.first_name} {p.last_name}
            </button>
          );
        })}
      </div>
      {selectedIds.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">Select players above to compare.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(0 0% 20%)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} />
            {selectedIds.map((id, i) => {
              const p = players.find(pl => pl.id === id);
              return (
                <Radar
                  key={id}
                  name={`${p?.first_name} ${p?.last_name}`}
                  dataKey={`${p?.first_name} ${p?.last_name}`}
                  stroke={COLORS[i]}
                  fill={COLORS[i]}
                  fillOpacity={0.15}
                />
              );
            })}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Top performers leaderboard ────────────────────────────────────────────────
function TopPerformers({ players, allStats }) {
  const categories = [
    { label: "Avg",  key: "hitting_avg",  type: "hitting",  icon: "🏏", hi: true },
    { label: "HR",   key: "hitting_hr",   type: "hitting",  icon: "💥", hi: true },
    { label: "RBI",  key: "hitting_rbi",  type: "hitting",  icon: "🎯", hi: true },
    { label: "ERA",  key: "pitching_era", type: "pitching", icon: "⚡", hi: false },
    { label: "SO",   key: "pitching_so",  type: "pitching", icon: "🔥", hi: true },
    { label: "WHIP", key: "pitching_whip",type: "pitching", icon: "💨", hi: false },
  ];

  const leaders = categories.map(cat => {
    const ranked = players
      .map(p => {
        const rec = allStats.find(s => s.player_id === p.id && s.stat_type === cat.type);
        return { player: p, val: rec ? num(rec[cat.key]) : null };
      })
      .filter(x => x.val !== null)
      .sort((a, b) => cat.hi ? b.val - a.val : a.val - b.val);
    return { ...cat, top: ranked[0] };
  }).filter(c => c.top);

  if (!leaders.length) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Top Performers</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {leaders.map(cat => (
          <div key={cat.key} className="bg-surface border border-border rounded-xl p-3 text-center">
            <div className="text-lg">{cat.icon}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{cat.label} Leader</div>
            <div className="text-sm font-bold text-foreground mt-0.5 truncate">
              {cat.top.player.first_name} {cat.top.player.last_name}
            </div>
            <div className="text-primary font-bold text-base">{cat.top.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Multi-player trend chart (multiple uploads over time) ─────────────────────
function TrendChart({ players, allStats }) {
  const [metric, setMetric] = useState("hitting_avg");
  const [selectedIds, setSelectedIds] = useState([]);

  const toggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const allFields = [...HITTING_FIELDS, ...PITCHING_FIELDS];
  const statType = metric.startsWith("pitching") ? "pitching" : "hitting";

  // Group stats by player, sorted by created_date
  const trendData = useMemo(() => {
    if (!selectedIds.length) return [];
    const byUpload = {};
    selectedIds.forEach(id => {
      const recs = allStats
        .filter(s => s.player_id === id && s.stat_type === statType)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      recs.forEach((rec, idx) => {
        const label = `Upload ${idx + 1}`;
        if (!byUpload[label]) byUpload[label] = { label };
        const p = players.find(pl => pl.id === id);
        byUpload[label][`${p?.first_name} ${p?.last_name[0]}.`] = num(rec[metric]);
      });
    });
    return Object.values(byUpload);
  }, [selectedIds, allStats, metric, players, statType]);

  const eligiblePlayers = players.filter(p =>
    allStats.filter(s => s.player_id === p.id && s.stat_type === statType).length > 0
  );

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Performance Trend</span>
        </div>
        <Select value={metric} onValueChange={setMetric}>
          <SelectTrigger className="h-7 text-xs w-36 bg-surface border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HITTING_FIELDS.map(f => <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>)}
            {PITCHING_FIELDS.map(f => <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {eligiblePlayers.map((p, i) => {
          const idx = selectedIds.indexOf(p.id);
          const selected = idx !== -1;
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className="text-xs px-2 py-0.5 rounded-full border transition-colors"
              style={{
                borderColor: selected ? COLORS[idx] : "hsl(0 0% 25%)",
                backgroundColor: selected ? COLORS[idx] + "22" : "transparent",
                color: selected ? COLORS[idx] : "hsl(0 0% 55%)",
              }}
            >
              {p.first_name} {p.last_name}
            </button>
          );
        })}
      </div>
      {!selectedIds.length ? (
        <p className="text-xs text-muted-foreground text-center py-8">Select players to see trends.</p>
      ) : trendData.length < 2 ? (
        <p className="text-xs text-muted-foreground text-center py-8">Need at least 2 uploads per player to show trends.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 18%)" />
            <XAxis dataKey="label" tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {selectedIds.map((id, i) => {
              const p = players.find(pl => pl.id === id);
              const name = `${p?.first_name} ${p?.last_name[0]}.`;
              return <Line key={id} type="monotone" dataKey={name} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 4 }} />;
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function StatsDashboard({ teamFilter }) {
  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: allStats = [] } = useQuery({
    queryKey: ["playerStats-all"],
    queryFn: () => base44.entities.PlayerStats.list("-created_date", 500),
  });

  const [teamId, setTeamId] = useState("all");

  const teams = useMemo(() => {
    const map = {};
    players.forEach(p => { if (p.team_id) map[p.team_id] = p.team_name || p.team_id; });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [players]);

  const filteredPlayers = useMemo(() =>
    players.filter(p =>
      p.is_active !== false &&
      (teamId === "all" || p.team_id === teamId) &&
      allStats.some(s => s.player_id === p.id)
    ),
    [players, allStats, teamId]
  );

  const totalRecords = allStats.length;
  const playersWithStats = players.filter(p => allStats.some(s => s.player_id === p.id)).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3">
          <div className="text-center">
            <div className="text-xl font-bold text-primary">{playersWithStats}</div>
            <div className="text-xs text-muted-foreground">Athletes</div>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <div className="text-xl font-bold text-primary">{totalRecords}</div>
            <div className="text-xs text-muted-foreground">Records</div>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <div className="text-xl font-bold text-primary">{teams.length}</div>
            <div className="text-xs text-muted-foreground">Teams</div>
          </div>
        </div>
        <Select value={teamId} onValueChange={setTeamId}>
          <SelectTrigger className="h-8 text-xs w-44 bg-surface border-border">
            <SelectValue placeholder="All Teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Teams</SelectItem>
            {teams.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filteredPlayers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No stats uploaded yet. Upload stats using the Athletes tab.
        </div>
      ) : (
        <div className="space-y-4">
          <TopPerformers players={filteredPlayers} allStats={allStats} />
          <TeamComparisonChart players={filteredPlayers} allStats={allStats} />
          <PlayerRadarChart players={filteredPlayers} allStats={allStats} />
          <TrendChart players={filteredPlayers} allStats={allStats} />
        </div>
      )}
    </div>
  );
}