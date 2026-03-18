import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">{player.first_name[0]}{player.last_name[0]}</span>
        </div>
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
          return (
            <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{label}</p>
                <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
              </div>
              <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline shrink-0">View</a>
              <button onClick={() => deleteMutation.mutate(doc.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
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