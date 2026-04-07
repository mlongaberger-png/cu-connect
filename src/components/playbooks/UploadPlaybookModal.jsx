import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Upload, FileText, CheckCircle2, Image, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ACCEPTED = "image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";

const FILE_ICON = (type) => {
  if (type?.startsWith("image/")) return <Image className="w-5 h-5 text-blue-400" />;
  if (type?.includes("pdf")) return <FileText className="w-5 h-5 text-red-400" />;
  return <FileUp className="w-5 h-5 text-muted-foreground" />;
};

export default function UploadPlaybookModal({ teams, user, onClose, onCreated }) {
  const [files, setFiles] = useState([]); // [{file, uploading, url}]
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [season, setSeason] = useState("");
  const [assignedTo, setAssignedTo] = useState("all");
  const [parentVisible, setParentVisible] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...picked.map(f => ({ file: f, uploading: false, url: null }))]);
    if (!name && picked[0]) {
      setName(picked[0].name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleRemoveFile = (i) => setFiles(fs => fs.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!name.trim() || !teamId || files.length === 0) return;
    setSaving(true);

    // Upload all files
    const uploaded = [];
    for (const entry of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: entry.file });
      uploaded.push({ name: entry.file.name, url: file_url, type: entry.file.type });
    }

    const team = teams.find(t => t.id === teamId);
    const primary = uploaded[0];

    // Create the playbook
    const pb = await base44.entities.Playbook.create({
      name: name.trim(),
      team_id: teamId,
      team_name: team?.name || "",
      season: season.trim(),
      status: "published",
      assigned_to: assignedTo,
      parent_visible: parentVisible,
      document_url: primary.url,
      document_name: primary.name,
      // Store extra files as JSON in description if multiple
      description: uploaded.length > 1
        ? `__files__${JSON.stringify(uploaded)}`
        : "",
      created_by_email: user?.email,
      created_by_name: user?.full_name,
    });

    setSaving(false);
    setDone(true);
    onCreated?.(pb);
  };

  if (done) return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Playbook Uploaded!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Athletes can now view <span className="font-medium text-foreground">{name}</span> in their Playbooks tab.
          </p>
        </div>
        <Button onClick={onClose} className="w-full bg-primary text-primary-foreground">Done</Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-5 my-4" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Upload Playbook</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop zone */}
        <label className={`block border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${files.length === 0 ? "border-border hover:border-primary/50 hover:bg-primary/5" : "border-primary/30 bg-primary/5"}`}>
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Click to select files</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, images, Word, PowerPoint — multiple files supported</p>
          <input type="file" accept={ACCEPTED} multiple className="hidden" onChange={handleFiles} />
        </label>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl border border-border">
                {FILE_ICON(entry.file.type)}
                <span className="text-xs text-foreground flex-1 truncate">{entry.file.name}</span>
                <span className="text-[10px] text-muted-foreground">{(entry.file.size / 1024).toFixed(0)} KB</span>
                <button onClick={() => handleRemoveFile(i)} className="text-muted-foreground hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Playbook Title</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 2025 Offensive Playbook" className="bg-surface border-border mt-0.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Team</Label>
              <select
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                className="w-full h-9 mt-0.5 bg-surface border border-border rounded-md px-3 text-sm text-foreground"
              >
                <option value="">Select…</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Season (optional)</Label>
              <Input value={season} onChange={e => setSeason(e.target.value)} placeholder="Spring 2025" className="bg-surface border-border mt-0.5" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Assign To</Label>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full h-9 mt-0.5 bg-surface border border-border rounded-md px-3 text-sm text-foreground"
            >
              <option value="all">Entire Team</option>
              {["QB", "RB", "WR", "OL", "DL", "LB", "DB", "TE", "K/P"].map(pos => (
                <option key={pos} value={pos}>{pos} Group</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="pv2" checked={parentVisible} onChange={e => setParentVisible(e.target.checked)} />
            <label htmlFor="pv2" className="text-xs text-muted-foreground">Visible to parents</label>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1 border-border">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || files.length === 0 || !name.trim() || !teamId}
            className="flex-1 bg-primary text-primary-foreground gap-1"
          >
            <Upload className="w-3.5 h-3.5" />
            {saving ? "Uploading…" : "Upload Playbook"}
          </Button>
        </div>
      </div>
    </div>
  );
}