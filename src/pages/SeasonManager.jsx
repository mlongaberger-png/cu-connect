import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminGuard } from "@/hooks/useRoleGuard";
import { CalendarRange, Plus, Archive, Check, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

const TERMS = ["fall", "winter", "spring", "summer"];
const YEARS = ["2024", "2025", "2026", "2027"];

const BLANK = { name: "", year: new Date().getFullYear().toString(), term: "fall", start_date: "", end_date: "", notes: "", is_active: false, is_archived: false };

export default function SeasonManager({ embedded = false }) {
  useAdminGuard();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);

  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ["seasons"],
    queryFn: () => base44.entities.Season.list("-created_date"),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.Season.update(editing.id, data)
      : base44.entities.Season.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons"] });
      setShowForm(false);
      setEditing(null);
      setForm(BLANK);
      toast({ title: "Season saved" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (season) => {
      // Deactivate all others first
      for (const s of seasons) {
        if (s.is_active && s.id !== season.id) {
          await base44.entities.Season.update(s.id, { is_active: false });
        }
      }
      return base44.entities.Season.update(season.id, { is_active: true, is_archived: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons"] });
      toast({ title: "Season activated" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => base44.entities.Season.update(id, { is_active: false, is_archived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons"] });
      toast({ title: "Season archived" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Season.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seasons"] }),
  });

  const openEdit = (season) => {
    setEditing(season);
    setForm(season);
    setShowForm(true);
  };

  const active = seasons.filter(s => !s.is_archived);
  const archived = seasons.filter(s => s.is_archived);

  return (
    <div className={embedded ? "space-y-6" : "p-4 md:p-6 max-w-4xl mx-auto space-y-6"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarRange className="w-6 h-6 text-primary" /> Season Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage seasons to keep data organized across years</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(BLANK); setShowForm(true); }} className="bg-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" /> New Season
        </Button>
      </div>

      {/* Active & Upcoming */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active & Upcoming</h2>
        {active.length === 0 ? (
          <div className="text-center py-10 bg-card rounded-2xl border border-border">
            <CalendarRange className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No seasons yet. Create your first one.</p>
          </div>
        ) : (
          active.map(season => (
            <div key={season.id} className="bg-card rounded-2xl border border-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {season.is_active && (
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{season.name}</h3>
                    {season.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    {season.term} {season.year}
                    {season.start_date && ` · ${format(new Date(season.start_date), "MMM d")} – ${season.end_date ? format(new Date(season.end_date), "MMM d, yyyy") : "TBD"}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!season.is_active && (
                  <Button variant="outline" size="sm" onClick={() => activateMutation.mutate(season)} className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs h-8">
                    <Check className="w-3.5 h-3.5 mr-1" /> Set Active
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => openEdit(season)} className="text-muted-foreground h-8">
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => archiveMutation.mutate(season.id)} className="text-muted-foreground hover:text-orange-400 h-8">
                  <Archive className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Archived */}
      {archived.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Archived</h2>
          {archived.map(season => (
            <div key={season.id} className="bg-card/50 rounded-2xl border border-border p-4 flex items-center justify-between opacity-60">
              <div>
                <h3 className="font-medium text-foreground text-sm">{season.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{season.term} {season.year}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(season.id)} className="text-muted-foreground hover:text-red-400 h-8">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Season" : "Create New Season"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Season Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Fall 2025" className="bg-surface border-border mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Term</Label>
                <Select value={form.term} onValueChange={v => setForm({ ...form, term: v })}>
                  <SelectTrigger className="bg-surface border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {TERMS.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Select value={form.year} onValueChange={v => setForm({ ...form, year: v })}>
                  <SelectTrigger className="bg-surface border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date || ""} onChange={e => setForm({ ...form, start_date: e.target.value })} className="bg-surface border-border mt-1" />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.end_date || ""} onChange={e => setForm({ ...form, end_date: e.target.value })} className="bg-surface border-border mt-1" />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-surface border-border mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending} className="bg-primary text-primary-foreground">
                {saveMutation.isPending ? "Saving..." : "Save Season"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}