import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Clock, Mail, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function PendingAccess() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    await new Promise(r => setTimeout(r, 1500));
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Waiting for Access</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your account is set up, but you haven't been linked to a team yet. An admin needs to connect your account to your child's roster.
            </p>
          </div>

          {user?.email && (
            <div className="flex items-start gap-3 bg-surface rounded-xl border border-border p-4 text-left">
              <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Signed in as</p>
                <p className="text-xs text-muted-foreground mt-0.5 break-all">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-1">Make sure this matches the email your admin has on file.</p>
              </div>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking..." : "Check Again"}
          </button>

          <p className="text-xs text-muted-foreground">
            Questions? Contact your organization admin and share the email above so they can link you to your athlete.
          </p>
        </div>
      </main>
    </div>
  );
}