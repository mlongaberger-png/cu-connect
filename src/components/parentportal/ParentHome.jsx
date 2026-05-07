import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar, Clock, MapPin, Megaphone, CreditCard,
  FileText, ChevronRight, DollarSign, AlertCircle,
  MessageSquare, UserCircle, Trophy, HandHeart
} from "lucide-react";
import { formatDate, formatTime12h } from "@/utils/dateTime";
import { format, isPast, parseISO } from "date-fns";
import AthleteCard from "@/components/parentportal/AthleteCard";
import AthleteProfileModal from "@/components/parentportal/AthleteProfileModal";
import PushNotificationBanner from "@/components/notifications/PushNotificationBanner";
import AttendanceCard from "@/components/attendance/AttendanceCard";
import { Button } from "@/components/ui/button";

const TYPE_COLORS = {
  practice: "bg-blue-500/20 text-blue-400",
  game: "bg-green-500/20 text-green-400",
  tournament: "bg-purple-500/20 text-purple-400",
  meeting: "bg-orange-500/20 text-orange-400",
  fundraiser: "bg-yellow-500/20 text-yellow-400",
  other: "bg-cyan-500/20 text-cyan-400",
};

export default function ParentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const userEmail = user?.email;

  const { data: guardianLinks = [] } = useQuery({
    queryKey: ["my-guardian-links", userEmail],
    queryFn: () => base44.entities.PlayerGuardian.filter({ user_email: userEmail }),
    enabled: !!userEmail,
  });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: announcements = [] } = useQuery({ queryKey: ["announcements"], queryFn: () => base44.entities.Announcement.list("-created_date") });
  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: () => base44.entities.Sport.list() });
  const { data: allPayments = [] } = useQuery({
    queryKey: ["payments-all", userEmail],
    queryFn: () => base44.entities.Payment.list(),
    enabled: !!userEmail,
  });

  const myLinkedIds = new Set(guardianLinks.map(g => g.player_id));
  const myKids = players
    .filter(p => myLinkedIds.has(p.id) || p.parent_email === userEmail)
    .sort((a, b) => a.last_name.localeCompare(b.last_name));
  const myTeamIds = [...new Set(myKids.map(k => k.team_id))];
  const myTeams = teams.filter(t => myTeamIds.includes(t.id));
  const myEvents = events
    .filter(e => myTeamIds.includes(e.team_id) && e.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const myUpcoming = myEvents.filter(e => !isPast(parseISO(e.date + "T23:59:59")));
  const myAnnouncements = announcements.filter(a =>
    a.target === "org" || myTeamIds.includes(a.target_id) || myTeams.some(t => t.sport_id === a.target_id)
  );

  const myKidIds = new Set(myKids.map(k => k.id));
  const myUnpaid = allPayments.filter(p =>
    myKidIds.has(p.player_id) && !["paid", "draft", "voided", "refunded"].includes(p.status)
  );
  const totalOwed = myUnpaid.reduce((sum, p) => sum + (p.amount || 0), 0);

  const { data: sigRequests = [] } = useQuery({
    queryKey: ["my-sig-requests-home", userEmail],
    queryFn: async () => {
      if (!myKidIds.size) return [];
      const all = await base44.entities.SignatureRequest.list("-created_date");
      return all.filter(s => myKidIds.has(s.player_id) && s.status === "pending");
    },
    enabled: myKidIds.size > 0,
  });

  const { data: attendanceRequests = [] } = useQuery({
    queryKey: ["attendance-requests-home", myTeamIds.join(",")],
    queryFn: () => base44.entities.AttendanceRequest.list("-created_date"),
    enabled: myTeamIds.length > 0,
  });
  const openRsvps = attendanceRequests.filter(r => myTeamIds.includes(r.team_id) && !r.is_locked);

  const mySportIds = [...new Set(myTeams.map(t => t.sport_id).filter(Boolean))];
  const { data: volunteerOpportunities = [] } = useQuery({
    queryKey: ["volunteer-opps-home", mySportIds.join(",")],
    queryFn: () => base44.entities.VolunteerOpportunity.list(),
    enabled: mySportIds.length > 0,
  });
  const { data: volunteerAssignments = [] } = useQuery({
    queryKey: ["volunteer-assignments-home", userEmail],
    queryFn: () => base44.entities.VolunteerAssignment.filter({ volunteer_email: userEmail }),
    enabled: !!userEmail,
  });
  const assignedOppIds = new Set(volunteerAssignments.map(a => a.opportunity_id));
  const openVolunteerOpps = volunteerOpportunities.filter(opp => {
    if (!opp.is_active) return false;
    const relevantSport = !opp.sport_id || mySportIds.includes(opp.sport_id);
    const relevantTeam = !opp.team_id || myTeamIds.includes(opp.team_id);
    const notFull = (opp.filled_spots || 0) < (opp.total_spots || 1);
    const notAssigned = !assignedOppIds.has(opp.id);
    return relevantSport && relevantTeam && notFull && notAssigned;
  });

  if (myKids.length === 0) {
    return (
      <div className="p-6 text-center space-y-4">
        <UserCircle className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-foreground font-semibold">Welcome, {user?.full_name?.split(" ")[0] || "there"}!</p>
        <p className="text-sm text-muted-foreground">Your athlete profiles will appear here once your account is linked.</p>
        <Button onClick={() => navigate("/ParentPortal")} variant="outline" className="gap-2">
          Complete Setup <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
    {selectedAthlete && (
      <AthleteProfileModal
        player={selectedAthlete.player}
        team={selectedAthlete.team}
        sport={selectedAthlete.sport}
        onClose={() => setSelectedAthlete(null)}
      />
    )}
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 pb-24">
      <PushNotificationBanner />

      {/* 1. Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Hey, {user?.full_name?.split(" ")[0] || "there"}! 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {myTeams.map(t => t.name).join(" · ")}
        </p>
      </div>

      {/* Action alerts */}
      {(totalOwed > 0 || sigRequests.length > 0 || openRsvps.length > 0 || openVolunteerOpps.length > 0) && (
        <div className="space-y-2">
          {totalOwed > 0 && (
            <button
              onClick={() => navigate("/ParentPortal?tab=payments")}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-colors text-left"
            >
              <AlertCircle className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Balance due: ${(totalOwed / 100).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{myUnpaid.length} unpaid invoice{myUnpaid.length !== 1 ? "s" : ""}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          )}
          {sigRequests.length > 0 && (
            <button
              onClick={() => navigate("/ParentPortal?tab=documents")}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/15 transition-colors text-left"
            >
              <FileText className="w-4 h-4 text-yellow-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{sigRequests.length} document{sigRequests.length !== 1 ? "s" : ""} need your signature</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          )}
          {openVolunteerOpps.length > 0 && (
            <button
              onClick={() => navigate("/Volunteers")}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 hover:bg-teal-500/15 transition-colors text-left"
            >
              <HandHeart className="w-4 h-4 text-teal-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{openVolunteerOpps.length} volunteer shift{openVolunteerOpps.length !== 1 ? "s" : ""} need filling</p>
                <p className="text-xs text-muted-foreground">
                  {[...new Set(openVolunteerOpps.map(o => o.sport_name).filter(Boolean))].join(", ") || "Your team"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          )}
        </div>
      )}

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
              myPlayers={myKids}
              allPlayers={[]}
            />
          ))}
        </section>
      )}

      {/* 3. Athlete Cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-primary" /> My Athletes
        </h2>
        {myKids.map(kid => {
          const team = teams.find(t => t.id === kid.team_id);
          const sport = sports.find(s => s.id === team?.sport_id);
          const kidUnpaid = myUnpaid.filter(p => p.player_id === kid.id);
          const nextEvent = myUpcoming.find(e => e.team_id === kid.team_id);
          return (
            <div
              key={kid.id}
              className="bg-card border border-border rounded-2xl p-4 space-y-3 cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setSelectedAthlete({ player: kid, team: teams.find(t => t.id === kid.team_id), sport: sports.find(s => s.id === teams.find(t => t.id === kid.team_id)?.sport_id) })}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
                  {kid.photo_url
                    ? <img src={kid.photo_url} alt={kid.first_name} className="w-full h-full object-cover object-top" />
                    : <span className="text-sm font-bold text-primary">{kid.first_name[0]}{kid.last_name[0]}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{kid.first_name} {kid.last_name}</p>
                  <p className="text-xs text-muted-foreground">{team?.name || "—"}{kid.jersey_number ? ` · #${kid.jersey_number}` : ""}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {kidUnpaid.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                      ${(kidUnpaid.reduce((s, p) => s + p.amount, 0) / 100).toFixed(0)} due
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              {nextEvent && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>Next: <span className="text-foreground font-medium">{nextEvent.title}</span> · {formatDate(nextEvent.date, "MMM d")}{nextEvent.start_time ? ` @ ${formatTime12h(nextEvent.start_time)}` : ""}</span>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* 4. Upcoming Events */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Upcoming Events
          </h2>
          <button
            onClick={() => navigate("/ParentCalendar")}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Full Calendar <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {myUpcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4 bg-card rounded-2xl border border-border">No upcoming events</p>
        ) : (
          <div className="space-y-2">
            {myUpcoming.slice(0, 6).map(event => (
              <div key={event.id} className="flex items-start gap-3 p-3 bg-card rounded-xl border border-border">
                <div className="flex flex-col items-center min-w-[40px] shrink-0">
                  <span className="text-[10px] text-muted-foreground uppercase">{formatDate(event.date, "MMM")}</span>
                  <span className="text-lg font-bold text-foreground leading-tight">{formatDate(event.date, "d")}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[event.type] || TYPE_COLORS.other}`}>{event.type}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {event.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime12h(event.start_time)}</span>}
                    {event.location && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{event.location}</span>}
                    <span className="text-primary">{event.team_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Payments Summary */}
      <section
        className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors"
        onClick={() => navigate("/ParentPortal?tab=payments")}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Payments</p>
              {totalOwed > 0 ? (
                <p className="text-xs text-primary font-medium">${(totalOwed / 100).toFixed(2)} outstanding</p>
              ) : (
                <p className="text-xs text-green-400">All paid ✓</p>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </section>

      {/* 6. Documents Summary */}
      <section
        className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors"
        onClick={() => navigate("/ParentPortal?tab=documents")}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sigRequests.length > 0 ? "bg-yellow-500/20" : "bg-surface"}`}>
              <FileText className={`w-4 h-4 ${sigRequests.length > 0 ? "text-yellow-400" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Documents & Forms</p>
              {sigRequests.length > 0 ? (
                <p className="text-xs text-yellow-400">{sigRequests.length} signature{sigRequests.length !== 1 ? "s" : ""} needed</p>
              ) : (
                <p className="text-xs text-muted-foreground">No action needed</p>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </section>

      {/* 7. Recent Announcements */}
      {myAnnouncements.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" /> Announcements
          </h2>
          <div className="space-y-2">
            {myAnnouncements.slice(0, 3).map(ann => (
              <div key={ann.id} className="p-4 bg-card rounded-xl border border-border">
                <p className="text-sm font-semibold text-foreground">{ann.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ann.content}</p>
                {ann.created_date && (
                  <p className="text-[10px] text-muted-foreground mt-2">{format(new Date(ann.created_date), "MMM d, yyyy")}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. Messages CTA */}
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
    </div>
    </>
  );
}