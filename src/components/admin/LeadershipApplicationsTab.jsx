import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Clock, Calendar, ChevronDown, ChevronRight, Mail, Phone } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  interview_scheduled: { label: "Interview", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Calendar },
};

const ROLE_LABELS = {
  coach: "Head Coach", assistant_coach: "Assistant Coach", athletic_director: "Athletic Director",
  team_manager: "Team Manager", volunteer_coordinator: "Volunteer Coordinator", other: "Other"
};

function ApplicationRow({ app, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [adminNotes, setAdminNotes] = useState(app.admin_notes || "");
  const cfg = statusConfig[app.status] || statusConfig.pending;
  const Icon = cfg.icon;

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-sm">{app.applicant_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
              <Icon className="w-3 h-3" /> {cfg.label}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {ROLE_LABELS[app.role_applying_for] || app.role_applying_for}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {app.sport_interest && `${app.sport_interest} · `}{app.applicant_email}
          </p>
        </div>
        <div className="text-xs text-muted-foreground shrink-0 hidden sm:block">
          {app.created_date ? new Date(app.created_date).toLocaleDateString() : ""}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border space-y-4 mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Contact</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{app.applicant_email}</div>
              {app.applicant_phone && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{app.applicant_phone}</div>}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Availability</p>
              <p className="text-xs text-muted-foreground">{app.availability || "Not specified"}</p>
            </div>
            {app.experience && (
              <div className="space-y-1 col-span-full">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Experience</p>
                <p className="text-sm text-muted-foreground">{app.experience}</p>
              </div>
            )}
            {app.certifications && (
              <div className="space-y-1 col-span-full">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Certifications</p>
                <p className="text-sm text-muted-foreground">{app.certifications}</p>
              </div>
            )}
            {app.notes && (
              <div className="space-y-1 col-span-full">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Additional Notes</p>
                <p className="text-sm text-muted-foreground">{app.notes}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Admin Notes</p>
            <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} placeholder="Internal notes…" className="bg-card border-border text-sm" />
          </div>

          <div className="flex gap-2 flex-wrap">
            {app.status === "pending" && (
              <>
                <Button size="sm" onClick={() => onUpdate(app, "interview_scheduled", adminNotes)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  <Calendar className="w-3.5 h-3.5 mr-1" /> Schedule Interview
                </Button>
                <Button size="sm" onClick={() => onUpdate(app, "approved", adminNotes)} className="bg-green-600 hover:bg-green-700 text-white text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => onUpdate(app, "rejected", adminNotes)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs">
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </>
            )}
            {app.status === "interview_scheduled" && (
              <>
                <Button size="sm" onClick={() => onUpdate(app, "approved", adminNotes)} className="bg-green-600 hover:bg-green-700 text-white text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => onUpdate(app, "rejected", adminNotes)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs">
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => onUpdate(app, app.status, adminNotes)} className="border-border text-xs">
              Save Notes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeadershipApplicationsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("pending");

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["leadership-applications"],
    queryFn: () => base44.entities.LeadershipApplication.list("-created_date"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LeadershipApplication.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leadership-applications"] }),
  });

  const handleUpdate = (app, newStatus, adminNotes) => {
    updateMutation.mutate({
      id: app.id,
      data: { status: newStatus, admin_notes: adminNotes, reviewed_by: user?.email, reviewed_at: new Date().toISOString() }
    });
  };

  const counts = {
    pending: apps.filter(a => a.status === "pending").length,
    interview_scheduled: apps.filter(a => a.status === "interview_scheduled").length,
    approved: apps.filter(a => a.status === "approved").length,
  };

  const filtered = filterStatus === "all" ? apps : apps.filter(a => a.status === filterStatus);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "pending", label: `Pending (${counts.pending})` },
          { key: "interview_scheduled", label: `Interview (${counts.interview_scheduled})` },
          { key: "approved", label: `Approved (${counts.approved})` },
          { key: "all", label: "All" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === f.key ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No {filterStatus === "all" ? "" : filterStatus} applications.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(app => <ApplicationRow key={app.id} app={app} onUpdate={handleUpdate} />)}
        </div>
      )}
    </div>
  );
}