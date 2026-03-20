import React from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Clock, Mail } from "lucide-react";

export default function PendingAccess() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
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
            <h1 className="text-2xl font-bold text-foreground mb-2">Pending Access</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Thanks for signing up! Your account is being reviewed and connected to your child's team.
              You'll receive an email once your access is ready.
            </p>
          </div>

          <div className="flex items-start gap-3 bg-surface rounded-xl border border-border p-4 text-left">
            <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Check your email</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                We'll send you a confirmation once an admin has connected your account to your athlete's team.
              </p>
            </div>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Check Again
          </button>

          <p className="text-xs text-muted-foreground">
            Questions? Contact your organization admin directly.
          </p>
        </div>
      </main>
    </div>
  );
}