import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PenLine, Download } from "lucide-react";
import { format } from "date-fns";

export default function AdminSignDialog({ request, user, onClose }) {
  const qc = useQueryClient();
  const [typedName, setTypedName] = useState(user?.full_name || "");
  const [agreed, setAgreed] = useState(false);

  const signMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.SignatureRequest.update(request.id, {
        status: "signed",
        signed_by_email: user?.email,
        signed_by_name: typedName || user?.full_name || user?.email,
        signed_at: new Date().toISOString(),
        signed_file_url: request.file_url,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature-requests"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-4 h-4 text-primary" /> Admin Sign Document
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-surface rounded-xl p-4 space-y-1">
            <p className="text-sm font-semibold text-foreground">{request.document_name}</p>
            <p className="text-xs text-muted-foreground">{request.player_name} · {request.team_name}</p>
            {request.notes && <p className="text-xs text-muted-foreground italic mt-1">Note: {request.notes}</p>}
          </div>

          <a
            href={request.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Download className="w-4 h-4" /> View document before signing
          </a>

          <div>
            <Label>Type your full name to sign *</Label>
            <Input
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder="Your full legal name"
              className="bg-surface border-border mt-1.5"
            />
            {typedName && (
              <p className="text-lg font-semibold text-primary mt-2 italic pl-1">{typedName}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Signing as: <span className="text-foreground">{user?.email}</span> · {format(new Date(), "MMM d, yyyy")}
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span className="text-xs text-muted-foreground">
              I have reviewed this document and agree that my typed name constitutes my legal electronic signature on behalf of Cornerstone United Athletics. This signature is legally binding.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button
            onClick={() => signMutation.mutate()}
            disabled={!typedName.trim() || !agreed || signMutation.isPending}
            className="bg-primary text-primary-foreground gap-2"
          >
            <PenLine className="w-4 h-4" />
            {signMutation.isPending ? "Signing..." : "Sign Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}