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
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Upcoming Events</h3>
        <p className="text-muted-foreground text-sm text-center py-8">No upcoming events</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Upcoming Events</h3>
      <div className="space-y-3">
        {events.slice(0, 5).map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-4 p-3 rounded-xl bg-surface hover:bg-surface-hover transition-colors"
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