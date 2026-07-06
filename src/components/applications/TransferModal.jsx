import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function TransferModal({ open, onOpenChange, application, onTransferred }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    base44.entities.Team.list()
      .then(list => {
        const active = list.filter(t => t.is_active !== false);
        setTeams(active);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const handleConfirm = async () => {
    if (!selectedTeamId || !application) return;
    setSubmitting(true);
    await base44.entities.RegistrationApplication.update(application.id, {
      target_team_id: selectedTeamId,
      target_team_name: selectedTeam?.name || "",
      sport_name: selectedTeam?.sport_name || "",
    });
    setSubmitting(false);
    setSelectedTeamId("");
    onOpenChange(false);
    if (onTransferred) onTransferred();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Transfer Application</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Move <span className="font-semibold text-foreground">{application?.athlete_first_name} {application?.athlete_last_name}</span>'s application to a different team.
        </p>
        <div className="space-y-2">
          <Label>New Team</Label>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading teams…
            </div>
          ) : (
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="bg-surface border-border">
                <SelectValue placeholder="Select a new team" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-60">
                {teams
                  .filter(t => t.id !== application?.target_team_id)
                  .map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.age_group ? ` (${t.age_group})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedTeamId || submitting} className="bg-primary text-primary-foreground">
            {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Transferring…</> : "Confirm Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}