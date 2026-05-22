import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, User, Search, ChevronRight, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Picker modal: choose "Full Team Upload" or "Individual Athlete".
 * onSelectTeam(team) / onSelectPlayer(player)
 */
export default function StatsUploadPicker({ open, onOpenChange, onSelectTeam, onSelectPlayer }) {
  const [mode, setMode] = useState(null); // "team" | "player"
  const [search, setSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(null);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: open,
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
    enabled: open && mode === "player",
  });

  const handleClose = () => {
    setMode(null);
    setSearch("");
    setSelectedTeam(null);
    onOpenChange(false);
  };

  const filteredTeams = teams.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPlayers = players
    .filter(p => p.is_active !== false)
    .filter(p => {
      if (selectedTeam) return p.team_id === selectedTeam.id;
      const q = search.toLowerCase();
      return !q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        (p.team_name || "").toLowerCase().includes(q);
    })
    .sort((a, b) => `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Upload Stats</DialogTitle>
        </DialogHeader>

        {/* Step 1: Choose mode */}
        {!mode && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">What would you like to upload stats for?</p>
            <button
              onClick={() => { setMode("team"); setSearch(""); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-surface hover:border-primary/50 hover:bg-surface-hover transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">Full Team Upload</p>
                <p className="text-xs text-muted-foreground mt-0.5">One file — AI extracts every player automatically</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
            <button
              onClick={() => { setMode("player"); setSearch(""); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-surface hover:border-primary/50 hover:bg-surface-hover transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">Individual Athlete</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upload or type stats for one player</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        )}

        {/* Step 2a: Team picker */}
        {mode === "team" && (
          <div className="space-y-3 py-2">
            <button onClick={() => setMode(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← Back
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-surface border-border" />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredTeams.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No teams found.</p>}
              {filteredTeams.map(t => (
                <button
                  key={t.id}
                  onClick={() => { handleClose(); onSelectTeam(t); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {t.avatar_url ? <img src={t.avatar_url} alt="" className="w-full h-full object-cover" /> :
                      <span className="text-xs font-bold text-primary">{t.name?.[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.sport_name}{t.age_group ? ` · ${t.age_group}` : ""}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2b: Player picker (optionally filtered by team) */}
        {mode === "player" && (
          <div className="space-y-3 py-2">
            <button onClick={() => { setMode(null); setSelectedTeam(null); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← Back
            </button>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search athletes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-surface border-border" />
              </div>
              {selectedTeam ? (
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-lg px-2 whitespace-nowrap"
                >
                  {selectedTeam.name} <X className="w-3 h-3" />
                </button>
              ) : (
                <select
                  className="text-xs bg-surface border border-border rounded-lg px-2 text-foreground cursor-pointer"
                  onChange={e => { const t = teams.find(t => t.id === e.target.value); setSelectedTeam(t || null); }}
                  defaultValue=""
                >
                  <option value="">All teams</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredPlayers.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No athletes found.</p>}
              {filteredPlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => { handleClose(); onSelectPlayer(p); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> :
                      <span className="text-xs font-bold text-primary">{p.first_name?.[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-muted-foreground">{p.team_name || "No team"}{p.position ? ` · ${p.position}` : ""}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}