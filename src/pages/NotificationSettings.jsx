import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, MessageSquare, Calendar, ClipboardList, DollarSign, Users, FileText, Moon, Smartphone, CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const CATEGORIES = [
  { key: "messages",   label: "Messages",             icon: MessageSquare, desc: "Team chat and direct messages" },
  { key: "schedule",   label: "Schedule Updates",      icon: Calendar,     desc: "Event changes, cancellations, new events" },
  { key: "attendance", label: "Attendance Requests",   icon: ClipboardList, desc: "RSVP requests from coaches" },
  { key: "payments",   label: "Payments & Invoices",   icon: DollarSign,   desc: "New invoices and payment confirmations" },
  { key: "volunteers", label: "Volunteer Assignments", icon: Users,        desc: "Volunteer sign-up confirmations and reminders" },
  { key: "documents",  label: "Document Requests",     icon: FileText,     desc: "Signature requests and document uploads" },
];

const DEFAULTS = {
  messages_enabled: true,   messages_method: "both",
  schedule_enabled: true,   schedule_method: "both",
  attendance_enabled: true, attendance_method: "email",
  payments_enabled: true,   payments_method: "email",
  volunteers_enabled: true, volunteers_method: "both",
  documents_enabled: true,  documents_method: "email",
  quiet_hours_enabled: false, quiet_start: "22:00", quiet_end: "07:00",
};

export default function NotificationSettings() {
  const [userEmail, setUserEmail] = useState(null);
  const [prefs, setPrefs] = useState(DEFAULTS);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => setUserEmail(u?.email)).catch(() => {});
  }, []);

  const { data: existing = [] } = useQuery({
    queryKey: ["notif-prefs", userEmail],
    queryFn: () => base44.entities.NotificationPreference.filter({ user_email: userEmail }),
    enabled: !!userEmail,
    onSuccess: (data) => {
      if (data.length > 0) setPrefs({ ...DEFAULTS, ...data[0] });
    },
  });

  useEffect(() => {
    if (existing.length > 0) setPrefs({ ...DEFAULTS, ...existing[0] });
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (existing.length > 0) {
        return base44.entities.NotificationPreference.update(existing[0].id, data);
      } else {
        return base44.entities.NotificationPreference.create({ ...data, user_email: userEmail });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notif-prefs", userEmail] });
      toast({ title: "Preferences saved", description: "Your notification settings have been updated." });
    },
  });

  const update = (key, value) => setPrefs(p => ({ ...p, [key]: value }));
  const { isSupported, isSubscribed, isLoading: pushLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" /> Notification Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Control which notifications you receive and how.</p>
      </div>

      {/* Push Notifications Card */}
      {isSupported && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Push Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {isSubscribed ? "You'll receive browser push notifications in real time" :
                   permission === 'denied' ? "Blocked in browser — update site permissions to enable" :
                   "Get instant alerts even when the app isn't open"}
                </p>
              </div>
            </div>
            {permission === 'denied' ? (
              <span className="text-xs text-muted-foreground bg-surface border border-border rounded-lg px-3 py-1.5">Blocked</span>
            ) : isSubscribed ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3 h-3" /> Active</span>
                <button onClick={unsubscribe} disabled={pushLoading} className="text-xs text-muted-foreground hover:text-foreground underline">Disable</button>
              </div>
            ) : (
              <Button size="sm" onClick={subscribe} disabled={pushLoading} className="gap-1.5 text-xs">
                <Bell className="w-3.5 h-3.5" />
                {pushLoading ? 'Enabling...' : 'Enable Push'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Per-category */}
      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        {CATEGORIES.map(({ key, label, icon: CatIcon, desc }) => (
          <div key={key} className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CatIcon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                  {prefs[`${key}_enabled`] && (
                <Select
                  value={prefs[`${key}_method`]}
                  onValueChange={v => update(`${key}_method`, v)}
                >
                  <SelectTrigger className="w-24 h-8 text-xs bg-surface border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="push">Push</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Switch
                checked={prefs[`${key}_enabled`]}
                onCheckedChange={v => update(`${key}_enabled`, v)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Quiet Hours */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Moon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Quiet Hours</p>
              <p className="text-xs text-muted-foreground">Pause all notifications during set hours</p>
            </div>
          </div>
          <Switch
            checked={prefs.quiet_hours_enabled}
            onCheckedChange={v => update("quiet_hours_enabled", v)}
          />
        </div>
        {prefs.quiet_hours_enabled && (
          <div className="flex items-center gap-4 pl-12">
            <div>
              <p className="text-xs text-muted-foreground mb-1">From</p>
              <input
                type="time"
                value={prefs.quiet_start}
                onChange={e => update("quiet_start", e.target.value)}
                className="text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-foreground"
              />
            </div>
            <span className="text-muted-foreground text-sm mt-4">to</span>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Until</p>
              <input
                type="time"
                value={prefs.quiet_end}
                onChange={e => update("quiet_end", e.target.value)}
                className="text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-foreground"
              />
            </div>
          </div>
        )}
      </div>

      <Button
        onClick={() => saveMutation.mutate(prefs)}
        disabled={saveMutation.isPending}
        className="w-full bg-primary text-primary-foreground"
      >
        {saveMutation.isPending ? "Saving..." : "Save Preferences"}
      </Button>
    </div>
  );
}