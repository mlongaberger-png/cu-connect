import React from "react";
import { base44 } from "@/api/base44Client";
import { Users, Calendar, FileText } from "lucide-react";
import { Link } from "react-router-dom";

const CU_LOGO = "https://media.base44.com/images/public/69bae2515552e76ca1fbd6a0/2ff00e9bd_file_0000000089d071f8be26c9f306ac7ce1.png";

export default function Welcome() {
  return (
    <div className="h-dvh bg-background flex flex-col overflow-y-auto overflow-x-hidden overscroll-contain w-full" style={{ WebkitOverflowScrolling: "touch" }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden">
            <img src={CU_LOGO} alt="CU Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-foreground text-lg">Cornerstone United</span>
        </div>
        <button
          onClick={() => base44.auth.redirectToLogin(window.location.origin + "/Portal")}
          className="text-sm text-primary hover:underline font-medium"
        >
          Sign In
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-2xl mx-auto w-full">
        <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto mb-6">
          <img src={CU_LOGO} alt="Cornerstone United Logo" className="w-full h-full object-cover" />
        </div>

        <h1 className="text-4xl font-extrabold text-foreground mb-3">
          Cornerstone United Athletics
        </h1>
        <p className="text-lg text-muted-foreground mb-10 max-w-md">
          The parent portal for schedules, payments, documents, and team communication — all in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-sm">
          <button
            onClick={() => base44.auth.redirectToLogin(window.location.origin + "/Register")}
            className="flex-1 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Create Account
          </button>
          <button
            onClick={() => base44.auth.redirectToLogin(window.location.origin + "/Portal")}
            className="flex-1 px-6 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-surface transition-colors"
          >
            Log In
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          New parent? Create an account to apply for your athlete's team.{" "}
          <Link to="/ParentSignup" className="underline hover:text-foreground">Need help another way?</Link>
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14 w-full max-w-full text-left">
          {[
            { icon: Calendar, label: "Schedules", desc: "View practices, games, and events for your child's team." },
            { icon: FileText, label: "Documents", desc: "Access waivers, forms, and sign required documents." },
            { icon: Users, label: "Volunteers", desc: "Sign up for volunteer opportunities and track hours." },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-card rounded-2xl border border-border p-5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <p className="font-semibold text-foreground text-sm mb-1">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="py-5 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} Cornerstone United Athletics
        <span className="mx-2">·</span>
        {/* /LegalPages is only routed inside the authenticated app tree (see
            AppShell.jsx) -- a logged-out visitor clicking it here would hit
            the public catch-all route and get silently redirected right back
            to /welcome instead of seeing anything. /privacy-policy is the
            actual public route for this content (in AppShell's PUBLIC_PATHS
            and PublicRoutes), and is exactly what PrivacyPolicy.jsx's own
            "back" link already points to. */}
        <Link to="/privacy-policy" className="hover:text-foreground underline underline-offset-2 transition-colors">Privacy Policy</Link>
      </footer>
    </div>
  );
}