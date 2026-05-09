import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { X, Video, Upload, Loader2, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES = ["Game Film", "Practice", "Opponent Scout", "Highlight", "Other"];

export default function FilmUploadModal({ teams, user, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    team_id: "",
    category: "Game Film",
    description: "",
    event_date: "",
    tags: "",
    video_url: "",
  });
  const [videoFile, setVideoFile] = useState(null);
  const [inputMode, setInputMode] = useState("link"); // "link" | "upload"
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setVideoFile(file);
  };

  const handleSave = async () => {
    if (!form.title || !form.team_id) return;
    setSaving(true);
    let videoUrl = form.video_url;

    if (inputMode === "upload" && videoFile) {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: videoFile });
      videoUrl = file_url;
      setUploading(false);
    }

    if (!videoUrl) { setSaving(false); return; }

    const team = teams.find(t => t.id === form.team_id);
    const clip = await base44.entities.FilmClip.create({
      ...form,
      video_url: videoUrl,
      team_name: team?.name || "",
      sport_name: team?.sport_name || "",
      uploaded_by_email: user?.email,
      uploaded_by_name: user?.full_name,
    });

    queryClient.invalidateQueries({ queryKey: ["film-clips"] });
    setSaving(false);
    onCreated?.(clip);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 4.5rem)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Add Film</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Game 3 – Offensive Drive" className="bg-surface border-border mt-0.5" />
          </div>
          <div>
            <Label className="text-xs">Team</Label>
            <select value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}
              className="w-full h-9 mt-0.5 bg-surface border border-border rounded-md px-3 text-sm text-foreground">
              <option value="">Select team…</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full h-9 mt-0.5 bg-surface border border-border rounded-md px-3 text-sm text-foreground">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Game / Practice Date (optional)</Label>
            <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} className="bg-surface border-border mt-0.5" />
          </div>
          <div>
            <Label className="text-xs">Tags (optional)</Label>
            <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. offense, red zone" className="bg-surface border-border mt-0.5" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Notes (optional)</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief context or coaching focus…" className="bg-surface border-border mt-0.5" />
          </div>
        </div>

        {/* Video source toggle */}
        <div>
          <div className="flex gap-1 bg-surface rounded-xl p-1 mb-3">
            <button onClick={() => setInputMode("link")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${inputMode === "link" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Link className="w-3.5 h-3.5" /> Paste Link
            </button>
            <button onClick={() => setInputMode("upload")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${inputMode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Upload className="w-3.5 h-3.5" /> Upload File
            </button>
          </div>

          {inputMode === "link" ? (
            <Input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
              placeholder="YouTube, Hudl, Vimeo, or direct video URL…" className="bg-surface border-border" />
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-surface">
              {videoFile ? (
                <span className="text-sm text-foreground text-center px-4 truncate max-w-full">{videoFile.name}</span>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to select video file</span>
                </>
              )}
              <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
            </label>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1 border-border">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.title || !form.team_id || (inputMode === "link" ? !form.video_url : !videoFile)}
            className="flex-1 bg-primary text-primary-foreground gap-1.5"
          >
            {(saving || uploading) ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? "Uploading…" : "Saving…"}</> : <><Video className="w-4 h-4" /> Save Film</>}
          </Button>
        </div>
      </div>
    </div>
  );
}