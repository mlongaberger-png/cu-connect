import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, CheckCircle2, XCircle, Link2, Search, ChevronRight, UserCheck } from "lucide-react";

const STATUS_COLORS = {
  pending:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  matched:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function PendingChildrenPanel() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [matchSearch, setMatchSearch] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data: pendingChildren = [], isLoading } = useQuery({
    queryKey: ["pending-children-all"],
    queryFn: () => base44.entities.PendingChild.list("-created_date"),
  });

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players-all"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const filtered = pendingChildren.filter(c => statusFilter === "all" || c.status === statusFilter);

  const playerSearchResults = matchSearch.trim()
    ? allPlayers.filter(p => {
        const q = matchSearch.toLowerCase();
        return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q);
      }).slice(0, 5)
    : [];

  const openReview = (child) => {
    setSelected(child);
    setAdminNotes(child.admin_notes || "");
    setMatchSearch("");
  };

  const handleApprove = async (matchedPlayer = null) => {
    setSaving(true);
    const updates = {
      status: matchedPlayer ? "matched" : "approved",
      admin_notes: adminNotes,
      reviewed_by: (await base44.auth.me())?.email || "",
      reviewed_at: new Date().toISOString(),
    };
    if (matchedPlayer) {
      updates.matched_player_id = matchedPlayer.id;
      updates.matched_player_name = `${matchedPlayer.first_name} ${matchedPlayer.last_name}`;
      // Link guardian
      const existingLinks = await base44.entities.PlayerGuardian.filter({ player_id: matchedPlayer.id, user_email: selected.parent_email });
      if (!existingLinks.length) {
        await base44.entities.PlayerGuardian.create({
          player_id: matchedPlayer.id,
          player_name: `${matchedPlayer.first_name} ${matchedPlayer.last_name}`,
          user_email: selected.parent_email,
          relationship: "Guardian",
          invited_by: updates.reviewed_by,
        });
      }
    } else {
      // Create new Player record
      const newPlayer = await base44.entities.Player.create({
        first_name: selected.first_name,
        last_name: selected.last_name,
        date_of_birth: selected.date_of_birth || undefined,
        parent_email: selected.parent_email,
        parent_name: selected.parent_name,
        is_active: true,
        team_id: selected.assigned_team_id || "",
        team_name: selected.assigned_team_name || "",
      });
      await base44.entities.PlayerGuardian.create({
        player_id: newPlayer.id,
        player_name: `${selected.first_name} ${selected.last_name}`,
        user_email: selected.parent_email,
        relationship: "Guardian",
        invited_by: updates.reviewed_by,
      });
      updates.matched_player_id = newPlayer.id;
    }
    await base44.entities.PendingChild.update(selected.id, updates);
    queryClient.invalidateQueries({ queryKey: ["pending-children-all"] });
    queryClient.invalidateQueries({ queryKey: ["players-all"] });
    setSaving(false);
    setSelected(null);
  };

  const handleReject = async () => {
    setSaving(true);
    await base44.entities.PendingChild.update(selected.id, {
      status: "rejected",
      admin_notes: adminNotes,
      reviewed_by: (await base44.auth.me())?.email || "",
      reviewed_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ["pending-children-all"] });
    setSaving(false);
    setSelected(null);
  };

  const pendingCount = pendingChildren.filter(c => c.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            Child Submissions
            {pendingCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">{pendingCount}</span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Review, match, or approve children submitted by parents</p>
        </div>
        <div className="flex gap-1">
          {["pending", "approved", "matched", "rejected", "all"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all capitalize ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-10 bg-card rounded-2xl border border-border">
          <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No {statusFilter !== "all" ? statusFilter : ""} submissions.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(child => (
          <button
            key={child.id}
            onClick={() => openReview(child)}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-sm text-primary">
              {child.first_name?.[0]}{child.last_name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">{child.first_name} {child.last_name}</p>
              <p className="text-xs text-muted-foreground truncate">Parent: {child.parent_name || child.parent_email}</p>
              {child.sport_interest && <p className="text-xs text-muted-foreground">{child.sport_interest}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[child.status] || ""}`}>{child.status}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Child Submission</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="bg-surface rounded-xl p-4 space-y-2">
                <p className="font-bold text-foreground text-lg">{selected.first_name} {selected.last_name}</p>
                {selected.date_of_birth && <p className="text-sm text-muted-foreground">DOB: {selected.date_of_birth}</p>}
                {selected.grade && <p className="text-sm text-muted-foreground">Grade: {selected.grade}</p>}
                {selected.sport_interest && <p className="text-sm text-muted-foreground">Sport: {selected.sport_interest}</p>}
                <p className="text-sm text-muted-foreground">Parent: {selected.parent_name} ({selected.parent_email})</p>
              </div>

              {/* Match to existing player */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Link2 className="w-3.5 h-3.5" /> Match to Existing Player (optional)
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={matchSearch}
                    onChange={e => setMatchSearch(e.target.value)}
                    placeholder={`Search players (e.g. "${selected.first_name}")`}
                    className="bg-surface border-border pl-9"
                  />
                </div>
                {playerSearchResults.length > 0 && (
                  <div className="space-y-1">
                    {playerSearchResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleApprove(p)}
                        disabled={saving}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition-colors text-left"
                      >
                        <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.first_name} {p.last_name}</p>
                          {p.team_name && <p className="text-xs text-muted-foreground">{p.team_name}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Admin Notes</Label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Internal notes…"
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleReject} disabled={saving} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
              Reject
            </Button>
            <div className="flex gap-2 flex-1 justify-end">
              <Button variant="outline" onClick={() => setSelected(null)} className="border-border">Cancel</Button>
              <Button onClick={() => handleApprove(null)} disabled={saving} className="bg-primary text-primary-foreground">
                {saving ? "Saving…" : "Approve & Create Player"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}