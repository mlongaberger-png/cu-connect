import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";

import AppLayout from "@/components/layout/AppLayout";
import StaffRoute from "@/components/StaffRoute";
import Dashboard from "@/pages/Dashboard";
import Sports from "@/pages/Sports";
import Teams from "@/pages/Teams";
import TeamDetail from "@/pages/TeamDetail";
import Schedule from "@/pages/Schedule";
import Announcements from "@/pages/Announcements";
import Documents from "@/pages/Documents";
import ParentPortal from "@/pages/ParentPortal";
import Register from "@/pages/Register";
import AthleticDirectors from "@/pages/AthleticDirectors";
import Volunteers from "@/pages/Volunteers";
import AuditLog from "@/pages/AuditLog";
import NotificationSettings from "@/pages/NotificationSettings";
import HelpCenter from "@/pages/HelpCenter";
import SeasonManager from "@/pages/SeasonManager";
import DataExport from "@/pages/DataExport";
import LegalPages from "@/pages/LegalPages";
import ParentSignup from "@/pages/ParentSignup";
import Welcome from "@/pages/Welcome";
import PendingAccess from "@/pages/PendingAccess";
import AthletePaused from "@/pages/AthletePaused";
import AcceptInvite from "@/pages/AcceptInvite";
import AthleteRulesNotice from "@/pages/AthleteRulesNotice";
import AccountSettings from "@/pages/AccountSettings";
import Gallery from "@/pages/Gallery";
import PracticePlans from "@/pages/PracticePlans";
import GameDayPlaylists from "@/pages/GameDayPlaylists";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import ParentCalendar from "@/pages/ParentCalendar";
import Playbooks from "@/pages/Playbooks";
import CoachesTraining from "@/pages/CoachesTraining";
import MessagesLayout from "@/pages/MessagesLayout";
import ParentSportsRegister from "@/pages/ParentSportsRegister";
import SRD from "@/pages/SRD";
import SecurityReport from "@/pages/SecurityReport";
import UIUXAuditReport from "@/pages/UIUXAuditReport";
import IssuesFixedReport from "@/pages/IssuesFixedReport";
import Applications from "@/pages/Applications";
import UniformInventory from "@/pages/UniformInventory";
import AppDocumentation from "@/pages/AppDocumentation";

const PUBLIC_PATHS = ["/welcome", "/ParentSignup", "/Register", "/AcceptInvite", "/privacy-policy"];
const STAFF_ONLY_PATHS = [
  "/Teams",
  "/Announcements", "/Documents", "/AthleticDirectors", "/Volunteers", "/TeamDetail"
];

const PublicRoutes = () => (
  <Routes>
    <Route path="/welcome" element={<Welcome />} />
    <Route path="/ParentSignup" element={<ParentSignup />} />
    <Route path="/Register" element={<Register />} />
    <Route path="/AcceptInvite" element={<AcceptInvite />} />
    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
    <Route path="*" element={<Navigate to="/welcome" replace />} />
  </Routes>
);

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
  </div>
);

export default function AppShell() {
  const { isLoadingAuth, isLoadingPublicSettings, authError, user, isAuthenticated } = useAuth();
  const currentPath = window.location.pathname;

  // Loading state
  if (isLoadingPublicSettings || isLoadingAuth) return <Spinner />;

  // Always allow public pages through
  if (PUBLIC_PATHS.some(p => currentPath.startsWith(p))) return <PublicRoutes />;

  // Not authenticated → Welcome
  if (!isAuthenticated || authError?.type === "auth_required") return <PublicRoutes />;

  // Authenticated but not registered in this app
  if (authError?.type === "user_not_registered") return <UserNotRegisteredError />;

  // Any other error — show friendly fallback
  if (authError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-sm">
          <p className="text-foreground font-semibold mb-2">Something went wrong</p>
          <p className="text-sm text-muted-foreground">{authError.message || "Please refresh and try again."}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const role = user?.role;

  // Newly invited parents/grandparents who haven't completed setup yet → AcceptInvite onboarding
  if (currentPath !== "/AcceptInvite" && user && !user.setup_complete && (role === "parent" || role === "grandparent")) {
    return (
      <Routes>
        <Route path="*" element={<AcceptInvite />} />
      </Routes>
    );
  }

  // Brand-new self-signed-up accounts with no application submitted yet and no
  // athlete linked to them → send straight into the team application form
  // instead of an empty portal.
  if (user?.needsApplication && currentPath !== "/Register") {
    return (
      <Routes>
        <Route path="/Register" element={<Register />} />
        <Route path="*" element={<Navigate to="/Register" replace />} />
      </Routes>
    );
  }

  // All authenticated users land on Portal; unknown/pending/user role → PendingAccess
  // "ad" is accepted as an alias for "athletic_director"
  // "athlete" = a promoted athlete's own login (see Player.athlete_email / PromoteAthleteModal).
  // Athletes intentionally skip the AcceptInvite onboarding gate above — there is no
  // profile-setup step defined for them. Instead, a first-time promoted athlete sees
  // a one-time Player Guidelines/monitoring notice (not a form) before landing on
  // /Portal. Nothing downstream reads user.setup_complete outside the AcceptInvite
  // gate, so skipping that gate for athletes is safe.
  if (currentPath !== "/AthleteRules" && role === "athlete" && !user?.athlete_rules_ack_at) {
    return (
      <Routes>
        <Route path="*" element={<AthleteRulesNotice />} />
      </Routes>
    );
  }

  const KNOWN_ROLES = new Set(["admin", "coach", "athletic_director", "ad", "parent", "grandparent", "user", "athlete"]);
  const homeRoute = role && role !== "pending" && KNOWN_ROLES.has(role) ? "/Portal" : null;

  // Unknown / missing role → PendingAccess
  if (!homeRoute) {
    return (
      <Routes>
        <Route path="*" element={<PendingAccess />} />
      </Routes>
    );
  }

  // Paused athlete login (parent-controlled kill switch, User.athlete_paused) →
  // block all routes and show a clear "Access Paused" state instead of /Portal.
  // This is a client-side convenience only — the real enforcement is server-side
  // RLS on Player/Message (athlete_paused: false AND-condition), so a paused
  // athlete's data access is cut off even if this check is bypassed.
  if (role === "athlete" && user?.athlete_paused) {
    return (
      <Routes>
        <Route path="*" element={<AthletePaused />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homeRoute} replace />} />
      <Route path="/welcome" element={<Navigate to={homeRoute} replace />} />
      <Route path="/pending-access" element={<PendingAccess />} />

      {/* Shared layout wrapper */}
      <Route element={<AppLayout />}>

        {/* ── All-roles routes ── */}
        <Route path="/Portal" element={<Dashboard />} />
        <Route path="/ParentPortal" element={<ParentPortal />} />
        <Route path="/ParentCalendar" element={<ParentCalendar />} />
        <Route path="/NotificationSettings" element={<NotificationSettings />} />
        <Route path="/HelpCenter" element={<HelpCenter />} />
        <Route path="/LegalPages" element={<LegalPages />} />
        <Route path="/AccountSettings" element={<AccountSettings />} />
        <Route path="/Gallery" element={<Gallery />} />
        <Route path="/GameDayPlaylists" element={<GameDayPlaylists />} />
        <Route path="/Playbooks" element={<Playbooks />} />
        <Route path="/Messages" element={<MessagesLayout />} />
        <Route path="/sports-directory" element={<ParentSportsRegister />} />
        <Route path="/Register" element={<Register />} />
        <Route path="/AthleteRules" element={<AthleteRulesNotice />} />

        {/* ── Staff-only routes — redirects non-staff to /Portal ── */}
        <Route element={<StaffRoute />}>
          <Route path="/Sports" element={<Sports />} />
          <Route path="/Teams" element={<Teams />} />
          <Route path="/CoachesTraining" element={<CoachesTraining />} />
          <Route path="/TeamDetail" element={<TeamDetail />} />
          <Route path="/Schedule" element={<Schedule />} />
          <Route path="/Announcements" element={<Announcements />} />
          <Route path="/Documents" element={<Documents />} />
          <Route path="/AthleticDirectors" element={<AthleticDirectors />} />
          <Route path="/Volunteers" element={<Volunteers />} />
          <Route path="/AuditLog" element={<AuditLog />} />
          <Route path="/SeasonManager" element={<SeasonManager />} />
          <Route path="/DataExport" element={<DataExport />} />
          <Route path="/PracticePlans" element={<PracticePlans />} />
          <Route path="/Applications" element={<Applications />} />
          <Route path="/UniformInventory" element={<UniformInventory />} />
        </Route>

      </Route>

      {/* Public legal pages — always accessible */}
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />

      {/* Internal review only — not linked in navigation */}
      <Route path="/srd" element={<SRD />} />
      <Route path="/SecurityReport" element={<SecurityReport />} />
      <Route path="/UIUXAuditReport" element={<UIUXAuditReport />} />
      <Route path="/IssuesFixedReport" element={<IssuesFixedReport />} />
      <Route path="/AppDocumentation" element={<AppDocumentation />} />

      <Route path="/ParentSignup" element={<ParentSignup />} />

      {/* Catch-all → role home */}
      <Route path="*" element={<Navigate to={homeRoute} replace />} />
    </Routes>
  );
}