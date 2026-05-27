import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, BellOff, Calendar } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function NotificationPreferencesCard({ currentUser, onUpdated }) {
  const [saving, setSaving] = useState(null);

  const chatEnabled = currentUser?.allow_chat_notifications !== false;
  const scheduleEnabled = currentUser?.allow_schedule_notifications !== false;

  const toggle = async (field, newValue) => {
    setSaving(field);
    await base44.auth.updateMe({ [field]: newValue });
    if (onUpdated) onUpdated();
    setSaving(null);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Notification Preferences</p>

      {/* Chat Notifications */}
      <div className="flex items-center justify-between gap-3 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Message Notifications</p>
            <p className="text-xs text-muted-foreground">Alerts for new chat messages</p>
          </div>
        </div>
        <Switch
          checked={chatEnabled}
          disabled={saving === "allow_chat_notifications"}
          onCheckedChange={(v) => toggle("allow_chat_notifications", v)}
        />
      </div>

      {/* Schedule Notifications */}
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Game & Practice Notifications</p>
            <p className="text-xs text-muted-foreground">Alerts for new events on the schedule</p>
          </div>
        </div>
        <Switch
          checked={scheduleEnabled}
          disabled={saving === "allow_schedule_notifications"}
          onCheckedChange={(v) => toggle("allow_schedule_notifications", v)}
        />
      </div>
    </div>
  );
}