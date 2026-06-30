import { jsPDF } from "jspdf";

// Quick Reference — compact one-page table of all 18 UI/UX prompts
const ROWS = [
  { id: "U-01", sev: "CRITICAL", finding: "Composer Overlap with Bottom Navigation Bar", effort: "1", pages: "18 lines" },
  { id: "U-02", sev: "HIGH", finding: "Bottom Navigation Touch Target — 'Manage Hidden Channels' Overlap", effort: "30", pages: "14 lines" },
  { id: "U-03", sev: "HIGH", finding: "Aggressive API Polling — Rate Limit Exhaustion Risk", effort: "3", pages: "25 lines" },
  { id: "U-04", sev: "HIGH", finding: "Inefficient Reactions Query — Full Table Scan", effort: "1", pages: "23 lines" },
  { id: "U-05", sev: "MEDIUM", finding: "Hardcoded Timezone in Message Timestamps", effort: "30 min", pages: "20 lines" },
  { id: "U-06", sev: "MEDIUM", finding: "Theme Inconsistency — Light vs Dark Mode in Messaging", effort: "1", pages: "24 lines" },
  { id: "U-07", sev: "MEDIUM", finding: "Score Bot / Automated Messages Lack Visual Hierarchy", effort: "4", pages: "22 lines" },
  { id: "U-08", sev: "MEDIUM", finding: "Channel Name Truncation in Chat Header", effort: "15", pages: "20 lines" },
  { id: "U-09", sev: "MEDIUM", finding: "Low Contrast on 'No messages yet' Empty State", effort: "30 min", pages: "19 lines" },
  { id: "U-10", sev: "MEDIUM", finding: "Top Bar Icon Density — Insufficient Edge Margins on Mobile", effort: "30 min", pages: "18 lines" },
  { id: "U-11", sev: "MEDIUM", finding: "Mute Toggle — Inconsistent Active State Styling", effort: "15 min", pages: "18 lines" },
  { id: "U-12", sev: "LOW", finding: "Hide/Unhide Channel Button — Desktop Hover Only, Inaccessible on Mobile", effort: "1", pages: "17 lines" },
  { id: "U-13", sev: "LOW", finding: "Composer Placeholder Lacks Channel Context", effort: "15 min", pages: "20 lines" },
  { id: "U-14", sev: "LOW", finding: "Pull-to-Refresh Lacks Haptic Feedback", effort: "15 min", pages: "26 lines" },
  { id: "U-15", sev: "LOW", finding: "Sponsor Ticker Consumes Mobile Screen Real Estate", effort: "1", pages: "32 lines" },
  { id: "U-16", sev: "LOW", finding: "Avatar Layering — Profile Photo Clipped Behind Header", effort: "15 min", pages: "15 lines" },
  { id: "U-17", sev: "LOW", finding: "Inconsistent Empty States Across Channel Types", effort: "1", pages: "36 lines" },
  { id: "U-18", sev: "LOW", finding: "Dashboard Query — No staleTime on Staff Dashboard", effort: "15 min", pages: "22 lines" },
];

const SEV_COLORS = {
  CRITICAL: [220, 38, 38],
  HIGH: [234, 88, 12],
  MEDIUM: [202, 138, 4],
  LOW: [100, 116, 139],
};

export default function buildQuickRefPDF() {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 28;
  const contentW = pageW - margin * 2;

  // ── Header band ──
  doc.setFillColor(20, 30, 48);
  doc.rect(0, 0, pageW, 54, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(200, 168, 75);
  doc.text("CU Connect — UI/UX Fixes Quick Reference", margin, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text("All 18 Prompts  ·  Severity, Finding, Effort (hrs/min), Affected Lines", margin, 40);
  doc.text(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pageW - margin, 40, { align: "right" });

  // ── Table header ──
  let y = 70;
  const cols = {
    id: { x: margin, w: 46 },
    sev: { x: margin + 46, w: 70 },
    finding: { x: margin + 116, w: contentW - 116 - 70 - 70 },
    effort: { x: pageW - margin - 140, w: 70 },
    pages: { x: pageW - margin - 70, w: 70 },
  };

  doc.setFillColor(30, 30, 30);
  doc.rect(margin, y - 14, contentW, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(200, 168, 75);
  doc.text("ID", cols.id.x + 6, y);
  doc.text("SEVERITY", cols.sev.x + 6, y);
  doc.text("FINDING", cols.finding.x + 6, y);
  doc.text("EFFORT", cols.effort.x + 6, y);
  doc.text("PAGES", cols.pages.x + 6, y);
  y += 20;

  // ── Rows ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  ROWS.forEach((r, i) => {
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 40;
    }
    const rowH = 26;
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 4, contentW, rowH, "F");
    }

    // ID
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 168, 75);
    doc.text(r.id, cols.id.x + 6, y + 8);

    // Severity badge
    const c = SEV_COLORS[r.sev] || SEV_COLORS.LOW;
    doc.setFillColor(...c);
    doc.roundedRect(cols.sev.x + 4, y + 2, 58, 13, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(r.sev, cols.sev.x + 33, y + 11, { align: "center" });
    doc.setFontSize(8.5);

    // Finding (wrapped)
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 55, 55);
    const findingLines = doc.splitTextToSize(r.finding, cols.finding.w - 12);
    doc.text(findingLines[0], cols.finding.x + 6, y + 8);
    if (findingLines[1]) {
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 110);
      doc.text(findingLines[1], cols.finding.x + 6, y + 18);
      doc.setFontSize(8.5);
    }

    // Effort
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 30, 48);
    doc.text(r.effort, cols.effort.x + 6, y + 8);

    // Pages
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    doc.text(r.pages, cols.pages.x + 6, y + 8);

    y += rowH;
  });

  // ── Footer ──
  y += 10;
  doc.setDrawColor(200, 168, 75);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text("CU Connect · UI/UX Fixes Quick Reference · CONFIDENTIAL — Internal Use Only", pageW / 2, y, { align: "center" });

  return doc;
}