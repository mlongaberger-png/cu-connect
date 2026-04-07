import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, ChevronRight, Check, RotateCcw, Clock, BookOpen, ChevronDown, ChevronUp, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const STATUS_CONFIG = {
  assigned:    { label: "Assigned",    color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  in_progress: { label: "In Progress", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  submitted:   { label: "Submitted",   color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  approved:    { label: "Approved",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
  returned:    { label: "Returned",    color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

function fmtTime(secs) {
  if (!secs || secs < 60) return `${secs || 0}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function SubmissionRow({ sub, onApprove, onReturn }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(null);
  const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.assigned;

  const sections = (() => { try { return JSON.parse(sub.sections_accessed || "[]"); } catch { return []; } })();

  const handleApprove = async () => {
    setLoading("approve");
    await onApprove(sub.id);
    setLoading(null);
  };

  const handleReturn = async () => {
    setLoading("return");
    await onReturn(sub.id, feedback);
    setLoading(null);
    setOpen(false);
  };

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-primary">{sub.player_name?.[0] || "?"}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{sub.player_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{fmtTime(sub.time_viewed_seconds)}</span>
            {sections.length > 0 && <span className="text-xs text-muted-foreground">· {sections.join(", ")}</span>}
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${cfg.color}`}>{cfg.label}</span>
        {(sub.status === "submitted" || sub.status === "approved" || sub.status === "returned") && (
          <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground transition-colors">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {open && sub.status === "submitted" && (
        <div className="px-3 pb-3 border-t border-border pt-3 space-y-2">
          {sub.athlete_notes && (
            <div className="bg-card rounded-lg p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Athlete note: </span>{sub.athlete_notes}
            </div>
          )}
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Feedback for athlete (required to return)…"
            rows={2}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleApprove} disabled={loading === "approve"} className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
              <Check className="w-3.5 h-3.5" /> {loading === "approve" ? "Approving…" : "Approve"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleReturn} disabled={loading === "return" || !feedback.trim()} className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> {loading === "return" ? "Returning…" : "Return"}
            </Button>
          </div>
        </div>
      )}

      {open && (sub.status === "approved" || sub.status === "returned") && (
        <div className="px-3 pb-3 border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
          {sub.coach_feedback && <p><span className="font-semibold text-foreground">Feedback: </span>{sub.coach_feedback}</p>}
          {sub.approved_at && <p>Approved {format(new Date(sub.approved_at), "MMM d, yyyy")}</p>}
          {sub.returned_at && <p>Returned {format(new Date(sub.returned_at), "MMM d, yyyy")}</p>}
        </div>
      )}
    </div>
  );
}

export default function CoachAssignmentDashboard({ user }) {
  const queryClient = useQueryClient();
  const [expandedAssignment, setExpandedAssignment] = useState(null);

  const { data: assignments = [] } = useQuery({
    queryKey: ["playbook-assignments"],
    queryFn: () => base44.entities.PlaybookAssignment.filter({ status: "active" }, "-created_date"),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["playbook-submissions-all"],
    queryFn: () => base44.entities.PlaybookSubmission.list("-created_date", 200),
  });

  const handleApprove = async (subId) => {
    await base44.entities.PlaybookSubmission.update(subId, {
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: user?.email,
    });
    queryClient.invalidateQueries({ queryKey: ["playbook-submissions-all"] });
  };

  const handleReturn = async (subId, feedback) => {
    await base44.entities.PlaybookSubmission.update(subId, {
      status: "returned",
      coach_feedback: feedback,
      returned_at: new Date().toISOString(),
      returned_by: user?.email,
    });
    queryClient.invalidateQueries({ queryKey: ["playbook-submissions-all"] });
  };

  const handleArchive = async (id) => {
    if (!confirm("Archive this assignment?")) return;
    await base44.entities.PlaybookAssignment.update(id, { status: "archived" });
    queryClient.invalidateQueries({ queryKey: ["playbook-assignments"] });
  };

  if (assignments.length === 0) return (
    <div className="text-center py-12 bg-card rounded-2xl border border-border">
      <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground text-sm">No active assignments. Open a playbook and click "Assign" to get started.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {assignments.map(a => {
        const subs = submissions.filter(s => s.assignment_id === a.id);
        const submittedCount = subs.filter(s => ["submitted", "approved"].includes(s.status)).length;
        const approvedCount = subs.filter(s => s.status === "approved").length;
        const isExpanded = expandedAssignment === a.id;

        return (
          <div key={a.id} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                    <h3 className="font-semibold text-foreground text-sm">{a.playbook_name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.assigned_to_label || a.assigned_to} · {a.team_name}
                    {a.due_date && ` · Due ${format(new Date(a.due_date + "T00:00"), "MMM d")}`}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{submittedCount}/{subs.length} submitted</span>
                    <span className="text-green-400">{approvedCount} approved</span>
                    {subs.filter(s => s.status === "submitted").length > 0 && (
                      <span className="text-purple-400">{subs.filter(s => s.status === "submitted").length} pending review</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleArchive(a.id)} className="p-1.5 rounded hover:bg-surface text-muted-foreground hover:text-foreground transition-colors" title="Archive">
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setExpandedAssignment(isExpanded ? null : a.id)} className="p-1.5 rounded hover:bg-surface text-muted-foreground hover:text-foreground transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border p-4 space-y-2">
                {a.instructions && (
                  <div className="bg-surface rounded-lg px-3 py-2 text-xs text-muted-foreground mb-3">
                    <span className="font-semibold text-foreground">Instructions: </span>{a.instructions}
                  </div>
                )}
                {subs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No submissions yet</p>}
                {subs.map(sub => (
                  <SubmissionRow key={sub.id} sub={sub} onApprove={handleApprove} onReturn={handleReturn} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}