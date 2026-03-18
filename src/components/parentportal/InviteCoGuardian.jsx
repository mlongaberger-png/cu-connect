import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserPlus, CheckCircle, AlertCircle, Users, Trash2 } from "lucide-react";

export default function InviteCoGuardian({ player, currentUserEmail }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const { data: guardians = [] } = useQuery({
    queryKey: ["guardians", player.id],
    queryFn: () => base44.entities.PlayerGuardian.filter({ player_id: player.id }),
  });

  const otherGuardians = guardians.filter(g => g.user_email !== currentUserEmail);

  const handleInvite = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    // Check for duplicate
    if (guardians.some(g => g.user_email === trimmed)) {
      setError("This person already has access.");
      return;
    }

    setSending(true);
    setError(null);

    // Create guardian link
    await base44.entities.PlayerGuardian.create({
      player_id: player.id,
      player_name: `${player.first_name} ${player.last_name}`,
      user_email: trimmed,
      invited_by: currentUserEmail,
      relationship: "Guardian",
    });

    // Send invite email so they can create an account
    await base44.functions.invoke("inviteParent", { email: trimmed });

    queryClient.invalidateQueries({ queryKey: ["guardians", player.id] });
    setEmail("");
    setSending(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleRemove = async (guardian) => {
    await base44.entities.PlayerGuardian.delete(guardian.id);
    queryClient.invalidateQueries({ queryKey: ["guardians", player.id] });
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Shared access for {player.first_name}
        </p>
      </div>

      {otherGuardians.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {otherGuardians.map(g => (
            <div key={g.id} className="flex items-center justify-between text-xs bg-surface rounded-lg px-3 py-2 border border-border">
              <span className="text-foreground">{g.user_email}</span>
              <button
                onClick={() => handleRemove(g)}
                className="text-muted-foreground hover:text-red-400 transition-colors ml-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleInvite} className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="co-parent@email.com"
          className="bg-surface border-border text-sm h-8"
          required
        />
        <Button type="submit" disabled={sending} size="sm" className="bg-primary text-primary-foreground shrink-0 h-8">
          <UserPlus className="w-3.5 h-3.5 mr-1" />
          {sending ? "Inviting…" : "Invite"}
        </Button>
      </form>

      {success && (
        <p className="flex items-center gap-1.5 text-xs text-green-400 mt-2">
          <CheckCircle className="w-3.5 h-3.5" /> Invitation sent!
        </p>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400 mt-2">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
    </div>
  );
}