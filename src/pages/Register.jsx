import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, CheckCircle, AlertCircle, Loader2, ChevronRight, DollarSign, Users } from "lucide-react";

function RegistrationBrowser() {
  const urlParams = new URLSearchParams(window.location.search);
  const sportParam = urlParams.get("sport") || "";

  const [sports, setSports] = useState([]);
  const [teams, setTeams] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedSport, setSelectedSport] = useState(sportParam);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Sport.list(),
      base44.entities.Team.list(),
      base44.entities.TeamRegistration.filter({ is_open: true }),
    ]).then(([s, t, r]) => {
      setSports(s.filter(sp => sp.is_active !== false));
      setTeams(t.filter(tm => tm.is_active !== false));
      setRegistrations(r);
      setLoading(false);
    });
  }, []);

  const filteredTeams = selectedSport
    ? teams.filter(t => t.sport_id === selectedSport)
    : teams;

  const filteredRegs = selectedTeam
    ? registrations.filter(r => r.team_id === selectedTeam)
    : selectedSport
    ? registrations.filter(r => filteredTeams.some(t => t.id === r.team_id))
    : registrations;

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Athlete Registration</h1>
          <p className="text-muted-foreground text-sm mt-2">Select a sport and team to find open registration forms.</p>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-2xl border border-border p-5 mb-6 space-y-4">
          <div>
            <Label className="mb-2 block">Sport</Label>
            <Select value={selectedSport} onValueChange={(v) => { setSelectedSport(v); setSelectedTeam(""); }}>
              <SelectTrigger className="bg-surface border-border">
                <SelectValue placeholder="All Sports" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value={null}>All Sports</SelectItem>
                {sports.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Team</Label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="bg-surface border-border">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value={null}>All Teams</SelectItem>
                {filteredTeams.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name} {t.age_group ? `(${t.age_group})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Open Registration Forms */}
        {filteredRegs.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold">No open registrations found</p>
            <p className="text-muted-foreground text-sm mt-1">Try a different sport or team, or check back later.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium">{filteredRegs.length} open registration{filteredRegs.length !== 1 ? "s" : ""}</p>
            {filteredRegs.map(reg => (
              <div key={reg.id} className="bg-card rounded-2xl border border-border p-5 hover:border-primary/40 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{reg.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{reg.team_name} · {reg.sport_name}</p>
                    {reg.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{reg.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {reg.season && <span className="capitalize">{reg.season} {reg.year}</span>}
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {reg.fee_amount > 0 ? `$${reg.fee_amount} fee` : "Free"}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => window.location.href = `/Register?reg=${reg.id}`}
                    className="bg-primary text-primary-foreground shrink-0"
                    size="sm"
                  >
                    Register <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RegistrationForm({ regId }) {
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get("success");
  const cancelled = urlParams.get("cancelled");

  const [form, setForm] = useState({
    player_first_name: "", player_last_name: "", player_dob: "",
    jersey_number: "", position: "", medical_notes: "",
    emergency_contact: "", emergency_phone: "",
    parent_name: "", parent_email: "", parent_phone: "",
    custom_field_1_value: "", custom_field_2_value: ""
  });

  useEffect(() => {
    if (success) { setSubmitted(true); setLoading(false); return; }
    base44.entities.TeamRegistration.filter({ id: regId })
      .then(results => { setRegistration(results[0] || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [regId, success]);

  const isInIframe = () => { try { return window.self !== window.top; } catch { return true; } };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isInIframe()) {
      alert("Registration payments only work from the published app. Please open the registration link directly.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const origin = window.location.origin;
    const res = await base44.functions.invoke("registrationCheckout", {
      registration_id: regId,
      submission_data: form,
      success_url: `${origin}/Register?success=1`,
      cancel_url: `${origin}/Register?reg=${regId}&cancelled=1`
    });
    if (res.data.free) {
      setSubmitted(true);
    } else if (res.data.checkout_url) {
      window.location.href = res.data.checkout_url;
    } else {
      setError(res.data.error || "Something went wrong");
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
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Registration Submitted!</h2>
        <p className="text-muted-foreground">
          {registration?.fee_amount > 0
            ? "Your payment was successful. You'll receive an invitation to the parent portal after your registration is reviewed."
            : "Your registration has been submitted. You'll receive an invitation to the parent portal after it's reviewed."}
        </p>
        <Button onClick={() => window.location.href = "/Register"} variant="outline" className="mt-6 border-border">
          Back to Registrations
        </Button>
      </div>
    </div>
  );

  if (!registration) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-foreground font-semibold">Registration not found</p>
        <Button onClick={() => window.location.href = "/Register"} variant="outline" className="mt-4 border-border">Browse Registrations</Button>
      </div>
    </div>
  );

  if (!registration.is_open) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
        <p className="text-foreground font-semibold">Registration is closed</p>
        <Button onClick={() => window.location.href = "/Register"} variant="outline" className="mt-4 border-border">Browse Registrations</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{registration.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{registration.team_name} · {registration.sport_name}</p>
          {registration.description && <p className="text-muted-foreground text-sm mt-3">{registration.description}</p>}
          {registration.fee_amount > 0 && (
            <div className="mt-4 inline-block px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm">
              Registration Fee: ${registration.fee_amount}
              {registration.fee_description && <span className="text-primary/70 font-normal"> · {registration.fee_description}</span>}
            </div>
          )}
        </div>

        {cancelled && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm text-center">
            Payment was cancelled. You can try again below.
          </div>
        )}

        <Button variant="ghost" onClick={() => window.location.href = "/Register"} className="mb-4 text-muted-foreground hover:text-foreground text-sm -ml-2">
          ← Back to all registrations
        </Button>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Athlete Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>First Name *</Label><Input value={form.player_first_name} onChange={e => setForm({...form, player_first_name: e.target.value})} className="bg-surface border-border" required /></div>
              <div><Label>Last Name *</Label><Input value={form.player_last_name} onChange={e => setForm({...form, player_last_name: e.target.value})} className="bg-surface border-border" required /></div>
            </div>
          </div>

          {registration.collect_dob && <div><Label>Date of Birth</Label><Input type="date" value={form.player_dob} onChange={e => setForm({...form, player_dob: e.target.value})} className="bg-surface border-border" /></div>}
          {registration.collect_jersey && <div><Label>Jersey Number</Label><Input value={form.jersey_number} onChange={e => setForm({...form, jersey_number: e.target.value})} className="bg-surface border-border" /></div>}
          {registration.collect_position && <div><Label>Position</Label><Input value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="bg-surface border-border" /></div>}
          {registration.collect_medical && <div><Label>Medical Notes / Allergies</Label><Input value={form.medical_notes} onChange={e => setForm({...form, medical_notes: e.target.value})} className="bg-surface border-border" placeholder="Any relevant medical information" /></div>}
          {registration.collect_emergency && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Emergency Contact</Label><Input value={form.emergency_contact} onChange={e => setForm({...form, emergency_contact: e.target.value})} className="bg-surface border-border" /></div>
              <div><Label>Emergency Phone</Label><Input value={form.emergency_phone} onChange={e => setForm({...form, emergency_phone: e.target.value})} className="bg-surface border-border" /></div>
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-3">Parent / Guardian Information</p>
            <div className="space-y-3">
              <div><Label>Full Name *</Label><Input value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} className="bg-surface border-border" required /></div>
              <div><Label>Email Address *</Label><Input type="email" value={form.parent_email} onChange={e => setForm({...form, parent_email: e.target.value})} className="bg-surface border-border" required /></div>
              <div><Label>Phone Number</Label><Input value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} className="bg-surface border-border" /></div>
            </div>
          </div>

          {registration.custom_field_1_label && <div><Label>{registration.custom_field_1_label}</Label><Input value={form.custom_field_1_value} onChange={e => setForm({...form, custom_field_1_value: e.target.value})} className="bg-surface border-border" /></div>}
          {registration.custom_field_2_label && <div><Label>{registration.custom_field_2_label}</Label><Input value={form.custom_field_2_value} onChange={e => setForm({...form, custom_field_2_value: e.target.value})} className="bg-surface border-border" /></div>}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground h-11 text-base">
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : registration.fee_amount > 0 ? `Register & Pay $${registration.fee_amount}` : "Submit Registration"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function Register() {
  const urlParams = new URLSearchParams(window.location.search);
  const regId = urlParams.get("reg");

  if (regId) return <RegistrationForm regId={regId} />;
  return <RegistrationBrowser />;
}