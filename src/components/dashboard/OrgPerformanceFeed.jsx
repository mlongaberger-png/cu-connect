import React, { useState } from "react";
import { Trophy, TrendingUp, TrendingDown, Minus, Star, ChevronDown, ChevronUp } from "lucide-react";
import { formatDate } from "@/utils/dateTime";

const resultColors = {
  win: "bg-green-500/20 text-green-400 border-green-500/30",
  loss: "bg-red-500/20 text-red-400 border-red-500/30",
  draw: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const resultLabel = { win: "W", loss: "L", draw: "D" };

function WLBadge({ result, size = "sm" }) {
  if (!result) return null;
  const sz = size === "sm" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold border ${sz} ${resultColors[result] || ""}`}>
      {resultLabel[result]}
    </span>
  );
}

function RecordBar({ wins, losses, draws }) {
  const total = wins + losses + draws;
  if (total === 0) return <span className="text-xs text-muted-foreground">No results yet</span>;
  const winPct = Math.round((wins / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-green-400 font-bold">{wins}W</span>
        <span className="text-muted-foreground">-</span>
        <span className="text-red-400 font-bold">{losses}L</span>
        {draws > 0 && <><span className="text-muted-foreground">-</span><span className="text-yellow-400 font-bold">{draws}D</span></>}
        <span className="text-muted-foreground ml-1">({winPct}%)</span>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden flex">
        {wins > 0 && <div className="bg-green-500 h-full" style={{ width: `${(wins / total) * 100}%` }} />}
        {draws > 0 && <div className="bg-yellow-500 h-full" style={{ width: `${(draws / total) * 100}%` }} />}
        {losses > 0 && <div className="bg-red-500/60 h-full" style={{ width: `${(losses / total) * 100}%` }} />}
      </div>
    </div>
  );
}

export default function OrgPerformanceFeed({ events = [], teams = [] }) {
  const [showAll, setShowAll] = useState(false);

  // Only game/tournament events with a result
  const resultEvents = events.filter(e =>
    (e.type === "game" || e.type === "tournament") && e.result
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const championships = resultEvents.filter(e => e.is_championship_win);

  // Build per-team records
  const teamRecords = {};
  resultEvents.forEach(e => {
    if (!e.team_id) return;
    if (!teamRecords[e.team_id]) {
      teamRecords[e.team_id] = { wins: 0, losses: 0, draws: 0, name: e.team_name || "Unknown", championships: 0 };
    }
    if (e.result === "win") teamRecords[e.team_id].wins++;
    else if (e.result === "loss") teamRecords[e.team_id].losses++;
    else if (e.result === "draw") teamRecords[e.team_id].draws++;
    if (e.is_championship_win) teamRecords[e.team_id].championships++;
  });

  const teamRecordList = Object.entries(teamRecords)
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));

  const recentResults = resultEvents.slice(0, showAll ? 20 : 6);

  if (resultEvents.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Team Performance
        </h3>
        <p className="text-sm text-muted-foreground text-center py-6">No game results recorded yet. Results will appear here after games are played.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Championship Banner */}
      {championships.length > 0 && (
        <div className="bg-gradient-to-r from-primary/20 via-yellow-500/10 to-primary/20 border border-primary/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">🏆 Championship Wins</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {championships.map(e => (
              <div key={e.id} className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{e.team_name}</p>
                  <p className="text-xs text-muted-foreground">{e.title} · {formatDate(e.date, "MMM d, yyyy")}</p>
                  {e.our_score && e.opponent_score && (
                    <p className="text-xs font-bold text-primary">{e.our_score} – {e.opponent_score}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Standings */}
      {teamRecordList.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Team Standings
          </h3>
          <div className="space-y-3">
            {teamRecordList.map((team, idx) => (
              <div key={team.id} className="flex items-center gap-4 p-3 rounded-xl bg-surface">
                <span className="text-lg font-bold text-muted-foreground w-6 text-center">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{team.name}</p>
                    {team.championships > 0 && (
                      <span title={`${team.championships} championship win${team.championships > 1 ? "s" : ""}`}>
                        {"🏆".repeat(Math.min(team.championships, 3))}
                      </span>
                    )}
                  </div>
                  <RecordBar wins={team.wins} losses={team.losses} draws={team.draws} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Results Feed */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" /> Recent Results
        </h3>
        <div className="space-y-2">
          {recentResults.map(e => (
            <div key={e.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${e.is_championship_win ? "bg-primary/10 border-primary/30" : "bg-surface border-transparent"}`}>
              <WLBadge result={e.result} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                  {e.is_championship_win && <Trophy className="w-3.5 h-3.5 text-primary shrink-0" />}
                  {e.tournament_round && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">{e.tournament_round}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span className="text-primary font-medium">{e.team_name}</span>
                  {e.opponent && <span>vs {e.opponent}</span>}
                  <span>{formatDate(e.date, "MMM d")}</span>
                </div>
              </div>
              {e.our_score != null && e.our_score !== "" && (
                <div className={`text-right shrink-0 font-bold text-sm ${e.result === "win" ? "text-green-400" : e.result === "loss" ? "text-red-400" : "text-yellow-400"}`}>
                  {e.our_score}–{e.opponent_score ?? "?"}
                </div>
              )}
            </div>
          ))}
        </div>
        {resultEvents.length > 6 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            {showAll ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show {resultEvents.length - 6} more results</>}
          </button>
        )}
      </div>
    </div>
  );
}