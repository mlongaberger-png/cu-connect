import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserPlus, CheckCircle, AlertCircle, Calendar, MessageSquare, CreditCard, X, Info } from "lucide-react";

const PERMISSION_OPTIONS = [
  {
    id: "view_calendar",
    icon: Calendar,
    label: "View Calendar",
    description: "See team schedules, games, and upcoming events. Read-only.",
    color: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    checkColor: "bg-blue-500/20 border-blue-500/40",
  },
  {
    id: "view_messages",
    icon: MessageSquare,
    label: "View Messages",
    description: "Read team messages and announcements from coaches.",
    color: "border-purple-500/40 bg-purple-500/10 text-purple-400",
    checkColor: "bg-purple-500/20 border-purple-500/40",
  },
  {
    id: "financial_contributor",
    icon: CreditCard,
    label: "Financial Contributor",
    description: "View balances and make payments on behalf of your athlete. Cannot refund or manage finances.",
    color: "border-green-500/40 bg-green-500/10 text-green-400",
    checkColor: "bg-green-500/20 border-green-500/40",
  },
];

export default function InviteFamilyMember({ player, currentUserEmail, onClose, existingGuardians = [] }) {
  const [step, setStep] = useState("form"); // "form" | "success"
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("Guardian");
  const [permissions, setPermissions] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const togglePermission = (id) => {
    setPermissions(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (permissions.length === 0) {
      setError("Please select at least one access permission.");
      return;
    }
    if (existingGuardians.some(g => g.user_email === trimmed)) {
      setError("This person already has access.");
      return;
    }

    setSending(true);
    setError(null);

    await base44.entities.PlayerGuardian.create({
      player_id: player.id,
      player_name: `${player.first_name} ${player.last_name}`,
      user_email: trimmed,
      invited_by: currentUserEmail,
      relationship,
      permissions,
    });

    await base44.functions.invoke("inviteParent", { email: trimmed });

    queryClient.invalidateQueries({ queryKey: ["guardians", player.id] });
    setSending(false);
    setStep("success");
  };

  // Auto-close success screen after 3 seconds
  useEffect(() => {
    if (step === "success") {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [step, onClose]);

  if (step === "success") {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
          <CheckCircle className="w-7 h-7 text-green-400" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Invitation Sent!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="text-foreground font-medium">{email}</span> will receive an email with a sign-up link.
            Their access will be applied automatically when they join.
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-3 text-left space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Permissions granted</p>
          {permissions.map(pid => {
            const opt = PERMISSION_OPTIONS.find(o => o.id === pid);
            if (!opt) return null;
            const Icon = opt.icon;
            return (
              <div key={pid} className="flex items-center gap-2 text-sm">
                <Icon className="w-3.5 h-3.5 text-primary" />
                <span className="text-foreground">{opt.label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Closing automatically…</p>
        <Button onClick={onClose} className="w-full bg-primary text-primary-foreground">Done</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Email Address</Label>
          <Input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null); }}
            placeholder="grandparent@email.com"
            className="bg-surface border-border"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Relationship</Label>
          <select
            value={relationship}
            onChange={e => setRelationship(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-surface px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="Guardian">Guardian</option>
            <option value="Grandparent">Grandparent</option>
            <option value="Aunt/Uncle">Aunt / Uncle</option>
            <option value="Stepparent">Stepparent</option>
            <option value="Sibling">Sibling</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Permission selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label>Access Permissions</Label>
          <span className="text-xs text-destructive">*</span>
        </div>
        <p className="text-xs text-muted-foreground">Choose what this person can see and do in the app.</p>
        <div className="space-y-2 mt-1">
          {PERMISSION_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const selected = permissions.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => togglePermission(opt.id)}
                className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  selected
                    ? opt.color
                    : "border-border bg-surface hover:border-border/70 hover:bg-surface/80"
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                  selected ? "bg-current border-current" : "border-muted-foreground"
                }`}>
                  {selected && <CheckCircle className="w-3 h-3 text-background" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? "opacity-100" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-semibold ${selected ? "" : "text-foreground"}`}>{opt.label}</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${selected ? "opacity-80" : "text-muted-foreground"}`}>{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Safety note */}
      <div className="flex items-start gap-2 bg-surface rounded-xl border border-border p-3">
        <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Invited family members must accept Terms of Service before accessing any content. You can edit or revoke their access at any time.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 border-border" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={sending || permissions.length === 0} className="flex-1 bg-primary text-primary-foreground gap-1.5">
          <UserPlus className="w-4 h-4" />
          {sending ? "Sending…" : "Send Invite"}
        </Button>
      </div>
    </form>
  );
}