import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, CheckCircle, Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";

const REFERRAL_OPTIONS = [
  { value: "coach_or_staff_invite", label: "A coach or staff member invited us" },
  { value: "returning_family", label: "We're a returning family" },
  { value: "word_of_mouth", label: "Word of mouth / friend" },
  { value: "school_or_flyer", label: "School or flyer" },
  { value: "social_media", label: "Social media" },
  { value: "other", label: "Other" },
];

function emptyAthlete() {
  return { sport_id: "", team_id: "", athlete_first_name: "", athlete_last_name: "", athlete_dob: "" };
}

export default function Register() {
  const { user, isAuthenticated, isLoadingAuth, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [sports, setSports] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const [parent, setParent] = useState({ parent_name: "", parent_email: "" });
  const [athletes, setAthletes] = useState(() => {
    // Prefilled when arriving from AddChildForm's "couldn't find this athlete" handoff
    const first_name = searchParams.get("first_name") || "";
    const last_name = searchParams.get("last_name") || "";
    const dob = searchParams.get("dob") || "";
    if (first_name || last_name) {
      return [{ ...emptyAthlete(), athlete_first_name: first_name, athlete_last_name: last_name, athlete_dob: dob }];
    }
    return [emptyAthlete()];
  });
  const [referralSource, setReferralSource] = useState("");
  const [referralNote, setReferralNote] = useState("");

  useEffect(() => {
    Promise.all([
      base44.entities.Sport.list(),
      base44.entities.Team.list(),
    ]).then(([s, t]) => {
      setSports(s.filter(sp => sp.is_active !== false));
      setTeams(t.filter(tm => tm.is_active !== false));
      setLoading(false);
    });
  }, []);

  // Pre-fill parent fields from auth
  useEffect(() => {
    if (user) {
      setParent(p => ({
        parent_name: p.parent_name || user.full_name || "",
        parent_email: p.parent_email || user.email || "",
      }));
    }
  }, [user]);

  const teamsForSport = (sportId) => sportId ? teams.filter(t => t.sport_id === sportId) : teams;

  const updateAthlete = (idx, updates) => {
    setAthletes(list => list.map((a, i) => (i === idx ? { ...a, ...updates } : a)));
  };

  const addAthlete = () => setAthletes(list => [...list, emptyAthlete()]);
  const removeAthlete = (idx) => setAthletes(list => list.filter((_, i) => i !== idx));

  const isValid = () =>
    parent.parent_name && parent.parent_email &&
    athletes.length > 0 &&
    athletes.every(a => a.team_id && a.athlete_first_name && a.athlete_last_name);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid()) return;
    setSubmitting(true);
    setError(null);

    // Links multiple athletes submitted together so a reviewer can see they're
    // one family's submission, without forcing them all onto the same team.
    const siblingGroupId = athletes.length > 1
      ? `sib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      : undefined;

    try {
      await Promise.all(athletes.map(a => {
        const selectedTeam = teams.find(t => t.id === a.team_id);
        return base44.entities.RegistrationApplication.create({
          parent_user_id: user?.id || "",
          parent_name: parent.parent_name,
          parent_email: parent.parent_email,
          athlete_first_name: a.athlete_first_name,
          athlete_last_name: a.athlete_last_name,
          athlete_dob: a.athlete_dob,
          target_team_id: a.team_id,
          target_team_name: selectedTeam?.name || "",
          sport_name: selectedTeam?.name || selectedTeam?.sport_name || "",
          status: "pending",
          applied_at: new Date().toISOString(),
          referral_source: referralSource || undefined,
          referral_note: referralNote.trim() || undefined,
          sibling_group_id: siblingGroupId,
        });
      }));
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setSubmitted(false);
    setAthletes([emptyAthlete()]);
    setReferralSource("");
    setReferralNote("");
    setParent({ parent_name: user?.full_name || "", parent_email: user?.email || "" });
  };

  if (loading || isLoadingAuth) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  // Logged-out visitor — don't let them fill out the whole form only to have
  // the submit fail; send them to create an account first, then bounce back here.
  if (!isAuthenticated) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Create an account to apply</h2>
        <p className="text-muted-foreground text-sm mb-6">You'll need an account before submitting an athlete application. It only takes a minute.</p>
        <Button
          onClick={() => base44.auth.redirectToLogin(window.location.origin + "/Register")}
          className="w-full bg-primary text-primary-foreground h-11 text-base"
        >
          Sign Up / Log In
        </Button>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-12 h-12 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {athletes.length > 1 ? "Applications Submitted!" : "Application Submitted!"}
        </h2>
        <p className="text-muted-foreground">
          {athletes.length > 1
            ? "A coach will review each application shortly. You'll receive a notification once they've been approved."
            : "A coach will review it shortly. You'll receive a notification once it's been approved."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={async () => { await refreshUser(); window.location.href = "/ParentPortal"; }} className="bg-primary text-primary-foreground">
            Go to Portal
          </Button>
          <Button variant="outline" onClick={resetForm} className="border-border">
            Submit Another Application
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-dvh bg-background overflow-y-auto overscroll-contain py-10 px-4 pb-safe-nav">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-sm text-muted-foreground">Back</span>
        </div>

        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Athlete Application</h1>
          <p className="text-muted-foreground text-sm mt-2">Apply for a team. A coach will review your application before your athlete is added to the roster. Have more than one child? Add them all below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {athletes.map((a, idx) => (
            <div key={idx} className="bg-card rounded-2xl border border-border p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {athletes.length > 1 ? `Athlete ${idx + 1}` : "Athlete Information"}
                </p>
                {athletes.length > 1 && (
                  <button type="button" onClick={() => removeAthlete(idx)} className="text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Sport *</Label>
                  <Select
                    value={a.sport_id}
                    onValueChange={(v) => updateAthlete(idx, { sport_id: v, team_id: "" })}
                  >
                    <SelectTrigger className="bg-surface border-border">
                      <SelectValue placeholder="Select a sport" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border max-h-60">
                      {sports.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Team *</Label>
                  <Select
                    value={a.team_id}
                    onValueChange={(v) => updateAthlete(idx, { team_id: v })}
                    disabled={!a.sport_id}
                  >
                    <SelectTrigger className="bg-surface border-border">
                      <SelectValue placeholder={a.sport_id ? "Select a team" : "Select a sport first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border max-h-60">
                      {teamsForSport(a.sport_id).map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{t.age_group ? ` (${t.age_group})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input value={a.athlete_first_name} onChange={e => updateAthlete(idx, { athlete_first_name: e.target.value })} className="bg-surface border-border" required />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input value={a.athlete_last_name} onChange={e => updateAthlete(idx, { athlete_last_name: e.target.value })} className="bg-surface border-border" required />
                </div>
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={a.athlete_dob} onChange={e => updateAthlete(idx, { athlete_dob: e.target.value })} className="bg-surface border-border" />
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addAthlete} className="w-full border-border border-dashed">
            <Plus className="w-4 h-4 mr-2" /> Add Another Athlete
          </Button>

          {/* Parent fields — shared across all athletes in this submission */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <p className="text-sm font-semibold text-foreground">Parent / Guardian</p>
            <div>
              <Label>Full Name *</Label>
              <Input value={parent.parent_name} onChange={e => setParent(p => ({ ...p, parent_name: e.target.value }))} className="bg-surface border-border" required />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={parent.parent_email} onChange={e => setParent(p => ({ ...p, parent_email: e.target.value }))} className="bg-surface border-border" required />
            </div>
          </div>

          {/* Optional context for the reviewer */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <p className="text-sm font-semibold text-foreground">A Bit More Context <span className="text-muted-foreground font-normal">(optional)</span></p>
            <div>
              <Label className="mb-2 block">How did you hear about us?</Label>
              <Select value={referralSource} onValueChange={setReferralSource}>
                <SelectTrigger className="bg-surface border-border">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {REFERRAL_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Anything else the coach/admin should know?</Label>
              <Textarea
                value={referralNote}
                onChange={e => setReferralNote(e.target.value)}
                placeholder="e.g. Coach Smith told us to sign up, or we played last season"
                className="bg-surface border-border resize-none"
                rows={3}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <Button type="submit" disabled={submitting || !isValid()} className="w-full bg-primary text-primary-foreground h-11 text-base">
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : athletes.length > 1 ? `Submit ${athletes.length} Applications` : "Submit Application"}
          </Button>
        </form>
      </div>
    </div>
  );
}
