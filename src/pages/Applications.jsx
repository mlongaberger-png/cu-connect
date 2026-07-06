import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, ArrowRightLeft, Loader2, ClipboardList } from "lucide-react";
import TransferModal from "@/components/applications/TransferModal";

const STATUS_CONFIG = {
  pending:     { label: "Pending",     className: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400" },
  approved:    { label: "Approved",    className: "bg-green-500/20 border-green-500/50 text-green-400" },
  waitlisted:  { label: "Waitlisted",  className: "bg-orange-500/20 border-orange-500/50 text-orange-400" },
  archived:    { label: "Archived",    className: "bg-muted text-muted-foreground border-border" },
};

const STATUS_FILTERS = ["pending", "waitlisted", "approved", "archived"];

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

export default function Applications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [transferApp, setTransferApp] = useState(null);

  const isAdmin = user?.role === "admin" || user?.role === "athletic_director" || user?.role === "ad";

  // Fetch coach profiles for current user (to know which teams they own)
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

  // Filter: admins see all; coaches see only their teams
  const applications = useMemo(() => {
    let list = allApplications;
    if (!isAdmin && myTeamIds.length > 0) {
      list = list.filter(a => myTeamIds.includes(a.target_team_id));
    } else if (!isAdmin) {
      list = [];
    }
    return statusFilter === "all"
      ? list
      : list.filter(a => a.status === statusFilter);
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

  const isApproved = (app) => app.status === "approved";

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          Applications
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin ? "Review and manage all athlete applications across all teams." : "Review and manage athlete applications for your teams."}
        </p>
      </div>

      {/* Status filter pills */}
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

      {/* Table */}
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
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {app.athlete_dob ? formatDate(app.athlete_dob) : "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {app.target_team_name || "—"}
                        {app.sport_name && <span className="block text-xs text-muted-foreground">{app.sport_name}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{app.parent_email}</td>
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
    </div>
  );
}