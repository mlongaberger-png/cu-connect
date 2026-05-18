import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin, CheckCircle2, XCircle, HelpCircle, Lock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { formatTime12h } from "@/utils/dateTime";
import CarpoolHub from "./CarpoolHub";

const RSVP_OPTIONS = [
  { status: "attending",     Icon: CheckCircle2, label: "Going",     cls: "bg-green-500/20 border-green-500/50 text-green-400" },
  { status: "not_attending", Icon: XCircle,      label: "Not Going", cls: "bg-red-500/20 border-red-500/50 text-red-400" },
  { status: "maybe",         Icon: HelpCircle,   label: "Maybe",     cls: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400" },
];

export default function EventMessageCard({ attendanceRequestId, currentUser, isStaff }) {
  const queryClient = useQueryClient();
  const [changing, setChanging] = useState(false);

  const { data: request } = useQuery({
    queryKey: ["attendance-request", attendanceRequestId],
    queryFn: () => base44.entities.AttendanceRequest.filter({ id: attendanceRequestId }).then(r => r[0]),
    enabled: !!attendanceRequestId,
  });

  // Only poll while the card is mounted and has a valid, stable attendanceRequestId.
  // Using the id itself as a refetchInterval guard — falsy id = no polling.
  const { data: responses = [] } = useQuery({
    queryKey: ["attendance-responses", attendanceRequestId],
    queryFn: () => base44.entities.AttendanceResponse.filter({ attendance_request_id: attendanceRequestId }),
    enabled: !!attendanceRequestId,
    refetchInterval: attendanceRequestId ? 30000 : false,
    // Only re-render if the actual response set changed (length or status fingerprint)
    select: (data) => data,
    structuralSharing: true,
  });

  const myResponse = responses.find(r => r.responder_email === currentUser?.email);
  const selected = RSVP_OPTIONS.find(o => o.status === myResponse?.status);

  const upsertMutation = useMutation({
    mutationFn: async (status) => {
      if (myResponse) {
        return base44.entities.AttendanceResponse.update(myResponse.id, { status });
      }
      return base44.entities.AttendanceResponse.create({
        attendance_request_id: attendanceRequestId,
        player_id: "",
        player_name: currentUser?.full_name || currentUser?.email || "",
        team_id: request?.team_id || "",
        responder_email: currentUser?.email || "",
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-responses", attendanceRequestId] });
      setChanging(false);
    },
  });

  if (!request) return null;

  const isLocked = request.is_locked;

  // Staff: show aggregate counts
  const attending = responses.filter(r => r.status === "attending").length;
  const notAttending = responses.filter(r => r.status === "not_attending").length;
  const maybe = responses.filter(r => r.status === "maybe").length;

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden max-w-sm">
      {/* Event header */}
      <div className="px-4 py-3 bg-primary/10 border-b border-primary/20">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm font-bold text-foreground truncate">{request.label}</span>
          </div>
          {request.event_date && (
            <span className="text-xs text-primary font-semibold whitespace-nowrap">
              {format(new Date(request.event_date + "T12:00:00"), "MMM d")}
            </span>
          )}
        </div>

        {/* Meta details */}
        <div className="mt-2 space-y-1 pl-6">
          {request.event_time && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{formatTime12h(request.event_time)}</span>
            </div>
          )}
          {request.location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{request.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* RSVP area */}
      <div className="px-4 py-3">
        {isLocked ? (
          <p className="text-xs text-yellow-400 flex items-center gap-1.5">
            <Lock className="w-3 h-3" /> RSVP closed
          </p>
        ) : isStaff ? (
          /* Staff: show counts */
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="w-3.5 h-3.5" /> {attending} Going</span>
            <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3.5 h-3.5" /> {notAttending} No</span>
            <span className="flex items-center gap-1 text-yellow-400"><HelpCircle className="w-3.5 h-3.5" /> {maybe} Maybe</span>
          </div>
        ) : (
          /* Parent: RSVP controls */
          <>
            {selected && !changing ? (
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${selected.cls}`}>
                  <selected.Icon className="w-3 h-3" /> {selected.label}
                </span>
                <button
                  onClick={() => setChanging(true)}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                {RSVP_OPTIONS.map(({ status, Icon, label, cls }) => (
                  <button
                    key={status}
                    disabled={upsertMutation.isPending}
                    onClick={() => upsertMutation.mutate(status)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all
                      ${myResponse?.status === status ? cls : "bg-surface border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <CarpoolHub
        eventId={request.event_id || attendanceRequestId}
        eventTitle={request.label}
        eventDate={request.event_date}
        eventTime={request.event_time}
        teamId={request.team_id}
        teamName={request.channel_name || ""}
        currentUser={currentUser}
      />
    </div>
  );
}