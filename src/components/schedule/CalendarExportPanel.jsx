import React, { useState } from "react";
import { Download, Link, Calendar, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateICSContent, downloadICS } from "@/utils/calendarExport";

export default function CalendarExportPanel({ events, teams, myTeamIds, onClose }) {
  const [copied, setCopied] = useState(false);

  const visibleEvents = myTeamIds
    ? events.filter(e => myTeamIds.includes(e.team_id))
    : events;

  const handleDownloadAll = () => {
    const ics = generateICSContent(visibleEvents);
    downloadICS(ics, "cornerstone_schedule.ics");
  };

  const handleDownloadTeam = (teamId) => {
    const teamEvents = events.filter(e => e.team_id === teamId);
    const team = teams.find(t => t.id === teamId);
    const ics = generateICSContent(teamEvents);
    downloadICS(ics, `${(team?.name || "team").replace(/\s+/g, "_")}_schedule.ics`);
  };

  const handleGoogleAll = () => {
    alert("For Google Calendar live sync, download the .ics file and import it via Google Calendar > Other Calendars > Import.");
  };

  const subscriptionUrl = `${window.location.origin}/api/functions/icsCalendarFeed`;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(subscriptionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Export & Sync Calendar</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Download All */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Download All Events</p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="border-border" onClick={handleDownloadAll}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download All (.ics)
            </Button>
            <Button size="sm" variant="outline" className="border-border" onClick={handleGoogleAll}>
              <Calendar className="w-3.5 h-3.5 mr-1.5" /> Add to Google Calendar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Works with Apple Calendar, Outlook, Google Calendar, and any app that supports .ics files.
          </p>
        </div>

        {/* Per-Team Downloads */}
        {myTeamIds && myTeamIds.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Download by Team</p>
            <div className="space-y-1.5">
              {teams.filter(t => myTeamIds.includes(t.id)).map(team => (
                <button
                  key={team.id}
                  onClick={() => handleDownloadTeam(team.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-surface border border-border hover:border-primary/30 transition-all text-left"
                >
                  <span className="text-sm text-foreground font-medium">{team.name}</span>
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <Download className="w-3.5 h-3.5" /> .ics
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live Subscription */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Live Subscription URL</p>
          <p className="text-xs text-muted-foreground">Subscribe with this URL for automatic updates when events change.</p>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-muted-foreground truncate">
              {subscriptionUrl}
            </div>
            <Button size="sm" variant="outline" className="border-border flex-shrink-0" onClick={copyUrl}>
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Link className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}