import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle2, AlertCircle, FileSpreadsheet, Download } from "lucide-react";
import { addDays, addWeeks, addMonths, format } from "date-fns";

const REQUIRED_COLS = ["title", "type", "date"];

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; continue; }
      if (line[i] === "," && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += line[i];
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || "").trim(); });
    return row;
  }).filter(r => r.title);
}

function expandRecurring(row, teams) {
  const recurType = (row.recur_type || "none").toLowerCase();
  const recurCount = parseInt(row.recur_count) || 1;
  const team = teams.find(t => t.name?.toLowerCase() === (row.team || "").toLowerCase() || t.id === row.team_id);

  const base = {
    title: row.title || "",
    type: row.type || "practice",
    team_id: team?.id || "",
    team_name: team?.name || row.team || "",
    sport_name: team?.sport_name || "",
    date: row.date || "",
    start_time: row.start_time || "",
    end_time: row.end_time || "",
    location: row.location || "",
    opponent: row.opponent || "",
    notes: row.notes || "",
  };

  if (recurType === "none" || !row.date || recurCount <= 1) return [base];

  const results = [];
  let d = new Date(row.date + "T00:00:00");
  for (let i = 0; i < recurCount; i++) {
    results.push({ ...base, date: format(d, "yyyy-MM-dd") });
    if (recurType === "daily") d = addDays(d, 1);
    else if (recurType === "weekly") d = addWeeks(d, 1);
    else if (recurType === "monthly") d = addMonths(d, 1);
  }
  return results;
}

export default function BulkEventImporter({ open, onOpenChange, teams }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDone(false);
    setErrors([]);

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (isExcel) {
      // Use LLM extraction for Excel
      setImporting(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  type: { type: "string" },
                  team: { type: "string" },
                  date: { type: "string", description: "YYYY-MM-DD" },
                  start_time: { type: "string", description: "HH:MM" },
                  end_time: { type: "string", description: "HH:MM" },
                  location: { type: "string" },
                  opponent: { type: "string" },
                  notes: { type: "string" },
                  recur_type: { type: "string", description: "none, daily, weekly, or monthly" },
                  recur_count: { type: "string", description: "Number of occurrences" },
                },
              },
            },
          },
        },
      });
      setImporting(false);
      if (result.status === "success" && result.output?.events) {
        setRows(result.output.events);
      } else {
        setErrors(["Could not parse the Excel file. Try CSV format."]);
      }
    } else {
      // CSV
      const text = await file.text();
      const parsed = parseCSV(text);
      const errs = [];
      REQUIRED_COLS.forEach(col => {
        if (!Object.keys(parsed[0] || {}).includes(col)) errs.push(`Missing required column: "${col}"`);
      });
      if (errs.length) { setErrors(errs); return; }
      setRows(parsed);
    }
  };

  const allExpanded = rows.flatMap(r => expandRecurring(r, teams));

  const ALLOWED_EVENT_FIELDS = new Set([
    "title", "type", "team_id", "team_name", "sport_name",
    "date", "start_time", "end_time", "arrival_time",
    "location", "opponent", "notes", "tournament_round", "uniform_info",
  ]);

  const handleImport = async () => {
    setImporting(true);
    const valid = allExpanded
      .filter(e => e.title && e.date)
      .map(e => Object.fromEntries(Object.entries(e).filter(([k]) => ALLOWED_EVENT_FIELDS.has(k))));
    await base44.entities.Event.bulkCreate(valid);
    queryClient.invalidateQueries({ queryKey: ["events"] });
    setImportedCount(valid.length);
    setImporting(false);
    setDone(true);
  };

  const handleClose = () => {
    setRows([]); setErrors([]); setDone(false); setFileName("");
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const header = "title,type,team,date,start_time,end_time,location,opponent,notes,recur_type,recur_count";
    const ex1 = "Monday Practice,practice,Tigers 12U,2025-09-01,18:00,19:30,Field A,,,weekly,10";
    const ex2 = "Opening Game,game,Tigers 12U,2025-09-08,10:00,12:00,Field B,Blue Sox,,none,1";
    const blob = new Blob([[header, ex1, ex2].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "events_template.csv"; a.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" /> Bulk Import Events
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="text-center py-10 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <p className="text-lg font-semibold text-foreground">{importedCount} events imported!</p>
            <Button onClick={handleClose} className="bg-primary text-primary-foreground">Done</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Instructions */}
            <div className="bg-surface rounded-xl p-4 text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">How to use:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Upload a <strong>CSV</strong> or <strong>Excel</strong> file with your events</li>
                <li>Required columns: <code className="bg-border px-1 rounded">title</code>, <code className="bg-border px-1 rounded">type</code>, <code className="bg-border px-1 rounded">date</code> (YYYY-MM-DD)</li>
                <li>For recurring events, add <code className="bg-border px-1 rounded">recur_type</code> (daily/weekly/monthly) and <code className="bg-border px-1 rounded">recur_count</code></li>
                <li>Event types: practice, game, tournament, meeting, fundraiser, other</li>
              </ul>
              <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-2">
                <Download className="w-3.5 h-3.5" /> Download CSV template
              </button>
            </div>

            {/* Upload area */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {fileName ? <span className="text-foreground font-medium">{fileName}</span> : "Click to upload CSV or Excel file"}
              </p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>

            {/* Errors */}
            {errors.map((err, i) => (
              <div key={i} className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {err}
              </div>
            ))}

            {/* Preview */}
            {allExpanded.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Preview — {allExpanded.length} event{allExpanded.length !== 1 ? "s" : ""} to create
                </p>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-surface sticky top-0">
                      <tr>
                        {["Title","Type","Team","Date","Time","Recurring"].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allExpanded.map((ev, i) => (
                        <tr key={i} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-surface/50"}`}>
                          <td className="px-3 py-2 text-foreground truncate max-w-[160px]">{ev.title}</td>
                          <td className="px-3 py-2 capitalize text-muted-foreground">{ev.type}</td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">{ev.team_name || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{ev.date}</td>
                          <td className="px-3 py-2 text-muted-foreground">{ev.start_time || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {rows.find(r => r.title === ev.title && (r.recur_type || "none") !== "none") ? "✓" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={handleClose} className="border-border">Cancel</Button>
                  <Button onClick={handleImport} disabled={importing} className="bg-primary text-primary-foreground">
                    {importing ? "Importing…" : `Import ${allExpanded.length} Events`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}