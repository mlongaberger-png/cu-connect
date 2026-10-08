import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const SNOOZE_KEY = "cu_name_prompt_snoozed_until";

// One-time "What's your name?" prompt for accounts that only have an auto-generated
// username (e.g. "kmattes08") or no name at all (Sign in with Apple hides both name and
// email). Names now show on every chat message, so this matters. Saves through the same
// updateMyProfile function Account Settings uses (stores User.display_name).
export default function NamePrompt() {
  const { user, refreshUser } = useAuth();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(() => {
    try { return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { return false; }
  });

  if (!user?.needsName || dismissed) return null;

  const save = async (e) => {
    e.preventDefault();
    const full = `${first.trim()} ${last.trim()}`.trim();
    if (!first.trim() || !last.trim()) { setError("Please enter your first and last name."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await base44.functions.invoke("updateMyProfile", { full_name: full });
      if (res?.data?.error) throw new Error(res.data.error);
      await refreshUser?.();
    } catch (err) {
      setError(err?.message || "Couldn't save your name. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const later = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 60 * 60 * 1000)); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) later(); }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>What's your name?</DialogTitle>
          <DialogDescription>
            Coaches and other parents see this on your messages. Use the name people know you by.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="np-first">First name</Label>
            <Input id="np-first" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-last">Last name</Label>
            <Input id="np-last" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={later}>Later</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
