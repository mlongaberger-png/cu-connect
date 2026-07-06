import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, CheckCircle2, Loader2, ChevronRight } from "lucide-react";

const STEPS = [
  {
    number: 1,
    title: "Understand what gets deleted",
    description: "Your account, guardian links, notification settings, and personal data will be permanently removed. Financial records and payment history are retained as required by compliance policy.",
  },
  {
    number: 2,
    title: "Remove your athlete links",
    description: "Once deleted, you will lose access to all athlete schedules, documents, and team communications. If another guardian needs access, make sure they are already set up before proceeding.",
  },
  {
    number: 3,
    title: "Confirm your identity",
    description: "Type Delete in the confirmation box below to verify you understand this action is permanent and cannot be undone.",
  },
];

export default function DeleteAccountModal({ open, onClose }) {
  const [step, setStep] = useState(0); // 0 = steps view, 1 = confirm
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);

  const handleClose = () => {
    setStep(0);
    setConfirmText("");
    setDeleting(false);
    setDone(false);
    onClose();
  };

  const handleDelete = async () => {
    if (confirmText.toLowerCase() !== "delete") return;
    setDeleting(true);
    await base44.functions.invoke("deleteAccount", {});
    setDone(true);
    setTimeout(() => {
      base44.auth.logout();
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Trash2 className="w-5 h-5" /> Delete My Account
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
            <p className="font-semibold text-foreground">Account deleted.</p>
            <p className="text-sm text-muted-foreground">You are being signed out…</p>
          </div>
        ) : step === 0 ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">
                <strong>This action is permanent.</strong> Please read the steps below before continuing.
              </p>
            </div>

            <div className="space-y-3">
              {STEPS.map((s) => (
                <div key={s.number} className="flex gap-3 p-3 rounded-xl bg-surface border border-border">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-foreground">{s.number}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setStep(1)}
              >
                I Understand <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Type <strong className="text-foreground">Delete</strong> below to permanently delete your account.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Type Delete to confirm"
              className="w-full rounded-lg border border-red-900/50 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(0)} disabled={deleting}>Back</Button>
              <Button
                onClick={handleDelete}
                disabled={confirmText.toLowerCase() !== "delete" || deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete My Account"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}