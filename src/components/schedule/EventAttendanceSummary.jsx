import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, HelpCircle, Users, ChevronDown, ChevronRight } from "lucide-react";

const CATEGORIES = [
  { status: "attending",     label: "Going",       icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
  { status: "not_attending", label: "Not Going",   icon: XCircle,      color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
  { status: "maybe",         label: "Maybe",       icon: HelpCircle,   color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  { status: "no_response",   label: "No Response", icon: Users,        color: "text-muted-foreground", bg: "bg-surface", border: "border-border" },
];

export default function EventAttendanceSummary({ event }) {
  const [expanded, setExpanded] = useState({});

  const { data: attendanceRequests = [] } = useQuery({
    queryKey: ["attendance-requests-event-staff", event?.id],
    queryFn: () => base44.entities.AttendanceRequest.filter({ event_id: event.id }),
    enabled: !!event?.id,
    refetchInterval: 10000,
  });
  const req = attendanceRequests[0] || null;

  const { data: responses = [] } = useQuery({
    queryKey: ["attendance-responses-event-staff", req?.id],
    queryFn: () => base44.entities.AttendanceResponse.filter({ attendance_request_id: req.id }),
    enabled: !!req?.id,
    refetchInterval: 10000,
  });

  if (!req) return null;

  const byStatus = {
    attending:     responses.filter(r => r.status === "attending"),
    not_attending: responses.filter(r => r.status === "not_attending"),
    maybe:         responses.filter(r => r.status === "maybe"),
  };

  const respondedPlayerIds = new Set(responses.map(r => r.player_id).filter(Boolean));
  // No-response count isn't directly computable without roster; show responded totals
  const total = responses.length;

  const toggle = (status) => setExpanded(prev => ({ ...prev, [status]: !prev[status] }));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-primary" /> Attendance RSVP
      </p>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.slice(0, 3).map(cat => (
          <div key={cat.status} className={`rounded-xl px-3 py-2 text-center border ${cat.bg} ${cat.border}`}>
            <p className={`text-lg font-bold ${cat.color}`}>{byStatus[cat.status]?.length ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">{cat.label}</p>
          </div>
        ))}
      </div>

      {/* Expandable category lists */}
      <div className="space-y-1">
        {CATEGORIES.slice(0, 3).map(cat => {
          const list = byStatus[cat.status] || [];
          const Icon = cat.icon;
          const isOpen = expanded[cat.status];
          return (
            <div key={cat.status} className={`rounded-xl border overflow-hidden ${cat.border}`}>
              <button
                onClick={() => toggle(cat.status)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                  <span className={`text-sm font-medium ${cat.color}`}>{cat.label}</span>
                  <span className="text-xs text-muted-foreground">({list.length})</span>
                </div>
                {isOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                }
              </button>

              {isOpen && (
                <div className="border-t border-border px-3 py-2 max-h-40 overflow-y-auto">
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">No responses yet</p>
                  ) : (
                    <ul className="space-y-1">
                      {list.map((r, i) => (
                        <li key={r.id || i} className="flex items-center gap-2 text-sm text-foreground/80 py-0.5">
                          <div className="w-5 h-5 rounded-full bg-surface flex items-center justify-center text-[9px] font-bold text-muted-foreground flex-shrink-0">
                            {(r.player_name || r.responder_email || "?")[0].toUpperCase()}
                          </div>
                          <span className="truncate">{r.player_name || r.responder_email}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}