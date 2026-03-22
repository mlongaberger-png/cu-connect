import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useAnimation } from "framer-motion";
import { Trophy, TrendingUp, Zap, Star, Flame } from "lucide-react";
import { formatDate } from "@/utils/dateTime";

// ─── Animated win % bar ──────────────────────────────────────────────────────
function AnimatedBar({ pct, color, delay = 0 }) {
  const controls = useAnimation();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (inView) controls.start({ width: `${pct}%`, transition: { duration: 0.9, delay, ease: "easeOut" } });
  }, [inView, pct, delay, controls]);
  return (
    <div ref={ref} className="h-2 bg-surface rounded-full overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={controls} className={`h-full rounded-full ${color}`} />
    </div>
  );
}

// ─── Scrolling Ticker ─────────────────────────────────────────────────────────
function Ticker({ items }) {
  if (!items.length) return null;
  const duplicated = [...items, ...items, ...items];
  const duration = Math.max(18, items.length * 5);
  return (
    <div className="overflow-hidden border-b border-white/10 py-2 relative">
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .ticker-track { animation: tickerScroll ${duration}s linear infinite; display: flex; width: max-content; }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>
      <div className="ticker-track">
        {duplicated.map((e, i) => (
          <div key={i} className="flex items-center gap-2 px-6 shrink-0 whitespace-nowrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              e.result === "win" ? "bg-green-500/30 text-green-300" :
              e.result === "loss" ? "bg-red-500/30 text-red-300" :
              "bg-yellow-500/30 text-yellow-300"
            }`}>
              {e.result === "win" ? "✓ W" : e.result === "loss" ? "✗ L" : "~ D"}
            </span>
            {e.is_championship_win && <span className="text-sm">🏆</span>}
            {e.sport_icon && <span className="text-sm">{e.sport_icon}</span>}
            <span className="text-xs text-white/80 font-medium">{e.team_name}</span>
            {e.opponent && <span className="text-xs text-white/40">vs {e.opponent}</span>}
            {e.our_score != null && e.our_score !== "" && (
              <span className="text-xs font-bold text-white/70">{e.our_score}–{e.opponent_score ?? "?"}</span>
            )}
            <span className="text-white/20 text-lg mx-1">·</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(value / 20);
    const interval = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [inView, value]);
  return <span ref={ref}>{display}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PerformanceHero({ events = [], teams = [], sports = [], players = [] }) {
  const resultEvents = events.filter(e =>
    (e.type === "game" || e.type === "tournament") && e.result
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const championships = resultEvents.filter(e => e.is_championship_win);

  // Build per-sport breakdown using the teams passed in (already family-filtered)
  const sportMap = {};
  sports.forEach(s => { sportMap[s.id] = s; });

  // Enrich result events with sport info from teams
  const teamSportMap = {};
  teams.forEach(t => { teamSportMap[t.id] = t.sport_id; });

  const enriched = resultEvents.map(e => ({
    ...e,
    sport_id: teamSportMap[e.team_id] || null,
    sport_icon: sportMap[teamSportMap[e.team_id]]?.icon || null,
    sport_name: sportMap[teamSportMap[e.team_id]]?.name || null,
  }));

  const totalWins = enriched.filter(e => e.result === "win").length;
  const totalLosses = enriched.filter(e => e.result === "loss").length;
  const totalDraws = enriched.filter(e => e.result === "draw").length;
  const totalGames = totalWins + totalLosses + totalDraws;
  const winPct = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  // Per-team records
  const teamRecords = {};
  enriched.forEach(e => {
    if (!e.team_id) return;
    if (!teamRecords[e.team_id]) teamRecords[e.team_id] = {
      wins: 0, losses: 0, draws: 0, championships: 0,
      name: e.team_name || "Unknown",
      sport_name: e.sport_name, sport_icon: e.sport_icon,
    };
    if (e.result === "win") teamRecords[e.team_id].wins++;
    else if (e.result === "loss") teamRecords[e.team_id].losses++;
    else if (e.result === "draw") teamRecords[e.team_id].draws++;
    if (e.is_championship_win) teamRecords[e.team_id].championships++;
  });

  const teamList = Object.entries(teamRecords)
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));

  const recentResults = enriched.slice(0, 5);

  // ── Personalized family header text ──────────────────────────────────────
  const playerNames = players.map(p => p.first_name);
  const familyLabel = playerNames.length === 1
    ? `${playerNames[0]}'s Season`
    : playerNames.length === 2
    ? `${playerNames[0]} & ${playerNames[1]}'s Season`
    : "Your Family's Season";

  const sportLabels = [...new Set(teams.map(t => sportMap[t.sport_id]?.name).filter(Boolean))];
  const sportIcons  = [...new Set(teams.map(t => sportMap[t.sport_id]?.icon).filter(Boolean))];

  // ── No results yet ─────────────────────────────────────────────────────────
  if (resultEvents.length === 0) {
    const upcomingCount = events.filter(e => e.date && new Date(e.date + "T00:00:00") >= new Date()).length;
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-surface to-card p-6 md:p-8"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {sportIcons.length > 0
                ? <span className="text-3xl">{sportIcons.join(" ")}</span>
                : <Flame className="w-8 h-8 text-primary" />
              }
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">{familyLabel}</h2>
                {sportLabels.length > 0 && (
                  <p className="text-sm text-muted-foreground">{sportLabels.join(" · ")}</p>
                )}
              </div>
            </div>
            <p className="text-muted-foreground max-w-xl text-sm mt-1">
              Season results will light up here once games are played. Go {playerNames[0] || "team"}!
            </p>
          </div>
          <div className="flex gap-6">
            {[
              { label: "Teams", value: teams.length },
              { label: "Athletes", value: players.length },
              { label: "Upcoming", value: upcomingCount },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-primary"><AnimatedNumber value={value} /></p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Has results: full personalized performance hero ────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[hsl(0,0%,8%)] via-[hsl(0,0%,11%)] to-[hsl(0,0%,8%)]"
    >
      {/* Background glow orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/6 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/4 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl pointer-events-none" />
      {championships.length > 0 && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-transparent to-primary/3 pointer-events-none" />
      )}

      {/* Header row */}
      <div className="relative px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {sportIcons.length > 0
            ? <span className="text-lg leading-none">{sportIcons.join(" ")}</span>
            : <Flame className="w-5 h-5 text-primary" />
          }
          <div>
            <span className="text-sm font-bold text-foreground">{familyLabel}</span>
            {sportLabels.length > 0 && (
              <span className="text-xs text-white/40 ml-2">{sportLabels.join(" · ")}</span>
            )}
          </div>
        </div>
        <div className="text-xs text-white/40">
          {totalGames} game{totalGames !== 1 ? "s" : ""} played
        </div>
      </div>

      {/* Ticker */}
      <Ticker items={enriched.slice(0, 10)} />

      {/* Main content grid */}
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/10">

        {/* ── Combined Record ── */}
        <div className="p-5 md:p-6 flex flex-col justify-center">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" /> Season Record
          </p>
          <div className="flex items-end gap-3 mb-3">
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-black text-green-400 leading-none"><AnimatedNumber value={totalWins} /></p>
              <p className="text-xs text-white/40 mt-1">Wins</p>
            </div>
            <p className="text-3xl text-white/20 font-thin mb-2">-</p>
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-black text-red-400 leading-none"><AnimatedNumber value={totalLosses} /></p>
              <p className="text-xs text-white/40 mt-1">Losses</p>
            </div>
            {totalDraws > 0 && <>
              <p className="text-3xl text-white/20 font-thin mb-2">-</p>
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-black text-yellow-400 leading-none"><AnimatedNumber value={totalDraws} /></p>
                <p className="text-xs text-white/40 mt-1">Draws</p>
              </div>
            </>}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-white/40 mb-1">
              <span>Win rate</span><span className="text-primary font-bold">{winPct}%</span>
            </div>
            <AnimatedBar pct={winPct} color="bg-gradient-to-r from-green-500 to-green-400" />
          </div>
          {championships.length > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
              className="mt-3 flex items-center gap-2"
            >
              <span className="text-lg">{"🏆".repeat(Math.min(championships.length, 4))}</span>
              <span className="text-xs text-primary font-semibold">{championships.length} Championship{championships.length > 1 ? "s" : ""}</span>
            </motion.div>
          )}
        </div>

        {/* ── Team Highlights ── */}
        <div className="p-5 md:p-6">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Team Highlights
          </p>
          {teamList.length === 0 ? (
            <p className="text-xs text-white/30 italic">No team results yet</p>
          ) : (
            <div className="space-y-3">
              {teamList.map((team, idx) => {
                const total = team.wins + team.losses + team.draws;
                const pct = total > 0 ? Math.round((team.wins / total) * 100) : 0;
                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {team.sport_icon && <span className="text-sm">{team.sport_icon}</span>}
                      <span className="text-xs font-semibold text-white/80 truncate flex-1">{team.name}</span>
                      {team.championships > 0 && <span className="text-xs">🏆</span>}
                      <span className="text-xs text-white/40">{team.wins}W-{team.losses}L</span>
                    </div>
                    <AnimatedBar
                      pct={pct}
                      color={pct >= 70 ? "bg-gradient-to-r from-green-600 to-green-400" : pct >= 50 ? "bg-gradient-to-r from-primary/80 to-primary" : "bg-gradient-to-r from-red-600/80 to-red-500"}
                      delay={0.4 + idx * 0.1}
                    />
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recent Results ── */}
        <div className="p-5 md:p-6">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-primary" /> Recent Results
          </p>
          <div className="space-y-2">
            {recentResults.map((e, idx) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + idx * 0.08 }}
                className={`flex items-center gap-2.5 p-2 rounded-lg ${e.is_championship_win ? "bg-primary/15 border border-primary/20" : "bg-white/4 border border-transparent"}`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  e.result === "win" ? "bg-green-500/30 text-green-300" :
                  e.result === "loss" ? "bg-red-500/30 text-red-300" :
                  "bg-yellow-500/30 text-yellow-300"
                }`}>
                  {e.result === "win" ? "W" : e.result === "loss" ? "L" : "D"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/80 truncate">
                    {e.sport_icon && <span className="mr-1">{e.sport_icon}</span>}
                    {e.team_name}
                    {e.is_championship_win && " 🏆"}
                  </p>
                  <p className="text-xs text-white/35 truncate">
                    {e.opponent ? `vs ${e.opponent}` : e.title} · {formatDate(e.date, "MMM d")}
                  </p>
                </div>
                {e.our_score != null && e.our_score !== "" && (
                  <span className={`text-xs font-bold shrink-0 ${
                    e.result === "win" ? "text-green-400" : e.result === "loss" ? "text-red-400" : "text-yellow-400"
                  }`}>
                    {e.our_score}–{e.opponent_score ?? "?"}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}