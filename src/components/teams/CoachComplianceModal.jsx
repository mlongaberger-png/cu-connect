import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

// Compliance-only edit modal, wired to the CoachCompliance entity (one record
// per coach, keyed by user_email). Team/sport/role assignment lives in
// TeamCoachesTab.jsx against CoachProfile instead -- this modal used to also
// carry those fields (as the old CoachProfileModal), but that data model was
// per-team-assignment, so a coach on multiple teams could end up with
// conflicting bg check / NAYS values depending on which record you edited.
// CoachCompliance fixes that by being one record per coach.

const EMPTY = {
  user_name: "", user_email: "",
  bg_check_passed: false, bg_check_expires: "",
  nays_completed: false, nays_expires: "",
  last_reminder_sent: "none",
  notes: "",
};

export default function CoachComplianceModal({ record, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(record ? { ...EMPTY, ...record } : EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.user_email) return;
    setSaving(true);
    try {
      const payload = {
        user_name: form.user_name,
        user_email: form.user_email,
        bg_check_passed: form.bg_check_passed,
        bg_check_expires: form.bg_check_expires || null,
        nays_completed: form.nays_completed,
        nays_expires: form.nays_expires || null,
        notes: form.notes,
      };
      if (record?.id) {
        await base44.entities.CoachCompliance.update(record.id, payload);
      } else {
        await base44.entities.CoachCompliance.create(payload);
      }
      onSaved();
    } catch (err) {
      toast({
        title: "Couldn't save compliance record",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>{record ? "Edit Compliance Record" : "Add Compliance Record"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.user_name} onChange={e => set("user_name", e.target.value)} className="bg-surface border-border h-8 text-sm" placeholder="Full name" />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input
                value={form.user_email}
                onChange={e => set("user_email", e.target.value)}
                className="bg-surface border-border h-8 text-sm"
                placeholder="coach@email.com"
                required
                disabled={!!record?.id}
              />
            </div>
          </div>
          {!record?.id && (
            <p className="text-[10px] text-muted-foreground -mt-2">
              Tip: use the email the coach logs in with -- team/sport assignment for coaches is managed from each team's Coaches tab, not here.
            </p>
          )}

          {/* Background Check */}
          <div className="bg-surface rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Background Check Passed</Label>
              <Switch checked={form.bg_check_passed} onCheckedChange={v => set("bg_check_passed", v)} />
            </div>
            {form.bg_check_passed && (
              <div>
                <Label className="text-xs text-muted-foreground">Expiration Date</Label>
                <Input type="date" value={form.bg_check_expires || ""} onChange={e => set("bg_check_expires", e.target.value)} className="bg-background border-border h-8 text-sm" />
              </div>
            )}
          </div>

          {/* NAYS */}
          <div className="bg-surface rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">NAYS Training Completed</Label>
              <Switch checked={form.nays_completed} onCheckedChange={v => set("nays_completed", v)} />
            </div>
            {form.nays_completed && (
              <div>
                <Label className="text-xs text-muted-foreground">Expiration Date</Label>
                <Input type="date" value={form.nays_expires || ""} onChange={e => set("nays_expires", e.target.value)} className="bg-background border-border h-8 text-sm" />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes || ""}
              onChange={e => set("notes", e.target.value)}
              className="bg-surface border-border text-sm min-h-[60px]"
              placeholder="Optional -- e.g. how the document was received"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="border-border h-8 text-xs">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.user_email} className="bg-primary text-primary-foreground h-8 text-xs">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
