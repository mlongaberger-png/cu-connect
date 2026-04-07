import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, UserCheck, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PromoteAthleteModal({ player, currentUserEmail, onClose, onPromoted }) {
  const [step, setStep] = useState("confirm"); // "confirm" | "email" | "done"
  const [athleteEmail, setAthleteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const playerName = `${player.first_name} ${player.last_name}`;

  const handlePromote = async () => {
    if (!athleteEmail.trim() || !athleteEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);

    // Invite the athlete as a user with role "athlete"
    await base44.users.inviteUser(athleteEmail.trim(), "athlete");

    // Update the player record to reflect promotion
    await base44.entities.Player.update(player.id, {
      athlete_email: athleteEmail.trim(),
      is_promoted: true,
      promoted_at: new Date().toISOString(),
      promoted_by: currentUserEmail,
    });

    setLoading(false);
    setStep("done");
    onPromoted?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Promote Athlete</h2>
              <p className="text-xs text-muted-foreground">{playerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-foreground space-y-1">
                <p className="font-semibold">Before you continue</p>
                <ul className="text-xs text-muted-foreground list-disc pl-3 space-y-1">
                  <li>The athlete will receive a login invitation via email</li>
                  <li>They will gain access to film, schedule, messages, and playbooks</li>
                  <li>You will retain full access to documents and payments</li>
                  <li>This action can be reversed by an admin if needed</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              By proceeding, you confirm that <span className="font-semibold text-foreground">{playerName}</span> is ready for their own account and you have their consent to create one.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1 border-border">Cancel</Button>
              <Button onClick={() => setStep("email")} className="flex-1 bg-primary text-primary-foreground">
                I Agree – Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step: Enter email */}
        {step === "email" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the email address <span className="font-semibold text-foreground">{playerName}</span> will use to log in. An invitation will be sent to them.
            </p>
            <div>
              <Label className="text-xs">Athlete Email Address</Label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input
                  type="email"
                  value={athleteEmail}
                  onChange={e => setAthleteEmail(e.target.value)}
                  placeholder="athlete@email.com"
                  className="bg-surface border-border flex-1"
                  onKeyDown={e => e.key === "Enter" && handlePromote()}
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("confirm")} className="flex-1 border-border">Back</Button>
              <Button
                onClick={handlePromote}
                disabled={loading || !athleteEmail.trim()}
                className="flex-1 bg-primary text-primary-foreground"
              >
                {loading ? "Sending Invite…" : "Send Invitation"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Invitation Sent!</p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{playerName}</span> will receive an invite at <span className="font-medium text-foreground">{athleteEmail}</span>. Once they accept, they'll have their own login.
              </p>
            </div>
            <p className="text-xs text-muted-foreground bg-surface rounded-xl p-3">
              You still have full access to {player.first_name}'s documents, payments, and team information.
            </p>
            <Button onClick={onClose} className="w-full bg-primary text-primary-foreground">Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}