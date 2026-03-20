import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Send, CheckCircle2 } from "lucide-react";

// Staff invite only — parents use the InviteParentPanel or AccessRequests flow
const ROLE_LABELS = {
  admin: "Admin",
  athletic_director: "Athletic Director",
  coach: "Coach",
};

export default function StaffInvitePanel() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [sportId, setSportId] = useState("none");
  const [teamId, setTeamId] = useState("none");
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

  const filteredTeams = sportId === "none"
    ? teams
    : teams.filter(t => t.sport_id === sportId);

  const handleSportChange = (val) => {
    setSportId(val);
    setTeamId("none"); // reset team when sport changes
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      const selectedSport = sports.find(s => s.id === sportId);
      const selectedTeam = teams.find(t => t.id === teamId);
      await base44.functions.invoke("inviteStaff", {
        email,
        role,
        sport_id: sportId === "none" ? "" : sportId,
        sport_name: selectedSport?.name || "",
        team_id: teamId === "none" ? "" : teamId,
        team_name: selectedTeam?.name || "",
      });
      setSuccess(true);
      setEmail("");
      setRole("");
      setSportId("none");
      setTeamId("none");
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
          <h2 className="font-semibold text-foreground">Invite Users</h2>
          <p className="text-xs text-muted-foreground">Send an invitation link to admins, athletic directors, or coaches</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div className="space-y-1.5 lg:col-span-2">
          <Label>Email *</Label>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="staff@example.com"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Role *</Label>
          <Select value={role} onValueChange={setRole} required>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="athletic_director">Athletic Director</SelectItem>
              <SelectItem value="coach">Coach</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Sport (optional)</Label>
          <Select value={sportId} onValueChange={handleSportChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Sports" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All Sports</SelectItem>
              {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Team (optional)</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger>
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All Teams</SelectItem>
              {filteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2 lg:col-span-5 flex items-center gap-3">
          <Button type="submit" disabled={loading || !email || !role} className="gap-2">
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