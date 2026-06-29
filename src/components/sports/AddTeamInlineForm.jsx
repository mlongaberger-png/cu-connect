import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const ageGroups = ["6U", "8U", "10U", "12U", "14U", "16U", "18U", "Adult"];
const seasonOptions = ["fall", "winter", "spring", "summer"];

export default function AddTeamInlineForm({ sport }) {
  const [form, setForm] = useState({
    name: "",
    age_group: "12U",
    head_coach: "",
    coach_email: "",
    season: "fall",
    year: String(new Date().getFullYear()),
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["sports"] });
      setForm({ name: "", age_group: "12U", head_coach: "", coach_email: "", season: "fall", year: String(new Date().getFullYear()) });
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
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add a New Team</span>
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
          <Lock className="w-3 h-3" /> {sport.name}
        </span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
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
        <div className="grid grid-cols-2 gap-3">
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
            <Label className="text-xs">Season</Label>
            <Select value={form.season} onValueChange={(v) => setForm(f => ({ ...f, season: v }))}>
              <SelectTrigger className="bg-surface border-border mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {seasonOptions.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <div>
          <Label className="text-xs">Year</Label>
          <Input
            value={form.year}
            onChange={(e) => setForm(f => ({ ...f, year: e.target.value }))}
            className="bg-surface border-border mt-1"
          />
        </div>
        <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={createMutation.isPending || !form.name.trim()}>
          {createMutation.isPending ? "Adding Team…" : "Add Team"}
        </Button>
      </form>
    </div>
  );
}