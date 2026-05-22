import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Trophy, Medal, TrendingUp, Zap, Target, Star } from "lucide-react";

const HITTING_CATS = [
  { key: "hitting_avg", label: "AVG", desc: "Batting Average", icon: "⚾", higher: true, format: v => parseFloat(v).toFixed(3) },
  { key: "hitting_hr", label: "HR", desc: "Home Runs", icon: "💥", higher: true },
  { key: "hitting_rbi", label: "RBI", desc: "Runs Batted In", icon: "🏃", higher: true },
  { key: "hitting_h", label: "H", desc: "Hits", icon: "🎯", higher: true },
  { key: "hitting_obp", label: "OBP", desc: "On-Base %", icon: "📈", higher: true, format: v => parseFloat(v).toFixed(3) },
  { key: "hitting_slg", label: "SLG", desc: "Slugging %", icon: "🔥", higher: true, format: v => parseFloat(v).toFixed(3) },
];

const PITCHING_CATS = [
  { key: "pitching_era", label: "ERA", desc: "Earned Run Average", icon: "💨", higher: false, format: v => parseFloat(v).toFixed(2) },
  { key: "pitching_so", label: "SO", desc: "Strikeouts", icon: "⚡", higher: true },
  { key: "pitching_ip", label: "IP", desc: "Innings Pitched", icon: "⏱️", higher: true, format: v => parseFloat(v).toFixed(1) },
  { key: "pitching_whip", label: "WHIP", desc: "Walks + Hits per IP", icon: "🎯", higher: false, format: v => parseFloat(v).toFixed(2) },
];

const RANK_STYLES = [
  { bg: "bg-yellow-500/15 border-yellow-500/40", text: "text-yellow-400", medal: "🥇", shadow: "shadow-yellow-500/10" },
  { bg: "bg-slate-400/15 border-slate-400/40", text: "text-slate-300", medal: "🥈", shadow: "shadow-slate-400/10" },
  { bg: "bg-orange-600/15 border-orange-600/40", text: "text-orange-400", medal: "🥉", shadow: "shadow-orange-600/10" },
];

function RankCard({ rank, player, value, display }) {
  const style = RANK_STYLES[rank - 1];
  const isTop3 = rank <= 3;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
      ${isTop3 ? `${style.bg} ${style.shadow} shadow-md` : "bg-surface border-border"}`}>
      {/* Rank */}
      <div className="w-8 flex-shrink-0 text-center">
        {isTop3
          ? <span className="text-xl leading-none">{style.medal}</span>
          : <span className="text-sm font-bold text-muted-foreground">{rank}</span>
        }
      </div>

      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-surface border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
        {player?.photo_url
          ? <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
          : <span className="text-xs font-bold text-primary">{player?.first_name?.[0]}</span>
        }
      </div>

      {/* Name / team */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isTop3 ? style.text : "text-foreground"}`}>
          {player?.first_name} {player?.last_name}
        </p>
        <p className="text-xs text-muted-foreground truncate">{player?.team_name || "—"}</p>
      </div>

      {/* Stat value */}
      <div className={`text-right flex-shrink-0`}>
        <p className={`text-lg font-black tabular-nums ${isTop3 ? style.text : "text-foreground"}`}>{display}</p>
        {rank === 1 && <p className="text-xs text-muted-foreground">League leader</p>}
      </div>
    </div>
  );
}

export default function StatsLeaderboard({ teamFilter = null }) {
  const [statType, setStatType] = useState("hitting");
  const [activeCat, setActiveCat] = useState(HITTING_CATS[0]);

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: allStats = [] } = useQuery({
    queryKey: ["playerStats-all"],
    queryFn: () => base44.entities.PlayerStats.list("-created_date", 500),
  });

  const playerMap = useMemo(() => {
    const m = {};
    players.forEach(p => { m[p.id] = p; });
    return m;
  }, [players]);

  const cats = statType === "hitting" ? HITTING_CATS : PITCHING_CATS;

  const ranked = useMemo(() => {
    const relevantStats = allStats.filter(s => {
      if (s.stat_type !== statType) return false;
      if (teamFilter && s.team_id !== teamFilter) return false;
      const val = s[activeCat.key];
      return val !== null && val !== undefined && val !== "" && !isNaN(parseFloat(val));
    });

    const sorted = [...relevantStats].sort((a, b) => {
      const av = parseFloat(a[activeCat.key]);
      const bv = parseFloat(b[activeCat.key]);
      return activeCat.higher ? bv - av : av - bv;
    });

    // Dedupe: keep best record per player
    const seen = new Set();
    return sorted.filter(s => {
      if (seen.has(s.player_id)) return false;
      seen.add(s.player_id);
      return true;
    }).slice(0, 10);
  }, [allStats, activeCat, statType, teamFilter]);

  const handleTypeChange = (type) => {
    setStatType(type);
    setActiveCat(type === "hitting" ? HITTING_CATS[0] : PITCHING_CATS[0]);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">Leaderboards</h2>
          <p className="text-xs text-muted-foreground">Top performers across the league</p>
        </div>
      </div>

      {/* Hitting / Pitching toggle */}
      <div className="flex p-1 gap-1 bg-surface rounded-xl border border-border">
        {[["hitting", "⚾ Hitting"], ["pitching", "💨 Pitching"]].map(([type, label]) => (
          <button
            key={type}
            onClick={() => handleTypeChange(type)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              statType === type
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {cats.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCat(cat)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeCat.key === cat.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-surface text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            <span>{cat.icon}</span> {cat.label}
          </button>
        ))}
      </div>

      {/* Active category hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 flex items-center gap-4">
        <span className="text-4xl">{activeCat.icon}</span>
        <div>
          <p className="text-xl font-black text-primary">{activeCat.label}</p>
          <p className="text-sm text-muted-foreground">{activeCat.desc}</p>
        </div>
        {ranked.length > 0 && (
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Leader</p>
            <p className="text-sm font-bold text-foreground">
              {playerMap[ranked[0]?.player_id]?.first_name} {playerMap[ranked[0]?.player_id]?.last_name}
            </p>
            <p className="text-lg font-black text-primary">
              {activeCat.format
                ? activeCat.format(ranked[0][activeCat.key])
                : ranked[0][activeCat.key]}
            </p>
          </div>
        )}
      </div>

      {/* Rankings list */}
      {ranked.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border">
          <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">No {activeCat.label} data yet</p>
          <p className="text-xs text-muted-foreground mt-1">Upload team stats to see the leaderboard</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranked.map((s, i) => (
            <RankCard
              key={s.id}
              rank={i + 1}
              player={playerMap[s.player_id]}
              value={parseFloat(s[activeCat.key])}
              display={activeCat.format ? activeCat.format(s[activeCat.key]) : s[activeCat.key]}
            />
          ))}
        </div>
      )}
    </div>
  );
}