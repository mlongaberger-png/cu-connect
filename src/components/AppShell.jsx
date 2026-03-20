import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";

import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Sports from "@/pages/Sports";
import Teams from "@/pages/Teams";
import TeamDetail from "@/pages/TeamDetail";
import Schedule from "@/pages/Schedule";
import Messages from "@/pages/Messages";
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

const PUBLIC_PATHS = ["/welcome", "/ParentSignup", "/Register"];
const STAFF_ONLY_PATHS = [
  "/Dashboard", "/Sports", "/Teams", "/Schedule", "/Messages",
  "/Announcements", "/Documents", "/AthleticDirectors", "/Volunteers", "/TeamDetail"
];

const PublicRoutes = () => (
  <Routes>
    <Route path="/welcome" element={<Welcome />} />
    <Route path="/ParentSignup" element={<ParentSignup />} />
    <Route path="/Register" element={<Register />} />
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

  // Determine home route by role
  const homeRoute =
    role === "admin" || role === "athletic_director" ? "/Dashboard" :
    role === "coach" ? "/Schedule" :
    role === "parent" ? "/Portal" :
    null; // unknown role → pending

  // Unknown / missing role → PendingAccess
  if (!homeRoute) {
    return (
      <Routes>
        <Route path="*" element={<PendingAccess />} />
      </Routes>
    );
  }

  // Parents must not access staff-only paths
  if (role === "parent" && STAFF_ONLY_PATHS.some(p => currentPath.startsWith(p))) {
    return <Navigate to="/Portal" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homeRoute} replace />} />
      <Route path="/welcome" element={<Navigate to={homeRoute} replace />} />
      <Route path="/pending-access" element={<PendingAccess />} />

      {/* Staff layout (with sidebar) */}
      <Route element={<AppLayout />}>
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/Sports" element={<Sports />} />
        <Route path="/Teams" element={<Teams />} />
        <Route path="/TeamDetail" element={<TeamDetail />} />
        <Route path="/Schedule" element={<Schedule />} />
        <Route path="/Messages" element={<Messages />} />
        <Route path="/Announcements" element={<Announcements />} />
        <Route path="/Documents" element={<Documents />} />
        <Route path="/ParentPortal" element={<ParentPortal />} />
        <Route path="/AthleticDirectors" element={<AthleticDirectors />} />
        <Route path="/Volunteers" element={<Volunteers />} />
        <Route path="/AuditLog" element={<AuditLog />} />
        <Route path="/NotificationSettings" element={<NotificationSettings />} />
        <Route path="/HelpCenter" element={<HelpCenter />} />
        <Route path="/SeasonManager" element={<SeasonManager />} />
        <Route path="/DataExport" element={<DataExport />} />
        <Route path="/LegalPages" element={<LegalPages />} />
      </Route>

      {/* Standalone pages (no sidebar) */}
      <Route path="/Portal" element={<ParentPortal />} />
      <Route path="/Register" element={<Register />} />
      <Route path="/ParentSignup" element={<ParentSignup />} />

      {/* Catch-all → role home */}
      <Route path="*" element={<Navigate to={homeRoute} replace />} />
    </Routes>
  );
}