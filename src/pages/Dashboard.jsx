import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Calendar, UserCircle, ClipboardList, DollarSign } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import UpcomingEvents from "@/components/dashboard/UpcomingEvents";
import RecentAnnouncements from "@/components/dashboard/RecentAnnouncements";
import PerformanceHero from "@/components/dashboard/PerformanceHero";
import { useAuth } from "@/lib/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role;
  const isStaff = ["admin", "athletic_director", "coach"].includes(role);
  const isParent = role === "parent" || role === "user";

  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: () => base44.entities.Sport.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list(), enabled: isStaff });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: announcements = [] } = useQuery({ queryKey: ["announcements"], queryFn: () => base44.entities.Announcement.list("-created_date") });
  const { data: submissions = [] } = useQuery({ queryKey: ["reg-submissions-all"], queryFn: () => base44.entities.RegistrationSubmission.filter({ status: "pending" }), enabled: isStaff });
  const { data: payments = [] } = useQuery({ queryKey: ["payments-dashboard"], queryFn: () => base44.entities.Payment.list(), enabled: isStaff });

  // Parent-specific: fetch guardian links to find their kids
  const { data: guardianLinks = [] } = useQuery({
    queryKey: ["my-guardian-links", user?.email],
    queryFn: () => base44.entities.PlayerGuardian.filter({ user_email: user?.email }),
    enabled: isParent && !!user?.email,
  });
  const { data: allPlayers = [] } = useQuery({
    queryKey: ["all-players-for-parent"],
    queryFn: () => base44.entities.Player.list(),
    enabled: isParent,
  });

  // Determine parent's kids, teams, and sport
  const myLinkedPlayerIds = new Set(guardianLinks.map(g => g.player_id));
  const myKids = isParent
    ? allPlayers.filter(p => myLinkedPlayerIds.has(p.id) || p.parent_email === user?.email)
    : [];
  const myTeamIds = [...new Set(myKids.map(k => k.team_id))];
  const myTeams = teams.filter(t => myTeamIds.includes(t.id));
  const mySportIds = [...new Set(myTeams.map(t => t.sport_id).filter(Boolean))];

  // For parents: filter events and announcements to their teams
  const parentEvents = isParent ? events.filter(e => myTeamIds.includes(e.team_id)) : events;
  const parentAnnouncements = isParent
    ? announcements.filter(a => a.target === "org" || myTeamIds.includes(a.target_id) || mySportIds.includes(a.target_id))
    : announcements;

  const unpaidPayments = payments.filter(p => p.status !== "paid");
  const totalOutstanding = unpaidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const upcomingEvents = (isParent ? parentEvents : events)
    .filter(e => e.date && new Date(e.date + "T00:00:00") >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Parent welcome header
  const sportLabel = myTeams.length > 0 ? [...new Set(myTeams.map(t => t.sport_name).filter(Boolean))].join(" & ") : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {isParent && myKids.length > 0 && (
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Welcome back, {user?.full_name?.split(" ")[0] || "there"}!
            </h2>
            <p className="text-sm text-muted-foreground">
              {sportLabel ? `${sportLabel} · ` : ""}{myTeams.map(t => t.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      <PerformanceHero
        events={isParent ? parentEvents : events}
        teams={isParent ? myTeams : teams}
        sports={sports}
        players={isParent ? myKids : players}
      />

      {isStaff && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Sports" value={sports.filter(s => s.is_active !== false).length} icon={Trophy} />
          <StatCard label="Teams" value={teams.filter(t => t.is_active !== false).length} icon={Users} />
          <StatCard label="Athletes" value={players.filter(p => p.is_active !== false).length} icon={UserCircle} />
          <StatCard label="Upcoming Events" value={upcomingEvents.length} icon={Calendar} />
          <StatCard label="Pending Reg." value={submissions.length} icon={ClipboardList} />
          <StatCard label="Outstanding" value={`$${(totalOutstanding / 100).toFixed(0)}`} icon={DollarSign} />
        </div>
      )}

      {isParent && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="My Teams" value={myTeams.filter(t => t.is_active !== false).length} icon={Users} />
          <StatCard label="Upcoming Events" value={upcomingEvents.length} icon={Calendar} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingEvents events={upcomingEvents} />
        <RecentAnnouncements announcements={parentAnnouncements} />
      </div>
    </div>
  );
}