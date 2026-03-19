import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle2, Clock, Download, Calendar } from "lucide-react";
import { format, isBefore, parseISO } from "date-fns";

// Build an ICS file string for one or more volunteer assignments
function buildVolunteerICS(entries) {
  const pad = (n) => String(n).padStart(2, "0");
  const toICSDate = (dateStr, timeStr) => {
    const d = new Date(dateStr);
    if (timeStr) {
      const [h, m] = timeStr.split(":").map(Number);
      d.setHours(h, m, 0, 0);
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    }
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  };

  const events = entries.map(({ assignment, opp }) => {
    const uid = `volunteer-${assignment.id}@cornerstone`;
    const title = `Volunteer – ${opp?.role_name || "Shift"} (${opp?.team_name || ""})`;
    const dtstart = opp?.date ? toICSDate(opp.date, opp.start_time) : null;
    const dtend = opp?.date ? toICSDate(opp.date, opp.end_time || opp.start_time) : null;
    if (!dtstart) return "";
    const desc = [
      `Role: ${opp?.role_name || ""}`,
      opp?.event_name ? `Event: ${opp.event_name}` : "",
      opp?.notes ? `Notes: ${opp.notes}` : "",
    ].filter(Boolean).join("\\n");

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${toICSDate(new Date().toISOString().split("T")[0])}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${title}`,
      desc ? `DESCRIPTION:${desc}` : "",
      opp?.location ? `LOCATION:${opp.location}` : "",
      "END:VEVENT",
    ].filter(Boolean).join("\r\n");
  }).filter(Boolean);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cornerstone//Volunteer Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(content, filename) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ParentVolunteerView({ myKids, userEmail, userName }) {
  const queryClient = useQueryClient();

  const myTeamIds = [...new Set(myKids.map(k => k.team_id))];

  const { data: opportunities = [] } = useQuery({
    queryKey: ["volunteer-opportunities-parent"],
    queryFn: () => base44.entities.VolunteerOpportunity.list("-date"),
    enabled: myTeamIds.length > 0,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["volunteer-assignments-parent", userEmail],
    queryFn: () => base44.entities.VolunteerAssignment.list(),
    enabled: !!userEmail,
  });

  const signupMutation = useMutation({
    mutationFn: (data) => base44.entities.VolunteerAssignment.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["volunteer-assignments-parent", userEmail] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => base44.entities.VolunteerAssignment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["volunteer-assignments-parent", userEmail] }),
  });

  const myAssignments = assignments.filter(a => a.volunteer_email === userEmail);
  const myAssignmentOppIds = new Set(myAssignments.map(a => a.opportunity_id));

  // Opportunities for my teams
  const myOpps = opportunities.filter(o =>
    myTeamIds.includes(o.team_id) &&
    !o.is_locked &&
    new Date(o.date) >= new Date()
  );

  const getFilledCount = (oppId) =>
    assignments.filter(a => a.opportunity_id === oppId && a.status !== "no_show").length;

  const canCancel = (opp) => {
    if (!opp.signup_deadline) return true;
    return !isBefore(parseISO(opp.signup_deadline), new Date());
  };

  const handleSignup = (opp) => {
    // Find a kid on this team
    const kid = myKids.find(k => k.team_id === opp.team_id);
    if (!kid) return;
    signupMutation.mutate({
      opportunity_id: opp.id,
      player_id: kid.id,
      player_name: `${kid.first_name} ${kid.last_name}`,
      team_id: opp.team_id,
      volunteer_name: userName || userEmail,
      volunteer_email: userEmail,
      status: "signed_up",
    });
  };

  const handleCancel = (opp) => {
    const assignment = myAssignments.find(a => a.opportunity_id === opp.id);
    if (assignment) cancelMutation.mutate(assignment.id);
  };

  const handleExportAll = () => {
    const entries = myAssignments.map(a => ({
      assignment: a,
      opp: opportunities.find(o => o.id === a.opportunity_id),
    })).filter(e => e.opp?.date);
    if (!entries.length) return;
    downloadICS(buildVolunteerICS(entries), "my-volunteer-shifts.ics");
  };

  const handleExportOne = (assignment) => {
    const opp = opportunities.find(o => o.id === assignment.opportunity_id);
    if (!opp?.date) return;
    downloadICS(buildVolunteerICS([{ assignment, opp }]), `volunteer-${opp.role_name || "shift"}.ics`);
  };

  return (
    <div className="space-y-6">
      {/* My commitments */}
      {myAssignments.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" /> My Volunteer Commitments
            </h3>
            <button
              onClick={handleExportAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary border border-border rounded-lg px-3 py-1.5 transition-colors bg-surface"
            >
              <Download className="w-3.5 h-3.5" /> Export All to Calendar
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Your volunteer shifts are private — they appear only on your personal calendar and are not visible to coaches, other parents, or shared team calendars.
          </p>
          <div className="space-y-2">
            {myAssignments.map(a => {
              const opp = opportunities.find(o => o.id === a.opportunity_id);
              return (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{opp?.role_name || "Role"}</p>
                    <p className="text-xs text-muted-foreground">
                      {opp?.date ? format(new Date(opp.date), "MMM d, yyyy") : ""}{opp?.start_time ? ` at ${opp.start_time}` : ""}
                      {opp?.team_name ? ` · ${opp.team_name}` : ""}
                    </p>
                  </div>
                  <StatusChip status={a.status} />
                  {opp?.date && (
                    <button
                      onClick={() => handleExportOne(a)}
                      title="Add to my calendar"
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {a.status === "signed_up" && opp && canCancel(opp) && (
                    <button
                      onClick={() => handleCancel(opp)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      disabled={cancelMutation.isPending}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Open opportunities */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Available Opportunities
        </h3>

        {myOpps.length === 0 ? (
          <div className="text-center py-10 bg-card border border-border rounded-2xl">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No open volunteer opportunities right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myOpps.map(opp => {
              const filled = getFilledCount(opp.id);
              const total = opp.required_count || 1;
              const isFull = filled >= total;
              const isSignedUp = myAssignmentOppIds.has(opp.id);

              return (
                <div key={opp.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{opp.role_name}</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{opp.team_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <Clock className="w-3 h-3" />
                      {opp.date ? format(new Date(opp.date), "EEEE, MMM d") : ""}
                      {opp.start_time && ` · ${opp.start_time}${opp.end_time ? ` – ${opp.end_time}` : ""}`}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isFull ? "bg-green-500" : "bg-primary"}`}
                          style={{ width: `${Math.min(100, (filled / total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{filled}/{total} filled</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isSignedUp ? (
                      <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg font-medium">Signed Up ✓</span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isFull || signupMutation.isPending}
                        onClick={() => handleSignup(opp)}
                        className="text-xs h-8"
                      >
                        {isFull ? "Full" : "Sign Up"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    signed_up: { cls: "bg-blue-500/20 text-blue-400", label: "Signed Up" },
    completed: { cls: "bg-green-500/20 text-green-400", label: "Completed" },
    no_show: { cls: "bg-red-500/20 text-red-400", label: "No Show" },
    excused: { cls: "bg-yellow-500/20 text-yellow-400", label: "Excused" },
  };
  const { cls, label } = map[status] || { cls: "", label: status };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}