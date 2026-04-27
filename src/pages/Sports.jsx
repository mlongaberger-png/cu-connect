import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trophy } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import SportProfileCard from "@/components/sports/SportProfileCard";
import AthleteRegistrationForm from "@/components/registration/AthleteRegistrationForm";
import LeadershipApplicationForm from "@/components/registration/LeadershipApplicationForm";

const seasons = ["fall", "winter", "spring", "summer", "year_round"];

export default function Sports() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isStaff = ["admin", "athletic_director", "coach"].includes(user?.role);

  const [showForm, setShowForm] = useState(false);
  const [editingSport, setEditingSport] = useState(null);
  const [form, setForm] = useState({ name: "", icon: "🏅", season: "year_round", description: "" });
  const [registerSport, setRegisterSport] = useState(null);
  const [registerWithReg, setRegisterWithReg] = useState(null); // specific TeamRegistration
  const [showLeadershipForm, setShowLeadershipForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: sports = [], isLoading } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  // Fetch all open sport-level registrations
  const { data: allRegistrations = [] } = useQuery({
    queryKey: ["team-registrations-all"],
    queryFn: () => base44.entities.TeamRegistration.list(),
  });
  const openRegistrations = allRegistrations.filter(r => r.is_open);

  // Fetch open leadership applications (to conditionally show button)
  const { data: leadershipApps = [] } = useQuery({
    queryKey: ["leadership-applications-open"],
    queryFn: () => base44.entities.LeadershipApplication.list(),
  });
  const hasOpenLeadershipApps = true; // Always allow applications; apps are always open

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Sport.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sports"] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Sport.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sports"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Sport.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sports"] }),
  });

  const openCreate = () => {
    setEditingSport(null);
    setForm({ name: "", icon: "🏅", season: "year_round", description: "" });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingSport(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSport) updateMutation.mutate({ id: editingSport.id, data: form });
    else createMutation.mutate(form);
  };

  const visibleSports = isStaff ? sports : sports.filter(s => s.is_active !== false);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sports Programs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isStaff ? "Manage your organization's sports programs" : "Explore our athletic programs and register your athlete"}
          </p>
        </div>
        <div className="flex gap-2">
          {!isStaff && hasOpenLeadershipApps && (
            <Button variant="outline" onClick={() => setShowLeadershipForm(true)} className="border-border text-sm">
              Apply for Leadership Role
            </Button>
          )}
          {isAdmin && (
            <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Add Sport
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-card rounded-2xl animate-pulse border border-border" />)}
        </div>
      ) : visibleSports.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No sports yet</h3>
          <p className="text-muted-foreground mb-4">Add your first sport to get started</p>
          {isAdmin && (
            <Button onClick={openCreate} className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Add Sport
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleSports.map((sport) => (
            <SportProfileCard
              key={sport.id}
              sport={sport}
              teams={teams}
              canEdit={isAdmin}
              onRegisterClick={(s) => setRegisterSport(s)}
              openRegistrations={openRegistrations.filter(r =>
                r.sport_id === sport.id || r.team_id === sport.id || r.sport_name === sport.name
              )}
              onRegistrationClick={(reg, sport) => { setRegisterWithReg(reg); setRegisterSport(sport); }}
            />
          ))}
        </div>
      )}

      {/* Athlete Registration Form */}
      <AthleteRegistrationForm
        sport={registerSport}
        registration={registerWithReg}
        open={!!registerSport}
        onClose={() => { setRegisterSport(null); setRegisterWithReg(null); }}
      />

      {/* Leadership Application Dialog */}
      <Dialog open={showLeadershipForm} onOpenChange={setShowLeadershipForm}>
        <DialogContent className="bg-card border-border text-foreground max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply for a Leadership Role</DialogTitle>
          </DialogHeader>
          <LeadershipApplicationForm onClose={() => setShowLeadershipForm(false)} />
        </DialogContent>
      </Dialog>

      {/* Add Sport Dialog (admin only) */}
      {isAdmin && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle>{editingSport ? "Edit Sport" : "Add Sport"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>Icon</Label>
                  <Input value={form.icon} onChange={e => setForm({...form, icon: e.target.value})} className="bg-surface border-border text-center text-2xl" />
                </div>
                <div className="col-span-3">
                  <Label>Sport Name</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Football" className="bg-surface border-border" required />
                </div>
              </div>
              <div>
                <Label>Season</Label>
                <Select value={form.season} onValueChange={v => setForm({...form, season: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {seasons.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Short Description</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-surface border-border" rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeForm} className="border-border">Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground">{editingSport ? "Update" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}