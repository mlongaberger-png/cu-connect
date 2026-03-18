import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Users, ChevronRight, Filter } from "lucide-react";

const ageGroups = ["6U", "8U", "10U", "12U", "14U", "16U", "18U", "Adult"];
const seasonOptions = ["fall", "winter", "spring", "summer"];

export default function Teams() {
  const [showForm, setShowForm] = useState(false);
  const [filterSport, setFilterSport] = useState("all");
  const [form, setForm] = useState({ name: "", sport_id: "", sport_name: "", age_group: "12U", head_coach: "", coach_email: "", season: "fall", year: "2026" });
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });
  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["teams"] }); setShowForm(false); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const sport = sports.find(s => s.id === form.sport_id);
    createMutation.mutate({ ...form, sport_name: sport?.name || "" });
  };

  const filteredTeams = filterSport === "all" ? teams : teams.filter(t => t.sport_id === filterSport);
  const playerCount = (teamId) => players.filter(p => p.team_id === teamId).length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">{teams.length} teams across {sports.length} sports</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterSport} onValueChange={setFilterSport}>
              <SelectTrigger className="w-40 bg-surface border-border">
                <SelectValue placeholder="Filter sport" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Sports</SelectItem>
                {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" /> Add Team
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-36 bg-card rounded-2xl animate-pulse border border-border" />)}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No teams yet</h3>
          <p className="text-muted-foreground mb-4">Create your first team</p>
          <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Team
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <Link key={team.id} to={`/TeamDetail?id=${team.id}`}>
              <div className="bg-card rounded-2xl border border-border p-5 hover:border-primary/30 transition-all group cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{team.name}</h3>
                    <p className="text-sm text-primary mt-0.5">{team.sport_name}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
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
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Add Team</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Team Name</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-surface border-border" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sport</Label>
                <Select value={form.sport_id} onValueChange={v => setForm({...form, sport_id: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Select sport" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Age Group</Label>
                <Select value={form.age_group} onValueChange={v => setForm({...form, age_group: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {ageGroups.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Head Coach</Label>
                <Input value={form.head_coach} onChange={e => setForm({...form, head_coach: e.target.value})} className="bg-surface border-border" />
              </div>
              <div>
                <Label>Coach Email</Label>
                <Input type="email" value={form.coach_email} onChange={e => setForm({...form, coach_email: e.target.value})} className="bg-surface border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Season</Label>
                <Select value={form.season} onValueChange={v => setForm({...form, season: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {seasonOptions.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input value={form.year} onChange={e => setForm({...form, year: e.target.value})} className="bg-surface border-border" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">Create Team</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}