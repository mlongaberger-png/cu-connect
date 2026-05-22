import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, BarChart2, Trash2, Search } from "lucide-react";
import StatsUploadModal from "@/components/stats/StatsUploadModal";
import BaseballStatsDisplay from "@/components/stats/BaseballStatsDisplay";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function StatsManagerPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statsPlayer, setStatsPlayer] = useState(null);
  const [viewPlayer, setViewPlayer] = useState(null);

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: allStats = [] } = useQuery({
    queryKey: ["playerStats-all"],
    queryFn: () => base44.entities.PlayerStats.list("-created_date", 500),
  });

  const filtered = players
    .filter(p => p.is_active !== false)
    .filter(p => {
      const q = search.toLowerCase();
      return !q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.team_name || "").toLowerCase().includes(q);
    })
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));

  const statsCountFor = (playerId) => allStats.filter(s => s.player_id === playerId).length;

  const handleDeleteStats = async (playerId) => {
    const toDelete = allStats.filter(s => s.player_id === playerId);
    await Promise.all(toDelete.map(s => base44.entities.PlayerStats.delete(s.id)));
    queryClient.invalidateQueries({ queryKey: ["playerStats-all"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Athlete Stats</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Upload stats for any athlete — parents are notified automatically.</p>
        </div>
        <div className="text-xs text-muted-foreground">{allStats.length} stat record{allStats.length !== 1 ? "s" : ""} total</div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search athletes or teams..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-surface border-border"
        />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No athletes found.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(p => {
              const count = statsCountFor(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.photo_url
                      ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold text-primary">{p.first_name?.[0]}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-muted-foreground">{p.team_name || "No team"}{p.position ? ` · ${p.position}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {count > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {count} record{count !== 1 ? "s" : ""}
                      </span>
                    )}
                    {count > 0 && (
                      <Button variant="ghost" size="icon" title="View Stats" onClick={() => setViewPlayer(p)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <BarChart2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" title="Upload Stats" onClick={() => setStatsPlayer(p)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Sparkles className="w-4 h-4" />
                    </Button>
                    {count > 0 && (
                      <Button variant="ghost" size="icon" title="Delete All Stats" onClick={() => handleDeleteStats(p.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <StatsUploadModal
        open={!!statsPlayer}
        onOpenChange={(open) => { if (!open) { setStatsPlayer(null); queryClient.invalidateQueries({ queryKey: ["playerStats-all"] }); } }}
        player={statsPlayer}
        teamId={statsPlayer?.team_id}
        teamName={statsPlayer?.team_name}
      />

      {/* View Stats Dialog */}
      <Dialog open={!!viewPlayer} onOpenChange={(open) => { if (!open) setViewPlayer(null); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              {viewPlayer?.first_name} {viewPlayer?.last_name} — Stats
            </DialogTitle>
          </DialogHeader>
          {viewPlayer && (() => {
            const ps = allStats.filter(s => s.player_id === viewPlayer.id);
            return ps.length > 0
              ? <BaseballStatsDisplay stats={ps} />
              : <p className="text-sm text-muted-foreground py-4 text-center">No stats on file.</p>;
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}