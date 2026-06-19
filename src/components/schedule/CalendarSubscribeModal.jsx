import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Smartphone, Link, RefreshCw, Key } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";

export default function CalendarSubscribeModal({ open, onOpenChange, teams, myTeamIds = [] }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Pre-check the user's own teams, fall back to all teams
  const defaultSelected = myTeamIds.length > 0 ? myTeamIds : teams.map(t => t.id);
  const [selectedIds, setSelectedIds] = useState(defaultSelected);

  const toggleTeam = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const generateToken = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateCalendarToken', { teams: selectedIds });
      if (res.data?.token) {
        setToken(res.data.token);
        toast({ title: "Token ready", description: "Your calendar feed is now secured." });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate calendar token.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [selectedIds, toast]);

  // Auto-generate on open
  useEffect(() => {
    if (open) {
      generateToken();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const feedUrl = token
    ? `${appParams.appBaseUrl || window.location.origin}/api/apps/${appParams.appId}/functions/icsCalendarFeed?token=${token}`
    : null;
  const webcalUrl = feedUrl ? feedUrl.replace(/^https?:\/\//, "webcal://") : null;

  const handleCopy = async () => {
    if (!feedUrl) return;
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    toast({ title: "Copied!", description: "Paste into Google Calendar or Outlook → 'Subscribe by URL'." });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">📅 Subscribe to Schedule</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          Select the teams you want synced. Your calendar app will stay live-updated automatically.
        </p>

        {/* Team checkboxes */}
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {teams.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">No teams found.</p>
          )}
          {teams.map(t => (
            <label
              key={t.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer border border-border/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(t.id)}
                onChange={() => toggleTeam(t.id)}
                className="w-4 h-4 accent-primary"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                {t.sport_name && <p className="text-xs text-muted-foreground">{t.sport_name}</p>}
              </div>
            </label>
          ))}
        </div>

        {selectedIds.length === 0 && (
          <p className="text-xs text-destructive text-center">Select at least one team.</p>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-1">
          {generating ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating secure token…
            </div>
          ) : !token ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Key className="w-6 h-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">No calendar token. Regenerating…</p>
              <Button size="sm" variant="outline" className="border-border" onClick={generateToken}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Apple / iOS */}
              <Button
                className="w-full gap-2 bg-primary text-primary-foreground"
                disabled={selectedIds.length === 0}
                onClick={() => window.open(webcalUrl)}
              >
                <Smartphone className="w-4 h-4" />
                Sync to Apple / iOS Calendar
              </Button>

              {/* Copy link for Google / Outlook */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5" /> For Google Calendar or Outlook — paste this URL:
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={feedUrl}
                    className="flex-1 bg-surface border-border text-xs font-mono"
                    onFocus={e => e.target.select()}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-border gap-1.5"
                    onClick={handleCopy}
                    disabled={selectedIds.length === 0}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}