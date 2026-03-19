import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Clock, XCircle, Download, Trash2, RotateCcw, PenLine } from "lucide-react";
import { format } from "date-fns";

const statusConfig = {
  pending: { icon: Clock, cls: "bg-yellow-500/20 text-yellow-400", label: "Pending" },
  signed: { icon: CheckCircle2, cls: "bg-green-500/20 text-green-400", label: "Signed" },
  revoked: { icon: XCircle, cls: "bg-red-500/20 text-red-400", label: "Revoked" },
};

export default function SignatureRequestsPanel({ user }) {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["signature-requests"],
    queryFn: () => base44.entities.SignatureRequest.list("-created_date"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SignatureRequest.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signature-requests"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SignatureRequest.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signature-requests"] }),
  });

  const filtered = filterStatus === "all" ? requests : requests.filter(r => r.status === filterStatus);

  if (isLoading) return <div className="h-32 bg-card rounded-2xl animate-pulse border border-border" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-surface border-border text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="signed">Signed</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} request{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 bg-card rounded-2xl border border-border">
          <PenLine className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No signature requests yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(req => {
            const sc = statusConfig[req.status] || statusConfig.pending;
            const Icon = sc.icon;
            return (
              <div key={req.id} className="bg-card rounded-xl border border-border p-4 flex items-start gap-4 hover:border-primary/20 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <PenLine className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{req.document_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${sc.cls}`}>
                      <Icon className="w-3 h-3" />{sc.label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                    <span>Player: {req.player_name}</span>
                    {req.team_name && <span>· {req.team_name}</span>}
                    <span>· Sent {req.created_date ? format(new Date(req.created_date), "MMM d, yyyy") : ""}</span>
                  </div>
                  {req.status === "signed" && req.signed_by_name && (
                    <div className="text-xs text-green-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Signed by {req.signed_by_name} {req.signed_at ? `on ${format(new Date(req.signed_at), "MMM d, yyyy 'at' h:mm a")}` : ""}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity items-center">
                  {req.file_url && (
                    <a href={req.signed_file_url || req.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Download className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                  {req.status === "pending" && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-yellow-400"
                      title="Revoke"
                      onClick={() => updateMutation.mutate({ id: req.id, data: { status: "revoked" } })}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  )}
                  {req.status === "revoked" && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      title="Resend"
                      onClick={() => updateMutation.mutate({ id: req.id, data: { status: "pending" } })}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-400"
                    onClick={() => { if (confirm("Delete this signature request?")) deleteMutation.mutate(req.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}