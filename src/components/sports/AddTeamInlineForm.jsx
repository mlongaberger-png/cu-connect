import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

const ageGroups = ["6U", "8U", "10U", "12U", "14U", "16U", "18U", "Adult"];
const seasons = ["fall", "winter", "spring", "summer"];

export default function AddTeamInlineForm({ sport }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    name: "",
    age_group: "8U",
    head_coach: "",
    coach_email: "",
    season: "fall",
    year: String(new Date().getFullYear()),
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["sports"] });
      toast({ title: "Team created!", className: "bg-green-500/20 border-green-500/50 text-green-400" });
      setForm({ name: "", age_group: "8U", head_coach: "", coach_email: "", season: "fall", year: String(new Date().getFullYear()) });
      setExpanded(false);
    },
    onError: (error) => {
      toast({ title: "Failed to create team", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMutation.mutate({
      ...form,
      sport_id: sport.id,
      sport_name: sport.name,
    });
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => setExpanded(v => !v)}
        className="w-full border-dashed border-border text-muted-foreground hover:text-foreground"
      >
        <Plus className="w-4 h-4 mr-2" /> {expanded ? "Cancel" : "Add Team"}
      </Button>

      {expanded && (
        <form onSubmit={handleSubmit} className="space-y-3 border border-border rounded-xl p-4 bg-surface/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Team</span>
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
              <Lock className="w-3 h-3" /> {sport.name}
            </span>
          </div>

          <div>
            <Label className="text-xs">Team Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 10U Lions"
              className="bg-surface border-border mt-1"
              required
            />
          </div>

          <div>
            <Label className="text-xs">Age Group</Label>
            <Select value={form.age_group} onValueChange={(v) => setForm(f => ({ ...f, age_group: v }))}>
              <SelectTrigger className="bg-surface border-border mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {ageGroups.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Head Coach</Label>
            <Input
              value={form.head_coach}
              onChange={(e) => setForm(f => ({ ...f, head_coach: e.target.value }))}
              className="bg-surface border-border mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Coach Email</Label>
            <Input
              type="email"
              value={form.coach_email}
              onChange={(e) => setForm(f => ({ ...f, coach_email: e.target.value }))}
              className="bg-surface border-border mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Season</Label>
            <Select value={form.season} onValueChange={(v) => setForm(f => ({ ...f, season: v }))}>
              <SelectTrigger className="bg-surface border-border mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {seasons.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Year</Label>
            <Input
              type="number"
              value={form.year}
              onChange={(e) => setForm(f => ({ ...f, year: e.target.value }))}
              className="bg-surface border-border mt-1"
            />
          </div>

          <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={createMutation.isPending || !form.name.trim()}>
            {createMutation.isPending ? "Creating…" : "Create Team"}
          </Button>
        </form>
      )}
    </div>
  );
}