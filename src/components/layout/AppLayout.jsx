import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import OfflineIndicator from "./OfflineIndicator";
import BottomTabBar from "./BottomTabBar";
import PageTransition from "./PageTransition";
import SponsorTicker from "@/components/sponsors/SponsorTicker";
import IOSInstallBanner from "@/components/notifications/IOSInstallBanner";
import MessageNotifier from "@/components/notifications/MessageNotifier";
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
    "/UniformInventory": "Uniform Inventory",
  };

  const title = pageTitles[location.pathname] || "Cornerstone United Athletics";
  const isFullscreen = FULLSCREEN_PAGES.some(p => location.pathname.startsWith(p));

  // Defensive mitigation for a real, reproduced-live bug (2026-09-08): after using the
  // Messages Thread reply Textarea (ThreadSidebar.jsx) and backing out, the whole app shell
  // was left shifted horizontally -- header text clipped, BottomTabBar pushed off-screen --
  // and it never self-corrected, even across further navigation. Root cause is almost
  // certainly the iOS WKWebView keyboard-resize path: this app had no @capacitor/keyboard
  // config at all, so WKWebView's default 'native' resize (which shifts the WebView's own
  // content area via contentInset) was fighting with this app's own 100dvh/safe-area layout
  // every time the keyboard showed or hid. The real fix is capacitor.config.ts's new
  // `plugins.Keyboard.resize: 'none'`, but that needs a native rebuild to take effect. This
  // is a same-day safety net that works immediately, before that rebuild ships: whenever the
  // visual viewport resizes (keyboard show/hide is the dominant cause on a phone, but a safe
  // no-op otherwise) or an input blurs, force the window/root scroll position back to (0,0)
  // on the next frame -- undoing exactly the kind of stuck offset that was observed, without
  // touching anything about the normal vertical scroll containers elsewhere in the app.
  useEffect(() => {
    const resetScroll = () => {
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollLeft = 0;
        document.body.scrollLeft = 0;
      });
    };
    const vv = window.visualViewport;
    vv?.addEventListener("resize", resetScroll);
    window.addEventListener("focusout", resetScroll);
    return () => {
      vv?.removeEventListener("resize", resetScroll);
      window.removeEventListener("focusout", resetScroll);
    };
  }, []);

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
      <IOSInstallBanner />
      <MessageNotifier />
    </div>
  );
}