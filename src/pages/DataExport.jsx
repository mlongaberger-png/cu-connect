import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAdminGuard } from "@/hooks/useRoleGuard";
import { Download, Upload, Users, ClipboardList, DollarSign, UserCheck, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function downloadCSV(filename, rows, headers) {
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => {
    const val = r[h] ?? "";
    return `"${String(val).replace(/"/g, '""')}"`;
  }).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EXPORTS = [
  {
    id: "players",
    label: "Player Roster",
    desc: "All active players with team, contact, and medical info",
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    id: "volunteers",
    label: "Volunteer Assignments",
    desc: "All volunteer sign-ups with player, role, and status",
    icon: UserCheck,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    id: "attendance",
    label: "Attendance Report",
    desc: "Attendance responses per event and player",
    icon: ClipboardList,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    id: "payments",
    label: "Payments & Invoices",
    desc: "All invoices with amounts, status, and player info",
    icon: DollarSign,
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
];

export default function DataExport({ embedded = false }) {
  if (!embedded) useAdminGuard();
  const [exporting, setExporting] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importType, setImportType] = useState("players");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: volunteers = [] } = useQuery({ queryKey: ["volunteer-assignments"], queryFn: () => base44.entities.VolunteerAssignment.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance-responses"], queryFn: () => base44.entities.AttendanceResponse.list() });
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: () => base44.entities.Payment.list() });

  const handleExport = async (type) => {
    setExporting(type);
    try {
      switch (type) {
        case "players":
          downloadCSV("players_roster.csv", players, [
            "first_name", "last_name", "team_name", "sport_name", "jersey_number",
            "position", "date_of_birth", "parent_name", "parent_email", "parent_phone",
            "emergency_contact", "emergency_phone", "medical_notes", "is_active"
          ]);
          break;
        case "volunteers":
          downloadCSV("volunteer_assignments.csv", volunteers, [
            "volunteer_name", "volunteer_email", "player_name", "team_id",
            "role_name", "date", "start_time", "status"
          ]);
          break;
        case "attendance":
          downloadCSV("attendance_report.csv", attendance, [
            "player_name", "team_id", "attendance_request_id", "status", "responder_email"
          ]);
          break;
        case "payments":
          downloadCSV("payments_invoices.csv", payments, [
            "player_name", "team_name", "parent_email", "description",
            "amount", "due_date", "status"
          ]);
          break;
      }
    } finally {
      setExporting(null);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await importFile.text();
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
      const rows = lines.slice(1).map(line => {
        const values = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = (values[i] || "").replace(/^"|"$/g, "").replace(/""/g, '"').trim();
        });
        return obj;
      }).filter(r => r.first_name || r.player_first_name);

      let created = 0;
      let errors = [];

      if (importType === "players") {
        for (const row of rows) {
          try {
            await base44.entities.Player.create({
              first_name: row.first_name || row["First Name"] || "",
              last_name: row.last_name || row["Last Name"] || "",
              team_name: row.team_name || row["Team"] || "",
              jersey_number: row.jersey_number || "",
              position: row.position || "",
              parent_name: row.parent_name || "",
              parent_email: row.parent_email || "",
              parent_phone: row.parent_phone || "",
              is_active: true,
            });
            created++;
          } catch (e) {
            errors.push(`Row ${created + errors.length + 2}: ${e.message}`);
          }
        }
      }

      setImportResult({ created, errors, total: rows.length });
    } catch (e) {
      setImportResult({ created: 0, errors: [e.message], total: 0 });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={embedded ? "space-y-8" : "p-4 md:p-6 max-w-4xl mx-auto space-y-8"}>
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" /> Data Import & Export
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Export reports as CSV or import players from a spreadsheet</p>
      </div>

      {/* Exports */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Export Data</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXPORTS.map(exp => {
            const Icon = exp.icon;
            return (
              <div key={exp.id} className="bg-card rounded-2xl border border-border p-5 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl ${exp.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${exp.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm">{exp.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{exp.desc}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport(exp.id)}
                    disabled={exporting === exp.id}
                    className="mt-3 border-border text-xs h-7 gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exporting === exp.id ? "Exporting..." : "Download CSV"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Import */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Import Data</h2>
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Import Players via CSV</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload a CSV with columns: <code className="bg-surface px-1 rounded text-xs">first_name, last_name, team_name, jersey_number, position, parent_name, parent_email, parent_phone</code>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={e => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
                className="bg-surface border-border mt-1 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:text-xs"
              />
            </div>

            <Button
              onClick={handleImport}
              disabled={!importFile || importing}
              className="bg-primary text-primary-foreground"
            >
              {importing ? "Importing..." : "Import Players"}
            </Button>

            {importResult && (
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${importResult.errors.length === 0 ? "bg-green-500/10 border-green-500/30" : "bg-orange-500/10 border-orange-500/30"}`}>
                {importResult.errors.length === 0
                  ? <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  : <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                }
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {importResult.created} of {importResult.total} players imported successfully
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {importResult.errors.map((e, i) => (
                        <li key={i} className="text-xs text-orange-400">{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}