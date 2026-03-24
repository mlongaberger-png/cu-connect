import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ClipboardList, Trash2, ChevronDown, ChevronUp, Clock, Copy, Pencil, GripVertical } from "lucide-react";
import { format } from "date-fns";

const BLANK_DRILL = { name: "", duration_minutes: 10, description: "", equipment: "" };

function DrillEditor({ drills, onChange }) {
  const add = () => onChange([...drills, { ...BLANK_DRILL }]);
  const remove = (i) => onChange(drills.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(drills.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  return (
    <div className="space-y-3">
      {drills.map((drill, i) => (
        <div key={i} className="bg-surface border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Input
              value={drill.name}
              onChange={e => update(i, "name", e.target.value)}
              placeholder="Drill name…"
              className="bg-card border-border text-sm flex-1"
            />
            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="number"
                value={drill.duration_minutes}
                onChange={e => update(i, "duration_minutes", parseInt(e.target.value) || 0)}
                className="bg-card border-border text-sm w-14"
                min={1}
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
            <button onClick={() => remove(i)} className="text-muted-foreground hover:text-red-400 flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <Input
            value={drill.description}
            onChange={e => update(i, "description", e.target.value)}
            placeholder="Description / instructions…"
            className="bg-card border-border text-xs"
          />
          <Input
            value={drill.equipment}
            onChange={e => update(i, "equipment", e.target.value)}
            placeholder="Equipment needed (optional)"
            className="bg-card border-border text-xs"
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full border-dashed border-border text-muted-foreground hover:text-foreground">
        <Plus className="w-3.5 h-3.5 mr-1" /> Add Drill
      </Button>
    </div>
  );
}

function PlanCard({ plan, onEdit, onDelete, onDuplicate }) {
  const [expanded, setExpanded] = useState(false);
  let drills = [];
  try { drills = JSON.parse(plan.drills || "[]"); } catch {}
  const totalMins = drills.reduce((sum, d) => sum + (d.duration_minutes || 0), 0);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div
        className="p-4 flex items-start justify-between cursor-pointer hover:bg-surface/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-foreground">{plan.title}</h3>
            {plan.is_template && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">Template</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="text-primary font-medium">{plan.team_name}</span>
            {plan.date && <span>{format(new Date(plan.date), "MMM d, yyyy")}</span>}
            {plan.focus && <span>Focus: {plan.focus}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {plan.duration_minutes || totalMins}min · {drills.length} drills</span>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(plan); }} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface" title="Duplicate">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(plan); }} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(plan.id); }} className="p-1.5 text-muted-foreground hover:text-red-400 rounded-lg hover:bg-surface">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          {plan.notes && <p className="text-sm text-muted-foreground italic">{plan.notes}</p>}
          {drills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No drills added yet.</p>
          ) : (
            <div className="space-y-2">
              {drills.map((drill, i) => (
                <div key={i} className="flex items-start gap-3 bg-surface rounded-xl p-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-foreground">{drill.name || "Unnamed drill"}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{drill.duration_minutes}min</span>
                    </div>
                    {drill.description && <p className="text-xs text-muted-foreground mt-0.5">{drill.description}</p>}
                    {drill.equipment && <p className="text-xs text-primary/70 mt-0.5">🎒 {drill.equipment}</p>}
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <span className="text-xs text-muted-foreground">Total: {totalMins} min</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BLANK_FORM = {
  title: "", team_id: "", date: "", duration_minutes: 90, focus: "", drills: [], notes: "", is_template: false
};

export default function PracticePlans() {
  const { user } = useAuth();
  const role = user?.role;
  const isCoach = role === "coach";
  const isAdmin = ["admin", "athletic_director"].includes(role);
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterTemplates, setFilterTemplates] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const myTeams = isCoach
    ? teams.filter(t => t.coach_email?.toLowerCase() === user?.email?.toLowerCase())
    : teams;

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["practice-plans"],
    queryFn: () => base44.entities.PracticePlan.list("-created_date"),
  });

  const visiblePlans = plans.filter(p => {
    const teamMatch = filterTeam === "all" || p.team_id === filterTeam;
    const templateMatch = !filterTemplates || p.is_template;
    if (isCoach) return myTeams.some(t => t.id === p.team_id) && teamMatch && templateMatch;
    return teamMatch && templateMatch;
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) return base44.entities.PracticePlan.update(editing.id, data);
      return base44.entities.PracticePlan.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-plans"] });
      setShowForm(false);
      setEditing(null);
      setForm(BLANK_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PracticePlan.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["practice-plans"] }),
  });

  const openEdit = (plan) => {
    let drills = [];
    try { drills = JSON.parse(plan.drills || "[]"); } catch {}
    setEditing(plan);
    setForm({ ...plan, drills });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...BLANK_FORM, team_id: myTeams[0]?.id || "" });
    setShowForm(true);
  };

  const handleDuplicate = (plan) => {
    let drills = [];
    try { drills = JSON.parse(plan.drills || "[]"); } catch {}
    setEditing(null);
    setForm({ ...plan, id: undefined, title: `${plan.title} (copy)`, drills, date: "" });
    setShowForm(true);
  };

  const handleSave = () => {
    const team = teams.find(t => t.id === form.team_id);
    saveMutation.mutate({
      ...form,
      team_name: team?.name || "",
      drills: JSON.stringify(form.drills),
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Practice Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">{visiblePlans.length} plans</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setFilterTemplates(t => !t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterTemplates ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            Templates only
          </button>
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-40 bg-surface border-border"><SelectValue placeholder="All Teams" /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Teams</SelectItem>
              {myTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> New Plan
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-card rounded-2xl animate-pulse border border-border" />)}
        </div>
      ) : visiblePlans.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-2xl border border-border">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No practice plans yet</h3>
          <p className="text-muted-foreground text-sm mt-1">Create your first plan to organize your practices</p>
          <Button onClick={openNew} className="mt-4 bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Create Plan
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditing(null); setForm(BLANK_FORM); } }}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Practice Plan" : "New Practice Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-surface border-border" placeholder="e.g. Tuesday Defense Prep" />
              </div>
              <div>
                <Label>Team</Label>
                <Select value={form.team_id} onValueChange={v => setForm(f => ({ ...f, team_id: v }))}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Select team…" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {myTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-surface border-border" />
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))} className="bg-surface border-border" />
              </div>
              <div>
                <Label>Focus</Label>
                <Input value={form.focus} onChange={e => setForm(f => ({ ...f, focus: e.target.value }))} className="bg-surface border-border" placeholder="e.g. Offense" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Drills</Label>
              <DrillEditor drills={form.drills} onChange={(drills) => setForm(f => ({ ...f, drills }))} />
            </div>

            <div>
              <Label>Coach Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-surface border-border" placeholder="Additional notes…" rows={2} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_template}
                onChange={e => setForm(f => ({ ...f, is_template: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-sm text-muted-foreground">Save as reusable template</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); setForm(BLANK_FORM); }} className="border-border">Cancel</Button>
              <Button onClick={handleSave} disabled={!form.title || !form.team_id || saveMutation.isPending} className="bg-primary text-primary-foreground">
                {saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Create Plan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}