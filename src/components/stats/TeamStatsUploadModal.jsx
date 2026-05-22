import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Sparkles, CheckCircle2, AlertCircle, Loader2, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

export default function TeamStatsUploadModal({ open, onOpenChange, team }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [seasonLabel, setSeasonLabel] = useState("Spring 2026");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const reset = () => { setFile(null); setStatus("idle"); setResult(null); setErrorMsg(""); };
  const handleClose = () => { reset(); onOpenChange(false); };

  const handleProcess = async () => {
    if (!file || !team) return;
    setStatus("uploading");
    setErrorMsg("");

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    setStatus("extracting");
    const response = await base44.functions.invoke("extractTeamStats", {
      file_url,
      team_id: team.id,
      team_name: team.name,
      season_label: seasonLabel,
    });

    if (response.data?.success) {
      setResult(response.data);
      setStatus("done");
      queryClient.invalidateQueries({ queryKey: ["playerStats-all"] });
    } else {
      setStatus("error");
      setErrorMsg(response.data?.error || "Extraction failed. Please try a clearer image.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Team Stats Import
          </DialogTitle>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Upload a full team stat sheet for{" "}
              <span className="text-foreground font-medium">{team?.name}</span>. AI will extract stats for every player automatically.
            </p>
            <div className="space-y-1">
              <Label>Season</Label>
              <Input value={seasonLabel} onChange={e => setSeasonLabel(e.target.value)} placeholder="e.g. Spring 2026" />
            </div>
            <div className="space-y-1">
              <Label>Team Stat Sheet (JPG, PNG, or PDF)</Label>
              <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-surface">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{file ? file.name : "Click to select file"}</span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleProcess} disabled={!file} className="gap-1.5">
                <Sparkles className="w-4 h-4" /> Extract Team Stats
              </Button>
            </div>
          </div>
        )}

        {(status === "uploading" || status === "extracting") && (
          <div className="py-10 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground text-center">
              {status === "uploading" ? "Uploading file…" : "AI is reading the team stat sheet…"}
            </p>
            {status === "extracting" && (
              <p className="text-xs text-muted-foreground text-center">This may take 15–30 seconds for a full roster.</p>
            )}
          </div>
        )}

        {status === "done" && result && (
          <div className="py-2 space-y-3">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Done! {result.total_records} stat records saved.</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {result.players?.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={p.matched ? "text-green-400" : "text-red-400"}>
                    {p.matched ? "✓" : "✗"}
                  </span>
                  <span className={p.matched ? "text-foreground" : "text-muted-foreground line-through"}>
                    {p.player_name}
                  </span>
                  {p.matched && <span className="text-muted-foreground">— {p.records} record{p.records !== 1 ? "s" : ""}</span>}
                  {!p.matched && <span className="text-muted-foreground">(not matched to roster)</span>}
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        )}

        {status === "error" && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Extraction failed</span>
            </div>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={reset}>Try Again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}