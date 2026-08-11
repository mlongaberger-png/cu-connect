import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Users, ChevronRight, Filter, Trash2, ShieldCheck } from "lucide-react";
import TeamAvatarPicker, { getTeamAvatarEmoji } from "@/components/teams/TeamAvatarPicker";
import { useScheduleGuard } from "@/hooks/useRoleGuard";
import { useToast } from "@/components/ui/use-toast";

const ageGroups = ["6U", "8U", "10U", "12U", "14U", "16U", "18U", "Adult"];
const seasonOptions = ["fall", "winter", "spring", "summer"];

export default function Teams() {
  // Was useAdminOrADGuard() (admin/AD only) — blocked Coach from this page entirely,
  // which was the only in-app link into TeamDetail (roster/compliance/snacks/depth
  // chart), a page whose own permission checks already assume Coach access throughout.
  // Scoped below to the coach's own team(s) via CoachProfile, same pattern already
  // used for the Carpool page's coach branch — unlike admin/AD, who legitimately see
  // every team org-wide.
  const { isAdmin, isCoach, user } = useScheduleGuard();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [filterSport, setFilterSport] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active"); // "active" | "archived"
  const [deleteBlockedMessage, setDeleteBlockedMessage] = useState(null);
  const [form, setForm] = useState({ name: "", sport_id: "", sport_name: "", age_group: "12U", head_coach: "", coach_email: "", season: "fall", year: "2026", avatar_url: null, avatar_type: null });
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list()
  });
  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list()
  });
  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list()
  });
  const { data: coachProfiles = [] } = useQuery({
    queryKey: ["coach-profiles-teams", user?.email],
    queryFn: () => base44.entities.CoachProfile.filter({ user_email: user.email }),
    enabled: isCoach && !!user?.email
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["teams"] }); setShowForm(false); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke("deleteTeamSafely", { team_id: id }).then(res => {
      if (res.data?.blocked) {
        const err = new Error(res.data.message);
        err.blocked = true;
        throw err;
      }
      if (!res.data?.success) throw new Error(res.data?.error || "Couldn't delete team.");
      return res.data;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast({ title: "Team deleted" });
    },
    onError: (err) => {
      if (err.blocked) {
        setDeleteBlockedMessage(err.message);
      } else {
        toast({ title: "Couldn't delete team", description: err?.message, variant: "destructive" });
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const sport = sports.find((s) => s.id === form.sport_id);
    createMutation.mutate({ ...form, sport_name: sport?.name || "" });
  };

  const sortedSports = [...sports].sort((a, b) => a.name.localeCompare(b.name));
  const coachTeamIds = new Set(coachProfiles.map((cp) => cp.team_id));
  const scopedTeams = isCoach ? teams.filter((t) => coachTeamIds.has(t.id)) : teams;
  const statusScopedTeams = statusFilter === "archived"
    ? scopedTeams.filter((t) => t.is_active === false)
    : scopedTeams.filter((t) => t.is_active !== false);
  const filteredTeams = (filterSport === "all" ? statusScopedTeams : statusScopedTeams.filter((t) => t.sport_id === filterSport))
    .slice().sort((a, b) => a.name.localeCompare(b.name));
  const archivedCount = scopedTeams.filter((t) => t.is_active === false).length;
  const playerCount = (teamId) => players.filter((p) => p.team_id === teamId).length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">{teams.length} teams across {sports.length} sports</p>
        </div>
        <div className="flex gap-3">
          {!isCoach && (
            <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter("archived")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === "archived" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Archived{archivedCount > 0 ? ` (${archivedCount})` : ""}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterSport} onValueChange={setFilterSport}>
              <SelectTrigger className="w-40 bg-surface border-border">
                <SelectValue placeholder="Filter sport" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Sports</SelectItem>
                {sortedSports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Link to="/CoachesTraining">
            <Button variant="outline" className="border-border gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Coaches Training
            </Button>
          </Link>
          {isAdmin && (
            <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Add Team
            </Button>
          )}
        </div>
      </div>

      {isLoading ?
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-card rounded-2xl animate-pulse border border-border" />)}
        </div> :
      filteredTeams.length === 0 ?
      <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No teams yet</h3>
          <p className="text-muted-foreground mb-4">Create your first team</p>
          <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Team
          </Button>
        </div> :

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <div key={team.id} className="relative group">
              <Link to={`/TeamDetail?id=${team.id}`}>
                <div className="bg-card rounded-2xl border border-border p-5 hover:border-primary/30 transition-all cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-surface border border-border flex items-center justify-center flex-shrink-0">
                        {team.avatar_url
                          ? <img src={team.avatar_url} alt={team.name} className="w-full h-full object-cover" />
                          : <span className="text-lg">{getTeamAvatarEmoji(team.avatar_type)}</span>
                        }
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{team.name}</h3>
                        <p className="text-sm text-primary mt-0.5">{team.sport_name}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 mt-4 flex-wrap">
                    {team.age_group && (
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{team.age_group}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{playerCount(team.id)} players</span>
                    {team.head_coach && <span className="text-xs text-muted-foreground">Coach: {team.head_coach}</span>}
                  </div>
                </div>
              </Link>
              {isAdmin && (
                <button
                  onClick={(e) => { e.preventDefault(); if (confirm(`Delete "${team.name}"?`)) deleteMutation.mutate(team.id); }}
                  className="absolute top-3 right-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      }

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Add Team</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <TeamAvatarPicker
              avatarUrl={form.avatar_url}
              avatarType={form.avatar_type}
              onChange={(vals) => setForm(f => ({ ...f, ...vals }))}
            />
            <div>
              <Label>Team Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-surface border-border" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sport</Label>
                <Select value={form.sport_id} onValueChange={(v) => setForm({ ...form, sport_id: v })}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Select sport" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {sortedSports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Age Group / Division</Label>
                <Input value={form.age_group} onChange={(e) => setForm({ ...form, age_group: e.target.value })} placeholder="e.g. 10U, Junior Varsity..." className="bg-surface border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Head Coach</Label>
                <Input value={form.head_coach} onChange={(e) => setForm({ ...form, head_coach: e.target.value })} className="bg-surface border-border" />
              </div>
              <div>
                <Label>Coach Email</Label>
                <Input type="email" value={form.coach_email} onChange={(e) => setForm({ ...form, coach_email: e.target.value })} className="bg-surface border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Season</Label>
                <Select value={form.season} onValueChange={(v) => setForm({ ...form, season: v })}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {seasonOptions.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="bg-surface border-border" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">Create Team</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteBlockedMessage} onOpenChange={(open) => { if (!open) setDeleteBlockedMessage(null); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle>Can't delete this team</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{deleteBlockedMessage}</p>
          <div className="flex justify-end">
            <Button onClick={() => setDeleteBlockedMessage(null)} className="bg-primary text-primary-foreground">Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}