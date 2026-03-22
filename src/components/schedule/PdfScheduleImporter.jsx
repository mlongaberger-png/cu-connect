import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, Sparkles, Loader2, Trash2, Check, AlertCircle } from "lucide-react";

const EVENT_TYPES = ["practice", "game", "tournament", "meeting", "fundraiser", "other"];

export default function PdfScheduleImporter({ open, onOpenChange, teams }) {
  const [step, setStep] = useState("upload"); // upload | review
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const queryClient = useQueryClient();

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const handleFilePick = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleParse = async () => {
    if (!file || !selectedTeamId) return;
    setError(null);
    setParsing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke("parsePdfSchedule", {
        file_url,
        team_id: selectedTeam.id,
        team_name: selectedTeam.name,
        sport_name: selectedTeam.sport_name || "",
      });
      if (res.data?.error) throw new Error(res.data.error);
      setEvents(res.data.events || []);
      setStep("review");
    } catch (err) {
      setError(err.message || "Failed to parse PDF");
    } finally {
      setParsing(false);
    }
  };

  const updateEvent = (idx, field, value) => {
    setEvents(prev => prev.map((ev, i) => i === idx ? { ...ev, [field]: value } : ev));
  };

  const removeEvent = (idx) => {
    setEvents(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const ev of events) {
        if (!ev.date) continue; // skip events with no date
        await base44.entities.Event.create(ev);
      }
      queryClient.invalidateQueries({ queryKey: ["events"] });
      handleClose();
    } catch (err) {
      setError(err.message || "Failed to save events");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setSelectedTeamId("");
    setEvents([]);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Import Schedule from PDF
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
            <div>
              <Label>Team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="bg-surface border-border mt-1">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Schedule PDF</Label>
              <div
                onClick={() => fileRef.current?.click()}
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
                    <p className="text-sm text-foreground font-medium">Click to upload PDF</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports standard schedule/roster PDFs</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFilePick} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} className="border-border">Cancel</Button>
              <Button
                onClick={handleParse}
                disabled={!file || !selectedTeamId || parsing}
                className="bg-primary text-primary-foreground gap-2"
              >
                {parsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing PDF...</> : <><Sparkles className="w-4 h-4" /> Parse with AI</>}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Review & Edit */}
        {step === "review" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found <span className="text-foreground font-semibold">{events.length} events</span> for <span className="text-primary">{selectedTeam?.name}</span>. Review and edit before saving.
              </p>
              <Button variant="outline" size="sm" className="border-border text-xs" onClick={() => setStep("upload")}>
                ← Re-upload
              </Button>
            </div>

            {events.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No events were extracted. Try a different PDF or check the format.
              </div>
            )}

            <div className="space-y-3">
              {events.map((ev, idx) => (
                <div key={idx} className="bg-surface rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Event {idx + 1}</span>
                    <button onClick={() => removeEvent(idx)} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Title</Label>
                      <Input value={ev.title} onChange={e => updateEvent(idx, 'title', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select value={ev.type} onValueChange={v => updateEvent(idx, 'type', v)}>
                        <SelectTrigger className="bg-card border-border h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {EVENT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={ev.date} onChange={e => updateEvent(idx, 'date', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Start</Label>
                        <Input type="time" value={ev.start_time} onChange={e => updateEvent(idx, 'start_time', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-xs">End</Label>
                        <Input type="time" value={ev.end_time} onChange={e => updateEvent(idx, 'end_time', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Location</Label>
                      <Input value={ev.location} onChange={e => updateEvent(idx, 'location', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                    {(ev.type === 'game' || ev.type === 'tournament') && (
                      <div>
                        <Label className="text-xs">Opponent</Label>
                        <Input value={ev.opponent} onChange={e => updateEvent(idx, 'opponent', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Notes</Label>
                      <Input value={ev.notes} onChange={e => updateEvent(idx, 'notes', e.target.value)} className="bg-card border-border h-8 text-sm mt-0.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={handleClose} className="border-border">Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={saving || events.length === 0}
                className="bg-primary text-primary-foreground gap-2"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Add {events.length} Event{events.length !== 1 ? "s" : ""}</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}