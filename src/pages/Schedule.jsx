import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, MapPin, Clock, Trash2, Filter, List, Download, FileUp, Sheet, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Upload, Rss } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format as formatDateFns, parse } from "date-fns";
import BulkEventImporter from "@/components/schedule/BulkEventImporter";
import UniformSelector from "@/components/schedule/UniformSelector";
import SuggestionsInput from "@/components/schedule/SuggestionsInput";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import TimePickerPopup from "@/components/schedule/TimePickerPopup";
import { formatDate, formatTime12h } from "@/utils/dateTime";
import { useOrgTimezone } from "@/lib/useOrgTimezone";
import CalendarView from "@/components/schedule/CalendarView";
import EventDetailPanel from "@/components/schedule/EventDetailPanel";
import CalendarExportPanel from "@/components/schedule/CalendarExportPanel";
import PdfScheduleImporter from "@/components/schedule/PdfScheduleImporter";
import TimezoneSelector from "@/components/schedule/TimezoneSelector";
import CalendarSubscribeModal from "@/components/schedule/CalendarSubscribeModal";

import { useScheduleGuard } from "@/hooks/useRoleGuard";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import { useAuth } from "@/lib/AuthContext";

const eventTypes = ["practice", "game", "tournament", "meeting", "fundraiser", "other"];
const eventTypeLabels = { practice: "Practice", game: "Game", tournament: "Tournament", meeting: "Meeting", fundraiser: "Fundraiser", other: "Other" };
const typeColors = {
  practice: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  game: "bg-green-500/20 text-green-400 border-green-500/30",
  tournament: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  meeting: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  fundraiser: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  other: "bg-cyan-500/20 text-cyan-400",
};

const PREF_KEY = (email) => `cu_cal_view_${email || "default"}`;

export default function Schedule() {
  const { isAdmin, isAD, isCoach } = useScheduleGuard();
  const { user } = useAuth();
  const { abbr } = useOrgTimezone();
  const isStaff = isAdmin || isAD || isCoach;
  const isParent = !isStaff;

  // Restore saved sub-view preference; parents default to month
  const savedView = (() => { try { return localStorage.getItem(PREF_KEY(user?.email)); } catch { return null; } })();

  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [viewMode, setViewMode] = useState(isParent ? "calendar" : "list"); // "list" | "calendar"
  const [calendarView, setCalendarView] = useState(savedView || "month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  // Persist calendar sub-view preference per user
  const handleCalendarViewChange = (view) => {
    setCalendarView(view);
    try { localStorage.setItem(PREF_KEY(user?.email), view); } catch {}
  };
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [sortOrder, setSortOrder] = useState("asc"); // "asc" | "desc"
  const [form, setForm] = useState({ title: "", type: "practice", team_id: "", date: "", arrival_time: "", start_time: "", end_time: "", location: "", opponent: "", notes: "", tournament_round: "" });
  const [notifyTeam, setNotifyTeam] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const queryClient = useQueryClient();

  const refreshing = usePullToRefresh(async () => {
    await queryClient.invalidateQueries({ queryKey: ["events"] });
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date"),
  });

  // Build suggestions from existing events
  const locationSuggestions = React.useMemo(() => {
    const counts = {};
    events.forEach(e => { if (e.location) counts[e.location] = (counts[e.location] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([v]) => v);
  }, [events]);

  const opponentSuggestions = React.useMemo(() => {
    const counts = {};
    events.forEach(e => { if (e.opponent) counts[e.opponent] = (counts[e.opponent] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([v]) => v);
  }, [events]);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const team = teams.find(t => t.id === form.team_id);
    const eventData = { ...form, team_name: team?.name || "", sport_name: team?.sport_name || "" };
    const created = await base44.entities.Event.create(eventData);
    queryClient.invalidateQueries({ queryKey: ["events"] });
    setShowForm(false);

    // Post team message notification if checkbox is checked and team is selected
    if (notifyTeam && form.team_id && team) {
      const parts = [];
      const typeLabel = form.type ? form.type.charAt(0).toUpperCase() + form.type.slice(1) : "Event";
      parts.push(`📅 New ${typeLabel}: ${form.title}`);
      if (form.opponent) parts.push(`vs ${form.opponent}`);
      if (form.date) {
        let timeStr = form.start_time ? ` at ${formatTime12h(form.start_time)}` : "";
        if (form.arrival_time) timeStr += ` (arrive ${formatTime12h(form.arrival_time)})`;
        parts.push(form.date + timeStr);
      }
      if (form.location) parts.push(`📍 ${form.location}`);
      if (form.notes) parts.push(form.notes);
      // Create attendance request first so we can link it to the message
      const rsvpLabel = `${form.title}${form.start_time ? ` – ${formatTime12h(form.start_time)}` : ""}`;
      const attendanceReq = await base44.entities.AttendanceRequest.create({
        team_id: form.team_id,
        team_name: team.name,
        event_id: created.id,
        label: rsvpLabel,
        event_type: ["game", "tournament", "meeting"].includes(form.type) ? form.type : "other",
        event_date: form.date,
        event_time: form.start_time || "",
        created_by_name: user?.full_name || "Staff",
        created_by_email: user?.email || "",
        channel_id: form.team_id,
      });
      await base44.entities.Message.create({
        content: parts.join(" · "),
        channel: "team",
        channel_id: form.team_id,
        channel_name: team.name,
        sender_name: user?.full_name || "Staff",
        sender_email: user?.email || "",
        sender_avatar: user?.avatar_url || "",
        attendance_request_id: attendanceReq.id,
        event_id: created.id,
      });
      queryClient.invalidateQueries({ queryKey: ["messages", form.team_id] });
      queryClient.invalidateQueries({ queryKey: ["attendance-requests", form.team_id] });
    }
    setNotifyTeam(true);
    setForm({ title: "", type: "practice", team_id: "", date: "", arrival_time: "", start_time: "", end_time: "", location: "", opponent: "", notes: "", tournament_round: "", uniform_info: "" });
  };

  // Coaches only see events for their teams; ADs and admins see all
  const myTeamIds = myTeams.map(t => t.id);
  let filtered = (isCoach && myTeamIds.length > 0) ? events.filter(e => myTeamIds.includes(e.team_id)) : events;
  if (filterType !== "all") filtered = filtered.filter(e => e.type === filterType);
  if (filterTeam !== "all") filtered = filtered.filter(e => e.team_id === filterTeam);
  filtered = [...filtered].sort((a, b) => {
    const diff = new Date(a.date) - new Date(b.date);
    return sortOrder === "asc" ? diff : -diff;
  });

  const canEditEvent = (event) => isAdmin || isAD || (isCoach && myTeamIds.includes(event.team_id));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {refreshing && <div className="flex justify-center"><div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">{events.length} events scheduled</p>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          <TimezoneSelector canEdit={isAdmin || isAD} />
          <Button variant="outline" size="sm" className="border-border text-muted-foreground h-8 px-2.5" onClick={() => setShowExport(true)}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export
          </Button>
          {(isAdmin || isAD || isCoach) && (
            <Button variant="outline" size="sm" className="border-border text-muted-foreground h-8 px-2.5" onClick={() => setShowBulkImport(true)}>
              <Upload className="w-3.5 h-3.5 mr-1" /> Import
            </Button>
          )}
          {(isAdmin || isAD) && (
            <Button variant="outline" size="sm" className="border-border text-muted-foreground h-8 px-2.5" onClick={() => setShowPdfImport(true)}>
              <FileUp className="w-3.5 h-3.5 mr-1" /> Import PDF
            </Button>
          )}
          <Button variant="outline" size="sm" className="border-border text-muted-foreground h-8 px-2.5" onClick={() => setShowSubscribeModal(true)}>
            <Rss className="w-3.5 h-3.5 mr-1" /> Subscribe
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground h-8">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Event
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

        {/* Filters + Sort */}
        <div className="flex gap-3 flex-wrap items-center">
          <button
            onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            title={sortOrder === "asc" ? "Oldest first" : "Newest first"}
          >
            {sortOrder === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            {sortOrder === "asc" ? "Oldest first" : "Newest first"}
          </button>
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
          setCalendarView={handleCalendarViewChange}
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

      {/* Bulk CSV/Excel Import */}
      <BulkEventImporter
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        teams={myTeams}
      />

      {/* PDF Import Dialog */}
      <PdfScheduleImporter
        open={showPdfImport}
        onOpenChange={setShowPdfImport}
        teams={myTeams}
      />

      {/* Calendar Subscribe Modal */}
      <CalendarSubscribeModal
        open={showSubscribeModal}
        onOpenChange={setShowSubscribeModal}
        teams={myTeams}
        myTeamIds={myTeamIds}
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
                  <SelectTrigger className="bg-surface border-border"><SelectValue>{eventTypeLabels[form.type] || form.type}</SelectValue></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {eventTypes.map(t => <SelectItem key={t} value={t}>{eventTypeLabels[t]}</SelectItem>)}
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
            {/* Date picker */}
            <div>
              <Label>Date</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className="w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-surface text-sm text-left mt-1">
                    <span className={form.date ? "text-foreground" : "text-muted-foreground"}>
                      {form.date ? formatDateFns(new Date(form.date + "T12:00:00"), "MM/dd/yyyy") : "mm/dd/yyyy"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border z-50" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={form.date ? new Date(form.date + "T12:00:00") : undefined}
                    onSelect={(d) => {
                      if (d) setForm(f => ({ ...f, date: formatDateFns(d, "yyyy-MM-dd") }));
                      setDatePickerOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Time fields */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Arrival</Label>
                <TimePickerPopup
                  value={form.arrival_time || ""}
                  onChange={v => setForm(f => ({ ...f, arrival_time: v, start_time: f.start_time || v }))}
                  placeholder="Arrival"
                />
              </div>
              <div>
                <Label>Start</Label>
                <TimePickerPopup
                  value={form.start_time}
                  onChange={v => setForm(f => ({ ...f, start_time: v }))}
                  placeholder="Start"
                />
              </div>
              <div>
                <Label>End</Label>
                <TimePickerPopup
                  value={form.end_time}
                  onChange={v => setForm(f => ({ ...f, end_time: v }))}
                  placeholder="End"
                />
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <AddressAutocomplete
                value={form.location}
                onChange={v => setForm(f => ({ ...f, location: v }))}
                placeholder="Search address…"
                className="bg-surface border-border mt-1"
              />
            </div>
            {(form.type === "game" || form.type === "tournament") && (
              <div>
                <Label>Opponent</Label>
                <SuggestionsInput
                  value={form.opponent}
                  onChange={v => setForm(f => ({ ...f, opponent: v }))}
                  suggestions={opponentSuggestions}
                  placeholder="Opponent"
                  className="bg-surface border-border mt-1"
                />
              </div>
            )}
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
            <UniformSelector form={form} setForm={setForm} sportName={teams.find(t => t.id === form.team_id)?.sport_name || ""} />
            <div className="flex items-center gap-2 p-3 bg-surface rounded-xl border border-border">
                <input
                  type="checkbox"
                  id="notify-team"
                  checked={notifyTeam}
                  onChange={e => setNotifyTeam(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="notify-team" className="text-sm text-foreground cursor-pointer flex items-center gap-2">
                  <span className="text-base">✔</span> Notify team via Messages
                </label>
              </div>
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