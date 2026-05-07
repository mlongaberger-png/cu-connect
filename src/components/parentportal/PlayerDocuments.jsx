import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2, CheckCircle } from "lucide-react";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ParentSignatureRequests from "@/components/documents/ParentSignatureRequests";

const DOC_TYPES = [
  { value: "birth_certificate", label: "Birth Certificate" },
  { value: "physical", label: "Physical / Medical Form" },
  { value: "insurance", label: "Insurance Card" },
  { value: "consent_form", label: "Consent Form" },
  { value: "waiver", label: "Waiver" },
  { value: "other", label: "Other" },
];

export default function PlayerDocuments({ player }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["player-docs", player.id],
    queryFn: () => base44.entities.PlayerDocument.filter({ player_id: player.id }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PlayerDocument.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["player-docs", player.id] }),
  });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !docType) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.PlayerDocument.create({
      player_id: player.id,
      player_name: `${player.first_name} ${player.last_name}`,
      team_name: player.team_name,
      doc_type: docType,
      file_url,
      file_name: file.name,
    });
    qc.invalidateQueries({ queryKey: ["player-docs", player.id] });
    setUploading(false);
    setDocType("");
    e.target.value = "";
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <PlayerAvatar player={player} size="md" />
        <h3 className="font-semibold text-foreground">{player.first_name} {player.last_name}</h3>
        <span className="text-xs text-muted-foreground ml-auto">{player.team_name}</span>
      </div>

      {/* Existing Docs */}
      <div className="space-y-2 mb-4">
        {docs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">No documents uploaded yet</p>
        )}
        {docs.map(doc => {
          const label = DOC_TYPES.find(d => d.value === doc.doc_type)?.label || doc.doc_type;
          const isConfirming = confirmDeleteId === doc.id;
          return (
            <div key={doc.id} className="rounded-xl bg-surface border border-border overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                </div>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-primary hover:underline shrink-0 px-2 py-1"
                >
                  View
                </a>
                <button
                  onClick={() => setConfirmDeleteId(doc.id)}
                  className="ml-2 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  title="Delete document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Inline confirmation */}
              {isConfirming && (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-destructive/10 border-t border-destructive/20">
                  <p className="text-xs text-destructive font-medium">Delete this document?</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { deleteMutation.mutate(doc.id); setConfirmDeleteId(null); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upload */}
      <div className="flex gap-2">
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="flex-1 text-xs h-9">
            <SelectValue placeholder="Select doc type..." />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className={`cursor-pointer ${!docType ? "opacity-50 pointer-events-none" : ""}`}>
          <Button size="sm" disabled={!docType || uploading} asChild>
            <span><Upload className="w-4 h-4 mr-1" />{uploading ? "Uploading..." : "Upload"}</span>
          </Button>
          <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
        </label>
      </div>
    </div>
  );
}