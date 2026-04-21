import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import InviteFamilyMember from "./InviteFamilyMember";

export default function InviteCoGuardian({ player, currentUserEmail }) {
  const [open, setOpen] = useState(false);

  const { data: guardians = [] } = useQuery({
    queryKey: ["guardians", player.id],
    queryFn: () => base44.entities.PlayerGuardian.filter({ player_id: player.id }),
  });

  const others = guardians.filter(g => g.user_email !== currentUserEmail);

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          {others.length > 0
            ? `${others.length} family member${others.length > 1 ? "s" : ""} with access`
            : "No additional family access"}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-border text-xs h-7"
          onClick={() => setOpen(true)}
        >
          <UserPlus className="w-3 h-3" /> Invite Family
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Invite Family Member
              <span className="text-muted-foreground font-normal text-sm">for {player.first_name}</span>
            </DialogTitle>
          </DialogHeader>
          <InviteFamilyMember
            player={player}
            currentUserEmail={currentUserEmail}
            existingGuardians={guardians}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}