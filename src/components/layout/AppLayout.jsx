import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import OfflineIndicator from "./OfflineIndicator";

const pageTitles = {
  "/Portal": "Portal",
  "/Sports": "Sports",
  "/Teams": "Teams",
  "/Schedule": "Schedule",
  "/Messages": "Messages",
  "/Announcements": "Announcements",
  "/Documents": "Documents",
  "/ParentPortal": "Parent Portal",
  "/AthleticDirectors": "Admin",
  "/Volunteers": "Volunteers",
  "/AuditLog": "Audit Trail",
  "/NotificationSettings": "Notification Settings",
  "/HelpCenter": "Help Center",
  "/SeasonManager": "Season Manager",
  "/DataExport": "Import & Export",
  "/LegalPages": "Legal Pages",
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  
  const title = pageTitles[location.pathname] || "SportSync";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuToggle={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <OfflineIndicator />
    </div>
  );
}