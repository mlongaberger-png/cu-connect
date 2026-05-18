import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import AttendanceCard from "@/components/attendance/AttendanceCard";
import { addDays, parseISO, isWithinInterval, startOfDay } from "date-fns";

/**
 * Smart RSVP panel for the parent dashboard overview.
 * - Scans attendance requests for events in the next 7 days.
 * - Shows full interactive cards for any event needing action (no response or "maybe").
 * - Collapses to a single ✅ banner when all 7-day events have definitive answers.
 * - If no requests exist in the 7-day window, renders nothing.
 */
export default function SmartRsvpPanel({ myAttendanceRequests, myUpcomingEvents, user, myKids, userEmail }) {
  const today = startOfDay(new Date());
  const in7Days = addDays(today, 7);

  // Only look at open (unlocked) requests whose event falls within the next 7 days
  const window7 = myAttendanceRequests.filter(r => {
    if (r.is_locked) return false;
    if (!r.event_date) return false;
    const d = parseISO(r.event_date);
    return isWithinInterval(d, { start: today, end: in7Days });
  });

  // Fetch all RSVP responses the current user has submitted
  const { data: myResponses = [] } = useQuery({
    queryKey: ["my-rsvp-responses-panel", userEmail],
    queryFn: () => base44.entities.AttendanceResponse.filter({ responder_email: userEmail }),
    enabled: !!userEmail,
    staleTime: 20000,
  });

  // Nothing to show if no requests in window
  if (window7.length === 0) return null;

  // For each request, determine if this family still needs to act.
  // "Needs action" = at least one linked player has no response OR has "maybe".
  const needsAction = (req) => {
    const eligiblePlayers = myKids.filter(p => p.team_id === req.team_id);
    if (eligiblePlayers.length === 0) return false;
    return eligiblePlayers.some(player => {
      const resp = myResponses.find(r => r.attendance_request_id === req.id && r.player_id === player.id)
        // AttendanceCard also uses player_id on response — check both field names for compatibility
        || myResponses.find(r => r.request_id === req.id && r.player_id === player.id);
      if (!resp) return true; // no response yet
      if (resp.status === "maybe") return true; // indeterminate
      return false;
    });
  };

  const actionNeeded = window7.filter(needsAction);
  const allDefinitive = actionNeeded.length === 0;

  // Calculate going % for the collapsed banner
  const goingCount = window7.reduce((sum, req) => {
    const eligible = myKids.filter(p => p.team_id === req.team_id);
    return sum + eligible.filter(player => {
      const resp = myResponses.find(r =>
        (r.attendance_request_id === req.id || r.request_id === req.id) && r.player_id === player.id
      );
      return resp?.status === "attending";
    }).length;
  }, 0);

  const totalSlots = window7.reduce((sum, req) =>
    sum + myKids.filter(p => p.team_id === req.team_id).length, 0
  );

  const goingPct = totalSlots > 0 ? Math.round((goingCount / totalSlots) * 100) : 100;

  if (allDefinitive) {
    return (
      <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-3">
        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
        <p className="text-sm font-semibold text-foreground">
          ✅ All RSVPs Complete ({goingPct}% Going)
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        RSVPs — Action Needed
      </h3>
      <div className="space-y-3">
        {actionNeeded.map(req => (
          <AttendanceCard
            key={req.id}
            request={req}
            isStaff={false}
            currentUser={user}
            myPlayers={myKids}
            allPlayers={[]}
          />
        ))}
      </div>
    </div>
  );
}