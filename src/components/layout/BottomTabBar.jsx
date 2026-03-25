import React, { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Calendar, MessageSquare, UserCircle,
  Trophy, Users, Menu, Image
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

// Tab root paths — used to identify which tab is active
const staffTabs = [
  { root: "/Portal",   label: "Home",     icon: LayoutDashboard },
  { root: "/Schedule", label: "Schedule", icon: Calendar },
  { root: "/Messages", label: "Messages", icon: MessageSquare },
  { root: "/Teams",    label: "Teams",    icon: Users },
  { root: null,        label: "More",     icon: Menu, isSidebar: true },
];

const parentTabs = [
  { root: "/Portal",       label: "Home",    icon: LayoutDashboard },
  { root: "/ParentPortal", label: "My Team", icon: UserCircle },
  { root: "/Messages",     label: "Messages",icon: MessageSquare },
  { root: "/Sports",       label: "Sports",  icon: Trophy },
  { root: "/Gallery",      label: "Gallery", icon: Image },
];

const STORAGE_KEY = "tab_last_path";

function getTabMemory() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function setTabMemory(root, path) {
  const mem = getTabMemory();
  mem[root] = path;
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mem)); } catch {}
}

export default function BottomTabBar({ onOpenSidebar }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || "";
  const isStaff = ["admin", "athletic_director", "coach"].includes(role);
  const tabs = isStaff ? staffTabs : parentTabs;

  // Remember current path for the active tab whenever location changes
  const activeTab = tabs.find(t => t.root && location.pathname.startsWith(t.root));
  if (activeTab?.root) setTabMemory(activeTab.root, location.pathname + location.search);

  const handleTabPress = useCallback((tab) => {
    const mem = getTabMemory();
    const dest = mem[tab.root] || tab.root;
    // If already on this tab, navigate to root (reset stack)
    if (location.pathname.startsWith(tab.root)) {
      navigate(tab.root, { replace: true });
    } else {
      navigate(dest);
    }
  }, [location.pathname, navigate]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-sidebar border-t border-sidebar-border"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.root && location.pathname.startsWith(tab.root);

          if (tab.isSidebar) {
            return (
              <button
                key="more"
                onClick={onOpenSidebar}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-muted-foreground active:text-foreground transition-colors"
                style={{ minHeight: 56 }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.root}
              onClick={() => handleTabPress(tab)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors relative ${
                isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
              }`}
              style={{ minHeight: 56 }}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}