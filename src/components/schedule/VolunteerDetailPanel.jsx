import React from "react";
import { X, Clock, MapPin, Users, FileText, HandHeart } from "lucide-react";
import { formatDate, formatTime12h } from "@/utils/dateTime";

export default function VolunteerDetailPanel({ entry, onClose }) {
  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <HandHeart className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-teal-400 uppercase tracking-wider">Volunteer Duty</p>
              <h2 className="text-lg font-bold text-foreground">{entry.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 bg-surface rounded-xl p-4">
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-foreground font-medium">{formatDate(entry.date, "EEEE, MMMM d, yyyy")}</p>
              {(entry.start_time || entry.end_time) && (
                <p className="text-muted-foreground text-xs">
                  {entry.start_time ? formatTime12h(entry.start_time) : ""}
                  {entry.end_time ? ` – ${formatTime12h(entry.end_time)}` : ""}
                </p>
              )}
            </div>
          </div>

          {entry.team_name && (
            <div className="flex items-center gap-3 text-sm">
              <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{entry.team_name}</span>
            </div>
          )}

          {entry.location && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{entry.location}</span>
            </div>
          )}

          {entry.notes && (
            <div className="flex items-start gap-3 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{entry.notes}</span>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-surface text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border border-border"
        >
          Close
        </button>
      </div>
    </div>
  );
}