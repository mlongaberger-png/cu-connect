import React, { useState, useEffect } from "react";
import { Download, Link, Calendar, X, Check, Smartphone, RefreshCw, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateICSContent, downloadICS } from "@/utils/calendarExport";
import { base44 } from "@/api/base44Client";

export default function CalendarExportPanel({ events, teams, myTeamIds, onClose }) {
  const [copied, setCopied] = useState(false);
  const [showInstructions, setShowInstructions] = useState(null); // "google" | "apple"
  const [token, setToken] = useState(null);
  const [generating, setGenerating] = useState(false);

  const visibleEvents = myTeamIds
    ? events.filter(e => myTeamIds.includes(e.team_id))
    : events;

  // Generate token on mount
  useEffect(() => {
    const gen = async () => {
      setGenerating(true);
      try {
        const res = await base44.functions.invoke('generateCalendarToken', { teams: myTeamIds || teams.map(t => t.id) });
        if (res.data?.token) setToken(res.data.token);
      } catch {}
      setGenerating(false);
    };
    gen();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const subscriptionUrl = token
    ? `${window.location.origin}/api/calendar/feed?token=${token}`
    : null;

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

  const handleAddToGoogle = () => {
    if (!subscriptionUrl) return;
    const webcalUrl = subscriptionUrl.replace(/^https?:\/\//, "webcal://");
    const googleUrl = `https://www.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;
    window.open(googleUrl, "_blank");
  };

  const copyUrl = async () => {
    if (!subscriptionUrl) return;
    await navigator.clipboard.writeText(subscriptionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddToApple = () => {
    if (!subscriptionUrl) return;
    const webcalUrl = subscriptionUrl.replace(/^https?:\/\//, "webcal://");
    window.location.href = webcalUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-6 space-y-5 max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Export & Sync Calendar</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* One-tap sync options */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Live Sync — Auto-updates when schedule changes</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleAddToGoogle}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface border border-border hover:border-primary/40 transition-all"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
              <span className="text-sm font-medium text-foreground">Google Calendar</span>
              <span className="text-xs text-muted-foreground text-center">Tap to subscribe & auto-sync</span>
            </button>
            <button
              onClick={handleAddToApple}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface border border-border hover:border-primary/40 transition-all"
            >
              <Smartphone className="w-6 h-6 text-foreground" />
              <span className="text-sm font-medium text-foreground">Apple Calendar</span>
              <span className="text-xs text-muted-foreground text-center">Tap to subscribe & auto-sync</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Subscribe once — new events and changes appear automatically. No manual updates needed.
          </p>
        </div>

        {/* Manual download */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">One-Time Download</p>
          <Button size="sm" variant="outline" className="border-border" onClick={handleDownloadAll}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download All Events (.ics)
          </Button>
          <p className="text-xs text-muted-foreground">
            Snapshot of current events. Won't update automatically when the schedule changes.
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

        {/* Subscription URL (advanced) */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Subscription URL (Advanced)</p>
          <p className="text-xs text-muted-foreground">Use this URL in any calendar app that supports webcal subscriptions (Outlook, etc).</p>
          {generating ? (
            <div className="flex items-center gap-2 px-3 py-3 bg-surface border border-border rounded-lg text-xs text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating secure token…
            </div>
          ) : !token ? (
            <div className="flex items-center gap-2 px-3 py-3 bg-surface border border-border rounded-lg text-xs text-muted-foreground">
              <Key className="w-3.5 h-3.5" /> Token unavailable — reload the panel.
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-muted-foreground truncate">
                {subscriptionUrl}
              </div>
              <Button size="sm" variant="outline" className="border-border flex-shrink-0" onClick={copyUrl}>
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Link className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}