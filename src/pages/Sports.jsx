import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Trophy, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";

const seasons = ["fall", "winter", "spring", "summer", "year_round"];

export default function Sports() {
  const [showForm, setShowForm] = useState(false);
  const [editingSport, setEditingSport] = useState(null);
  const [form, setForm] = useState({ name: "", icon: "🏅", season: "year_round", description: "" });
  const queryClient = useQueryClient();

  const { data: sports = [], isLoading } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

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

  const openEdit = (sport) => {
    setEditingSport(sport);
    setForm({ name: sport.name, icon: sport.icon || "🏅", season: sport.season || "year_round", description: sport.description || "" });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingSport(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSport) {
      updateMutation.mutate({ id: editingSport.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const teamCount = (sportId) => teams.filter(t => t.sport_id === sportId).length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sports</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your organization's sports programs</p>
        </div>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Add Sport
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-card rounded-2xl animate-pulse border border-border" />)}
        </div>
      ) : sports.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No sports yet</h3>
          <p className="text-muted-foreground mb-4">Add your first sport to get started</p>
          <Button onClick={openCreate} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Sport
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sports.map((sport) => (
            <div key={sport.id} className="bg-card rounded-2xl border border-border p-6 hover:border-primary/30 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{sport.icon || "🏅"}</div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(sport)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(sport.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground">{sport.name}</h3>
              {sport.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{sport.description}</p>}
              <div className="flex items-center gap-3 mt-4">
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary capitalize">
                  {(sport.season || "").replace("_", " ")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {teamCount(sport.id)} team{teamCount(sport.id) !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

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
                <SelectTrigger className="bg-surface border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {seasons.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-surface border-border" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeForm} className="border-border">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">{editingSport ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}