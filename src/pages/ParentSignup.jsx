import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function ParentSignup() {
  const [form, setForm] = useState({
    parent_name: "",
    parent_email: "",
    parent_phone: "",
    child_names: "",
    sport_interest: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const { data: sports = [] } = useQuery({
    queryKey: ["sports-public"],
    queryFn: () => base44.entities.Sport.list(),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await base44.functions.invoke("parentSignup", form);
    setSubmitting(false);
    if (res.data?.success) {
      setSubmitted(true);
    } else {
      setError(res.data?.error || "Something went wrong. Please try again.");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Request Submitted!</h2>
          <p className="text-sm text-muted-foreground">
            Thank you! An administrator will review your request and send you an email once your account is approved.
          </p>
          <p className="text-xs text-muted-foreground">
            Check your inbox at <span className="text-primary">{form.parent_email}</span> for updates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-sidebar border-b border-sidebar-border px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
          <img
            src="https://media.base44.com/images/public/69bae2515552e76ca1fbd6a0/2ff00e9bd_file_0000000089d071f8be26c9f306ac7ce1.png"
            alt="Logo"
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h1 className="text-sm font-bold text-primary leading-tight">Cornerstone United</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Athletics</p>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-start justify-center p-4 md:p-8">
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 max-w-lg w-full space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Request Parent Access</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Fill out the form below. An admin will review and approve your access within 1–2 business days.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Your Full Name *</Label>
                <Input
                  required
                  placeholder="Jane Smith"
                  value={form.parent_name}
                  onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email Address *</Label>
                <Input
                  required
                  type="email"
                  placeholder="jane@example.com"
                  value={form.parent_email}
                  onChange={e => setForm(f => ({ ...f, parent_email: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                type="tel"
                placeholder="(555) 000-0000"
                value={form.parent_phone}
                onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Child Name(s) *</Label>
              <Input
                required
                placeholder="Alex Smith, Jordan Smith"
                value={form.child_names}
                onChange={e => setForm(f => ({ ...f, child_names: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Separate multiple children with commas.</p>
            </div>

            {sports.length > 0 && (
              <div className="space-y-1.5">
                <Label>Sport / Team Interest <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {sports.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, sport_interest: f.sport_interest === s.name ? "" : s.name }))}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                        form.sport_interest === s.name
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                      }`}
                    >
                      {s.icon && <span className="mr-1">{s.icon}</span>}{s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Additional Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <textarea
                rows={3}
                placeholder="Any additional information for the admin..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                {error}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Submitting…" : "Submit Access Request"}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => base44.auth.redirectToLogin(window.location.origin + "/Portal")}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}