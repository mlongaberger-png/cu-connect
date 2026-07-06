import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, CheckCircle, Loader2, ArrowLeft } from "lucide-react";

export default function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sports, setSports] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    sport_id: "",
    team_id: "",
    athlete_first_name: "",
    athlete_last_name: "",
    athlete_dob: "",
    parent_name: "",
    parent_email: "",
  });

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
      setForm(f => ({
        ...f,
        parent_name: f.parent_name || user.full_name || "",
        parent_email: f.parent_email || user.email || "",
      }));
    }
  }, [user]);

  const filteredTeams = form.sport_id
    ? teams.filter(t => t.sport_id === form.sport_id)
    : teams;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.team_id || !form.athlete_first_name || !form.athlete_last_name || !form.parent_email) return;
    setSubmitting(true);
    setError(null);

    const selectedTeam = teams.find(t => t.id === form.team_id);
    const selectedSport = sports.find(s => s.id === form.sport_id);

    try {
      await base44.entities.RegistrationApplication.create({
        parent_user_id: user?.id || "",
        parent_name: form.parent_name,
        parent_email: form.parent_email,
        athlete_first_name: form.athlete_first_name,
        athlete_last_name: form.athlete_last_name,
        athlete_dob: form.athlete_dob,
        target_team_id: form.team_id,
        target_team_name: selectedTeam?.name || "",
        sport_name: selectedTeam?.name || selectedTeam?.sport_name || "",
        status: "pending",
        applied_at: new Date().toISOString(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-12 h-12 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Application Submitted!</h2>
        <p className="text-muted-foreground">A coach will review it shortly. You'll receive a notification once it's been approved.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => window.location.href = "/ParentPortal"} className="bg-primary text-primary-foreground">
            Go to Portal
          </Button>
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ sport_id: "", team_id: "", athlete_first_name: "", athlete_last_name: "", athlete_dob: "", parent_name: user?.full_name || "", parent_email: user?.email || "" }); }} className="border-border">
            Submit Another Application
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10 px-4 pb-28">
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
          <p className="text-muted-foreground text-sm mt-2">Apply for a team. A coach will review your application before your athlete is added to the roster.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
          {/* Sport & Team */}
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Sport *</Label>
              <Select
                value={form.sport_id}
                onValueChange={(v) => setForm({ ...form, sport_id: v, team_id: "" })}
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
                value={form.team_id}
                onValueChange={(v) => setForm({ ...form, team_id: v })}
                disabled={!form.sport_id}
              >
                <SelectTrigger className="bg-surface border-border">
                  <SelectValue placeholder={form.sport_id ? "Select a team" : "Select a sport first"} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border max-h-60">
                  {filteredTeams.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.age_group ? ` (${t.age_group})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Athlete fields */}
          <div className="pt-4 border-t border-border space-y-4">
            <p className="text-sm font-semibold text-foreground">Athlete Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input value={form.athlete_first_name} onChange={e => setForm({ ...form, athlete_first_name: e.target.value })} className="bg-surface border-border" required />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input value={form.athlete_last_name} onChange={e => setForm({ ...form, athlete_last_name: e.target.value })} className="bg-surface border-border" required />
              </div>
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" value={form.athlete_dob} onChange={e => setForm({ ...form, athlete_dob: e.target.value })} className="bg-surface border-border" />
            </div>
          </div>

          {/* Parent fields */}
          <div className="pt-4 border-t border-border space-y-4">
            <p className="text-sm font-semibold text-foreground">Parent / Guardian</p>
            <div>
              <Label>Full Name *</Label>
              <Input value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} className="bg-surface border-border" required />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.parent_email} onChange={e => setForm({ ...form, parent_email: e.target.value })} className="bg-surface border-border" required />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground h-11 text-base">
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : "Submit Application"}
          </Button>
        </form>
      </div>
    </div>
  );
}