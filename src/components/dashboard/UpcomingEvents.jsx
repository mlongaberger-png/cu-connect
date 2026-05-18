import React from "react";
import { Calendar, MapPin, Clock } from "lucide-react";
import { formatDate, formatTime12h } from "@/utils/dateTime";
import { useOrgTimezone } from "@/lib/useOrgTimezone";

const typeColors = {
  practice: "bg-blue-500/20 text-blue-400",
  game: "bg-green-500/20 text-green-400",
  tournament: "bg-purple-500/20 text-purple-400",
  meeting: "bg-orange-500/20 text-orange-400",
  fundraiser: "bg-yellow-500/20 text-yellow-400",
  other: "bg-cyan-500/20 text-cyan-400",
};

export default function UpcomingEvents({ events }) {
  const { abbr } = useOrgTimezone();

  if (!events || events.length === 0) {
    return (
      <div className="relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl border border-border p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <h3 className="text-lg font-semibold text-foreground mb-4">Upcoming Events</h3>
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Calendar className="w-7 h-7 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No upcoming events</p>
          <p className="text-xs text-muted-foreground/60">Events will appear here when scheduled</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl border border-border p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <h3 className="text-lg font-semibold text-foreground mb-4">Upcoming Events</h3>
      <div className="space-y-3">
        {events.slice(0, 5).map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-4 p-3 rounded-xl bg-surface hover:bg-surface-hover active:scale-[0.99] transition-all duration-150"
          >
            <div className="flex flex-col items-center min-w-[48px]">
              <span className="text-xs text-muted-foreground">
                {event.date ? formatDate(event.date, "MMM") : ""}
              </span>
              <span className="text-xl font-bold text-foreground">
                {event.date ? formatDate(event.date, "dd") : "--"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[event.type] || typeColors.other}`}>
                  {event.type}
                </span>
                {event.is_cancelled && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Cancelled</span>
                )}
              </div>
              <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {event.start_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime12h(event.start_time)}
                    {abbr && <span className="text-muted-foreground/60 ml-0.5">{abbr}</span>}
                  </span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {event.location}
                  </span>
                )}
              </div>
              {event.team_name && (
                <p className="text-xs text-primary mt-1">{event.team_name}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}