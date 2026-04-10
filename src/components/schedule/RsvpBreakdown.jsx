import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, XCircle, HelpCircle, Clock, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { status: "attending",     label: "Going",        Icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
  { status: "not_attending", label: "Not Going",    Icon: XCircle,      color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
  { status: "maybe",         label: "Maybe",        Icon: HelpCircle,   color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  { status: "no_response",   label: "No Response",  Icon: Clock,        color: "text-muted-foreground", bg: "bg-surface", border: "border-border" },
];

function CategoryDropdown({ category, players }) {
  const [open, setOpen] = useState(false);
  const { Icon, label, color, bg, border } = category;

  return (
    <div className={`rounded-xl border ${border} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 ${bg} hover:opacity-90 transition-opacity`}
      >
        <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
        <span className={`text-sm font-semibold ${color} flex-1 text-left`}>{label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-black/20 ${color}`}>{players.length}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && players.length > 0 && (
        <div className="divide-y divide-border/50">
          {players.map((p, i) => (
            <div key={i} className="px-4 py-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">{(p.playerName || "?")[0].toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{p.playerName}</p>
                {p.responderName && p.responderName !== p.playerName && (
                  <p className="text-xs text-muted-foreground truncate">via {p.responderName}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && players.length === 0 && (
        <div className="px-4 py-2 text-xs text-muted-foreground">None</div>
      )}
    </div>
  );
}

export default function RsvpBreakdown({ event, user }) {
  const [rsvpCreated, setRsvpCreated] = useState(false);
  const [creating, setCreating] = useState(false);

  // Fetch attendance request for this event
  const { data: attendanceRequests = [] } = useQuery({
    queryKey: ["attendance-requests-event", event?.id],
    queryFn: () => base44.entities.AttendanceRequest.filter({ event_id: event.id }),
    enabled: !!event?.id,
    refetchInterval: 8000,
  });
  const req = attendanceRequests[0] || null;

  // Fetch all responses for this request
  const { data: responses = [] } = useQuery({
    queryKey: ["attendance-responses", req?.id],
    queryFn: () => base44.entities.AttendanceResponse.filter({ attendance_request_id: req.id }),
    enabled: !!req?.id,
    refetchInterval: 8000,
  });

  // Fetch team players
  const { data: players = [] } = useQuery({
    queryKey: ["players-team", event?.team_id],
    queryFn: () => base44.entities.Player.filter({ team_id: event.team_id }),
    enabled: !!event?.team_id,
  });

  // If no attendance request, show "Request RSVP" button
  if (!req) {
    const handleCreate = async () => {
      setCreating(true);
      const { formatTime12h } = await import("@/utils/dateTime");
      const label = `${event.title}${event.start_time ? ` – ${formatTime12h(event.start_time)}` : ""}`;
      await base44.entities.AttendanceRequest.create({
        team_id: event.team_id,
        team_name: event.team_name,
        event_id: event.id,
        label,
        event_type: (event.type === "game" || event.type === "tournament" || event.type === "meeting") ? event.type : "other",
        event_date: event.date,
        event_time: event.start_time || "",
        created_by_name: user?.full_name || "Staff",
        created_by_email: user?.email || "",
        channel_id: event.team_id,
      });
      setCreating(false);
      setRsvpCreated(true);
    };

    if (rsvpCreated) {
      return <p className="text-sm text-green-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> RSVP request sent to parents</p>;
    }

    return (
      <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 gap-1.5" onClick={handleCreate} disabled={creating}>
        <ClipboardList className="w-3.5 h-3.5" />
        {creating ? "Creating..." : "Request RSVP from Parents"}
      </Button>
    );
  }

  // Build categorized lists
  const responseMap = {};
  responses.forEach(r => { responseMap[r.player_id] = r; });

  const categorized = { attending: [], not_attending: [], maybe: [], no_response: [] };
  players.forEach(p => {
    const r = responseMap[p.id];
    const entry = {
      playerName: `${p.first_name} ${p.last_name}`,
      responderName: r?.responder_email || "",
    };
    if (r) {
      categorized[r.status]?.push(entry);
    } else {
      categorized.no_response.push(entry);
    }
  });

  const total = players.length;
  const goingCount = categorized.attending.length;
  const notGoingCount = categorized.not_attending.length;
  const maybeCount = categorized.maybe.length;
  const noRespCount = categorized.no_response.length;

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Going",       count: goingCount,    color: "text-green-400" },
          { label: "Not Going",   count: notGoingCount, color: "text-red-400" },
          { label: "Maybe",       count: maybeCount,    color: "text-yellow-400" },
          { label: "No Response", count: noRespCount,   color: "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-2 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Expandable categories */}
      <div className="space-y-1.5">
        {CATEGORIES.map(cat => (
          <CategoryDropdown key={cat.status} category={cat} players={categorized[cat.status] || []} />
        ))}
      </div>
    </div>
  );
}