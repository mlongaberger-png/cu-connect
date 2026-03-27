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

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TopBar onMenuToggle={() => setSidebarOpen(true)} title={title} />
        {/* Main content — pb accounts for bottom tab bar on mobile */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            transform: "translateZ(0)",
          }}
        >
          <div className="pb-20 lg:pb-6">
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