import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle, AlertCircle, Trophy } from "lucide-react";
import AddChildForm from "@/components/parentportal/AddChildForm";

export default function LinkPlayerByEmail({ currentUserEmail, onLinked, parentName }) {
  const [searchEmail, setSearchEmail] = useState("");
  const [found, setFound] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [searching, setSearching] = useState(false);
  const [linkError, setLinkError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearching(true);
    setNotFound(false);
    setFound(null);

    // Find players registered with that email. This is a lookup by an
    // ARBITRARY email (not the caller's own), so RLS on Player (which only
    // exposes rows where parent_email == the caller's own email) can never
    // return anything here — the lookup has to run server-side via
    // findPlayerByEmail, which returns only minimal, non-sensitive fields.
    const res = await base44.functions.invoke("findPlayerByEmail", {
      email: searchEmail.trim().toLowerCase(),
    });
    const players = res.data?.players || [];
    setSearching(false);

    if (players.length === 0) {
      setNotFound(true);
    } else {
      setFound(players);
    }
  };

  const handleLink = async () => {
    if (!found) return;
    setLinking(true);

    try {
      // Routed through linkPlayerGuardian (asServiceRole) rather than a direct
      // client-side PlayerGuardian.create() call -- that create's RLS has an
      // $or branch for data.user_email == the caller's own email, which is
      // exactly this case (self-linking with your own email), but that branch
      // never actually grants access in practice (confirmed via a raw network
      // probe: 403 "Permission denied" even with a perfectly matching
      // user_email). This previously failed silently for every parent using
      // this search-by-email flow, with no catch here to surface the error.
      for (const player of found) {
        await base44.functions.invoke("linkPlayerGuardian", {
          player_id: player.id,
          player_name: `${player.first_name} ${player.last_name}`,
          relationship: "Guardian",
          join_channels: true,
        });
      }

      setLinking(false);
      setLinked(true);
      setTimeout(() => onLinked(), 1500);
    } catch (err) {
      setLinking(false);
      setLinkError(err?.response?.data?.error || err?.message || "Failed to link player. Please try again.");
    }
  };

  if (linked) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle className="w-10 h-10 text-green-400" />
        <p className="text-foreground font-semibold">Account linked! Loading your players…</p>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-card border border-border rounded-2xl p-6 max-w-md mx-auto text-left">
      <h3 className="font-semibold text-foreground mb-1">Find Your Player</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Enter the email address used when your child was registered with the organization.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <Input
          type="email"
          value={searchEmail}
          onChange={e => setSearchEmail(e.target.value)}
          placeholder="registration@email.com"
          className="bg-surface border-border"
          required
        />
        <Button type="submit" disabled={searching} className="bg-primary text-primary-foreground flex-shrink-0">
          <Search className="w-4 h-4" />
        </Button>
      </form>

      {notFound && (
        <>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>No existing profile found with that email — you can add your child manually below.</span>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="font-semibold text-foreground mb-1">Add Your Child</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your child's info and we'll match them if they're in the system, or submit for admin review.
            </p>
            <AddChildForm
              parentEmail={currentUserEmail}
              parentName={parentName || ""}
              onChildAdded={onLinked}
              showSkip={false}
            />
          </div>
        </>
      )}

      {found && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Players found:</p>
          {found.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">{p.first_name?.[0]}{p.last_name?.[0]}</span>
              </div>
              <div>
                <p className="font-medium text-foreground">{p.first_name} {p.last_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> {p.team_name || "No team assigned"}
                </p>
              </div>
            </div>
          ))}

          <p className="text-xs text-muted-foreground">
            This will link these players to your current account (<span className="text-primary">{currentUserEmail}</span>).
          </p>

          {linkError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{linkError}</span>
            </div>
          )}

          <Button onClick={handleLink} disabled={linking} className="w-full bg-primary text-primary-foreground">
            {linking ? "Linking…" : "Link to My Account"}
          </Button>
        </div>
      )}
    </div>
  );
}