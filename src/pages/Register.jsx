import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function Register() {
  const urlParams = new URLSearchParams(window.location.search);
  const regId = urlParams.get("reg");
  const success = urlParams.get("success");
  const cancelled = urlParams.get("cancelled");

  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!success);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    player_first_name: "", player_last_name: "", player_dob: "",
    jersey_number: "", position: "", medical_notes: "",
    emergency_contact: "", emergency_phone: "",
    parent_name: "", parent_email: "", parent_phone: "",
    custom_field_1_value: "", custom_field_2_value: ""
  });

  useEffect(() => {
    if (!regId) { setLoading(false); return; }
    base44.entities.TeamRegistration.filter({ id: regId })
      .then(results => {
        setRegistration(results[0] || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [regId]);

  const isInIframe = () => {
    try { return window.self !== window.top; } catch { return true; }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isInIframe()) {
      alert("Registration payments only work from the published app. Please open the registration link directly.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
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
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!regId || !registration) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-foreground font-semibold">Registration not found</p>
        <p className="text-muted-foreground text-sm mt-1">Please check your link and try again.</p>
      </div>
    </div>
  );

  if (!registration.is_open) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
        <p className="text-foreground font-semibold">Registration is closed</p>
        <p className="text-muted-foreground text-sm mt-1">This registration form is not currently accepting submissions.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Registration Submitted!</h2>
        <p className="text-muted-foreground">
          {registration.fee_amount > 0
            ? "Your payment was successful. You'll receive an invitation to the parent portal shortly after your registration is reviewed."
            : "Your registration has been submitted. You'll receive an invitation to the parent portal shortly after it's reviewed."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
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

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
          {/* Player Info */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Athlete Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>First Name *</Label><Input value={form.player_first_name} onChange={e => setForm({...form, player_first_name: e.target.value})} className="bg-surface border-border" required /></div>
              <div><Label>Last Name *</Label><Input value={form.player_last_name} onChange={e => setForm({...form, player_last_name: e.target.value})} className="bg-surface border-border" required /></div>
            </div>
          </div>

          {registration.collect_dob && (
            <div><Label>Date of Birth</Label><Input type="date" value={form.player_dob} onChange={e => setForm({...form, player_dob: e.target.value})} className="bg-surface border-border" /></div>
          )}
          {registration.collect_jersey && (
            <div><Label>Jersey Number</Label><Input value={form.jersey_number} onChange={e => setForm({...form, jersey_number: e.target.value})} className="bg-surface border-border" /></div>
          )}
          {registration.collect_position && (
            <div><Label>Position</Label><Input value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="bg-surface border-border" /></div>
          )}
          {registration.collect_medical && (
            <div><Label>Medical Notes / Allergies</Label><Input value={form.medical_notes} onChange={e => setForm({...form, medical_notes: e.target.value})} className="bg-surface border-border" placeholder="Any relevant medical information" /></div>
          )}
          {registration.collect_emergency && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Emergency Contact</Label><Input value={form.emergency_contact} onChange={e => setForm({...form, emergency_contact: e.target.value})} className="bg-surface border-border" /></div>
              <div><Label>Emergency Phone</Label><Input value={form.emergency_phone} onChange={e => setForm({...form, emergency_phone: e.target.value})} className="bg-surface border-border" /></div>
            </div>
          )}

          {/* Parent Info */}
          <div className="pt-2 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-3">Parent / Guardian Information</p>
            <div className="space-y-3">
              <div><Label>Full Name *</Label><Input value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} className="bg-surface border-border" required /></div>
              <div><Label>Email Address *</Label><Input type="email" value={form.parent_email} onChange={e => setForm({...form, parent_email: e.target.value})} className="bg-surface border-border" required /></div>
              <div><Label>Phone Number</Label><Input value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} className="bg-surface border-border" /></div>
            </div>
          </div>

          {/* Custom Fields */}
          {registration.custom_field_1_label && (
            <div><Label>{registration.custom_field_1_label}</Label><Input value={form.custom_field_1_value} onChange={e => setForm({...form, custom_field_1_value: e.target.value})} className="bg-surface border-border" /></div>
          )}
          {registration.custom_field_2_label && (
            <div><Label>{registration.custom_field_2_label}</Label><Input value={form.custom_field_2_value} onChange={e => setForm({...form, custom_field_2_value: e.target.value})} className="bg-surface border-border" /></div>
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground h-11 text-base">
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : registration.fee_amount > 0 ? `Register & Pay $${registration.fee_amount}` : "Submit Registration"}
          </Button>
        </form>
      </div>
    </div>
  );
}