import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Sports from '@/pages/Sports';
import Teams from '@/pages/Teams';
import TeamDetail from '@/pages/TeamDetail';
import Schedule from '@/pages/Schedule';
import Messages from '@/pages/Messages';
import Announcements from '@/pages/Announcements';
import Documents from '@/pages/Documents';
import ParentPortal from '@/pages/ParentPortal';
import Register from '@/pages/Register';
import AthleticDirectors from '@/pages/AthleticDirectors';
import Volunteers from '@/pages/Volunteers';
import AuditLog from '@/pages/AuditLog';
import NotificationSettings from '@/pages/NotificationSettings';
import HelpCenter from '@/pages/HelpCenter';
import SeasonManager from '@/pages/SeasonManager';
import DataExport from '@/pages/DataExport';
import LegalPages from '@/pages/LegalPages';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // Role-based default redirect
  const role = user?.role;
  const homeRoute = role === "admin" || role === "athletic_director"
    ? "/Dashboard"
    : role === "coach"
    ? "/Schedule"
    : "/Portal"; // parents and unknown roles go to Portal

  // Routes that parents must not access
  const staffOnlyPaths = ["/Dashboard", "/Sports", "/Teams", "/Schedule", "/Messages", "/Announcements", "/Documents", "/AthleticDirectors", "/Volunteers", "/TeamDetail"];
  const isParent = role === "parent";
  const currentPath = window.location.pathname;
  if (isParent && staffOnlyPaths.some(p => currentPath.startsWith(p))) {
    return <Navigate to="/Portal" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homeRoute} replace />} />
      {/* Admin layout routes */}
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
      {/* Parent portal — standalone, no admin sidebar */}
      <Route path="/Portal" element={<ParentPortal />} />
      <Route path="/Register" element={<Register />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App