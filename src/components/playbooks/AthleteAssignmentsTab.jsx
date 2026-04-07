import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clock, CheckCircle2, RotateCcw, BookOpen, ChevronRight, Calendar } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

const STATUS_CONFIG = {
  assigned:    { label: "Assigned",    icon: ClipboardList, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  in_progress: { label: "In Progress", icon: Clock,         color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  submitted:   { label: "Submitted",   icon: CheckCircle2,  color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  approved:    { label: "Approved ✓",  icon: CheckCircle2,  color: "bg-green-500/20 text-green-400 border-green-500/30" },
  returned:    { label: "Returned",    icon: RotateCcw,     color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

function fmtTime(secs) {
  if (!secs || secs < 60) return `${secs || 0}s viewed`;
  const m = Math.floor(secs / 60);
  return `${m}m viewed`;
}

export default function AthleteAssignmentsTab({ player, userEmail, onOpenAssignment }) {
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["my-submissions", player?.id],
    queryFn: () => base44.entities.PlaybookSubmission.filter({ player_id: player?.id }, "-created_date"),
    enabled: !!player?.id,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["playbook-assignments"],
    queryFn: () => base44.entities.PlaybookAssignment.filter({ status: "active" }),
    enabled: submissions.length > 0,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (submissions.length === 0) return (
    <div className="text-center py-12 bg-card rounded-2xl border border-border">
      <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">No assignments yet. Check back after your coach assigns playbooks.</p>
    </div>
  );

  const active = submissions.filter(s => !["approved"].includes(s.status));
  const completed = submissions.filter(s => s.status === "approved");

  const renderSub = (sub) => {
    const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.assigned;
    const Icon = cfg.icon;
    const assignment = assignments.find(a => a.id === sub.assignment_id);
    const isOverdue = sub.due_date && isPast(parseISO(sub.due_date)) && !["submitted", "approved"].includes(sub.status);
    const canOpen = !["approved"].includes(sub.status);

    return (
      <button
        key={sub.id}
        onClick={() => canOpen && onOpenAssignment?.(sub, assignment)}
        className={`w-full flex items-center gap-3 p-4 bg-card border rounded-2xl text-left transition-colors ${canOpen ? "hover:border-primary/30 cursor-pointer" : "cursor-default"} ${sub.status === "returned" ? "border-red-500/30" : "border-border"}`}
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{sub.playbook_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
              <Icon className="w-2.5 h-2.5 inline mr-0.5" />{cfg.label}
            </span>
            {sub.time_viewed_seconds > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" /> {fmtTime(sub.time_viewed_seconds)}
              </span>
            )}
            {sub.due_date && (
              <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                <Calendar className="w-2.5 h-2.5" />
                {isOverdue ? "Overdue · " : "Due "}
                {format(parseISO(sub.due_date), "MMM d")}
              </span>
            )}
          </div>
          {sub.status === "returned" && sub.coach_feedback && (
            <p className="text-xs text-red-400 mt-1 truncate">Coach: {sub.coach_feedback}</p>
          )}
        </div>
        {canOpen && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {active.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active</h3>
          {active.map(renderSub)}
        </div>
      )}
      {completed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed</h3>
          {completed.map(renderSub)}
        </div>
      )}
    </div>
  );
}