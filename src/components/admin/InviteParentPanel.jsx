import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Send, CheckCircle2 } from "lucide-react";
import AthleteLinker from "@/components/admin/AthleteLinker";

const RELATIONSHIPS = ["Guardian", "Mother", "Father", "Stepparent", "Other"];

export default function InviteParentPanel() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("parent");
  const [relationship, setRelationship] = useState("Guardian");
  const [linkedPlayers, setLinkedPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: () => base44.entities.Sport.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });

  const handleAddPlayer = (player) => {
    if (!linkedPlayers.some(p => p.id === player.id)) {
      setLinkedPlayers(prev => [...prev, player]);
    }
  };

  const handleRemovePlayer = (playerId) => {
    setLinkedPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      await base44.functions.invoke("inviteParent", {
        email,
        role,
        relationship,
        players: linkedPlayers.map(p => ({
          player_id: p.id,
          player_name: `${p.first_name} ${p.last_name}`,
        })),
      });
      setSuccess(true);
      setEmail("");
      setRole("parent");
      setRelationship("Guardian");
      setLinkedPlayers([]);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Invite a Parent / Guardian</h2>
          <p className="text-xs text-muted-foreground">Send a portal invite as a Parent or Grandparent (view-only) and link them to athletes</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email + Relationship */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-1">
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="parent@example.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Portal Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Parent / Guardian</SelectItem>
                <SelectItem value="grandparent">Grandparent (view-only)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Relationship</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Athlete Linker */}
        <div className="space-y-1.5">
          <Label>Link Athletes (optional)</Label>
          <AthleteLinker
            sports={sports}
            teams={teams}
            players={players}
            linkedPlayers={linkedPlayers}
            onAdd={handleAddPlayer}
            onRemove={handleRemovePlayer}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={loading || !email} className="gap-2">
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
            ) : success ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {success ? "Invite Sent!" : "Send Invite"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </form>
    </div>
  );
}