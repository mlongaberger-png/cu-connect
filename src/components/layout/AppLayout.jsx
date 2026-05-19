import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import OfflineIndicator from "./OfflineIndicator";
import BottomTabBar from "./BottomTabBar";
import PageTransition from "./PageTransition";
import SponsorTicker from "@/components/sponsors/SponsorTicker";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Pages that manage their own full-height layout (no scroll wrapper)
const FULLSCREEN_PAGES = ["/Messages"];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Live sponsor rotator — only approved + active sponsors
  const { data: liveSponsors = [] } = useQuery({
    queryKey: ["layout-sponsors"],
    queryFn: () => base44.entities.Sponsor.filter({ approval_status: "approved", is_active: true }),
    staleTime: 60_000,
  });

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
    <div
      className="flex overflow-hidden bg-background safe-area-left safe-area-right"
      style={{ height: "100dvh", maxHeight: "100dvh" }}
    >
      {/* Sidebar — desktop always visible, mobile as overlay */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TopBar onMenuToggle={() => setSidebarOpen(true)} title={title} />
        {/* Main content area — fills remaining height between TopBar and BottomTabBar */}
        <main
          className="flex-1 min-h-0 overflow-hidden flex flex-col"
          style={{ transform: "translateZ(0)" }}
        >
          <PageTransition>
            {isFullscreen ? (
              /* Full-height pages (e.g. Messages) manage their own internal scroll and safe-area insets */
              /* On mobile, reserve space for the fixed BottomTabBar (56px) + safe area */
              <div
                className="h-full overflow-hidden flex flex-col"
                style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
              >
                <Outlet />
              </div>
            ) : (
              /* Normal pages: ONE scrollable container — no nested overflow on children */
              <div
                className="overflow-y-auto overflow-x-hidden h-full"
                style={{
                  overscrollBehavior: "contain",
                  WebkitOverflowScrolling: "touch",
                  paddingBottom: "calc(56px + env(safe-area-inset-bottom, 16px))",
                }}
                id="main-scroll-container"
              >
                {liveSponsors.length > 0 && (
                  <div className="px-3 pt-3 pb-1">
                    <SponsorTicker />
                  </div>
                )}
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