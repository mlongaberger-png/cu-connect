import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { X, Trophy, Calendar, Clock, MapPin, Shield } from "lucide-react";
import { formatDate, formatTime12h } from "@/utils/dateTime";
import { isPast, parseISO } from "date-fns";

const TYPE_COLORS = {
  practice: "bg-blue-500/20 text-blue-400",
  game: "bg-green-500/20 text-green-400",
  tournament: "bg-purple-500/20 text-purple-400",
  meeting: "bg-orange-500/20 text-orange-400",
  fundraiser: "bg-yellow-500/20 text-yellow-400",
  other: "bg-cyan-500/20 text-cyan-400",
};

export default function AthleteProfileModal({ player, team, sport, onClose }) {
  const { data: events = [] } = useQuery({
    queryKey: ["events-athlete-modal", player?.team_id],
    queryFn: () => base44.entities.Event.filter({ team_id: player.team_id }, "-date"),
    enabled: !!player?.team_id,
  });

  const wins = events.filter(e => e.result === "win");
  const championships = events.filter(e => e.is_championship_win);
  const upcoming = events.filter(e => e.date && !isPast(parseISO(e.date + "T23:59:59"))).slice(0, 5);
  const recent = events.filter(e => (e.result || e.our_score) && e.date && isPast(parseISO(e.date + "T23:59:59"))).slice(0, 5);

  const initials = `${player.first_name?.[0] || ""}${player.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 pt-5 pb-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-primary/30 bg-surface flex-shrink-0">
              {player.photo_url
                ? <img src={player.photo_url} alt={player.first_name} className="w-full h-full object-cover object-top" />
                : <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="text-lg font-black text-primary">{initials}</span>
                  </div>
              }
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground leading-tight">{player.first_name} {player.last_name}</h2>
              <p className="text-xs text-muted-foreground">{team?.name || "—"}{player.jersey_number ? ` · #${player.jersey_number}` : ""}{player.position ? ` · ${player.position}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface rounded-xl p-3 text-center border border-border">
              <p className="text-xl font-black text-primary">{wins.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Wins</p>
            </div>
            <div className="bg-surface rounded-xl p-3 text-center border border-border">
              <p className="text-xl font-black text-foreground">{events.filter(e => e.result === "loss").length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Losses</p>
            </div>
            <div className="bg-surface rounded-xl p-3 text-center border border-border">
              <p className="text-xl font-black text-yellow-400">{championships.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Titles</p>
            </div>
          </div>

          {/* Championships */}
          {championships.length > 0 && (
            <div className="bg-gradient-to-r from-primary/20 via-yellow-500/10 to-primary/20 border border-primary/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-primary" />
                <p className="text-sm font-bold text-primary">Championship Wins</p>
              </div>
              <div className="space-y-1">
                {championships.map(e => (
                  <p key={e.id} className="text-xs text-foreground">🏆 {e.title} · {formatDate(e.date, "MMM d, yyyy")}</p>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-primary" /> Upcoming Events
              </h3>
              <div className="space-y-2">
                {upcoming.map(e => (
                  <div key={e.id} className="flex items-start gap-3 p-3 bg-surface rounded-xl border border-border">
                    <div className="flex flex-col items-center min-w-[36px] shrink-0">
                      <span className="text-[10px] text-muted-foreground uppercase">{formatDate(e.date, "MMM")}</span>
                      <span className="text-base font-bold text-foreground leading-tight">{formatDate(e.date, "d")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[e.type] || TYPE_COLORS.other}`}>{e.type}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                      {e.start_time && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" />{formatTime12h(e.start_time)}</p>}
                      {e.location && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{e.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Results */}
          {recent.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary" /> Recent Results
              </h3>
              <div className="space-y-2">
                {recent.map(e => (
                  <div key={e.id} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border">
                    <div className="flex flex-col items-center min-w-[36px] shrink-0">
                      <span className="text-[10px] text-muted-foreground uppercase">{formatDate(e.date, "MMM")}</span>
                      <span className="text-base font-bold text-foreground leading-tight">{formatDate(e.date, "d")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                      {e.opponent && <p className="text-xs text-muted-foreground">vs {e.opponent}</p>}
                    </div>
                    {e.result && (
                      <div className="shrink-0 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${e.result === "win" ? "bg-green-500/20 text-green-400" : e.result === "loss" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                          {e.result}
                        </span>
                        {e.our_score != null && e.our_score !== "" && (
                          <p className="text-xs text-muted-foreground mt-0.5">{e.our_score}–{e.opponent_score ?? "?"}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcoming.length === 0 && recent.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">No events recorded yet for this team.</div>
          )}
        </div>
      </div>
    </div>
  );
}