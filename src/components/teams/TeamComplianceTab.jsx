import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, CheckCircle2, Clock, Send, ExternalLink, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DOC_CATEGORIES = [
  { key: "birth_certificate", label: "Birth Certificates" },
  { key: "physical",          label: "Physical Forms" },
  { key: "consent_form",      label: "Code of Conduct / Consent" },
  { key: "insurance",         label: "Insurance Cards" },
  { key: "waiver",            label: "Waivers" },
  { key: "medical",           label: "Medical Forms" },
  { key: "other",             label: "Other Documents" },
];

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function cooldownKey(teamId, docType) {
  return `doc_reminder_${teamId}_${docType}`;
}

function getLastSent(teamId, docType) {
  try {
    const val = localStorage.getItem(cooldownKey(teamId, docType));
    return val ? parseInt(val, 10) : null;
  } catch { return null; }
}

function markSent(teamId, docType) {
  try { localStorage.setItem(cooldownKey(teamId, docType), String(Date.now())); } catch {}
}

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Athlete doc viewer dialog ─────────────────────────────────────────────
function AthleteDocsViewer({ player, docs, open, onClose }) {
  if (!player) return null;
  const playerDocs = docs.filter(d => d.player_id === player.id);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            {player.first_name} {player.last_name} — Documents
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {playerDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded for this athlete.</p>
          ) : (
            playerDocs.map(doc => {
              const cat = DOC_CATEGORIES.find(c => c.key === doc.doc_type);
              return (
                <a
                  key={doc.id}
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border hover:border-primary/40 transition-colors group"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{cat?.label || doc.doc_type}</p>
                    <p className="text-xs text-muted-foreground truncate">{doc.file_name || "View file"}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </a>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category row ──────────────────────────────────────────────────────────
function CategoryRow({ category, players, docs, teamId, teamName, coachName }) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentNow, setSentNow] = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [, forceUpdate] = useState(0);

  const playerDocs = docs.filter(d => d.doc_type === category.key);
  const uploadedPlayerIds = new Set(playerDocs.map(d => d.player_id));
  const missing = players.filter(p => !uploadedPlayerIds.has(p.id));
  const received = players.filter(p => uploadedPlayerIds.has(p.id));
  const total = players.length;
  const receivedCount = received.length;
  const allDone = missing.length === 0;

  const lastSent = getLastSent(teamId, category.key);
  const onCooldown = lastSent && (Date.now() - lastSent) < COOLDOWN_MS;

  const handleRemind = async () => {
    if (onCooldown || sending || missing.length === 0) return;
    setSending(true);
    const parentEmails = [...new Set(missing.map(p => p.parent_email).filter(Boolean))];
    const missingNames = missing.map(p => `${p.first_name} ${p.last_name}`).join(", ");
    await base44.functions.invoke("sendDocumentReminder", {
      parent_emails: parentEmails,
      doc_type_label: category.label,
      team_name: teamName,
      coach_name: coachName,
      missing_player_names: missingNames,
    });
    markSent(teamId, category.key);
    setSending(false);
    setSentNow(true);
    forceUpdate(n => n + 1);
    setTimeout(() => setSentNow(false), 4000);
  };

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card">
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface transition-colors"
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allDone ? "bg-green-400" : "bg-yellow-400"}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">{category.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {receivedCount} / {total} received
            {lastSent && (
              <span className="ml-2 text-primary/60">· Reminded {timeAgo(lastSent)}</span>
            )}
          </p>
        </div>
        {/* Progress bar */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0 w-28">
          <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allDone ? "bg-green-400" : "bg-yellow-400"}`}
              style={{ width: `${total > 0 ? (receivedCount / total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground w-8 text-right">
            {total > 0 ? Math.round((receivedCount / total) * 100) : 0}%
          </span>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Athlete list */}
          <div className="divide-y divide-border">
            {players.map(p => {
              const hasDoc = uploadedPlayerIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => hasDoc ? setViewingPlayer(p) : null}
                  disabled={!hasDoc}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${hasDoc ? "hover:bg-surface cursor-pointer" : "cursor-default"}`}
                >
                  <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary">{p.first_name?.[0]}{p.last_name?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{p.first_name} {p.last_name}</p>
                    {p.parent_name && <p className="text-xs text-muted-foreground">{p.parent_name}</p>}
                  </div>
                  {hasDoc ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-green-400">Uploaded</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground ml-1" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-yellow-400">Missing</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Reminder action */}
          <div className="px-4 py-3 border-t border-border bg-surface/50 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {missing.length === 0
                ? "✅ All athletes are compliant"
                : `${missing.length} athlete${missing.length !== 1 ? "s" : ""} missing this document`}
            </div>
            {missing.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={onCooldown || sending || sentNow}
                onClick={handleRemind}
                className={`flex-shrink-0 gap-1.5 text-xs h-8 border-border transition-all ${
                  sentNow ? "text-green-400 border-green-500/40" : onCooldown ? "opacity-50" : "text-primary border-primary/40 hover:bg-primary/10"
                }`}
              >
                {sentNow ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Sent!</>
                ) : onCooldown ? (
                  <><Bell className="w-3.5 h-3.5" /> Reminded {timeAgo(lastSent)}</>
                ) : (
                  <><Send className="w-3.5 h-3.5" /> Send Reminder</>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Athlete doc viewer */}
      <AthleteDocsViewer
        player={viewingPlayer}
        docs={docs}
        open={!!viewingPlayer}
        onClose={() => setViewingPlayer(null)}
      />
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────
export default function TeamComplianceTab({ team, players }) {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["player-docs-team", team.id],
    queryFn: async () => {
      const all = await Promise.all(
        players.map(p => base44.entities.PlayerDocument.filter({ player_id: p.id }))
      );
      return all.flat();
    },
    enabled: players.length > 0,
  });

  // Only show categories that exist in the system doc types (exclude "other" only if empty)
  const categoriesToShow = DOC_CATEGORIES.filter(c => {
    if (c.key === "other") return docs.some(d => d.doc_type === "other");
    return true;
  });

  const totalPlayers = players.length;
  const fullyCompliantCount = players.filter(p =>
    ["birth_certificate", "physical"].every(k =>
      docs.some(d => d.player_id === p.id && d.doc_type === k)
    )
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className={`rounded-2xl border p-4 flex items-center gap-4 ${
        fullyCompliantCount === totalPlayers && totalPlayers > 0
          ? "bg-green-500/10 border-green-500/30"
          : "bg-yellow-500/10 border-yellow-500/30"
      }`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          fullyCompliantCount === totalPlayers && totalPlayers > 0 ? "bg-green-500/20" : "bg-yellow-500/20"
        }`}>
          {fullyCompliantCount === totalPlayers && totalPlayers > 0
            ? <CheckCircle2 className="w-5 h-5 text-green-400" />
            : <Clock className="w-5 h-5 text-yellow-400" />
          }
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">
            {fullyCompliantCount === totalPlayers && totalPlayers > 0
              ? "Team is fully compliant"
              : `${fullyCompliantCount} of ${totalPlayers} athletes fully compliant`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Based on Birth Certificate + Physical Form</p>
        </div>
      </div>

      {/* Category rows */}
      {totalPlayers === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No players on this roster yet.</div>
      ) : (
        <div className="space-y-3">
          {categoriesToShow.map(cat => (
            <CategoryRow
              key={cat.key}
              category={cat}
              players={players}
              docs={docs}
              teamId={team.id}
              teamName={team.name}
              coachName={team.head_coach || "Your Coach"}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center px-4">
        Documents are uploaded by parents. Coaches can view but not edit or delete files.
        Reminders are limited to once every 24 hours per document type.
      </p>
    </div>
  );
}