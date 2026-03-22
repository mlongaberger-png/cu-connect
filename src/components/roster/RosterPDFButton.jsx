import React from "react";
import { FileDown } from "lucide-react";
import { jsPDF } from "jspdf";
import { formatDate } from "@/utils/dateTime";

export default function RosterPDFButton({ team, players, label = "Download Roster", className = "" }) {
  const handleDownload = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const colW = (pageW - margin * 2) / 4;

    // ── Header ─────────────────────────────────────────────────────────────
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, pageW, 38, "F");

    doc.setTextColor(195, 155, 75); // gold
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("CORNERSTONE UNITED", pageW / 2, 13, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 200, 200);
    doc.text(`${team.name} · Official Roster`, pageW / 2, 21, { align: "center" });

    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    const meta = [
      team.sport_name, team.age_group, team.season ? `${team.season.charAt(0).toUpperCase() + team.season.slice(1)} ${team.year || ""}`.trim() : null
    ].filter(Boolean).join(" · ");
    doc.text(meta, pageW / 2, 28, { align: "center" });
    doc.text(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pageW / 2, 34, { align: "center" });

    let y = 48;

    // ── Coach Info ─────────────────────────────────────────────────────────
    if (team.head_coach) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(195, 155, 75);
      doc.text("COACHING STAFF", margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      let coachLine = `Coach: ${team.head_coach}`;
      if (team.coach_email) coachLine += `   Email: ${team.coach_email}`;
      if (team.coach_phone) coachLine += `   Phone: ${team.coach_phone}`;
      doc.text(coachLine, margin, y);
      y += 4;
      if (team.practice_location) {
        doc.text(`Practice Location: ${team.practice_location}`, margin, y);
        y += 4;
      }
      if (team.practice_schedule) {
        doc.text(`Practice Schedule: ${team.practice_schedule}`, margin, y);
        y += 4;
      }
      y += 4;
    }

    // ── Roster Table Header ────────────────────────────────────────────────
    doc.setFillColor(30, 30, 30);
    doc.rect(margin, y - 1, pageW - margin * 2, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(195, 155, 75);
    const cols = ["#", "Player Name", "Position", "Parent / Guardian"];
    const colXs = [margin, margin + 14, margin + 14 + colW * 1.2, margin + 14 + colW * 2.2];
    cols.forEach((col, i) => doc.text(col, colXs[i], y + 4));
    y += 10;

    // ── Player Rows ────────────────────────────────────────────────────────
    const sorted = [...players].sort((a, b) => {
      const na = parseInt(a.jersey_number) || 999;
      const nb = parseInt(b.jersey_number) || 999;
      return na !== nb ? na - nb : a.last_name.localeCompare(b.last_name);
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    sorted.forEach((p, i) => {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      const rowBg = i % 2 === 0 ? [248, 248, 248] : [255, 255, 255];
      doc.setFillColor(...rowBg);
      doc.rect(margin, y - 1, pageW - margin * 2, 7, "F");
      doc.setTextColor(40, 40, 40);
      doc.text(p.jersey_number || "—", colXs[0], y + 4);
      doc.setFont("helvetica", "bold");
      doc.text(`${p.last_name}, ${p.first_name}`, colXs[1], y + 4);
      doc.setFont("helvetica", "normal");
      doc.text(p.position || "—", colXs[2], y + 4);
      const parentInfo = [p.parent_name, p.parent_phone].filter(Boolean).join("  ·  ");
      doc.text(parentInfo || "—", colXs[3], y + 4);
      y += 8;
    });

    // ── Footer ─────────────────────────────────────────────────────────────
    y += 6;
    doc.setDrawColor(195, 155, 75);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "italic");
    doc.text(`${team.name} · ${players.length} athlete${players.length !== 1 ? "s" : ""} · Cornerstone United Athletics`, pageW / 2, y, { align: "center" });

    doc.save(`${team.name.replace(/\s+/g, "_")}_Roster.pdf`);
  };

  return (
    <button
      onClick={handleDownload}
      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium ${className}`}
    >
      <FileDown className="w-4 h-4" />
      {label}
    </button>
  );
}