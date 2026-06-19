import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import CalendarView from "@/components/schedule/CalendarView";
import EventDetailPanel from "@/components/schedule/EventDetailPanel";
import CalendarExportPanel from "@/components/schedule/CalendarExportPanel";
import VolunteerDetailPanel from "@/components/schedule/VolunteerDetailPanel";
import { Download } from "lucide-react";

const PREF_KEY = (email) => `cu_cal_view_${email || "default"}`;

export default function ParentCalendar() {
  const { user } = useAuth();
  const userEmail = user?.email;

  const savedView = (() => { try { return localStorage.getItem(PREF_KEY(userEmail)); } catch { return null; } })();
  const [calendarView, setCalendarView] = useState(savedView || "month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [filterTeam, setFilterTeam] = useState("all");

  const { data: guardianLinks = [] } = useQuery({
    queryKey: ["my-guardian-links", userEmail],
    queryFn: () => base44.entities.PlayerGuardian.filter({ user_email: userEmail }),
    enabled: !!userEmail,
  });
  const { data: allPlayers = [] } = useQuery({
    queryKey: ["all-players-for-parent"],
    queryFn: () => base44.entities.Player.list(),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const { data: events = [] } = useQuery({
    queryKey: ["events-parent", userEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventsFiltered', {});
      return res.data?.events || [];
    },
    enabled: !!userEmail,
  });
  const { data: myAssignments = [] } = useQuery({
    queryKey: ["my-volunteer-assignments", userEmail],
    queryFn: () => base44.entities.VolunteerAssignment.filter({ volunteer_email: userEmail }),
    enabled: !!userEmail,
  });
  const { data: allOpportunities = [] } = useQuery({
    queryKey: ["volunteer-opportunities"],
    queryFn: () => base44.entities.VolunteerOpportunity.list(),
    enabled: myAssignments.length > 0,
  });

  const myLinkedPlayerIds = new Set(guardianLinks.map(g => g.player_id));
  const myKids = allPlayers.filter(p => myLinkedPlayerIds.has(p.id) || p.parent_email === userEmail);
  const myTeamIds = [...new Set(myKids.map(k => k.team_id))];
  const myTeams = teams.filter(t => myTeamIds.includes(t.id));
  const myEvents = events
    .filter(e => myTeamIds.includes(e.team_id) && e.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Build volunteer calendar entries (only for active assignments)
  const activeStatuses = new Set(["signed_up", "completed"]);
  const volunteerEntries = myAssignments
    .filter(a => activeStatuses.has(a.status))
    .map(assignment => {
      const opp = allOpportunities.find(o => o.id === assignment.opportunity_id);
      if (!opp || !opp.date) return null;
      return {
        id: `vol_${assignment.id}`,
        _isVolunteer: true,
        _opportunityId: assignment.opportunity_id,
        _assignmentId: assignment.id,
        title: `Volunteer – ${opp.role_name || "Duty"}`,
        type: "volunteer",
        date: opp.date,
        start_time: opp.start_time || null,
        end_time: opp.end_time || null,
        team_name: opp.team_name || "",
        location: null,
        notes: opp.notes || null,
      };
    })
    .filter(Boolean);

  const handleCalendarViewChange = (view) => {
    setCalendarView(view);
    try { localStorage.setItem(PREF_KEY(userEmail), view); } catch {}
  };

  const handleEventClick = (entry) => {
    if (entry._isVolunteer) {
      setSelectedVolunteer(entry);
    } else {
      setSelectedEvent(entry);
    }
  };

  const baseEvents = filterTeam === "all" ? myEvents : myEvents.filter(e => e.team_id === filterTeam);
  const displayedEvents = [...baseEvents, ...volunteerEntries];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">Your team schedule & volunteer duties</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {myTeams.length > 1 && (
            <select
              value={filterTeam}
              onChange={e => setFilterTeam(e.target.value)}
              className="text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-foreground"
            >
              <option value="all">All Teams</option>
              {myTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <CalendarView
        events={displayedEvents}
        calendarView={calendarView}
        setCalendarView={handleCalendarViewChange}
        onEventClick={handleEventClick}
      />

      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          canEdit={false}
        />
      )}

      {selectedVolunteer && (
        <VolunteerDetailPanel
          entry={selectedVolunteer}
          onClose={() => setSelectedVolunteer(null)}
        />
      )}

      {showExport && (
        <CalendarExportPanel
          events={displayedEvents}
          teams={myTeams}
          myTeamIds={myTeamIds}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}