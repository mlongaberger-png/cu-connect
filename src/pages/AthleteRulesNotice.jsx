import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, MessageSquareWarning, Eye, Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CU_LOGO = "https://media.base44.com/images/public/69bae2515552e76ca1fbd6a0/2ff00e9bd_file_0000000089d071f8be26c9f306ac7ce1.png";

const RULES = [
  {
    icon: MessageSquareWarning,
    title: "Play nice",
    body: "Be respectful in every message, comment, and post connected to your team. No bullying, harassment, or inappropriate content — on this app or when you're representing the team elsewhere, including social media.",
  },
  {
    icon: Eye,
    title: "Your parent/guardian can see your messages",
    body: "Conversations you have through Messages are visible to your parent or guardian on their account. This app is a monitored space, not a private one.",
  },
  {
    icon: ShieldCheck,
    title: "Coaches and admins are watching out for you",
    body: "Your coaches and team admins can also see team communications and activity. That's on purpose — it keeps this a safe space for every athlete on the team.",
  },
  {
    icon: Ban,
    title: "Access can be taken away",
    body: "Your parent/guardian or a team admin can pause or remove your account access at any time, for any reason — including for not following these guidelines.",
  },
];

// One-time (but always revisitable) notice shown to promoted athletes before
// they enter their portal for the first time. Athletes skip the parent-style
// AcceptInvite onboarding (see AppShell.jsx) since there's no profile-setup
// step for them — this is the athlete-appropriate equivalent: not a form to
// fill out, just the ground rules they and their family should know about.
export default function AthleteRulesNotice() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [saving, setSaving] = useState(false);

  // Reached either as the forced first-time gate (AppShell redirects here
  // when athlete_rules_ack_at is unset) or as a voluntary revisit from the
  // sidebar — the "already acknowledged" case just skips straight to a
  // simple "Continue" with no re-acknowledgment required.
  const alreadyAcknowledged = !!user?.athlete_rules_ack_at;

  const handleContinue = async () => {
    if (alreadyAcknowledged) {
      navigate("/Portal");
      return;
    }
    setSaving(true);
    try {
      await base44.auth.updateMe({ athlete_rules_ack_at: new Date().toISOString() });
      if (refreshUser) await refreshUser();
    } finally {
      setSaving(false);
      navigate("/Portal");
    }
  };

  return (
    <div className="h-dvh bg-background flex flex-col overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
      <header className="px-6 py-4 flex items-center gap-3 border-b border-border">
        <div className="w-9 h-9 rounded-lg overflow-hidden">
          <img src={CU_LOGO} alt="CU Logo" className="w-full h-full object-cover" />
        </div>
        <span className="font-bold text-foreground text-lg">Cornerstone United</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Player Guidelines</h1>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {alreadyAcknowledged
                ? "A reminder of how your account works."
                : "Before you get started, a few things every player and their family should know."}
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
            {RULES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm mb-0.5">{title}</p>
                  <p className="text-xs text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-border">
              <Button
                type="button"
                disabled={saving}
                onClick={handleContinue}
                className="w-full bg-primary text-primary-foreground h-11 text-base font-semibold"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                  : alreadyAcknowledged ? "Back to My Portal →" : "I Understand — Continue to My Portal →"
                }
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-5">
            Questions? Talk to your coach or a parent/guardian on your account.
          </p>
        </div>
      </main>
    </div>
  );
}
