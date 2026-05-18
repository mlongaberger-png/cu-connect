import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, XCircle, ExternalLink, Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MATRIX_DOCS = [
  { key: "birth_certificate", label: "Birth Cert." },
  { key: "physical",          label: "Physical" },
  { key: "consent_form",      label: "Code of Conduct" },
];

const COOLDOWN_KEY = "compliance_matrix_bulk_reminder";
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Cell: green check (clickable) or red X
function MatrixCell({ doc, playerName }) {
  if (doc) {
    return (
      <a
        href={doc.file_url}
        target="_blank"
        rel="noreferrer"
        title={`View ${doc.file_name || "document"} for ${playerName}`}
        className="flex items-center justify-center gap-1 group"
        onClick={e => e.stopPropagation()}
      >
        <CheckCircle2 className="w-5 h-5 text-green-400 group-hover:text-green-300 transition-colors" />
        <ExternalLink className="w-3 h-3 text-green-400/50 group-hover:text-green-300 transition-colors hidden sm:block" />
      </a>
    );
  }
  return (
    <span className="flex items-center justify-center" title="Missing">
      <XCircle className="w-5 h-5 text-red-400" />
    </span>
  );
}

export default function ComplianceMatrix({ team, players, docs }) {
  const [sending, setSending] = useState(false);
  const [sentNow, setSentNow] = useState(false);
  const [viewingDocs, setViewingDocs] = useState(null); // { player, docKey }

  const lastSent = (() => {
    try { const v = localStorage.getItem(COOLDOWN_KEY + "_" + team.id); return v ? parseInt(v, 10) : null; } catch { return null; }
  })();
  const onCooldown = lastSent && (Date.now() - lastSent) < COOLDOWN_MS;

  // Build lookup: playerid -> docKey -> doc
  const docMap = {};
  for (const d of docs) {
    if (!docMap[d.player_id]) docMap[d.player_id] = {};
    if (!docMap[d.player_id][d.doc_type]) {
      docMap[d.player_id][d.doc_type] = d;
    }
  }

  // Players with at least one missing mandatory doc
  const playersWithMissing = players.filter(p =>
    MATRIX_DOCS.some(m => !docMap[p.id]?.[m.key])
  );

  const handleBulkRemind = async () => {
    if (onCooldown || sending || playersWithMissing.length === 0) return;
    setSending(true);

    // Group missing docs per player so we can build a useful message
    const emailSet = new Set();
    const missingByPlayer = {};
    for (const p of playersWithMissing) {
      if (!p.parent_email) continue;
      emailSet.add(p.parent_email);
      const missing = MATRIX_DOCS.filter(m => !docMap[p.id]?.[m.key]).map(m => m.label);
      missingByPlayer[`${p.first_name} ${p.last_name}`] = missing;
    }

    const missingLines = Object.entries(missingByPlayer)
      .map(([name, types]) => `• ${name}: ${types.join(", ")}`)
      .join("\n");

    await base44.functions.invoke("sendDocumentReminder", {
      parent_emails: [...emailSet],
      doc_type_label: "Required Compliance Documents (Birth Certificate, Physical, Code of Conduct)",
      team_name: team.name,
      coach_name: team.head_coach || "Your Coach",
      missing_player_names: missingLines,
    });

    try { localStorage.setItem(COOLDOWN_KEY + "_" + team.id, String(Date.now())); } catch {}
    setSending(false);
    setSentNow(true);
    setTimeout(() => setSentNow(false), 4000);
  };

  // For the inline doc viewer on cell click (green cells)
  const viewDocs = viewingDocs;

  const totalSlots = players.length * MATRIX_DOCS.length;
  const filledSlots = players.reduce((sum, p) =>
    sum + MATRIX_DOCS.filter(m => !!docMap[p.id]?.[m.key]).length, 0
  );
  const pct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Top bar: summary + bulk button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {filledSlots} / {totalSlots} documents received
            <span className="ml-2 text-muted-foreground font-normal">({pct}%)</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {playersWithMissing.length === 0
              ? "✅ All athletes fully compliant"
              : `${playersWithMissing.length} athlete${playersWithMissing.length !== 1 ? "s" : ""} missing at least one document`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={onCooldown || sending || playersWithMissing.length === 0}
          onClick={handleBulkRemind}
          className={`gap-1.5 text-xs h-9 border-border transition-all ${
            sentNow
              ? "text-green-400 border-green-500/40"
              : onCooldown
              ? "opacity-50"
              : "text-primary border-primary/40 hover:bg-primary/10"
          }`}
        >
          {sending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
          ) : sentNow ? (
            <><CheckCircle2 className="w-3.5 h-3.5" /> Reminders Sent!</>
          ) : onCooldown ? (
            <><Bell className="w-3.5 h-3.5" /> Reminded {timeAgo(lastSent)}</>
          ) : (
            <>📢 Send Missing Doc Reminders</>
          )}
        </Button>
      </div>

      {/* Matrix table */}
      {players.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No players on this roster yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-3 font-semibold text-foreground w-48 min-w-[160px]">Athlete</th>
                {MATRIX_DOCS.map(m => (
                  <th key={m.key} className="px-3 py-3 font-semibold text-foreground text-center min-w-[110px]">
                    {m.label}
                  </th>
                ))}
                <th className="px-3 py-3 font-semibold text-muted-foreground text-center w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => {
                const missingCount = MATRIX_DOCS.filter(m => !docMap[p.id]?.[m.key]).length;
                const fullyCompliant = missingCount === 0;
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-border last:border-0 transition-colors ${
                      idx % 2 === 0 ? "bg-card" : "bg-surface/30"
                    } hover:bg-surface`}
                  >
                    {/* Athlete name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {p.photo_url
                            ? <img src={p.photo_url} alt={p.first_name} className="w-full h-full object-cover" />
                            : <span className="text-[10px] font-bold text-primary">{p.first_name?.[0]}{p.last_name?.[0]}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{p.first_name} {p.last_name}</p>
                          {p.parent_name && <p className="text-[11px] text-muted-foreground truncate">{p.parent_name}</p>}
                        </div>
                      </div>
                    </td>

                    {/* Doc cells */}
                    {MATRIX_DOCS.map(m => (
                      <td key={m.key} className="px-3 py-3 text-center">
                        <MatrixCell
                          doc={docMap[p.id]?.[m.key]}
                          playerName={`${p.first_name} ${p.last_name}`}
                        />
                      </td>
                    ))}

                    {/* Overall status badge */}
                    <td className="px-3 py-3 text-center">
                      {fullyCompliant ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                          ✓ OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
                          {missingCount} missing
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        Click ✓ cells to view / download the uploaded file. Bulk reminders limited to once every 24 hours.
      </p>
    </div>
  );
}