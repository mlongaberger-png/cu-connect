import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import OfflineIndicator from "./OfflineIndicator";
import BottomTabBar from "./BottomTabBar";
import PageTransition from "./PageTransition";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

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
    "/AccountSettings": "Account Settings",
    "/Gallery": "Gallery",
    "/PracticePlans": "Practice Plans",
  };

  const title = pageTitles[location.pathname] || "Cornerstone United Athletics";

  return (
    <div className="flex h-screen overflow-hidden bg-background safe-area-left safe-area-right">
      {/* Sidebar — desktop always visible, mobile as overlay */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuToggle={() => setSidebarOpen(true)} title={title} />
        {/* Main content — add bottom padding on mobile for the tab bar */}
        <main className="flex-1 overflow-y-auto" style={{ overscrollBehaviorY: "contain", paddingBottom: 0 }}>
          <div className="pb-16 lg:pb-0 h-full">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>

      {/* Bottom tab bar — mobile only */}
      <BottomTabBar onOpenSidebar={() => setSidebarOpen(true)} />

      <OfflineIndicator />
    </div>
  );
}