import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Sparkles, Loader2, Trash2, Check, AlertCircle, UserPlus } from "lucide-react";

export default function RosterImporter({ open, onOpenChange, team }) {
  const [step, setStep] = useState("upload"); // upload | review
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const queryClient = useQueryClient();

  const handleFilePick = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleParse = async () => {
    if (!file || !team) return;
    setError(null);
    setParsing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke("parseRosterFile", {
        file_url,
        team_id: team.id,
        team_name: team.name,
        sport_name: team.sport_name || "",
      });
      if (res.data?.error) throw new Error(res.data.error);
      const parsed = res.data.players || [];
      if (parsed.length === 0) throw new Error("No players found in this file. Try a different format.");
      setPlayers(parsed);
      setStep("review");
    } catch (err) {
      setError(err.message || "Failed to parse file");
    } finally {
      setParsing(false);
    }
  };

  const updatePlayer = (idx, field, value) => {
    setPlayers(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const removePlayer = (idx) => {
    setPlayers(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const valid = players.filter(p => p.first_name && p.last_name);
      await base44.entities.Player.bulkCreate(valid);
      queryClient.invalidateQueries({ queryKey: ["players"] });
      handleClose();
    } catch (err) {
      setError(err.message || "Failed to save players");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setPlayers([]);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Import Roster — {team?.name}
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
                <li>PDF roster sheets</li>
                <li>Excel / CSV spreadsheets</li>
                <li>Scanned JPG/PNG roster images</li>
              </ul>
            </div>

            <div>
              <Label>Roster File</Label>
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
                    <p className="text-xs text-muted-foreground mt-1">PDF, Excel, CSV, JPG, or PNG</p>
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
                Found <span className="text-foreground font-semibold">{players.length} players</span>. Review and edit before saving.
              </p>
              <Button variant="outline" size="sm" className="border-border text-xs" onClick={() => setStep("upload")}>
                ← Re-upload
              </Button>
            </div>

            <div className="space-y-3">
              {players.map((p, idx) => (
                <div key={idx} className="bg-surface rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" /> Player {idx + 1}
                    </span>
                    <button onClick={() => removePlayer(idx)} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Core info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">First Name *</Label>
                      <Input value={p.first_name} onChange={e => updatePlayer(idx, 'first_name', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs">Last Name *</Label>
                      <Input value={p.last_name} onChange={e => updatePlayer(idx, 'last_name', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs">Jersey #</Label>
                      <Input value={p.jersey_number} onChange={e => updatePlayer(idx, 'jersey_number', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs">Position</Label>
                      <Input value={p.position} onChange={e => updatePlayer(idx, 'position', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                  </div>

                  {/* Parent/Guardian */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Parent Name</Label>
                      <Input value={p.parent_name} onChange={e => updatePlayer(idx, 'parent_name', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs">Parent Email</Label>
                      <Input type="email" value={p.parent_email} onChange={e => updatePlayer(idx, 'parent_email', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs">Parent Phone</Label>
                      <Input value={p.parent_phone} onChange={e => updatePlayer(idx, 'parent_phone', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                  </div>

                  {/* Extra fields — collapsed by default via a light row */}
                  {(p.date_of_birth || p.emergency_contact || p.medical_notes) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/50">
                      <div>
                        <Label className="text-xs">Date of Birth</Label>
                        <Input type="date" value={p.date_of_birth} onChange={e => updatePlayer(idx, 'date_of_birth', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-xs">Emergency Contact</Label>
                        <Input value={p.emergency_contact} onChange={e => updatePlayer(idx, 'emergency_contact', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-xs">Medical Notes</Label>
                        <Input value={p.medical_notes} onChange={e => updatePlayer(idx, 'medical_notes', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={handleClose} className="border-border">Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={saving || players.filter(p => p.first_name && p.last_name).length === 0}
                className="bg-primary text-primary-foreground gap-2"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  : <><Check className="w-4 h-4" /> Add {players.filter(p => p.first_name && p.last_name).length} Player{players.filter(p => p.first_name && p.last_name).length !== 1 ? "s" : ""}</>
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}