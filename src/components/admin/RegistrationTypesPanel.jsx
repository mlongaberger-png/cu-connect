import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, ExternalLink, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";

const SEASONS = ["Fall", "Winter", "Spring", "Summer", "Year Round"];

const defaultForm = {
  title: "",
  sport_id: "",
  sport_name: "",
  season: "",
  year: new Date().getFullYear().toString(),
  description: "",
  is_open: true,
  team_id: "sport_level",
  team_name: "",
  fee_amount: 0,
  fee_description: "",
  collect_dob: true,
  collect_jersey: false,
  collect_position: false,
  collect_medical: true,
  collect_emergency: true,
  custom_field_1_label: "",
  custom_field_2_label: "",
};

function SportGroup({ sport, registrations, onEdit, onToggle }) {
  const [expanded, setExpanded] = useState(true);
  const getRegLink = (regId) => `${window.location.origin}/Register?reg=${regId}`;

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-lg">{sport.icon || "🏅"}</span>
        <span className="font-semibold text-foreground flex-1">{sport.name}</span>
        <Badge className="text-xs bg-surface border border-border text-muted-foreground">
          {registrations.length} form{registrations.length !== 1 ? "s" : ""}
        </Badge>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="divide-y divide-border border-t border-border">
          {registrations.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">No registrations for this sport yet.</p>
          ) : registrations.map(reg => (
            <div key={reg.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-foreground text-sm truncate">{reg.title}</span>
                  <Badge className={reg.is_open ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground border-border"}>
                    {reg.is_open ? "Open" : "Closed"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[reg.season, reg.year].filter(Boolean).join(" ")}
                  {reg.description ? ` · ${reg.description}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => navigator.clipboard.writeText(getRegLink(reg.id))}
                  title="Copy registration link"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onToggle(reg)}
                  title={reg.is_open ? "Close registration" : "Open registration"}
                  className="text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  {reg.is_open ? "Close" : "Reopen"}
                </button>
                <button
                  onClick={() => onEdit(reg)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RegistrationTypesPanel() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingReg, setEditingReg] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["team-registrations-all"],
    queryFn: () => base44.entities.TeamRegistration.list("-created_date"),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editingReg
        ? base44.entities.TeamRegistration.update(editingReg.id, data)
        : base44.entities.TeamRegistration.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-registrations-all"] });
      setShowForm(false);
      setEditingReg(null);
      setForm(defaultForm);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (reg) => base44.entities.TeamRegistration.update(reg.id, { is_open: !reg.is_open }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-registrations-all"] }),
  });

  const handleEdit = (reg) => {
    setEditingReg(reg);
    setForm({ ...defaultForm, ...reg });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const sport = sports.find(s => s.id === form.sport_id);
    saveMutation.mutate({
      ...form,
      sport_name: sport?.name || form.sport_name,
      team_id: form.sport_id, // use sport_id as team_id for sport-level regs
      team_name: sport?.name || "",
      fee_amount: parseFloat(form.fee_amount) || 0,
    });
  };

  // Group registrations by sport
  const sportsWithRegs = sports.map(sport => ({
    sport,
    regs: registrations.filter(r => r.team_id === sport.id || r.sport_id === sport.id || r.sport_name === sport.name),
  }));

  // Ungrouped fallback
  const groupedSportIds = new Set(sportsWithRegs.flatMap(s => s.regs.map(r => r.id)));
  const ungrouped = registrations.filter(r => !groupedSportIds.has(r.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" /> Registration Types
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Create and manage sport-specific registration forms for parents.</p>
        </div>
        <Button size="sm" onClick={() => { setEditingReg(null); setForm(defaultForm); setShowForm(true); }} className="bg-primary text-primary-foreground gap-1.5">
          <Plus className="w-4 h-4" /> Create Registration
        </Button>
      </div>

      {registrations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No registration types yet</p>
          <p className="text-xs mt-1">Create your first registration form for a sport or program.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sportsWithRegs.filter(s => s.regs.length > 0).map(({ sport, regs }) => (
            <SportGroup key={sport.id} sport={sport} registrations={regs} onEdit={handleEdit} onToggle={toggleMutation.mutate} />
          ))}
          {ungrouped.length > 0 && (
            <SportGroup
              sport={{ name: "Other", icon: "📋" }}
              registrations={ungrouped}
              onEdit={handleEdit}
              onToggle={toggleMutation.mutate}
            />
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingReg(null); setForm(defaultForm); } }}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReg ? "Edit Registration" : "Create Registration"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <Label>Registration Name *</Label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="bg-surface border-border mt-1"
                placeholder="e.g. Baseball Fall 2025 Registration"
                required
              />
            </div>

            <div>
              <Label>Sport / Program *</Label>
              <Select
                value={form.sport_id}
                onValueChange={v => setForm({ ...form, sport_id: v })}
                required
              >
                <SelectTrigger className="bg-surface border-border mt-1">
                  <SelectValue placeholder="Select a sport…" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {sports.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.icon ? `${s.icon} ` : ""}{s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Season</Label>
                <Select value={form.season} onValueChange={v => setForm({ ...form, season: v })}>
                  <SelectTrigger className="bg-surface border-border mt-1">
                    <SelectValue placeholder="Select season…" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {SEASONS.map(s => <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input
                  value={form.year}
                  onChange={e => setForm({ ...form, year: e.target.value })}
                  className="bg-surface border-border mt-1"
                  placeholder="2025"
                />
              </div>
            </div>

            <div>
              <Label>Description / Instructions for Parents</Label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="bg-surface border-border mt-1"
                placeholder="What parents should know before registering…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Registration Fee ($)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.fee_amount}
                  onChange={e => setForm({ ...form, fee_amount: e.target.value })}
                  className="bg-surface border-border mt-1"
                  placeholder="0 = Free"
                />
              </div>
              <div>
                <Label>Fee Description</Label>
                <Input
                  value={form.fee_description}
                  onChange={e => setForm({ ...form, fee_description: e.target.value })}
                  className="bg-surface border-border mt-1"
                  placeholder="e.g. Covers uniform & fees"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-sm font-medium text-foreground">Fields to Collect</p>
              {[
                { key: "collect_dob", label: "Date of Birth" },
                { key: "collect_jersey", label: "Jersey Number" },
                { key: "collect_position", label: "Position" },
                { key: "collect_medical", label: "Medical Notes" },
                { key: "collect_emergency", label: "Emergency Contact" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="font-normal text-sm">{label}</Label>
                  <Switch checked={!!form[key]} onCheckedChange={v => setForm({ ...form, [key]: v })} />
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-sm font-medium text-foreground">Custom Fields (optional)</p>
              <div>
                <Label className="text-xs">Custom Field 1</Label>
                <Input value={form.custom_field_1_label} onChange={e => setForm({ ...form, custom_field_1_label: e.target.value })} className="bg-surface border-border mt-0.5" placeholder="e.g. T-shirt size" />
              </div>
              <div>
                <Label className="text-xs">Custom Field 2</Label>
                <Input value={form.custom_field_2_label} onChange={e => setForm({ ...form, custom_field_2_label: e.target.value })} className="bg-surface border-border mt-0.5" placeholder="e.g. School name" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <Label className="font-normal">Registration Open</Label>
                <p className="text-xs text-muted-foreground">Parents can submit when open</p>
              </div>
              <Switch checked={!!form.is_open} onCheckedChange={v => setForm({ ...form, is_open: v })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-primary text-primary-foreground">
                {saveMutation.isPending ? "Saving…" : editingReg ? "Save Changes" : "Create Registration"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}