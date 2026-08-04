import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { UserCircle, MessageSquare, ChevronRight, BookOpen } from "lucide-react";
import AthleteCard from "@/components/parentportal/AthleteCard";
import PushNotificationBanner from "@/components/notifications/PushNotificationBanner";
import FieldStatusBanner from "@/components/parentportal/FieldStatusBanner";
import UpcomingEvents from "@/components/dashboard/UpcomingEvents";
import RecentAnnouncements from "@/components/dashboard/RecentAnnouncements";
import AttendanceCard from "@/components/attendance/AttendanceCard";
import { PlayerPaymentCard } from "@/components/parentportal/PlayerPayments";

// Athlete-facing equivalent of ParentHome, scoped to the athlete's own single
// player record rather than a parent's (possibly multiple) linked children.
export default function AthleteHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userEmail = user?.email;

  // Player RLS includes data.athlete_email == {{user.email}}, so this client-side
  // filter is already scoped server-side to this athlete's own record only —
  // it can never return another family's player.
  const { data: myPlayers = [] } = useQuery({
    queryKey: ["my-player-athlete", userEmail],
    queryFn: () => base44.entities.Player.filter({ athlete_email: userEmail }),
    enabled: !!userEmail,
  });
  const player = myPlayers[0] || null;

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: () => base44.entities.Sport.list() });

  // getEventsFiltered scopes events server-side (asServiceRole) to this athlete's
  // own team(s), same pattern used for parents in ParentHome — RLS on Event can
  // only role-gate, not join through Player.
  const { data: events = [] } = useQuery({
    queryKey: ["events-athlete-home", userEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke("getEventsFiltered", {});
      return res.data?.events || [];
    },
    enabled: !!userEmail,
  });

  const { data: announcements = [] } = useQuery({ queryKey: ["announcements"], queryFn: () => base44.entities.Announcement.list("-created_date") });

  const team = teams.find(t => t.id === player?.team_id);
  const sport = sports.find(s => s.id === team?.sport_id);

  const myEvents = events
    .filter(e => e.date && (!e.team_id || e.team_id === player?.team_id))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const myUpcoming = myEvents.filter(e => {
    const timeStr = e.end_time || e.start_time || "23:59";
    return new Date(`${e.date}T${timeStr}:00`) >= new Date();
  });

  const myAnnouncements = announcements.filter(a =>
    a.target === "org" || a.target_id === player?.team_id || a.target_id === team?.sport_id
  );

  const { data: attendanceRequests = [] } = useQuery({
    queryKey: ["attendance-requests-athlete-home", player?.team_id],
    queryFn: () => base44.entities.AttendanceRequest.list("-created_date"),
    enabled: !!player?.team_id,
  });
  const now = new Date();
  const openRsvps = attendanceRequests.filter(r => {
    if (r.team_id !== player?.team_id || r.is_locked) return false;
    if (r.event_date) {
      const timeStr = r.event_time || "23:59";
      const eventEnd = new Date(`${r.event_date}T${timeStr}:00`);
      if (eventEnd < now) return false;
    }
    return true;
  });

  if (!player) {
    return (
      <div className="p-6 text-center space-y-4">
        <UserCircle className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-foreground font-semibold">Welcome, {(user?.display_name || user?.full_name)?.split(" ")[0] || "there"}!</p>
        <p className="text-sm text-muted-foreground">Your athlete profile isn't linked yet. Ask your coach or parent for help.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 pb-24">
      <PushNotificationBanner />
      <FieldStatusBanner />

      {/* 1. Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Hey, {(user?.display_name || user?.full_name || player.first_name)?.split(" ")[0]}! 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{team?.name || "—"}</p>
      </div>

      {/* 2. Open RSVPs */}
      {openRsvps.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
            RSVPs Needed
          </h2>
          {openRsvps.slice(0, 3).map(req => (
            <AttendanceCard
              key={req.id}
              request={req}
              isStaff={false}
              currentUser={user}
              myPlayers={[player]}
              allPlayers={[]}
            />
          ))}
        </section>
      )}

      {/* 3. Athlete Card */}
      <section className="flex justify-center">
        <AthleteCard player={player} team={team} sport={sport} canEdit={true} />
      </section>

      {/* 4. Upcoming Events */}
      <UpcomingEvents events={myUpcoming} />

      {/* 5. Announcements */}
      {myAnnouncements.length > 0 && (
        <RecentAnnouncements announcements={myAnnouncements} />
      )}

      {/* 6. Messages CTA */}
      <section
        className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors"
        onClick={() => navigate("/Messages")}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">Messages</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </section>

      {/* 7. Playbooks CTA */}
      <section
        className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors"
        onClick={() => navigate("/Playbooks")}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">Playbooks &amp; Film</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </section>
    </div>
  );
}
