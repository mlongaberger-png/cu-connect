import React from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, PauseCircle, Mail } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

// Shown instead of /Portal when a promoted athlete's login has been paused
// by their parent/guardian (User.athlete_paused === true). Distinct from
// PendingAccess, which is for accounts that were never linked at all —
// this is a deliberate, reversible pause a guardian controls from
// AccountSettings, not a setup/approval state.
export default function AthletePaused() {
  const { user } = useAuth();

  return (
    <div className="h-dvh bg-background flex flex-col overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
      <header className="px-6 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-foreground text-lg">Cornerstone United</span>
        </div>
        <button
          onClick={() => base44.auth.logout("/welcome")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign Out
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="bg-card rounded-2xl border border-border p-10 text-center max-w-md w-full space-y-5">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto">
            <PauseCircle className="w-8 h-8 text-orange-400" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Access Paused</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your account access has been temporarily paused by your parent or guardian. You won't be able to view
              messages, schedules, or your profile until it's turned back on.
            </p>
          </div>

          {user?.email && (
            <div className="flex items-start gap-3 bg-surface rounded-xl border border-border p-4 text-left">
              <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Signed in as</p>
                <p className="text-xs text-muted-foreground mt-0.5 break-all">{user.email}</p>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Ask your parent or guardian to re-enable your access from their Account Settings, or contact your
            organization admin with questions.
          </p>
        </div>
      </main>
    </div>
  );
}
