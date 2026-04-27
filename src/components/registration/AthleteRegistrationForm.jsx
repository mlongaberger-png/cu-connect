import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const empty = {
  player_first_name: "", player_last_name: "", player_dob: "",
  jersey_number: "", position: "", medical_notes: "",
  emergency_contact: "", emergency_phone: "",
  parent_name: "", parent_email: "", parent_phone: "",
  team_id: "", notes: ""
};

export default function AthleteRegistrationForm({ sport, registration, open, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...empty, parent_name: user?.full_name || "", parent_email: user?.email || "" });
  const [submitted, setSubmitted] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: open
  });

  const sportTeams = teams.filter(t => t.sport_id === sport?.id && t.is_active !== false);

  const selectedTeam = teams.find(t => t.id === form.team_id);

  const submitMutation = useMutation({
    mutationFn: (data) => base44.entities.RegistrationSubmission.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reg-submissions-all"] });
      setSubmitted(true);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMutation.mutate({
      ...form,
      registration_id: registration?.id || `reg_${Date.now()}`,
      team_name: selectedTeam?.name || registration?.team_name || "",
      sport_name: sport?.name || registration?.sport_name || "",
      sport_id: sport?.id || "",
      status: "pending",
      payment_status: "free"
    });
  };

  const handleClose = () => {
    setForm({ ...empty, parent_name: user?.full_name || "", parent_email: user?.email || "" });
    setSubmitted(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {sport?.icon} {registration ? registration.title : `Register for ${sport?.name}`}
          </DialogTitle>
        </DialogHeader>
        {registration?.description && (
          <div className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
            {registration.description}
          </div>
        )}

        {submitted ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto" />
            <h3 className="text-lg font-bold text-foreground">Registration Submitted!</h3>
            <p className="text-sm text-muted-foreground">
              Your registration for <strong>{form.player_first_name} {form.player_last_name}</strong> has been submitted.
              An administrator will review and contact you shortly.
            </p>
            <Button onClick={handleClose} className="bg-primary text-primary-foreground mt-4">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Team Selection */}
            <div className="space-y-1.5">
              <Label>Select Team <span className="text-destructive">*</span></Label>
              <Select value={form.team_id} onValueChange={v => setForm(f => ({ ...f, team_id: v }))}>
                <SelectTrigger className="bg-surface border-border">
                  <SelectValue placeholder="Choose a team…" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {sportTeams.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.age_group ? `· ${t.age_group}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Athlete Info */}
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Athlete Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">First Name <span className="text-destructive">*</span></Label>
                  <Input value={form.player_first_name} onChange={e => setForm(f => ({ ...f, player_first_name: e.target.value }))} required className="bg-surface border-border mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Last Name <span className="text-destructive">*</span></Label>
                  <Input value={form.player_last_name} onChange={e => setForm(f => ({ ...f, player_last_name: e.target.value }))} required className="bg-surface border-border mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label className="text-xs">Date of Birth</Label>
                  <Input type="date" value={form.player_dob} onChange={e => setForm(f => ({ ...f, player_dob: e.target.value }))} className="bg-surface border-border mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Jersey # (preferred)</Label>
                  <Input value={form.jersey_number} onChange={e => setForm(f => ({ ...f, jersey_number: e.target.value }))} className="bg-surface border-border mt-1" />
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Medical Notes / Allergies</Label>
                <Textarea value={form.medical_notes} onChange={e => setForm(f => ({ ...f, medical_notes: e.target.value }))} rows={2} className="bg-surface border-border mt-1" />
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Contact Name</Label>
                  <Input value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} className="bg-surface border-border mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Contact Phone</Label>
                  <Input value={form.emergency_phone} onChange={e => setForm(f => ({ ...f, emergency_phone: e.target.value }))} className="bg-surface border-border mt-1" />
                </div>
              </div>
            </div>

            {/* Parent Info */}
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Parent / Guardian</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Full Name <span className="text-destructive">*</span></Label>
                  <Input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))} required className="bg-surface border-border mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
                    <Input type="email" value={form.parent_email} onChange={e => setForm(f => ({ ...f, parent_email: e.target.value }))} required className="bg-surface border-border mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input value={form.parent_phone} onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} className="bg-surface border-border mt-1" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={handleClose} className="border-border">Cancel</Button>
              <Button type="submit" disabled={!form.team_id || submitMutation.isPending} className="bg-primary text-primary-foreground">
                {submitMutation.isPending ? "Submitting…" : "Submit Registration"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}