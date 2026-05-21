import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Users, ChevronRight, ClipboardList, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

const SEASON_COLORS = {
  fall:   { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  winter: { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20" },
  spring: { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/20" },
  summer: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
};

function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 9 && month <= 11) return "fall";
  if (month === 12 || month <= 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  return "summer";
}

export default function ParentSportsRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sportsData, setSportsData] = useState([]);
  const [openRegs, setOpenRegs] = useState([]);

  useEffect(() => {
    const currentSeason = getCurrentSeason();
    const currentYear = String(new Date().getFullYear());

    Promise.all([
      base44.entities.Sport.list(),
      base44.entities.Team.list(),
      base44.entities.Player.list(),
      base44.entities.TeamRegistration.filter({ is_open: true }),
    ]).then(([sports, teams, players, regs]) => {
      // Filter to current season's active teams
      const activeTeams = teams.filter(t =>
        t.is_active !== false &&
        (t.season === currentSeason || t.year === currentYear)
      );

      // Build a map: sport_id -> { sport, teams, playerCount, registrations }
      const activeSports = sports
        .filter(s => s.is_active !== false)
        .map(sport => {
          const sportTeams = activeTeams.filter(t => t.sport_id === sport.id);
          const teamIds = new Set(sportTeams.map(t => t.id));
          const playerCount = players.filter(p => teamIds.has(p.team_id) && p.is_active !== false).length;
          const sportRegs = regs.filter(r => sportTeams.some(t => t.id === r.team_id));
          return { sport, teams: sportTeams, playerCount, registrations: sportRegs };
        })
        .filter(s => s.teams.length > 0 || s.registrations.length > 0);

      setSportsData(activeSports);
      setOpenRegs(regs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleRegister = (sportId) => {
    navigate(`/Register?sport=${sportId}`);
  };

  const handleViewAll = () => {
    navigate("/Register");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentSeason = getCurrentSeason();
  const seasonColors = SEASON_COLORS[currentSeason] || SEASON_COLORS.fall;
  const hasOpenRegs = openRegs.length > 0;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sports</h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">
          {currentSeason} {new Date().getFullYear()} Season
        </p>
      </div>

      {/* Open Registrations Banner */}
      {hasOpenRegs && (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {openRegs.length} Registration{openRegs.length !== 1 ? "s" : ""} Open
                </p>
                <p className="text-xs text-muted-foreground">Spots are filling up — register today</p>
              </div>
            </div>
            <Button
              onClick={handleViewAll}
              size="sm"
              className="bg-primary text-primary-foreground shrink-0"
            >
              Register Now <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Sports Grid */}
      {sportsData.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground">No active sports this season</p>
          <p className="text-sm text-muted-foreground mt-1">Check back soon for upcoming programs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sportsData.map(({ sport, teams, playerCount, registrations }) => {
            const hasReg = registrations.length > 0;
            return (
              <div
                key={sport.id}
                className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Sport Icon */}
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                      {sport.icon || "🏆"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{sport.name}</h3>
                        {hasReg && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold uppercase tracking-wide border border-red-500/20">
                            Open
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {playerCount} active player{playerCount !== 1 ? "s" : ""}
                        </span>
                        <span>{teams.length} team{teams.length !== 1 ? "s" : ""}</span>
                        <span className={`capitalize px-1.5 py-0.5 rounded-md text-[10px] font-medium ${seasonColors.bg} ${seasonColors.text}`}>
                          {currentSeason}
                        </span>
                      </div>
                      {hasReg && (
                        <p className="text-xs text-primary mt-1.5">
                          {registrations.length} open registration form{registrations.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {hasReg && (
                    <Button
                      onClick={() => handleRegister(sport.id)}
                      size="sm"
                      className="bg-primary text-primary-foreground shrink-0"
                    >
                      Register
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}