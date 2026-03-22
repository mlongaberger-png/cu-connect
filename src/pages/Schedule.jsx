import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, MapPin, Clock, Trash2, Filter, List, Download, FileUp } from "lucide-react";
import { formatDate, formatTime12h } from "@/utils/dateTime";
import { useOrgTimezone } from "@/lib/useOrgTimezone";
import CalendarView from "@/components/schedule/CalendarView";
import EventDetailPanel from "@/components/schedule/EventDetailPanel";
import CalendarExportPanel from "@/components/schedule/CalendarExportPanel";
import PdfScheduleImporter from "@/components/schedule/PdfScheduleImporter";
import TimezoneSelector from "@/components/schedule/TimezoneSelector";

import { useScheduleGuard } from "@/hooks/useRoleGuard";
import { useAuth } from "@/lib/AuthContext";

const eventTypes = ["practice", "game", "tournament", "meeting", "fundraiser", "other"];
const typeColors = {
  practice: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  game: "bg-green-500/20 text-green-400 border-green-500/30",
  tournament: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  meeting: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  fundraiser: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  other: "bg-cyan-500/20 text-cyan-400",
};

export default function Schedule() {
  const { isAdmin, isAD, isCoach } = useScheduleGuard();
  const { user } = useAuth();
  const { abbr } = useOrgTimezone();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // "list" | "calendar"
  const [calendarView, setCalendarView] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [form, setForm] = useState({ title: "", type: "practice", team_id: "", date: "", start_time: "", end_time: "", location: "", opponent: "", notes: "" });
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date"),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  // Coaches are scoped to teams where their email matches coach_email
  const myTeams = isCoach
    ? teams.filter(t => t.coach_email && t.coach_email.toLowerCase() === (user?.email || "").toLowerCase())
    : teams;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Event.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); setSelectedEvent(null); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const team = teams.find(t => t.id === form.team_id);
    createMutation.mutate({ ...form, team_name: team?.name || "", sport_name: team?.sport_name || "" });
  };

  // Coaches only see events for their teams; ADs and admins see all
  const myTeamIds = myTeams.map(t => t.id);
  let filtered = (isCoach && myTeamIds.length > 0) ? events.filter(e => myTeamIds.includes(e.team_id)) : events;
  if (filterType !== "all") filtered = filtered.filter(e => e.type === filterType);
  if (filterTeam !== "all") filtered = filtered.filter(e => e.team_id === filterTeam);

  const canEditEvent = (event) => isAdmin || isAD || (isCoach && myTeamIds.includes(event.team_id));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">{events.length} events scheduled</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <TimezoneSelector canEdit={isAdmin || isAD} />
          <Button variant="outline" className="border-border text-muted-foreground" onClick={() => setShowExport(true)}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          {(isAdmin || isAD) && (
            <Button variant="outline" className="border-border text-muted-foreground" onClick={() => setShowPdfImport(true)}>
              <FileUp className="w-4 h-4 mr-2" /> Import PDF
            </Button>
          )}
          <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Event
          </Button>
        </div>
      </div>

      {/* View Toggle + Filters */}
      <div className="flex gap-3 flex-wrap items-center justify-between">
        {/* List / Calendar toggle */}
        <div className="flex gap-1 bg-surface rounded-lg p-1">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="w-4 h-4" /> List
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Calendar className="w-4 h-4" /> Calendar
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36 bg-surface border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Types</SelectItem>
                {eventTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-44 bg-surface border-border"><SelectValue placeholder="All Teams" /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Teams</SelectItem>
              {myTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <CalendarView
          events={filtered}
          calendarView={calendarView}
          setCalendarView={setCalendarView}
          onEventClick={setSelectedEvent}
        />
      )}

      {/* List View */}
      {viewMode === "list" && (
        isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-2xl animate-pulse border border-border" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No events found</h3>
            <p className="text-muted-foreground">Create an event to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((event) => (
              <div
                key={event.id}
                className={`bg-card rounded-2xl border border-border p-5 hover:border-primary/20 transition-all cursor-pointer ${event.is_cancelled ? "opacity-60" : ""}`}
                onClick={() => setSelectedEvent(event)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center min-w-[52px] bg-surface rounded-xl p-2">
                      <span className="text-xs text-muted-foreground">{event.date ? formatDate(event.date, "MMM") : ""}</span>
                      <span className="text-2xl font-bold text-foreground">{event.date ? formatDate(event.date, "dd") : "--"}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${typeColors[event.type] || ""}`}>{event.type}</span>
                        {event.tournament_round && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">{event.tournament_round}</span>}
                        {event.result && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border capitalize ${event.result === "win" ? "bg-green-500/20 text-green-400 border-green-500/30" : event.result === "loss" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}`}>
                            {event.result === "win" ? "✓ W" : event.result === "loss" ? "✗ L" : "~ D"}
                            {event.our_score != null && event.our_score !== "" ? ` ${event.our_score}–${event.opponent_score ?? "?"}` : ""}
                          </span>
                        )}
                        {event.is_championship_win && <span className="text-xs">🏆</span>}
                        {event.is_cancelled && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Cancelled</span>}
                      </div>
                      <h3 className="text-base font-semibold text-foreground">{event.title}</h3>
                      <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-muted-foreground">
                        {event.start_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatTime12h(event.start_time)}{event.end_time ? ` - ${formatTime12h(event.end_time)}` : ""}{abbr ? <span className="text-muted-foreground/60 ml-0.5">{abbr}</span> : null}</span>}
                        {event.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {event.location}</span>}
                      </div>
                      {event.team_name && <p className="text-xs text-primary mt-1">{event.team_name} {event.sport_name ? `• ${event.sport_name}` : ""}</p>}
                      {event.opponent && <p className="text-xs text-muted-foreground mt-1">vs {event.opponent}</p>}
                    </div>
                  </div>
                  {canEditEvent(event) && (
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(event.id); }} className="text-muted-foreground hover:text-red-400 h-8 w-8">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Event Detail Panel */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          canEdit={canEditEvent(selectedEvent)}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}

      {/* Export Panel */}
      {showExport && (
        <CalendarExportPanel
          events={filtered}
          teams={teams}
          myTeamIds={null}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* PDF Import Dialog */}
      <PdfScheduleImporter
        open={showPdfImport}
        onOpenChange={setShowPdfImport}
        teams={myTeams}
      />

      {/* Add Event Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Event</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-surface border-border" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {eventTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Team</Label>
                <Select value={form.team_id} onValueChange={v => setForm({...form, team_id: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {myTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="bg-surface border-border" required /></div>
              <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="bg-surface border-border" /></div>
              <div><Label>End</Label><Input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} className="bg-surface border-border" /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="bg-surface border-border" /></div>
            {(form.type === "game" || form.type === "tournament") && <div><Label>Opponent</Label><Input value={form.opponent} onChange={e => setForm({...form, opponent: e.target.value})} className="bg-surface border-border" /></div>}
            {form.type === "tournament" && (
              <div>
                <Label>Tournament Round</Label>
                <Select value={form.tournament_round || ""} onValueChange={v => setForm({...form, tournament_round: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Select round…" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {["Pool Play","Round of 16","Quarterfinals","Semifinals","Finals","Championship"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="bg-surface border-border" /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">Create Event</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}