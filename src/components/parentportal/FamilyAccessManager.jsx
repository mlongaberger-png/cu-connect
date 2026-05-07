import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UserPlus, Trash2, Pencil, Users, Calendar, MessageSquare, CreditCard, CheckCircle } from "lucide-react";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import InviteFamilyMember from "./InviteFamilyMember";
import EditFamilyPermissions from "./EditFamilyPermissions";

const PERMISSION_LABELS = {
  view_calendar: { label: "Calendar", icon: Calendar, color: "text-blue-400" },
  view_messages: { label: "Messages", icon: MessageSquare, color: "text-purple-400" },
  financial_contributor: { label: "Payments", icon: CreditCard, color: "text-green-400" },
};

export default function FamilyAccessManager({ players, currentUserEmail }) {
  const queryClient = useQueryClient();
  const [showInviteFor, setShowInviteFor] = useState(null); // player
  const [editingGuardian, setEditingGuardian] = useState(null); // guardian record
  const [removingId, setRemovingId] = useState(null);

  // Fetch all guardians for all players
  const playerIds = players.map(p => p.id);

  const { data: allGuardians = [] } = useQuery({
    queryKey: ["all-guardians-family", playerIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        playerIds.map(pid => base44.entities.PlayerGuardian.filter({ player_id: pid }))
      );
      return results.flat();
    },
    enabled: playerIds.length > 0,
  });

  // Only show guardians that were invited by this user (or where the current user is the primary parent)
  const invitedGuardians = allGuardians.filter(g => g.user_email !== currentUserEmail);

  const handleRemove = async (guardian) => {
    setRemovingId(guardian.id);
    await base44.entities.PlayerGuardian.delete(guardian.id);
    queryClient.invalidateQueries({ queryKey: ["all-guardians-family", playerIds.join(",")] });
    setRemovingId(null);
  };

  const guardiansByPlayer = players.map(player => ({
    player,
    guardians: invitedGuardians.filter(g => g.player_id === player.id),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Family Access
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Invite grandparents or other family members with specific permissions</p>
        </div>
      </div>

      {guardiansByPlayer.map(({ player, guardians }) => (
        <div key={player.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlayerAvatar player={player} size="sm" />
              <span className="text-sm font-semibold text-foreground">{player.first_name} {player.last_name}</span>
              {player.team_name && <span className="text-xs text-muted-foreground">· {player.team_name}</span>}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-border text-xs h-7"
              onClick={() => setShowInviteFor(player)}
            >
              <UserPlus className="w-3 h-3" /> Invite
            </Button>
          </div>

          {guardians.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">No family members invited yet</p>
          ) : (
            <div className="space-y-2">
              {guardians.map(g => (
                <div key={g.id} className="flex items-center gap-3 bg-surface rounded-xl border border-border px-3 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">{(g.user_email || "?")[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{g.user_email}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {g.relationship && (
                        <span className="text-xs text-muted-foreground">{g.relationship}</span>
                      )}
                      {(g.permissions || []).map(pid => {
                        const cfg = PERMISSION_LABELS[pid];
                        if (!cfg) return null;
                        const Icon = cfg.icon;
                        return (
                          <span key={pid} className={`flex items-center gap-0.5 text-xs ${cfg.color}`}>
                            <Icon className="w-3 h-3" /> {cfg.label}
                          </span>
                        );
                      })}
                      {(!g.permissions || g.permissions.length === 0) && (
                        <span className="text-xs text-muted-foreground italic">No permissions set</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditingGuardian(g)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                      title="Edit permissions"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(g)}
                      disabled={removingId === g.id}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove access"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Invite Dialog */}
      <Dialog open={!!showInviteFor} onOpenChange={open => !open && setShowInviteFor(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Invite Family Member
              {showInviteFor && <span className="text-muted-foreground font-normal text-sm">for {showInviteFor.first_name}</span>}
            </DialogTitle>
          </DialogHeader>
          {showInviteFor && (
            <InviteFamilyMember
              player={showInviteFor}
              currentUserEmail={currentUserEmail}
              existingGuardians={allGuardians.filter(g => g.player_id === showInviteFor.id)}
              onClose={() => {
                setShowInviteFor(null);
                queryClient.invalidateQueries({ queryKey: ["all-guardians-family", playerIds.join(",")] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editingGuardian} onOpenChange={open => !open && setEditingGuardian(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Edit Access Permissions
            </DialogTitle>
          </DialogHeader>
          {editingGuardian && (
            <EditFamilyPermissions
              guardian={editingGuardian}
              onClose={() => {
                setEditingGuardian(null);
                queryClient.invalidateQueries({ queryKey: ["all-guardians-family", playerIds.join(",")] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}