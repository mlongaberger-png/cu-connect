import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const EMPTY = {
  user_name: "", user_email: "", team_name: "",
  sport_type: "football", role_type: "assistant_coach",
  bg_check_passed: false, bg_check_expires: "",
  nays_completed: false, nays_expires: "",
  last_reminder_sent: "none",
};

export default function CoachProfileModal({ profile, onClose, onSaved }) {
  const [form, setForm] = useState(profile ? { ...EMPTY, ...profile } : EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.user_email) return;
    setSaving(true);
    if (profile?.id) {
      await base44.entities.CoachProfile.update(profile.id, form);
    } else {
      await base44.entities.CoachProfile.create(form);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit Coach Profile" : "Add Coach Profile"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.user_name} onChange={e => set("user_name", e.target.value)} className="bg-surface border-border h-8 text-sm" placeholder="Full name" />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input value={form.user_email} onChange={e => set("user_email", e.target.value)} className="bg-surface border-border h-8 text-sm" placeholder="coach@email.com" required />
            </div>
          </div>
          <div>
            <Label className="text-xs">Team</Label>
            <Input value={form.team_name} onChange={e => set("team_name", e.target.value)} className="bg-surface border-border h-8 text-sm" placeholder="Team name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sport</Label>
              <Select value={form.sport_type} onValueChange={v => set("sport_type", v)}>
                <SelectTrigger className="bg-surface border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="football">Football</SelectItem>
                  <SelectItem value="baseball">Baseball</SelectItem>
                  <SelectItem value="cheer">Cheer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={form.role_type} onValueChange={v => set("role_type", v)}>
                <SelectTrigger className="bg-surface border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="head_coach">Head Coach</SelectItem>
                  <SelectItem value="assistant_coach">Asst. Coach</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Background Check */}
          <div className="bg-surface rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Background Check Passed</Label>
              <Switch checked={form.bg_check_passed} onCheckedChange={v => set("bg_check_passed", v)} />
            </div>
            {form.bg_check_passed && (
              <div>
                <Label className="text-xs text-muted-foreground">Expiration Date</Label>
                <Input type="date" value={form.bg_check_expires} onChange={e => set("bg_check_expires", e.target.value)} className="bg-background border-border h-8 text-sm" />
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
                <Input type="date" value={form.nays_expires} onChange={e => set("nays_expires", e.target.value)} className="bg-background border-border h-8 text-sm" />
              </div>
            )}
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