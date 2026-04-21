import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Flag, UserX, Check, X, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const STATUS_COLORS = {
  pending:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  reviewed:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  actioned:  "bg-green-500/20 text-green-400 border-green-500/30",
  dismissed: "bg-surface text-muted-foreground border-border",
};

export default function MessageModerationPanel() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("pending");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["message-reports", filterStatus],
    queryFn: () => filterStatus === "all"
      ? base44.entities.MessageReport.list("-created_date", 50)
      : base44.entities.MessageReport.filter({ status: filterStatus }, "-created_date", 50),
    refetchInterval: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MessageReport.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["message-reports"] }),
  });

  const { data: blockedUsers = [] } = useQuery({
    queryKey: ["all-blocked-users-admin"],
    queryFn: () => base44.entities.BlockedUser.list("-created_date", 100),
  });

  const pendingCount = reports.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-orange-400" />
          <h3 className="font-semibold text-foreground">Message Reports</h3>
          {pendingCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold">
              {pendingCount} pending
            </span>
          )}
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-surface border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="actioned">Actioned</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="all">All Reports</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse border border-border" />)}
        </div>
      )}

      {!isLoading && reports.length === 0 && (
        <div className="text-center py-10 bg-card rounded-xl border border-border">
          <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No {filterStatus !== "all" ? filterStatus : ""} reports</p>
        </div>
      )}

      <div className="space-y-3">
        {reports.map(report => (
          <div key={report.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[report.status]}`}>
                    {report.status}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{report.reason?.replace("_", " ")}</span>
                  {report.created_date && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(report.created_date), "MMM d, h:mm a")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Reported by <span className="text-foreground font-medium">{report.reporter_name || report.reporter_email}</span>
                  {" · "}in <span className="text-foreground font-medium">#{report.channel_name || report.channel_id}</span>
                </p>
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Message from <span className="text-orange-400 font-medium">{report.reported_sender_name || report.reported_sender_email}</span></p>
              <p className="text-sm text-foreground italic">"{report.message_content}"</p>
            </div>

            {report.status === "pending" && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10 gap-1"
                  onClick={() => updateMutation.mutate({ id: report.id, data: { status: "actioned" } })}
                >
                  <Check className="w-3 h-3" /> Mark Actioned
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 gap-1"
                  onClick={() => updateMutation.mutate({ id: report.id, data: { status: "reviewed" } })}
                >
                  <Flag className="w-3 h-3" /> Mark Reviewed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => updateMutation.mutate({ id: report.id, data: { status: "dismissed" } })}
                >
                  <X className="w-3 h-3" /> Dismiss
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Blocked Users Summary */}
      {blockedUsers.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold text-foreground">Blocked Users</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">{blockedUsers.length}</span>
          </div>
          <div className="space-y-2">
            {blockedUsers.map(b => (
              <div key={b.id} className="flex items-center gap-3 bg-card rounded-xl border border-border px-4 py-2.5 text-sm">
                <UserX className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-muted-foreground flex-1">
                  <span className="text-foreground font-medium">{b.blocker_email}</span>
                  {" blocked "}
                  <span className="text-red-400 font-medium">{b.blocked_name || b.blocked_email}</span>
                </span>
                {b.created_date && (
                  <span className="text-xs text-muted-foreground">{format(new Date(b.created_date), "MMM d")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}