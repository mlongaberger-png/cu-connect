import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Trophy, CheckCircle, Loader2, Mail, User, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const CU_LOGO = "https://media.base44.com/images/public/69bae2515552e76ca1fbd6a0/2ff00e9bd_file_0000000089d071f8be26c9f306ac7ce1.png";

export default function AcceptInvite() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const updates = { setup_complete: true };
    if (phone.trim()) updates.phone = phone.trim();
    await base44.auth.updateMe(updates);
    setDone(true);
    setTimeout(() => {
      window.location.href = "/Portal";
    }, 1200);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">You're all set!</h2>
          <p className="text-muted-foreground">Taking you to the portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-3 border-b border-border">
        <div className="w-9 h-9 rounded-lg overflow-hidden">
          <img src={CU_LOGO} alt="CU Logo" className="w-full h-full object-cover" />
        </div>
        <span className="font-bold text-foreground text-lg">Cornerstone United</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Welcome card */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to the Parent Portal!</h1>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Your account is ready. Confirm your details below to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
            {/* Email — read-only, pre-filled from their account */}
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email Address
              </Label>
              <div className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm text-muted-foreground items-center select-none">
                {user?.email || "Loading…"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">This is the email your account was created with.</p>
            </div>

            {/* Name — read-only if already set, otherwise inform them */}
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> Your Name
              </Label>
              <div className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground items-center">
                {user?.full_name || <span className="text-muted-foreground">Will be set when you complete sign-in</span>}
              </div>
            </div>

            {/* Phone — optional, editable */}
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone Number <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. (555) 867-5309"
                className="bg-surface border-border"
              />
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-primary text-primary-foreground h-11 text-base font-semibold"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting up…</>
                : "Enter Parent Portal →"
              }
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-5">
            Questions? Contact your team administrator.
          </p>
        </div>
      </main>
    </div>
  );
}