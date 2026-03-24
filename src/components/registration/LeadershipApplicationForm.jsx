import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

const ROLES = [
  { value: "coach", label: "Head Coach" },
  { value: "assistant_coach", label: "Assistant Coach" },
  { value: "athletic_director", label: "Athletic Director" },
  { value: "team_manager", label: "Team Manager" },
  { value: "volunteer_coordinator", label: "Volunteer Coordinator" },
  { value: "other", label: "Other Leadership Role" },
];

export default function LeadershipApplicationForm({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    applicant_name: "", applicant_email: "", applicant_phone: "",
    role_applying_for: "", sport_interest: "", experience: "",
    certifications: "", availability: "", notes: ""
  });
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: (data) => base44.entities.LeadershipApplication.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadership-applications"] });
      setSubmitted(true);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMutation.mutate({ ...form, status: "pending" });
  };

  if (submitted) {
    return (
      <div className="text-center py-12 space-y-4">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
        <h3 className="text-xl font-bold text-foreground">Application Submitted!</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Thank you for your interest in joining the Cornerstone United leadership team.
          We'll review your application and be in touch soon.
        </p>
        {onClose && <Button onClick={onClose} className="bg-primary text-primary-foreground mt-2">Done</Button>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Your Information</p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Full Name <span className="text-destructive">*</span></Label>
            <Input value={form.applicant_name} onChange={e => setForm(f => ({ ...f, applicant_name: e.target.value }))} required className="bg-surface border-border mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={form.applicant_email} onChange={e => setForm(f => ({ ...f, applicant_email: e.target.value }))} required className="bg-surface border-border mt-1" />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={form.applicant_phone} onChange={e => setForm(f => ({ ...f, applicant_phone: e.target.value }))} className="bg-surface border-border mt-1" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Role & Interest</p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Role Applying For <span className="text-destructive">*</span></Label>
            <Select value={form.role_applying_for} onValueChange={v => setForm(f => ({ ...f, role_applying_for: v }))}>
              <SelectTrigger className="bg-surface border-border mt-1">
                <SelectValue placeholder="Select a role…" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Sport(s) of Interest</Label>
            <Input value={form.sport_interest} onChange={e => setForm(f => ({ ...f, sport_interest: e.target.value }))} placeholder="e.g. Football, Basketball, Multiple" className="bg-surface border-border mt-1" />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Background</p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Coaching / Leadership Experience</Label>
            <Textarea value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} rows={3} placeholder="Describe relevant experience…" className="bg-surface border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs">Certifications (CPR, coaching licenses, background check, etc.)</Label>
            <Input value={form.certifications} onChange={e => setForm(f => ({ ...f, certifications: e.target.value }))} placeholder="e.g. CPR certified, USA Football Level 1" className="bg-surface border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs">Availability</Label>
            <Input value={form.availability} onChange={e => setForm(f => ({ ...f, availability: e.target.value }))} placeholder="e.g. Weekday evenings, weekends" className="bg-surface border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs">Additional Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Anything else you'd like us to know…" className="bg-surface border-border mt-1" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        {onClose && <Button type="button" variant="outline" onClick={onClose} className="border-border">Cancel</Button>}
        <Button type="submit" disabled={!form.role_applying_for || submitMutation.isPending} className="bg-primary text-primary-foreground">
          {submitMutation.isPending ? "Submitting…" : "Submit Application"}
        </Button>
      </div>
    </form>
  );
}