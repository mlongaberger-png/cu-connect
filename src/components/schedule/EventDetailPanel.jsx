import React from "react";
import { format } from "date-fns";
import { X, MapPin, Clock, Trophy, FileText, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateICSContent, downloadICS } from "@/utils/calendarExport";

const typeColors = {
  practice: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  game: "bg-green-500/20 text-green-400 border-green-500/30",
  tournament: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  meeting: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  fundraiser: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  other: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function EventDetailPanel({ event, onClose }) {
  if (!event) return null;

  const handleExportICS = () => {
    const ics = generateICSContent([event]);
    downloadICS(ics, `${event.title.replace(/\s+/g, "_")}.ics`);
  };

  const handleAddToGoogleCalendar = () => {
    const start = event.date?.replace(/-/g, "") + (event.start_time ? `T${event.start_time.replace(":", "")}00` : "");
    const end = event.date?.replace(/-/g, "") + (event.end_time ? `T${event.end_time.replace(":", "")}00` : (event.start_time ? `T${event.start_time.replace(":", "")}00` : ""));
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&location=${encodeURIComponent(event.location || "")}&details=${encodeURIComponent(event.notes || "")}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${typeColors[event.type] || ""}`}>
              {event.type}
            </span>
            {event.is_cancelled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Cancelled</span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground">{event.title}</h2>
          {event.opponent && <p className="text-sm text-muted-foreground mt-0.5">vs {event.opponent}</p>}
        </div>

        <div className="space-y-2 text-sm">
          {event.date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 text-primary" />
              <span>{format(new Date(event.date), "EEEE, MMMM d, yyyy")}</span>
            </div>
          )}
          {event.start_time && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 text-primary" />
              <span>{event.start_time}{event.end_time ? ` – ${event.end_time}` : ""}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              <span>{event.location}</span>
            </div>
          )}
          {event.team_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="w-4 h-4 text-primary" />
              <span>{event.team_name}{event.sport_name ? ` · ${event.sport_name}` : ""}</span>
            </div>
          )}
          {event.notes && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <FileText className="w-4 h-4 text-primary mt-0.5" />
              <span>{event.notes}</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Add to Calendar</p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="border-border text-sm" onClick={handleExportICS}>
              <Download className="w-3.5 h-3.5 mr-1" /> Download (.ics)
            </Button>
            <Button size="sm" variant="outline" className="border-border text-sm" onClick={handleAddToGoogleCalendar}>
              <Calendar className="w-3.5 h-3.5 mr-1" /> Google Calendar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}