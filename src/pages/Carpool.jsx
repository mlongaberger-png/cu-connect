import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Car } from "lucide-react";
import { useScheduleGuard } from "@/hooks/useRoleGuard";
import CarpoolHub from "@/components/carpool/CarpoolHub";

// Staff-facing Carpool page (admin / athletic_director / coach). Carpool Hub
// previously only existed inside ParentPortal's RSVP tab, which is gated on
// myKids.length > 0 (see ParentPortal.jsx) -- myKids comes from getMyPlayers,
// which only returns players for a user who is a parent/guardian (or, for
// admin/AD, every player org-wide). A coach isn't a guardian of anyone, so
// myKids was always empty for them and ParentPortal showed the "add your
// child" screen instead of ever letting them in -- Carpool was completely
// unreachable for coaches even though the product intent (per Matthew,
// 2026-08-08) is that any staff role can both offer and request rides.
//
// This page reuses the exact same CarpoolHub component ParentPortal renders
// (same props: currentUser/myTeamIds/myTeams/events), just with team scoping
// resolved the staff way instead of the parent way:
//   - admin / athletic_director -> every team, matching their org-wide access
//     everywhere else in the app (getEventsFiltered's admin/AD branch, the
//     Messages "Request a Ride" broadcast in ChatSidebar.jsx, etc).
//   - coach -> only the team(s) on their CoachProfile, same scoping
//     getEventsFiltered already applies server-side for the coach role.
export default function Carpool() {
  const { user, isAdmin, isAD, isCoach } = useScheduleGuard();
  const isAdminOrAD = isAdmin || isAD;

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: coachProfiles = [] } = useQuery({
    queryKey: ["my-coach-profiles-carpool", user?.email],
    queryFn: () => base44.entities.CoachProfile.filter({ user_email: user.email }),
    enabled: !!user && isCoach,
    staleTime: 60_000,
  });

  const myTeamIds = isAdminOrAD
    ? teams.map(t => t.id)
    : [...new Set(coachProfiles.map(p => p.team_id).filter(Boolean))];
  const myTeams = teams.filter(t => myTeamIds.includes(t.id));

  // Events scoped server-side via getEventsFiltered -- the same function
  // ParentPortal/Schedule already rely on, so a coach's carpool board always
  // shows the same set of upcoming games/practices as the rest of the app
  // considers "theirs" (their CoachProfile team; everything for admin/AD).
  const { data: events = [] } = useQuery({
    queryKey: ["events-carpool-staff", user?.email],
    queryFn: async () => {
      const res = await base44.functions.invoke("getEventsFiltered", {});
      return res.data?.events || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (!user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isCoach && myTeamIds.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="text-center py-10 bg-card rounded-2xl border border-border px-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Car className="w-9 h-9 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No team assigned yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You're not currently assigned to a team, so there's nothing to coordinate carpools
            for. Contact your admin or athletic director if this doesn't look right.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Carpool</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdminOrAD ? "Coordinate rides across all teams" : "Coordinate rides for your team"}
        </p>
      </div>
      <CarpoolHub currentUser={user} myTeamIds={myTeamIds} myTeams={myTeams} events={events} />
    </div>
  );
}
