import { jsPDF } from "jspdf";
import { format } from "date-fns";

function addSectionHeader(doc, text, y) {
  doc.setFillColor(184, 145, 74); // gold
  doc.rect(14, y, 182, 6, "F");
  doc.setFontSize(8);
  doc.setTextColor(10, 10, 10);
  doc.setFont("helvetica", "bold");
  doc.text(text.toUpperCase(), 16, y + 4.2);
  doc.setTextColor(220, 210, 190);
  return y + 10;
}

function addRow(doc, label, value, y, x1 = 14, x2 = 60) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(150, 140, 120);
  doc.text(label, x1, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(220, 210, 190);
  doc.text(String(value || "—"), x2, y);
  return y + 6;
}

function formatDate(d) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}

function formatTime(t) {
  if (!t) return "";
  try {
    const [h, m] = t.split(":");
    const date = new Date();
    date.setHours(parseInt(h), parseInt(m));
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return t; }
}

export async function generatePlayerSummaryPDF({ player, team, sport, events = [], playerStats = [] }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Background
  doc.setFillColor(18, 18, 18);
  doc.rect(0, 0, pageW, pageH, "F");

  // Top gold bar
  doc.setFillColor(184, 145, 74);
  doc.rect(0, 0, pageW, 2.5, "F");

  // Header block
  doc.setFillColor(28, 28, 28);
  doc.rect(0, 2.5, pageW, 38, "F");

  // Logo placeholder circle
  doc.setFillColor(184, 145, 74);
  doc.circle(pageW - 22, 18, 8, "F");
  doc.setFontSize(6);
  doc.setTextColor(10, 10, 10);
  doc.setFont("helvetica", "bold");
  doc.text("CU", pageW - 25, 18.5);

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(184, 145, 74);
  doc.text("PLAYER SEASON SUMMARY", 14, 16);

  doc.setFontSize(9);
  doc.setTextColor(160, 150, 130);
  doc.setFont("helvetica", "normal");
  doc.text("Cornerstone United Athletics", 14, 22);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(230, 220, 200);
  const fullName = `${player.first_name || ""} ${player.last_name || ""}`.trim();
  doc.text(fullName, 14, 33);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 110, 90);
  doc.text(`Generated ${format(new Date(), "MMMM d, yyyy")}`, 14, 38.5);

  let y = 50;

  // ── Player Info ──
  y = addSectionHeader(doc, "Player Information", y);
  y = addRow(doc, "Full Name", fullName, y);
  y = addRow(doc, "Jersey #", player.jersey_number || "—", y);
  y = addRow(doc, "Position", player.position || "—", y);
  if (player.date_of_birth) y = addRow(doc, "Date of Birth", formatDate(player.date_of_birth), y);
  y += 4;

  // ── Team Info ──
  if (team) {
    y = addSectionHeader(doc, "Team & Season", y);
    y = addRow(doc, "Team", team.name || "—", y);
    y = addRow(doc, "Sport", sport?.name || team.sport_name || "—", y);
    y = addRow(doc, "Division", team.age_group || "—", y);
    y = addRow(doc, "Season", team.season ? `${team.season.charAt(0).toUpperCase() + team.season.slice(1)} ${team.year || ""}`.trim() : "—", y);
    if (team.head_coach) y = addRow(doc, "Head Coach", team.head_coach, y);
    if (team.practice_location) y = addRow(doc, "Practice Location", team.practice_location, y);
    if (team.practice_schedule) y = addRow(doc, "Practice Schedule", team.practice_schedule, y);
    y += 4;
  }

  // ── Contact Info ──
  y = addSectionHeader(doc, "Contact Information", y);
  y = addRow(doc, "Parent/Guardian", player.parent_name || "—", y);
  y = addRow(doc, "Parent Email", player.parent_email || "—", y);
  if (player.parent_phone) y = addRow(doc, "Parent Phone", player.parent_phone, y);
  if (player.emergency_contact) y = addRow(doc, "Emergency Contact", player.emergency_contact, y);
  if (player.emergency_phone) y = addRow(doc, "Emergency Phone", player.emergency_phone, y);
  if (player.medical_notes) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(150, 140, 120);
    doc.text("Medical Notes", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(220, 80, 80);
    const lines = doc.splitTextToSize(player.medical_notes, 120);
    doc.text(lines, 60, y);
    y += lines.length * 5 + 2;
  }
  y += 4;

  // ── Season Record ──
  const teamEvents = events.filter(e => e.team_id === player.team_id);
  const resultEvents = teamEvents.filter(e => e.result);
  const wins = resultEvents.filter(e => e.result === "win").length;
  const losses = resultEvents.filter(e => e.result === "loss").length;
  const draws = resultEvents.filter(e => e.result === "draw").length;
  const championships = teamEvents.filter(e => e.is_championship_win).length;
  const winPct = resultEvents.length > 0 ? Math.round((wins / resultEvents.length) * 100) : null;

  if (resultEvents.length > 0) {
    y = addSectionHeader(doc, "Season Record", y);
    const cols = [
      { label: "Wins", value: wins, color: [80, 200, 100] },
      { label: "Losses", value: losses, color: [220, 80, 80] },
      ...(draws > 0 ? [{ label: "Draws", value: draws, color: [200, 180, 80] }] : []),
      ...(winPct !== null ? [{ label: "Win %", value: `${winPct}%`, color: [184, 145, 74] }] : []),
      ...(championships > 0 ? [{ label: "Champs", value: `${championships} 🏆`, color: [184, 145, 74] }] : []),
    ];
    const boxW = 30;
    cols.forEach((col, i) => {
      const bx = 14 + i * (boxW + 4);
      doc.setFillColor(30, 30, 30);
      doc.roundedRect(bx, y, boxW, 18, 2, 2, "F");
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...col.color);
      doc.text(String(col.value), bx + boxW / 2, y + 10, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 110, 90);
      doc.text(col.label.toUpperCase(), bx + boxW / 2, y + 15, { align: "center" });
    });
    y += 26;
  }

  // ── Recent Results ──
  const recentResults = [...resultEvents]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  if (recentResults.length > 0) {
    y = addSectionHeader(doc, "Recent Results", y);
    recentResults.forEach(evt => {
      if (y > pageH - 30) { doc.addPage(); doc.setFillColor(18, 18, 18); doc.rect(0, 0, pageW, pageH, "F"); y = 14; }
      doc.setFillColor(30, 30, 30);
      doc.roundedRect(14, y, 182, 10, 1.5, 1.5, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 210, 190);
      doc.text(evt.title || "Event", 18, y + 6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 110, 90);
      doc.text(formatDate(evt.date), 100, y + 6.5);
      if (evt.our_score !== undefined && evt.opponent_score !== undefined) {
        doc.setTextColor(184, 145, 74);
        doc.text(`${evt.our_score ?? "?"} – ${evt.opponent_score ?? "?"}`, 145, y + 6.5);
      }
      const resultColor = evt.result === "win" ? [80, 200, 100] : evt.result === "loss" ? [220, 80, 80] : [200, 180, 80];
      doc.setTextColor(...resultColor);
      doc.setFont("helvetica", "bold");
      doc.text((evt.result || "").toUpperCase(), 178, y + 6.5);
      y += 12;
    });
    y += 2;
  }

  // ── Upcoming Events ──
  const today = new Date(new Date().toDateString());
  const upcoming = teamEvents
    .filter(e => e.date && new Date(e.date) >= today && !e.is_cancelled)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 6);

  if (upcoming.length > 0) {
    if (y > pageH - 40) { doc.addPage(); doc.setFillColor(18, 18, 18); doc.rect(0, 0, pageW, pageH, "F"); y = 14; }
    y = addSectionHeader(doc, "Upcoming Schedule", y);
    upcoming.forEach(evt => {
      if (y > pageH - 30) { doc.addPage(); doc.setFillColor(18, 18, 18); doc.rect(0, 0, pageW, pageH, "F"); y = 14; }
      doc.setFillColor(30, 30, 30);
      doc.roundedRect(14, y, 182, 12, 1.5, 1.5, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(184, 145, 74);
      doc.text(format(new Date(evt.date), "MMM d"), 18, y + 8);
      doc.setTextColor(220, 210, 190);
      doc.text(evt.title || "Event", 40, y + 8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 110, 90);
      if (evt.start_time) doc.text(formatTime(evt.start_time), 130, y + 5);
      if (evt.location) {
        const loc = doc.splitTextToSize(evt.location, 60);
        doc.text(loc[0], 130, y + 10);
      }
      doc.setTextColor(120, 110, 90);
      doc.text((evt.type || "").toUpperCase(), 18, y + 12);
      y += 14;
    });
    y += 2;
  }

  // ── Player Stats (Baseball) ──
  if (playerStats.length > 0) {
    if (y > pageH - 40) { doc.addPage(); doc.setFillColor(18, 18, 18); doc.rect(0, 0, pageW, pageH, "F"); y = 14; }
    y = addSectionHeader(doc, "Player Statistics", y);

    const hitStats = playerStats.filter(s => s.stat_type === "hitting");
    const pitchStats = playerStats.filter(s => s.stat_type === "pitching");
    const fieldStats = playerStats.filter(s => s.stat_type === "fielding");

    const renderStatTable = (title, rows, cols) => {
      if (!rows.length) return;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(184, 145, 74);
      doc.text(title, 14, y);
      y += 5;

      // Header row
      doc.setFillColor(40, 40, 40);
      doc.rect(14, y, 182, 6, "F");
      doc.setFontSize(7);
      doc.setTextColor(120, 110, 90);
      const colW = 182 / cols.length;
      cols.forEach((col, i) => {
        doc.text(col.label, 14 + i * colW + colW / 2, y + 4.2, { align: "center" });
      });
      y += 7;

      rows.forEach(row => {
        if (y > pageH - 20) { doc.addPage(); doc.setFillColor(18, 18, 18); doc.rect(0, 0, pageW, pageH, "F"); y = 14; }
        doc.setFillColor(26, 26, 26);
        doc.rect(14, y, 182, 6, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(210, 200, 180);
        cols.forEach((col, i) => {
          const val = String(row[col.key] || "—");
          doc.text(val, 14 + i * colW + colW / 2, y + 4.2, { align: "center" });
        });
        y += 6;
      });
      y += 6;
    };

    renderStatTable("Hitting", hitStats, [
      { label: "Season", key: "season_label" }, { label: "AVG", key: "hitting_avg" },
      { label: "AB", key: "hitting_ab" }, { label: "H", key: "hitting_h" },
      { label: "R", key: "hitting_r" }, { label: "RBI", key: "hitting_rbi" },
      { label: "HR", key: "hitting_hr" }, { label: "BB", key: "hitting_bb" },
      { label: "K", key: "hitting_k" }, { label: "OBP", key: "hitting_obp" },
    ]);

    renderStatTable("Pitching", pitchStats, [
      { label: "Season", key: "season_label" }, { label: "ERA", key: "pitching_era" },
      { label: "IP", key: "pitching_ip" }, { label: "W", key: "pitching_w" },
      { label: "L", key: "pitching_l" }, { label: "SO", key: "pitching_so" },
      { label: "BB", key: "pitching_bb" }, { label: "WHIP", key: "pitching_whip" },
    ]);

    renderStatTable("Fielding", fieldStats, [
      { label: "Season", key: "season_label" }, { label: "PO", key: "fielding_po" },
      { label: "A", key: "fielding_a" }, { label: "E", key: "fielding_e" },
      { label: "FPCT", key: "fielding_fpct" },
    ]);
  }

  // ── Footer on all pages ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(28, 28, 28);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setFillColor(184, 145, 74);
    doc.rect(0, pageH - 1.5, pageW, 1.5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 90, 70);
    doc.text("Cornerstone United Athletics — Confidential", 14, pageH - 4);
    doc.text(`Page ${p} of ${totalPages}`, pageW - 14, pageH - 4, { align: "right" });
  }

  const fileName = `${player.first_name}_${player.last_name}_SeasonSummary.pdf`.replace(/\s+/g, "_");
  doc.save(fileName);
}