import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, PenLine, Download, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function ParentSignatureRequests({ myKids, userEmail, userName }) {
  const qc = useQueryClient();
  const [signing, setSigning] = useState(null); // the request being signed
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);

  const myPlayerIds = myKids.map(k => k.id);

  const { data: allRequests = [] } = useQuery({
    queryKey: ["signature-requests-parent", userEmail],
    queryFn: () => base44.entities.SignatureRequest.list("-created_date"),
    enabled: !!userEmail && myPlayerIds.length > 0,
  });

  // Only requests for my kids
  const myRequests = allRequests.filter(r => myPlayerIds.includes(r.player_id) && r.status !== "revoked");

  const signMutation = useMutation({
    mutationFn: async (req) => {
      // Mark request as signed
      await base44.entities.SignatureRequest.update(req.id, {
        status: "signed",
        signed_by_email: userEmail,
        signed_by_name: typedName || userName || userEmail,
        signed_at: new Date().toISOString(),
        signed_file_url: req.file_url,
      });
      // Store in PlayerDocument for permanent record
      const player = myKids.find(k => k.id === req.player_id);
      await base44.entities.PlayerDocument.create({
        player_id: req.player_id,
        player_name: req.player_name,
        team_name: req.team_name,
        doc_type: req.doc_type === "medical_form" ? "physical"
          : req.doc_type === "liability_waiver" ? "waiver"
          : req.doc_type === "consent_form" ? "consent_form"
          : "other",
        file_url: req.file_url,
        file_name: req.document_name,
        uploaded_by: userEmail,
        notes: `E-signed by ${typedName || userName || userEmail} on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature-requests-parent", userEmail] });
      qc.invalidateQueries({ queryKey: ["player-docs"] });
      setSigning(null);
      setTypedName("");
      setAgreed(false);
    },
  });

  const pending = myRequests.filter(r => r.status === "pending");
  const signed = myRequests.filter(r => r.status === "signed");

  if (myRequests.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Pending */}
      {pending.length > 0 && (
        <div className="bg-card border border-yellow-500/30 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" /> Documents Requiring Your Signature ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(req => (
              <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface">
                <PenLine className="w-4 h-4 text-yellow-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{req.document_name}</p>
                  <p className="text-xs text-muted-foreground">{req.player_name} · {req.team_name}</p>
                  {req.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">"{req.notes}"</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={req.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-8 text-xs border-border gap-1.5">
                      <Download className="w-3.5 h-3.5" /> View
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground"
                    onClick={() => { setSigning(req); setTypedName(userName || ""); setAgreed(false); }}
                  >
                    <PenLine className="w-3.5 h-3.5" /> Sign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signed */}
      {signed.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" /> Completed Signatures
          </h3>
          <div className="space-y-2">
            {signed.map(req => (
              <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{req.document_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {req.player_name}
                    {req.signed_at ? ` · Signed ${format(new Date(req.signed_at), "MMM d, yyyy")}` : ""}
                    {req.signed_by_name ? ` by ${req.signed_by_name}` : ""}
                  </p>
                </div>
                <a href={req.signed_file_url || req.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-primary">
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* E-Sign Dialog */}
      <Dialog open={!!signing} onOpenChange={open => { if (!open) setSigning(null); }}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-primary" /> Sign Document
            </DialogTitle>
          </DialogHeader>
          {signing && (
            <div className="space-y-4">
              <div className="bg-surface rounded-xl p-4 space-y-1">
                <p className="text-sm font-semibold text-foreground">{signing.document_name}</p>
                <p className="text-xs text-muted-foreground">{signing.player_name} · {signing.team_name}</p>
                {signing.notes && <p className="text-xs text-muted-foreground italic mt-1">Note: {signing.notes}</p>}
              </div>

              <div>
                <a href={signing.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Download className="w-4 h-4" /> View document before signing
                </a>
              </div>

              <div>
                <Label>Type your full name to sign *</Label>
                <Input
                  value={typedName}
                  onChange={e => setTypedName(e.target.value)}
                  placeholder="Your full legal name"
                  className="bg-surface border-border mt-1.5"
                />
                {typedName && (
                  <p className="text-lg font-semibold text-primary mt-2 font-serif italic pl-1">{typedName}</p>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span className="text-xs text-muted-foreground">
                  I have reviewed this document and agree that my typed name above constitutes my legal electronic signature. I understand this signature is legally binding.
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSigning(null)} className="border-border">Cancel</Button>
            <Button
              onClick={() => signMutation.mutate(signing)}
              disabled={!typedName.trim() || !agreed || signMutation.isPending}
              className="bg-primary text-primary-foreground gap-2"
            >
              <PenLine className="w-4 h-4" />
              {signMutation.isPending ? "Signing..." : "Sign Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}