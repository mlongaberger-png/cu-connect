import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Calendar, MessageSquare, CreditCard, CheckCircle, Save, Loader2 } from "lucide-react";

const PERMISSION_OPTIONS = [
  {
    id: "view_calendar",
    icon: Calendar,
    label: "View Calendar",
    description: "See team schedules, games, and upcoming events. Read-only.",
    color: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  },
  {
    id: "view_messages",
    icon: MessageSquare,
    label: "View Messages",
    description: "Read team messages and announcements from coaches.",
    color: "border-purple-500/40 bg-purple-500/10 text-purple-400",
  },
  {
    id: "financial_contributor",
    icon: CreditCard,
    label: "Financial Contributor",
    description: "View balances and make payments. Cannot refund or manage finances.",
    color: "border-green-500/40 bg-green-500/10 text-green-400",
  },
];

export default function EditFamilyPermissions({ guardian, onClose }) {
  const [permissions, setPermissions] = useState(guardian.permissions || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const togglePermission = (id) => {
    setPermissions(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.PlayerGuardian.update(guardian.id, { permissions });
    queryClient.invalidateQueries({ queryKey: ["guardians", guardian.player_id] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="space-y-4">
      <div className="px-3 py-2.5 bg-surface rounded-xl border border-border text-sm text-muted-foreground">
        Editing access for <span className="text-foreground font-medium">{guardian.user_email}</span>
        {guardian.relationship && <> ({guardian.relationship})</>}
      </div>

      <div className="space-y-2">
        {PERMISSION_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const selected = permissions.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => togglePermission(opt.id)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                selected ? opt.color : "border-border bg-surface hover:border-border/70"
              }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                selected ? "bg-current border-current" : "border-muted-foreground"
              }`}>
                {selected && <CheckCircle className="w-3 h-3 text-background" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? "opacity-100" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-semibold ${selected ? "" : "text-foreground"}`}>{opt.label}</span>
                </div>
                <p className={`text-xs mt-0.5 ${selected ? "opacity-80" : "text-muted-foreground"}`}>{opt.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {saved && (
        <div className="flex items-center justify-center gap-2 py-2 text-green-400 text-sm font-medium">
          <CheckCircle className="w-4 h-4" /> Permissions updated!
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 border-border" onClick={onClose} disabled={saving || saved}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || saved} className={`flex-1 gap-1.5 ${saved ? "bg-green-600 hover:bg-green-700 text-white" : "bg-primary text-primary-foreground"}`}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </Button>
      </div>
    </div>
  );
}