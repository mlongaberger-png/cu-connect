import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Send } from "lucide-react";

const DOC_TYPES = [
  { value: "medical_form", label: "Medical Form" },
  { value: "liability_waiver", label: "Liability Waiver" },
  { value: "code_of_conduct", label: "Code of Conduct" },
  { value: "consent_form", label: "Consent Form" },
  { value: "custom", label: "Custom" },
];

export default function SendSignatureRequestDialog({ open, onOpenChange, user }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    document_name: "",
    doc_type: "consent_form",
    player_id: "",
    notes: "",
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.SignatureRequest.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature-requests"] });
      onOpenChange(false);
      setSelectedFile(null);
      setForm({ document_name: "", doc_type: "consent_form", player_id: "", notes: "" });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !form.player_id) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
    setUploading(false);
    const player = players.find(p => p.id === form.player_id);
    const team = teams.find(t => t.id === player?.team_id);
    sendMutation.mutate({
      ...form,
      file_url,
      player_name: player ? `${player.first_name} ${player.last_name}` : "",
      team_id: player?.team_id || "",
      team_name: team?.name || player?.team_name || "",
      sent_by: user?.email || "",
      sent_by_name: user?.full_name || "",
      status: "pending",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Send for E-Signature</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Upload */}
          <div>
            <Label>Document PDF *</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-1.5 border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">{selectedFile ? selectedFile.name : "Click to select a PDF"}</p>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf" onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setSelectedFile(f); setForm(prev => ({ ...prev, document_name: prev.document_name || f.name })); }
              }} />
            </div>
          </div>

          <div>
            <Label>Document Name *</Label>
            <Input
              value={form.document_name}
              onChange={e => setForm(f => ({ ...f, document_name: e.target.value }))}
              placeholder="e.g. 2026 Liability Waiver"
              className="bg-surface border-border mt-1.5"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Document Type</Label>
              <Select value={form.doc_type} onValueChange={v => setForm(f => ({ ...f, doc_type: v }))}>
                <SelectTrigger className="bg-surface border-border mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Player *</Label>
              <Select value={form.player_id} onValueChange={v => setForm(f => ({ ...f, player_id: v }))}>
                <SelectTrigger className="bg-surface border-border mt-1.5"><SelectValue placeholder="Select player" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {players.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name} — {p.team_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Instructions for Parent (optional)</Label>
            <Input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Please review and sign before first practice"
              className="bg-surface border-border mt-1.5"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancel</Button>
            <Button
              type="submit"
              disabled={!selectedFile || !form.player_id || !form.document_name || uploading || sendMutation.isPending}
              className="bg-primary text-primary-foreground gap-2"
            >
              <Send className="w-4 h-4" />
              {uploading ? "Uploading..." : sendMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}