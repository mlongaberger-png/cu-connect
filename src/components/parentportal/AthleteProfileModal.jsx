import React from "react";
import { Trophy, Calendar, MapPin, Clock, X, Star, Target, Zap, Shield } from "lucide-react";
import { format } from "date-fns";
import { formatTime12h } from "@/utils/dateTime";
import PlayerAvatar from "@/components/ui/PlayerAvatar";

function StatBox({ value, label, color = "text-primary" }) {
  return (
    <div className="flex flex-col items-center bg-surface rounded-2xl p-4 border border-border">
      <span className={`text-3xl font-black ${color}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

const TYPE_COLORS = {
  practice: "bg-blue-500/20 text-blue-400",
  game: "bg-green-500/20 text-green-400",
  tournament: "bg-purple-500/20 text-purple-400",
  meeting: "bg-orange-500/20 text-orange-400",
  fundraiser: "bg-yellow-500/20 text-yellow-400",
  other: "bg-cyan-500/20 text-cyan-400",
};

export default function AthleteProfileModal({ player, team, sport, events = [], onClose }) {
  if (!player) return null;

  // Derive season stats from game/tournament events that have results
  const teamEvents = events.filter(e => e.team_id === player.team_id);
  const resultEvents = teamEvents.filter(e => e.result);
  const wins = resultEvents.filter(e => e.result === "win").length;
  const losses = resultEvents.filter(e => e.result === "loss").length;
  const draws = resultEvents.filter(e => e.result === "draw").length;
  const championships = teamEvents.filter(e => e.is_championship_win).length;
  const winPct = resultEvents.length > 0 ? Math.round((wins / resultEvents.length) * 100) : null;

  // Upcoming events for this player's team
  const today = new Date(new Date().toDateString());
  const upcoming = teamEvents
    .filter(e => e.date && new Date(e.date) >= today && !e.is_cancelled)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  // Recent results
  const recentResults = [...resultEvents]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden overflow-y-auto"
        style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 4.5rem)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gold top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-5 pt-5 pb-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <PlayerAvatar player={player} size="lg" />
            <div>
              <h2 className="font-black text-foreground text-lg leading-tight">
                {player.first_name} {player.last_name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {team?.name || "Team"} {player.jersey_number ? `· #${player.jersey_number}` : ""} {player.position ? `· ${player.position}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface flex items-center justify-center hover:bg-border transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-6">

          {/* Season Record */}
          {resultEvents.length > 0 ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-primary" /> Season Record
              </h3>
              <div className="grid grid-cols-4 gap-2">
                <StatBox value={wins} label="Wins" color="text-green-400" />
                <StatBox value={losses} label="Losses" color="text-red-400" />
                {draws > 0 && <StatBox value={draws} label="Draws" color="text-yellow-400" />}
                {championships > 0 && <StatBox value={championships} label="Champs 🏆" color="text-primary" />}
                {winPct !== null && (
                  <StatBox value={`${winPct}%`} label="Win Rate" color="text-primary" />
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-surface rounded-2xl border border-border p-4">
              <Trophy className="w-5 h-5 text-primary/40" />
              <p className="text-sm text-muted-foreground">Season results will appear here once games are recorded.</p>
            </div>
          )}

          {/* Championships highlight */}
          {championships > 0 && (
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <div>
                <p className="font-bold text-foreground text-sm">Championship{championships > 1 ? "s" : ""} Won!</p>
                <p className="text-xs text-muted-foreground">{championships} title{championships > 1 ? "s" : ""} this season</p>
              </div>
            </div>
          )}

          {/* Recent Results */}
          {recentResults.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-primary" /> Recent Results
              </h3>
              <div className="space-y-2">
                {recentResults.map(evt => (
                  <div key={evt.id} className="flex items-center justify-between bg-surface rounded-xl border border-border px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{evt.title}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(evt.date), "MMM d, yyyy")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(evt.our_score || evt.opponent_score) && (
                        <span className="text-sm font-bold text-foreground">{evt.our_score ?? "?"} – {evt.opponent_score ?? "?"}</span>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        evt.result === "win" ? "bg-green-500/20 text-green-400" :
                        evt.result === "loss" ? "bg-red-500/20 text-red-400" :
                        "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {evt.result?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-primary" /> Upcoming Events
            </h3>
            {upcoming.length === 0 ? (
              <div className="text-center py-6 bg-surface rounded-2xl border border-border">
                <p className="text-sm text-muted-foreground">No upcoming events scheduled</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcoming.map(evt => (
                  <div key={evt.id} className="flex items-center gap-3 bg-surface rounded-xl border border-border p-3">
                    <div className="flex flex-col items-center min-w-[40px] bg-primary/10 rounded-xl p-2">
                      <span className="text-[9px] text-primary uppercase font-bold">{format(new Date(evt.date), "MMM")}</span>
                      <span className="text-base font-black text-foreground">{format(new Date(evt.date), "d")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[evt.type] || ""}`}>{evt.type}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate">{evt.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {evt.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime12h(evt.start_time)}</span>}
                        {evt.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {evt.location}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team info */}
          {team && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-primary" /> Team Info
              </h3>
              <div className="bg-surface rounded-2xl border border-border p-4 grid grid-cols-2 gap-3 text-sm">
                {team.head_coach && <div><p className="text-xs text-muted-foreground">Coach</p><p className="font-semibold text-foreground">{team.head_coach}</p></div>}
                {team.age_group && <div><p className="text-xs text-muted-foreground">Division</p><p className="font-semibold text-foreground">{team.age_group}</p></div>}
                {team.practice_location && <div><p className="text-xs text-muted-foreground">Practice Location</p><p className="font-semibold text-foreground">{team.practice_location}</p></div>}
                {team.practice_schedule && <div><p className="text-xs text-muted-foreground">Practice Schedule</p><p className="font-semibold text-foreground">{team.practice_schedule}</p></div>}
              </div>
            </div>
          )}
        </div>

        {/* Bottom accent */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        {/* Safe area bottom spacer */}
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </div>
  );
}