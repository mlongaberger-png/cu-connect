import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, Sparkles, Loader2, Trash2, Check, AlertCircle } from "lucide-react";

// Bulk import for coach compliance records (task 36). Mirrors the
// RosterImporter.jsx pattern: upload -> AI parse (parseCoachComplianceFile)
// -> review/edit -> commit (importCoachCompliance, upserts by email).
//
// Matching by email is required (CoachCompliance is keyed by user_email), but
// real-world coach spreadsheets often list names only. To help close that
// gap, rows with no parsed email get auto-suggested against existing
// CoachProfile records by exact name match -- still editable/overridable
// before saving, never auto-committed silently.

function normalizeName(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export default function CoachComplianceImporter({ open, onOpenChange }) {
  const [step, setStep] = useState("upload"); // upload | review | done
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileRef = useRef();
  const queryClient = useQueryClient();

  const { data: coachProfiles = [] } = useQuery({
    queryKey: ["coach-profiles-all"],
    queryFn: () => base44.entities.CoachProfile.list(),
    enabled: open,
  });

  const handleFilePick = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleParse = async () => {
    if (!file) return;
    setError(null);
    setParsing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke("parseCoachComplianceFile", { file_url });
      if (res.data?.error) throw new Error(res.data.error);
      const parsed = res.data.coaches || [];
      if (parsed.length === 0) throw new Error("No coaches found in this file. Try a different format.");

      // Suggest an email for rows the AI couldn't find one for, by exact
      // (case/whitespace-insensitive) name match against existing coaches.
      const byName = {};
      for (const p of coachProfiles) {
        if (!p.user_email) continue;
        const key = normalizeName(p.user_name);
        if (!key) continue;
        if (!byName[key]) byName[key] = new Set();
        byName[key].add(p.user_email);
      }
      const enriched = parsed.map(c => {
        if (c.user_email) return { ...c, suggested: false };
        const matches = byName[normalizeName(c.user_name)];
        if (matches && matches.size === 1) {
          return { ...c, user_email: [...matches][0], suggested: true };
        }
        return { ...c, suggested: false };
      });

      setRows(enriched);
      setStep("review");
    } catch (err) {
      setError(err.message || "Failed to parse file");
    } finally {
      setParsing(false);
    }
  };

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, suggested: field === "user_email" ? false : r.suggested } : r));
  };

  const removeRow = (idx) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const validRows = rows.filter(r => r.user_name && r.user_email);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("importCoachCompliance", { records: validRows });
      if (res.data?.error) throw new Error(res.data.error);
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ["coach-compliance"] });
      setStep("done");
    } catch (err) {
      setError(err.message || "Failed to import coaches");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setRows([]);
    setError(null);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Import Coach Compliance
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-5">
            <div className="bg-surface rounded-xl p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Supported formats:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li>Excel / CSV spreadsheets (recommended)</li>
                <li>PDF coach lists</li>
                <li>Scanned JPG/PNG lists</li>
              </ul>
              <p className="text-xs pt-1">Every coach needs an email to import — rows missing one can be filled in on the next step, or matched automatically if the coach already has a team profile.</p>
            </div>

            <div>
              <Label>Compliance File</Label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
                className="mt-1 border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                {file ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-foreground font-medium">Click or drag to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">Excel, CSV, PDF, JPG, or PNG</p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={handleFilePick}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} className="border-border">Cancel</Button>
              <Button
                onClick={handleParse}
                disabled={!file || parsing}
                className="bg-primary text-primary-foreground gap-2"
              >
                {parsing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                  : <><Sparkles className="w-4 h-4" /> Parse with AI</>
                }
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Review & Edit */}
        {step === "review" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found <span className="text-foreground font-semibold">{rows.length} coaches</span>
                {" "}(<span className={validRows.length === rows.length ? "text-green-400" : "text-yellow-400"}>{validRows.length} ready to import</span>).
                Review and edit before saving — every row needs an email.
              </p>
              <Button variant="outline" size="sm" className="border-border text-xs" onClick={() => setStep("upload")}>
                ← Re-upload
              </Button>
            </div>

            <div className="space-y-3">
              {rows.map((r, idx) => (
                <div key={idx} className={`bg-surface rounded-xl border p-4 space-y-3 ${r.user_name && r.user_email ? "border-border" : "border-red-500/40"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Coach {idx + 1}{!r.user_email && <span className="text-red-400 ml-1">— missing email</span>}
                    </span>
                    <button onClick={() => removeRow(idx)} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Name *</Label>
                      <Input value={r.user_name} onChange={e => updateRow(idx, "user_name", e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs">Email *{r.suggested && <span className="text-primary ml-1">(auto-matched, verify)</span>}</Label>
                      <Input type="email" value={r.user_email} onChange={e => updateRow(idx, "user_email", e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">BG Check Passed</Label>
                        <Switch checked={r.bg_check_passed} onCheckedChange={v => updateRow(idx, "bg_check_passed", v)} />
                      </div>
                      {r.bg_check_passed && (
                        <Input type="date" value={r.bg_check_expires || ""} onChange={e => updateRow(idx, "bg_check_expires", e.target.value)} className="bg-surface border-border h-7 text-xs" />
                      )}
                    </div>
                    <div className="bg-card rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">NAYS Completed</Label>
                        <Switch checked={r.nays_completed} onCheckedChange={v => updateRow(idx, "nays_completed", v)} />
                      </div>
                      {r.nays_completed && (
                        <Input type="date" value={r.nays_expires || ""} onChange={e => updateRow(idx, "nays_expires", e.target.value)} className="bg-surface border-border h-7 text-xs" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={handleClose} className="border-border">Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={saving || validRows.length === 0}
                className="bg-primary text-primary-foreground gap-2"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                  : <><Check className="w-4 h-4" /> Import {validRows.length} Coach{validRows.length !== 1 ? "es" : ""}</>
                }
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === "done" && result && (
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3">
              <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Import complete</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {result.created} created, {result.updated} updated{result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.
                </p>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Skipped rows</p>
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-400">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1 truncate">{e.name}</span>
                    <span className="text-xs opacity-70 truncate">{e.reason}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <Button onClick={handleClose} className="bg-primary text-primary-foreground">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
