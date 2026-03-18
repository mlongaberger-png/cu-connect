import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, Pencil, ExternalLink, Users, DollarSign, CheckCircle, Clock, XCircle } from "lucide-react";

const defaultForm = {
  title: "", description: "", fee_amount: 0, fee_description: "",
  season: "", year: "", is_open: true,
  collect_dob: true, collect_jersey: false, collect_position: false,
  collect_medical: true, collect_emergency: true,
  custom_field_1_label: "", custom_field_2_label: ""
};

export default function RegistrationManager({ team }) {
  const [showForm, setShowForm] = useState(false);
  const [editingReg, setEditingReg] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [showSubmissions, setShowSubmissions] = useState(null);
  const qc = useQueryClient();

  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations", team.id],
    queryFn: () => base44.entities.TeamRegistration.filter({ team_id: team.id }),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["reg-submissions", team.id],
    queryFn: () => base44.entities.RegistrationSubmission.filter({ team_id: team.id }),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingReg
      ? base44.entities.TeamRegistration.update(editingReg.id, data)
      : base44.entities.TeamRegistration.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["registrations", team.id] }); setShowForm(false); setEditingReg(null); setForm(defaultForm); }
  });

  const approveMutation = useMutation({
    mutationFn: async (sub) => {
      // Create player from submission
      const player = await base44.entities.Player.create({
        first_name: sub.player_first_name,
        last_name: sub.player_last_name,
        team_id: sub.team_id,
        team_name: sub.team_name,
        sport_name: sub.sport_name,
        jersey_number: sub.jersey_number || "",
        position: sub.position || "",
        date_of_birth: sub.player_dob || "",
        parent_name: sub.parent_name,
        parent_email: sub.parent_email,
        parent_phone: sub.parent_phone,
        emergency_contact: sub.emergency_contact || "",
        emergency_phone: sub.emergency_phone || "",
        medical_notes: sub.medical_notes || "",
        is_active: true
      });
      return base44.entities.RegistrationSubmission.update(sub.id, { status: "approved", player_id: player.id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reg-submissions", team.id] }); qc.invalidateQueries({ queryKey: ["players"] }); }
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => base44.entities.RegistrationSubmission.update(id, { status: "rejected" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reg-submissions", team.id] })
  });

  const handleEdit = (reg) => {
    setEditingReg(reg);
    setForm({ ...defaultForm, ...reg });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate({ ...form, team_id: team.id, team_name: team.name, sport_name: team.sport_name || "", fee_amount: parseFloat(form.fee_amount) || 0 });
  };

  const getRegLink = (regId) => `${window.location.origin}/Register?reg=${regId}`;

  const pendingSubs = submissions.filter(s => s.status === "pending");
  const regSubs = showSubmissions ? submissions.filter(s => s.registration_id === showSubmissions) : [];

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Registrations</h3>
          {pendingSubs.length > 0 && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{pendingSubs.length} pending</Badge>}
        </div>
        <Button size="sm" onClick={() => { setEditingReg(null); setForm(defaultForm); setShowForm(true); }} className="bg-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-1" /> New Form
        </Button>
      </div>

      {registrations.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">No registration forms yet</div>
      ) : (
        <div className="divide-y divide-border">
          {registrations.map(reg => {
            const regSubs2 = submissions.filter(s => s.registration_id === reg.id);
            const pending = regSubs2.filter(s => s.status === "pending").length;
            return (
              <div key={reg.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground truncate">{reg.title}</span>
                    <Badge className={reg.is_open ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}>
                      {reg.is_open ? "Open" : "Closed"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{reg.fee_amount > 0 ? `$${reg.fee_amount}` : "Free"}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{regSubs2.length} submitted{pending > 0 && <span className="text-yellow-400 font-medium"> ({pending} pending)</span>}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowSubmissions(reg.id)} className="text-xs text-muted-foreground hover:text-foreground">
                    View
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(getRegLink(reg.id))} className="text-xs text-muted-foreground hover:text-primary">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Copy Link
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(reg)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submissions Dialog */}
      <Dialog open={!!showSubmissions} onOpenChange={() => setShowSubmissions(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registration Submissions</DialogTitle></DialogHeader>
          {regSubs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">No submissions yet</p>
          ) : (
            <div className="space-y-3">
              {regSubs.map(sub => (
                <div key={sub.id} className="bg-surface rounded-xl p-4 border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{sub.player_first_name} {sub.player_last_name}</p>
                      <p className="text-xs text-muted-foreground">{sub.parent_name} · {sub.parent_email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={
                          sub.payment_status === "paid" || sub.payment_status === "free"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }>
                          {sub.payment_status === "free" ? "Free" : sub.payment_status === "paid" ? "Paid" : "Unpaid"}
                        </Badge>
                        <Badge className={
                          sub.status === "approved" ? "bg-green-500/20 text-green-400" :
                          sub.status === "rejected" ? "bg-red-500/20 text-red-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }>
                          {sub.status}
                        </Badge>
                      </div>
                    </div>
                    {sub.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveMutation.mutate(sub)} className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(sub.id)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 text-xs">
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingReg(null); setForm(defaultForm); } }}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingReg ? "Edit Registration Form" : "Create Registration Form"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Form Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-surface border-border" required placeholder="e.g. Fall 2025 Registration" /></div>
            <div><Label>Description / Instructions</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-surface border-border" placeholder="What parents should know..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Registration Fee ($)</Label><Input type="number" min="0" step="0.01" value={form.fee_amount} onChange={e => setForm({...form, fee_amount: e.target.value})} className="bg-surface border-border" placeholder="0 for free" /></div>
              <div><Label>Fee Description</Label><Input value={form.fee_description} onChange={e => setForm({...form, fee_description: e.target.value})} className="bg-surface border-border" placeholder="e.g. Covers uniform & fees" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Season</Label><Input value={form.season} onChange={e => setForm({...form, season: e.target.value})} className="bg-surface border-border" placeholder="e.g. Fall" /></div>
              <div><Label>Year</Label><Input value={form.year} onChange={e => setForm({...form, year: e.target.value})} className="bg-surface border-border" placeholder="e.g. 2025" /></div>
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-sm font-medium text-foreground">Fields to Collect</p>
              {[
                { key: "collect_dob", label: "Date of Birth" },
                { key: "collect_jersey", label: "Jersey Number" },
                { key: "collect_position", label: "Position" },
                { key: "collect_medical", label: "Medical Notes" },
                { key: "collect_emergency", label: "Emergency Contact" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="font-normal">{label}</Label>
                  <Switch checked={!!form[key]} onCheckedChange={v => setForm({...form, [key]: v})} />
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-sm font-medium text-foreground">Custom Fields (optional)</p>
              <div><Label>Custom Field 1 Label</Label><Input value={form.custom_field_1_label} onChange={e => setForm({...form, custom_field_1_label: e.target.value})} className="bg-surface border-border" placeholder="e.g. T-shirt size" /></div>
              <div><Label>Custom Field 2 Label</Label><Input value={form.custom_field_2_label} onChange={e => setForm({...form, custom_field_2_label: e.target.value})} className="bg-surface border-border" placeholder="e.g. School name" /></div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Label className="font-normal">Registration Open</Label>
              <Switch checked={!!form.is_open} onCheckedChange={v => setForm({...form, is_open: v})} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">{editingReg ? "Save Changes" : "Create Form"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}