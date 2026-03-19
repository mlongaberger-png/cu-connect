import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Send, CheckCircle2 } from "lucide-react";

export default function InviteParentPanel() {
  const [email, setEmail] = useState("");
  const [sportId, setSportId] = useState("none");
  const [teamId, setTeamId] = useState("none");
  const [playerId, setPlayerId] = useState("none");
  const [relationship, setRelationship] = useState("Guardian");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const filteredTeams = sportId === "none" ? teams : teams.filter(t => t.sport_id === sportId);
  const filteredPlayers = teamId === "none" ? players : players.filter(p => p.team_id === teamId);

  const handleSportChange = (val) => { setSportId(val); setTeamId("none"); setPlayerId("none"); };
  const handleTeamChange = (val) => { setTeamId(val); setPlayerId("none"); };

  const selectedPlayer = players.find(p => p.id === playerId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      await base44.functions.invoke("inviteParent", {
        email,
        player_id: playerId === "none" ? "" : playerId,
        player_name: selectedPlayer ? `${selectedPlayer.first_name} ${selectedPlayer.last_name}` : "",
        relationship,
      });
      setSuccess(true);
      setEmail("");
      setSportId("none");
      setTeamId("none");
      setPlayerId("none");
      setRelationship("Guardian");
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
          <h2 className="font-semibold text-foreground">Invite a Parent</h2>
          <p className="text-xs text-muted-foreground">Send a portal invite and optionally link them to a sport, team, and athlete</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Parent Email *</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="parent@example.com" required />
          </div>

          <div className="space-y-1.5">
            <Label>Relationship</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Guardian">Guardian</SelectItem>
                <SelectItem value="Mother">Mother</SelectItem>
                <SelectItem value="Father">Father</SelectItem>
                <SelectItem value="Stepparent">Stepparent</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Sport</Label>
            <Select value={sportId} onValueChange={handleSportChange}>
              <SelectTrigger><SelectValue placeholder="All Sports" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No filter —</SelectItem>
                {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Team</Label>
            <Select value={teamId} onValueChange={handleTeamChange} disabled={filteredTeams.length === 0}>
              <SelectTrigger><SelectValue placeholder="All Teams" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No filter —</SelectItem>
                {filteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Athlete (optional — links parent to player)</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder={filteredPlayers.length === 0 ? "Select a team first" : "Select athlete"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {filteredPlayers.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} {p.jersey_number ? `#${p.jersey_number}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {playerId !== "none" && selectedPlayer && (
              <p className="text-xs text-muted-foreground">
                Will be linked as guardian of <strong>{selectedPlayer.first_name} {selectedPlayer.last_name}</strong> on {selectedPlayer.team_name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={loading || !email} className="gap-2">
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
            ) : success ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {success ? "Invite Sent!" : "Send Parent Invite"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </form>
    </div>
  );
}