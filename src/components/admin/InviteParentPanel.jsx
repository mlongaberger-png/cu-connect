import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Send, CheckCircle2 } from "lucide-react";
import AthleteLinker from "@/components/admin/AthleteLinker";

const RELATIONSHIPS = ["Guardian", "Mother", "Father", "Stepparent", "Other"];

export default function InviteParentPanel() {
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("Guardian");

  // For the "add athlete" picker row
  const [pickerSportId, setPickerSportId] = useState("none");
  const [pickerTeamId, setPickerTeamId] = useState("none");
  const [pickerPlayerId, setPickerPlayerId] = useState("none");

  // List of confirmed athlete links
  const [linkedPlayers, setLinkedPlayers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: () => base44.entities.Sport.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });

  const filteredTeams = pickerSportId === "none" ? teams : teams.filter(t => t.sport_id === pickerSportId);
  const filteredPlayers = (pickerTeamId === "none" ? players : players.filter(p => p.team_id === pickerTeamId))
    .filter(p => !linkedPlayers.some(lp => lp.id === p.id));

  const handleSportChange = (val) => { setPickerSportId(val); setPickerTeamId("none"); setPickerPlayerId("none"); };
  const handleTeamChange = (val) => { setPickerTeamId(val); setPickerPlayerId("none"); };

  const addPlayer = () => {
    if (pickerPlayerId === "none") return;
    const p = players.find(pl => pl.id === pickerPlayerId);
    if (!p) return;
    setLinkedPlayers(prev => [...prev, p]);
    setPickerPlayerId("none");
  };

  const removePlayer = (id) => setLinkedPlayers(prev => prev.filter(p => p.id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      // Send one invite call; backend will create all guardian links
      await base44.functions.invoke("inviteParent", {
        email,
        relationship,
        players: linkedPlayers.map(p => ({
          player_id: p.id,
          player_name: `${p.first_name} ${p.last_name}`,
        })),
        // Legacy single-player fields kept for backward compat
        player_id: linkedPlayers[0]?.id || "",
        player_name: linkedPlayers[0] ? `${linkedPlayers[0].first_name} ${linkedPlayers[0].last_name}` : "",
      });
      setSuccess(true);
      setEmail("");
      setRelationship("Guardian");
      setPickerSportId("none");
      setPickerTeamId("none");
      setPickerPlayerId("none");
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
          <h2 className="font-semibold text-foreground">Invite a Parent</h2>
          <p className="text-xs text-muted-foreground">Send a portal invite and link them to one or more athletes across any sport or team</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email + Relationship */}
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
                {RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Athlete Picker */}
        <div className="space-y-3">
          <Label>Link Athletes (optional)</Label>

          {/* Picker row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end p-3 rounded-xl bg-surface border border-border">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Sport</p>
              <Select value={pickerSportId} onValueChange={handleSportChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any sport" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any sport</SelectItem>
                  {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Team</p>
              <Select value={pickerTeamId} onValueChange={handleTeamChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any team</SelectItem>
                  {filteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Athlete</p>
              <Select value={pickerPlayerId} onValueChange={setPickerPlayerId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select athlete" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select —</SelectItem>
                  {filteredPlayers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}{p.jersey_number ? ` #${p.jersey_number}` : ""} · {p.team_name || "No team"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="button" size="sm" variant="outline" onClick={addPlayer} disabled={pickerPlayerId === "none"} className="gap-1 h-8">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>

          {/* Linked athletes list */}
          {linkedPlayers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {linkedPlayers.map(p => (
                <Badge key={p.id} variant="outline" className="flex items-center gap-1.5 pr-1 py-1">
                  <span>{p.first_name} {p.last_name} · {p.team_name || "No team"}</span>
                  <button type="button" onClick={() => removePlayer(p.id)} className="rounded hover:text-destructive transition-colors ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {linkedPlayers.length === 0 && (
            <p className="text-xs text-muted-foreground">No athletes linked yet — invite will still be sent.</p>
          )}
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