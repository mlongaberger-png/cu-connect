import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import OfflineIndicator from "./OfflineIndicator";
import BottomTabBar from "./BottomTabBar";
import PageTransition from "./PageTransition";

// Pages that manage their own full-height layout (no scroll wrapper)
const FULLSCREEN_PAGES = ["/Messages"];

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
  const isFullscreen = FULLSCREEN_PAGES.some(p => location.pathname.startsWith(p));

  return (
    <div className="flex h-screen overflow-hidden bg-background safe-area-left safe-area-right">
      {/* Sidebar — desktop always visible, mobile as overlay */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TopBar onMenuToggle={() => setSidebarOpen(true)} title={title} />
        {/* Main content — pb-14 on mobile reserves space for the fixed bottom tab bar */}
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col pb-14 lg:pb-0" style={{ transform: "translateZ(0)" }}>
          <PageTransition>
            {isFullscreen ? (
              /* Full-height pages (e.g. Messages) manage their own scroll */
              <div className="h-full flex flex-col overflow-hidden">
                <Outlet />
              </div>
            ) : (
              /* Normal pages: scrollable with bottom padding for tab bar */
              <div
                className="overflow-y-auto overflow-x-hidden h-full"
                style={{
                  overscrollBehavior: "contain",
                  WebkitOverflowScrolling: "touch",
                  paddingBottom: "env(safe-area-inset-bottom, 0px)",
                }}
              >
                <Outlet />
              </div>
            )}
          </PageTransition>
        </main>
      </div>

      {/* Bottom tab bar — mobile only */}
      <BottomTabBar onOpenSidebar={() => setSidebarOpen(true)} />

      <OfflineIndicator />
    </div>
  );
}