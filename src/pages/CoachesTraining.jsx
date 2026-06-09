import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { ShieldCheck, AlertTriangle, XCircle, Bell, BellOff, Plus, Pencil, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInDays, parseISO, format } from "date-fns";
import CoachProfileModal from "@/components/teams/CoachProfileModal";

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return differenceInDays(parseISO(dateStr), new Date());
}

function ComplianceCell({ passed, expires, label }) {
  const days = daysUntil(expires);

  if (!passed) {
    return (
      <div className="flex items-center gap-1.5">
        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-xs text-red-400 font-medium">Not {label}</span>
      </div>
    );
  }

  if (days === null) {
    return (
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-xs text-green-400 font-medium">{label} ✓</span>
      </div>
    );
  }

  let icon, colorClass, expiryLabel;
  if (days < 0) {
    icon = <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
    colorClass = "text-red-400";
    expiryLabel = `Expired ${Math.abs(days)}d ago`;
  } else if (days <= 30) {
    icon = <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />;
    colorClass = "text-red-400";
    expiryLabel = `Expires in ${days}d`;
  } else if (days <= 60) {
    icon = <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />;
    colorClass = "text-yellow-400";
    expiryLabel = `Expires in ${days}d`;
  } else {
    icon = <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />;
    colorClass = "text-green-400";
    expiryLabel = format(parseISO(expires), "MMM d, yyyy");
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={`text-xs font-medium ${colorClass}`}>{label} ✓</span>
      </div>
      <p className={`text-[10px] mt-0.5 ml-5 ${colorClass}`}>{expiryLabel}</p>
    </div>
  );
}

function ReminderBadge({ lastReminderSent }) {
  if (!lastReminderSent || lastReminderSent === "none") {
    return <span className="text-[10px] text-muted-foreground flex items-center gap-1"><BellOff className="w-3 h-3" /> None</span>;
  }
  if (lastReminderSent === "two_month") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-[10px] font-medium border border-yellow-500/30">
        <Bell className="w-3 h-3" /> 2-Mo Sent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-medium border border-red-500/30">
      <Bell className="w-3 h-3" /> 1-Mo Sent
    </span>
  );
}

function statusForProfile(profile) {
  const bgDays   = daysUntil(profile.bg_check_expires);
  const naysDays = daysUntil(profile.nays_expires);
  const anyExpired =
    !profile.bg_check_passed || !profile.nays_completed ||
    (profile.bg_check_passed && bgDays !== null && bgDays < 0) ||
    (profile.nays_completed  && naysDays !== null && naysDays < 0);
  const anyUrgent =
    (profile.bg_check_passed && bgDays !== null && bgDays >= 0 && bgDays <= 30) ||
    (profile.nays_completed  && naysDays !== null && naysDays >= 0 && naysDays <= 30);
  const anyWarning =
    (profile.bg_check_passed && bgDays !== null && bgDays > 30 && bgDays <= 60) ||
    (profile.nays_completed  && naysDays !== null && naysDays > 30 && naysDays <= 60);
  if (anyExpired) return "expired";
  if (anyUrgent)  return "urgent";
  if (anyWarning) return "warning";
  return "ok";
}

const SPORT_LABELS = { football: "Football", baseball: "Baseball", cheer: "Cheer" };
const ROLE_LABELS  = { head_coach: "Head Coach", assistant_coach: "Asst. Coach", manager: "Manager" };

export default function CoachesTraining() {
  const queryClient = useQueryClient();
  const [filterSport,  setFilterSport]  = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editingProfile, setEditingProfile] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["coach-profiles"],
    queryFn:  () => base44.entities.CoachProfile.list("-created_date"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CoachProfile.delete(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["coach-profiles"] }),
  });

  const filtered = profiles.filter(p => {
    if (filterSport  !== "all" && p.sport_type !== filterSport) return false;
    if (filterStatus !== "all" && statusForProfile(p) !== filterStatus) return false;
    return true;
  });

  const counts = {
    ok:      profiles.filter(p => statusForProfile(p) === "ok").length,
    warning: profiles.filter(p => statusForProfile(p) === "warning").length,
    urgent:  profiles.filter(p => statusForProfile(p) === "urgent").length,
    expired: profiles.filter(p => statusForProfile(p) === "expired").length,
  };

  const openNew  = () => { setEditingProfile(null); setShowModal(true); };
  const openEdit = (p)  => { setEditingProfile(p);  setShowModal(true); };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Coaches Training
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Background checks &amp; NAYS certification compliance</p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground gap-1.5 h-9">
          <Plus className="w-4 h-4" /> Add Coach Profile
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "All Clear",  count: counts.ok,      color: "text-green-400",  bg: "bg-green-500/10  border-green-500/30" },
          { label: "Warning",    count: counts.warning, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
          { label: "Urgent",     count: counts.urgent,  color: "text-red-400",    bg: "bg-red-500/10    border-red-500/30" },
          { label: "Incomplete", count: counts.expired, color: "text-red-400",    bg: "bg-red-500/10    border-red-500/30" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`rounded-xl border p-3 ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
            <p className={`text-xs font-medium mt-0.5 ${color}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterSport} onValueChange={setFilterSport}>
          <SelectTrigger className="w-36 bg-surface border-border h-8 text-xs">
            <SelectValue placeholder="All Sports" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Sports</SelectItem>
            <SelectItem value="football">Football</SelectItem>
            <SelectItem value="baseball">Baseball</SelectItem>
            <SelectItem value="cheer">Cheer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 bg-surface border-border h-8 text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ok">All Clear</SelectItem>
            <SelectItem value="warning">Warning (60d)</SelectItem>
            <SelectItem value="urgent">Urgent (30d)</SelectItem>
            <SelectItem value="expired">Expired / Incomplete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse border border-border" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No coach profiles found.</p>
          <Button onClick={openNew} className="mt-4 bg-primary text-primary-foreground gap-1.5 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Coach Profile
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coach</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sport / Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Background Check</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">NAYS Training</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alerts</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr key={p.id} className={`border-b border-border/40 hover:bg-surface/40 transition-colors ${idx % 2 === 0 ? "" : "bg-surface/20"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground text-sm">{p.user_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.user_email}</p>
                      {p.team_name && <p className="text-[10px] text-primary mt-0.5">{p.team_name}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground">{SPORT_LABELS[p.sport_type] || "—"}</span>
                      <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[p.role_type] || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ComplianceCell passed={p.bg_check_passed} expires={p.bg_check_expires} label="Passed" />
                    </td>
                    <td className="px-4 py-3">
                      <ComplianceCell passed={p.nays_completed} expires={p.nays_expires} label="Completed" />
                    </td>
                    <td className="px-4 py-3">
                      <ReminderBadge lastReminderSent={p.last_reminder_sent} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg bg-surface hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { if (confirm("Delete this coach profile?")) deleteMutation.mutate(p.id); }}
                          className="p-1.5 rounded-lg bg-surface hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{p.user_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.user_email}</p>
                    {p.team_name && <p className="text-xs text-primary">{p.team_name}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{SPORT_LABELS[p.sport_type] || "—"} · {ROLE_LABELS[p.role_type] || "—"}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg bg-surface hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm("Delete this coach profile?")) deleteMutation.mutate(p.id); }}
                      className="p-1.5 rounded-lg bg-surface hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-surface rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">BG Check</p>
                    <ComplianceCell passed={p.bg_check_passed} expires={p.bg_check_expires} label="Passed" />
                  </div>
                  <div className="bg-surface rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">NAYS</p>
                    <ComplianceCell passed={p.nays_completed} expires={p.nays_expires} label="Completed" />
                  </div>
                </div>
                <ReminderBadge lastReminderSent={p.last_reminder_sent} />
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <CoachProfileModal
          profile={editingProfile}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["coach-profiles"] });
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}