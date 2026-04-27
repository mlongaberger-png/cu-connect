import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, User, Phone, Mail, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import RegistrationTypesPanel from "./RegistrationTypesPanel";

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
};

function SubmissionRow({ sub, teams, onApprove, onReject, onReassign }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[sub.status] || statusConfig.pending;
  const Icon = cfg.icon;

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-sm">{sub.player_first_name} {sub.player_last_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
              <Icon className="w-3 h-3" /> {cfg.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sub.sport_name} · {sub.team_name || "No team assigned"} · Parent: {sub.parent_name}
          </p>
        </div>
        <div className="text-xs text-muted-foreground shrink-0 hidden sm:block">
          {sub.created_date ? new Date(sub.created_date).toLocaleDateString() : ""}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Athlete</p>
              <p className="text-sm text-foreground">{sub.player_first_name} {sub.player_last_name}</p>
              {sub.player_dob && <p className="text-xs text-muted-foreground">DOB: {sub.player_dob}</p>}
              {sub.jersey_number && <p className="text-xs text-muted-foreground">Jersey #: {sub.jersey_number}</p>}
              {sub.medical_notes && <p className="text-xs text-muted-foreground">Medical: {sub.medical_notes}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Parent / Guardian</p>
              <p className="text-sm text-foreground">{sub.parent_name}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{sub.parent_email}</div>
              {sub.parent_phone && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{sub.parent_phone}</div>}
            </div>
            {(sub.emergency_contact || sub.emergency_phone) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Emergency Contact</p>
                <p className="text-sm text-foreground">{sub.emergency_contact}</p>
                {sub.emergency_phone && <p className="text-xs text-muted-foreground">{sub.emergency_phone}</p>}
              </div>
            )}
          </div>

          {/* Reassign team */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Team:</span>
              <Select value={sub.team_id || ""} onValueChange={v => onReassign(sub, v, teams.find(t => t.id === v)?.name || "")}>
                <SelectTrigger className="h-7 text-xs bg-surface border-border w-40">
                  <SelectValue placeholder="Assign team…" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {teams.filter(t => !sub.sport_id || t.sport_id === sub.sport_id).map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sub.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onApprove(sub)} className="bg-green-600 hover:bg-green-700 text-white text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReject(sub)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs">
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegistrationsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("pending");

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["reg-submissions-all"],
    queryFn: () => base44.entities.RegistrationSubmission.list("-created_date"),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RegistrationSubmission.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reg-submissions-all"] }),
  });

  const filtered = filterStatus === "all" ? submissions : submissions.filter(s => s.status === filterStatus);

  const handleApprove = (sub) => updateMutation.mutate({ id: sub.id, data: { status: "approved", reviewed_by: user?.email, reviewed_at: new Date().toISOString() } });
  const handleReject = (sub) => updateMutation.mutate({ id: sub.id, data: { status: "rejected", reviewed_by: user?.email, reviewed_at: new Date().toISOString() } });
  const handleReassign = (sub, teamId, teamName) => updateMutation.mutate({ id: sub.id, data: { team_id: teamId, team_name: teamName } });

  const counts = {
    pending: submissions.filter(s => s.status === "pending").length,
    approved: submissions.filter(s => s.status === "approved").length,
    rejected: submissions.filter(s => s.status === "rejected").length,
  };

  return (
    <div className="space-y-8">
      {/* Sport Registration Types */}
      <RegistrationTypesPanel />

      {/* Divider */}
      <div className="border-t border-border pt-4">
        <h3 className="font-semibold text-foreground mb-4">Submitted Applications</h3>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "pending", label: `Pending (${counts.pending})` },
          { key: "approved", label: `Approved (${counts.approved})` },
          { key: "rejected", label: `Rejected (${counts.rejected})` },
          { key: "all", label: "All" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === f.key ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-surface rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No {filterStatus === "all" ? "" : filterStatus} registrations.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sub => (
            <SubmissionRow key={sub.id} sub={sub} teams={teams} onApprove={handleApprove} onReject={handleReject} onReassign={handleReassign} />
          ))}
        </div>
      )}
    </div>
  );
}