import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, Clock, ArrowRightLeft, Loader2, ClipboardList, UserPlus, Archive, XCircle } from "lucide-react";
import TransferModal from "@/components/applications/TransferModal";
import AccessRequestsPanel from "@/components/admin/AccessRequestsPanel";
import PendingChildrenPanel from "@/components/admin/PendingChildrenPanel";

const STATUS_CONFIG = {
  pending:     { label: "Pending",     className: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400" },
  approved:    { label: "Approved",    className: "bg-green-500/20 border-green-500/50 text-green-400" },
  waitlisted:  { label: "Waitlisted",  className: "bg-orange-500/20 border-orange-500/50 text-orange-400" },
  rejected:    { label: "Rejected",    className: "bg-red-500/20 border-red-500/50 text-red-400" },
  archived:    { label: "Archived",    className: "bg-muted text-muted-foreground border-border" },
};

const STATUS_FILTERS = ["pending", "waitlisted", "approved", "rejected"];

const REFERRAL_LABELS = {
  coach_or_staff_invite: "Coach/staff invite",
  returning_family: "Returning family",
  word_of_mouth: "Word of mouth",
  school_or_flyer: "School/flyer",
  social_media: "Social media",
  other: "Other",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso.endsWith("Z") ? iso : iso + "Z").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function TeamApplicationsTab({ user, isAdmin }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [transferApp, setTransferApp] = useState(null);
  const [rejectApp, setRejectApp] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: coachProfiles = [] } = useQuery({
    queryKey: ["my-coach-profiles", user?.email],
    queryFn: () => base44.entities.CoachProfile.filter({ user_email: user.email }),
    enabled: !!user?.email && !isAdmin,
  });

  const myTeamIds = useMemo(() => coachProfiles.map(p => p.team_id), [coachProfiles]);

  const { data: allApplications = [], isLoading } = useQuery({
    queryKey: ["registration-applications"],
    queryFn: () => base44.entities.RegistrationApplication.list("-applied_at", 200),
  });

  const siblingCounts = useMemo(() => {
    const counts = {};
    allApplications.forEach(a => {
      if (!a.sibling_group_id) return;
      counts[a.sibling_group_id] = (counts[a.sibling_group_id] || 0) + 1;
    });
    return counts;
  }, [allApplications]);

  const applications = useMemo(() => {
    let list = allApplications;
    if (!isAdmin && myTeamIds.length > 0) {
      list = list.filter(a => myTeamIds.includes(a.target_team_id));
    } else if (!isAdmin) {
      list = [];
    }
    return statusFilter === "all" ? list : list.filter(a => a.status === statusFilter);
  }, [allApplications, isAdmin, myTeamIds, statusFilter]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["registration-applications"] });

  const approveMutation = useMutation({
    mutationFn: (application_id) => base44.functions.invoke("handleApproval", { application_id }),
    onSuccess: () => invalidate(),
  });

  const waitlistMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.RegistrationApplication.update(id, {
      status: "waitlisted",
      waitlisted_at: new Date().toISOString(),
    }),
    onSuccess: () => invalidate(),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => base44.entities.RegistrationApplication.update(id, {
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || undefined,
    }),
    onSuccess: () => { invalidate(); setRejectApp(null); setRejectReason(""); },
  });

  const isApproved = (app) => app.status === "approved";

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(status => {
          const count = isAdmin
            ? allApplications.filter(a => a.status === status).length
            : allApplications.filter(a => a.status === status && myTeamIds.includes(a.target_team_id)).length;
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
              }`}
            >
              {STATUS_CONFIG[status].label} {count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <ClipboardList className="w-10 h-10 opacity-30" />
            <p className="text-sm">No {statusFilter !== "all" ? STATUS_CONFIG[statusFilter].label.toLowerCase() : ""} applications.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-semibold px-4 py-3">Athlete</th>
                  <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">DOB</th>
                  <th className="text-left font-semibold px-4 py-3">Target Team</th>
                  <th className="text-left font-semibold px-4 py-3 hidden lg:table-cell">Parent Email</th>
                  <th className="text-left font-semibold px-4 py-3 hidden xl:table-cell">Context</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3 hidden sm:table-cell">Applied</th>
                  <th className="text-right font-semibold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => {
                  const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
                  const disabled = isApproved(app);
                  return (
                    <tr key={app.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                        {app.athlete_first_name} {app.athlete_last_name}
                        {app.sibling_group_id && siblingCounts[app.sibling_group_id] > 1 && (
                          <span className="block text-[11px] font-normal text-blue-400">
                            Family of {siblingCounts[app.sibling_group_id]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {app.athlete_dob ? formatDate(app.athlete_dob) : "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {app.target_team_name || "—"}
                        {app.sport_name && <span className="block text-xs text-muted-foreground">{app.sport_name}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{app.parent_email}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell max-w-[220px]">
                        {app.referral_source && (
                          <span className="block text-xs text-foreground">{REFERRAL_LABELS[app.referral_source] || app.referral_source}</span>
                        )}
                        {app.referral_note && (
                          <span className="block text-xs text-muted-foreground truncate" title={app.referral_note}>{app.referral_note}</span>
                        )}
                        {!app.referral_source && !app.referral_note && "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${sc.className}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                        {formatDate(app.applied_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled || approveMutation.isPending}
                            onClick={() => approveMutation.mutate(app.id)}
                            className="border-green-500/40 text-green-400 hover:bg-green-500/10 hover:text-green-400 h-8 px-3"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled || waitlistMutation.isPending}
                            onClick={() => waitlistMutation.mutate({ id: app.id })}
                            className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-400 h-8 px-3"
                          >
                            <Clock className="w-3.5 h-3.5 mr-1" /> Waitlist
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled || rejectMutation.isPending}
                            onClick={() => setRejectApp(app)}
                            className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-400 h-8 px-3"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setTransferApp(app)}
                            className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:text-blue-400 h-8 px-3"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Transfer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {transferApp && (
        <TransferModal
          open={!!transferApp}
          onOpenChange={(v) => !v && setTransferApp(null)}
          application={transferApp}
          onTransferred={invalidate}
        />
      )}

      <Dialog open={!!rejectApp} onOpenChange={(v) => { if (!v) { setRejectApp(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Application?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {rejectApp && `${rejectApp.athlete_first_name} ${rejectApp.athlete_last_name}`}'s application for {rejectApp?.target_team_name} will be marked rejected. The parent won't be automatically notified of the reason — this note is for other reviewers only.
          </p>
          <div className="space-y-1.5">
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Optional: reason for rejecting (visible to other reviewers only)"
              className="bg-surface border-border resize-none"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setRejectApp(null); setRejectReason(""); }}>Cancel</Button>
            <Button
              type="button"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({ id: rejectApp.id, reason: rejectReason.trim() })}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {rejectMutation.isPending ? "Rejecting…" : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Applications() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "athletic_director" || user?.role === "ad";
  const isFullAdminOrAD = user?.role === "admin" || user?.role === "athletic_director";
  const [tab, setTab] = useState("applications");

  const { data: pendingApps = [] } = useQuery({
    queryKey: ["registration-applications", "pending-count"],
    queryFn: () => base44.entities.RegistrationApplication.filter({ status: "pending" }),
    staleTime: 30_000,
  });
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["access-requests", "pending-count"],
    queryFn: () => base44.entities.AccessRequest.filter({ status: "pending" }),
    enabled: isFullAdminOrAD,
    staleTime: 30_000,
  });
  const { data: pendingLegacyChildren = [] } = useQuery({
    queryKey: ["pending-children", "pending-count"],
    queryFn: () => base44.entities.PendingChild.filter({ status: "pending" }),
    enabled: isFullAdminOrAD,
    staleTime: 30_000,
  });

  const TABS = [
    { id: "applications", label: "Team Applications", icon: ClipboardList, count: pendingApps.length, show: true },
    { id: "requests", label: "Access Requests", icon: UserPlus, count: pendingRequests.length, show: isFullAdminOrAD },
    { id: "legacy", label: "Legacy Child Submissions", icon: Archive, count: pendingLegacyChildren.length, show: isFullAdminOrAD },
  ].filter(t => t.show);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          Applications & Requests
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isFullAdminOrAD ? "Review athlete applications, access requests, and legacy submissions in one place." : "Review and manage athlete applications for your teams."}
        </p>
      </div>

      {TABS.length > 1 && (
        <div className="flex flex-wrap gap-1 bg-surface rounded-xl p-1 w-fit">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.count > 0 && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-primary text-primary-foreground" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {tab === "applications" && <TeamApplicationsTab user={user} isAdmin={isAdmin} />}
      {tab === "requests" && isFullAdminOrAD && <AccessRequestsPanel />}
      {tab === "legacy" && isFullAdminOrAD && <PendingChildrenPanel />}
    </div>
  );
}
