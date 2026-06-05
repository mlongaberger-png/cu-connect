import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Download, Loader2, Pencil, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";

const GOLD = [180, 140, 60];
const DARK = [20, 20, 20];
const GRAY = [60, 60, 60];
const LIGHT = [120, 120, 120];

function drawHeader(doc, title, subtitle) {
  doc.setFillColor(...DARK);
  doc.rect(0, 0, 210, 28, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 28, 210, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("CU CONNECT", 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text("STATS REPORT", 14, 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 14, 24);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text(subtitle, 210 - 14, 24, { align: "right" });
  }
}

function drawStatTable(doc, y, title, color, rows) {
  const margin = 14;
  const colW = [32, 22];
  const rowH = 8;
  const tableW = 210 - margin * 2;

  // Section header
  doc.setFillColor(30, 30, 30);
  doc.rect(margin, y, tableW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...color);
  doc.text(title.toUpperCase(), margin + 3, y + 5.5);
  y += 8;

  // Stat cells in a grid (5 per row)
  const perRow = 5;
  const cellW = tableW / perRow;
  const cellH = 14;

  for (let i = 0; i < rows.length; i++) {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const cx = margin + col * cellW;
    const cy = y + row * cellH;

    doc.setFillColor(row % 2 === 0 ? 18 : 22, row % 2 === 0 ? 18 : 22, row % 2 === 0 ? 18 : 22);
    doc.rect(cx, cy, cellW, cellH, "F");
    doc.setDrawColor(35, 35, 35);
    doc.rect(cx, cy, cellW, cellH, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT);
    doc.text(rows[i].label, cx + cellW / 2, cy + 4.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(230, 230, 230);
    doc.text(rows[i].value ?? "—", cx + cellW / 2, cy + 11, { align: "center" });
  }

  const totalRows = Math.ceil(rows.length / perRow);
  return y + totalRows * cellH + 6;
}

function drawNotes(doc, y, notes) {
  if (!notes) return y;
  const margin = 14;
  const tableW = 210 - margin * 2;

  doc.setFillColor(25, 20, 10);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, tableW, 6, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.text("COACH / ADMIN NOTES", margin + 3, y + 4.2);
  y += 6;

  doc.setFillColor(18, 16, 10);
  doc.rect(margin, y, tableW, 1, "F");

  const lines = doc.splitTextToSize(notes, tableW - 6);
  const notesH = lines.length * 5 + 6;
  doc.setFillColor(15, 13, 8);
  doc.rect(margin, y, tableW, notesH, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(210, 210, 200);
  lines.forEach((line, i) => {
    doc.text(line, margin + 3, y + 5 + i * 5);
  });
  return y + notesH + 4;
}

function drawFooter(doc, pageNum, totalPages, generatedBy) {
  const y = 287;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...LIGHT);
  doc.text(`CU Connect · Generated ${new Date().toLocaleDateString()} · ${generatedBy || ""}`, 14, y + 4);
  doc.text(`Page ${pageNum} of ${totalPages}`, 196, y + 4, { align: "right" });
}

function generateTeamPDF({ team, players, allStats, notes, user }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;

  drawHeader(doc, `${team.name} — Team Stats Report`, team.sport_name || "");

  let y = 36;

  // Season label (from first stat)
  const seasonLabel = allStats[0]?.season_label || "";
  if (seasonLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...LIGHT);
    doc.text(`Season: ${seasonLabel}`, margin, y);
    y += 6;
  }

  // Optional team-level notes
  if (notes) {
    y = drawNotes(doc, y, notes);
    y += 2;
  }

  players.forEach((player, idx) => {
    const playerStats = allStats.filter(s => s.player_id === player.id);
    if (!playerStats.length) return;

    const hitting = playerStats.find(s => s.stat_type === "hitting");
    const pitching = playerStats.find(s => s.stat_type === "pitching");
    const fielding = playerStats.find(s => s.stat_type === "fielding");
    const playerNotes = playerStats.find(s => s.notes)?.notes;

    // Estimate height needed
    const sectionH = (hitting ? 30 : 0) + (pitching ? 22 : 0) + (fielding ? 22 : 0) + (playerNotes ? 24 : 0) + 20;
    if (y + sectionH > 270) {
      doc.addPage();
      drawHeader(doc, `${team.name} — Team Stats Report`, team.sport_name || "");
      y = 36;
    }

    // Player name bar
    doc.setFillColor(...GOLD);
    doc.rect(margin, y, 182, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(`${idx + 1}. ${player.first_name} ${player.last_name}`, margin + 3, y + 5);
    if (player.jersey_number) {
      doc.text(`#${player.jersey_number}`, 196, y + 5, { align: "right" });
    }
    y += 9;

    if (hitting) {
      y = drawStatTable(doc, y, "Hitting", [200, 170, 60], [
        { label: "AVG", value: hitting.hitting_avg },
        { label: "AB", value: hitting.hitting_ab },
        { label: "H", value: hitting.hitting_h },
        { label: "R", value: hitting.hitting_r },
        { label: "RBI", value: hitting.hitting_rbi },
        { label: "HR", value: hitting.hitting_hr },
        { label: "BB", value: hitting.hitting_bb },
        { label: "K", value: hitting.hitting_k },
        { label: "OBP", value: hitting.hitting_obp },
        { label: "SLG", value: hitting.hitting_slg },
      ]);
    }
    if (pitching) {
      y = drawStatTable(doc, y, "Pitching", [100, 150, 220], [
        { label: "ERA", value: pitching.pitching_era },
        { label: "IP", value: pitching.pitching_ip },
        { label: "W", value: pitching.pitching_w },
        { label: "L", value: pitching.pitching_l },
        { label: "SO", value: pitching.pitching_so },
        { label: "BB", value: pitching.pitching_bb },
        { label: "WHIP", value: pitching.pitching_whip },
      ]);
    }
    if (fielding) {
      y = drawStatTable(doc, y, "Fielding", [80, 180, 100], [
        { label: "PO", value: fielding.fielding_po },
        { label: "A", value: fielding.fielding_a },
        { label: "E", value: fielding.fielding_e },
        { label: "FPCT", value: fielding.fielding_fpct },
      ]);
    }
    if (playerNotes) {
      y = drawNotes(doc, y, playerNotes);
    }
    y += 4;
  });

  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total, user?.email || "");
  }

  doc.save(`${team.name.replace(/\s+/g, "_")}_Stats_Report.pdf`);
}

function generatePlayerPDF({ player, stats, notes, user }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const hitting = stats.find(s => s.stat_type === "hitting");
  const pitching = stats.find(s => s.stat_type === "pitching");
  const fielding = stats.find(s => s.stat_type === "fielding");
  const seasonLabel = stats[0]?.season_label || "";

  drawHeader(doc, `${player.first_name} ${player.last_name}`, `${player.team_name || ""} · ${seasonLabel}`);

  let y = 36;

  if (player.position || player.jersey_number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...LIGHT);
    const meta = [player.jersey_number ? `#${player.jersey_number}` : null, player.position].filter(Boolean).join(" · ");
    doc.text(meta, 14, y);
    y += 6;
  }

  if (notes) {
    y = drawNotes(doc, y, notes);
    y += 4;
  }

  if (hitting) {
    y = drawStatTable(doc, y, "Hitting", [200, 170, 60], [
      { label: "AVG", value: hitting.hitting_avg },
      { label: "AB", value: hitting.hitting_ab },
      { label: "H", value: hitting.hitting_h },
      { label: "R", value: hitting.hitting_r },
      { label: "RBI", value: hitting.hitting_rbi },
      { label: "HR", value: hitting.hitting_hr },
      { label: "BB", value: hitting.hitting_bb },
      { label: "K", value: hitting.hitting_k },
      { label: "OBP", value: hitting.hitting_obp },
      { label: "SLG", value: hitting.hitting_slg },
    ]);
  }
  if (pitching) {
    y = drawStatTable(doc, y, "Pitching", [100, 150, 220], [
      { label: "ERA", value: pitching.pitching_era },
      { label: "IP", value: pitching.pitching_ip },
      { label: "W", value: pitching.pitching_w },
      { label: "L", value: pitching.pitching_l },
      { label: "SO", value: pitching.pitching_so },
      { label: "BB", value: pitching.pitching_bb },
      { label: "WHIP", value: pitching.pitching_whip },
    ]);
  }
  if (fielding) {
    y = drawStatTable(doc, y, "Fielding", [80, 180, 100], [
      { label: "PO", value: fielding.fielding_po },
      { label: "A", value: fielding.fielding_a },
      { label: "E", value: fielding.fielding_e },
      { label: "FPCT", value: fielding.fielding_fpct },
    ]);
  }

  drawFooter(doc, 1, 1, user?.email || "");
  doc.save(`${player.first_name}_${player.last_name}_Stats_Report.pdf`);
}

// ─── Main Modal ─────────────────────────────────────────────────────────────

export default function StatsReportExporter({ open, onOpenChange, mode, player, team }) {
  // mode: "player" | "team"
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    enabled: open,
  });

  // Player mode: load stats for this player
  const { data: playerStats = [] } = useQuery({
    queryKey: ["playerStats", player?.id],
    queryFn: () => base44.entities.PlayerStats.filter({ player_id: player.id }),
    enabled: open && mode === "player" && !!player?.id,
  });

  // Team mode: load all stats + players for this team
  const { data: teamStats = [] } = useQuery({
    queryKey: ["playerStats-team", team?.id],
    queryFn: () => base44.entities.PlayerStats.filter({ team_id: team.id }),
    enabled: open && mode === "team" && !!team?.id,
  });

  const { data: teamPlayers = [] } = useQuery({
    queryKey: ["players-team", team?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: team.id, is_active: true }),
    enabled: open && mode === "team" && !!team?.id,
  });

  // Pre-fill notes from existing stat record
  const existingNotes = mode === "player"
    ? (playerStats.find(s => s.notes)?.notes || "")
    : (teamStats.find(s => s.notes)?.notes || "");

  const handleOpen = () => {
    setNotes(existingNotes);
    setNotesSaved(false);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    const statsToUpdate = mode === "player" ? playerStats : teamStats;
    // Save notes on the first stat record found
    if (statsToUpdate.length > 0) {
      await base44.entities.PlayerStats.update(statsToUpdate[0].id, { notes });
      queryClient.invalidateQueries({ queryKey: ["playerStats-all"] });
    }
    setSavingNotes(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const handleExport = async () => {
    setGenerating(true);
    try {
      if (mode === "player") {
        generatePlayerPDF({ player, stats: playerStats, notes, user });
      } else {
        // Sort players by last name, filter only those with stats
        const playersWithStats = teamPlayers
          .filter(p => teamStats.some(s => s.player_id === p.id))
          .sort((a, b) => a.last_name.localeCompare(b.last_name));
        generateTeamPDF({ team, players: playersWithStats, allStats: teamStats, notes, user });
      }
    } finally {
      setGenerating(false);
    }
  };

  const statsCount = mode === "player" ? playerStats.length : teamStats.length;
  const hasStats = statsCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="w-4 h-4 text-primary" />
            Export Stats Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target info */}
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {mode === "player" ? "Player" : "Team"}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {mode === "player"
                ? `${player?.first_name} ${player?.last_name}`
                : team?.name}
            </p>
            {mode === "player" && player?.team_name && (
              <p className="text-xs text-muted-foreground mt-0.5">{player.team_name}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {hasStats
                ? `${statsCount} stat record${statsCount !== 1 ? "s" : ""} on file`
                : "No stats on file yet"}
            </p>
          </div>

          {/* Notes / Commentary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Pencil className="w-3 h-3 text-primary" />
                Coach / Admin Notes
              </Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveNotes}
                disabled={savingNotes || !hasStats}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : notesSaved ? <Check className="w-3 h-3 text-green-400" /> : null}
                {notesSaved ? "Saved!" : "Save Notes"}
              </Button>
            </div>
            <Textarea
              placeholder="Add commentary, game recap, coaching notes, or observations to include in the PDF report…"
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesSaved(false); }}
              className="min-h-[100px] bg-surface border-border text-sm resize-none"
              disabled={!hasStats}
            />
            <p className="text-xs text-muted-foreground">
              Notes are saved to the stat record and printed in the PDF report.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={!hasStats || generating}
              className="gap-2"
            >
              {generating
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />}
              {generating ? "Generating…" : "Download PDF"}
            </Button>
          </div>

          {!hasStats && (
            <p className="text-xs text-center text-muted-foreground border border-border rounded-lg p-3 bg-surface">
              Upload stats first before exporting a report.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}