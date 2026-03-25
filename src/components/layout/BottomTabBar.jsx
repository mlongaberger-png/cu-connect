import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Calendar, MessageSquare, UserCircle,
  Trophy, Users, Menu, Image
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const staffTabs = [
  { path: "/Portal",    label: "Home",     icon: LayoutDashboard },
  { path: "/Schedule",  label: "Schedule", icon: Calendar },
  { path: "/Messages",  label: "Messages", icon: MessageSquare },
  { path: "/Teams",     label: "Teams",    icon: Users },
  { path: null,         label: "More",     icon: Menu, isSidebar: true },
];

const parentTabs = [
  { path: "/Portal",      label: "Home",    icon: LayoutDashboard },
  { path: "/ParentPortal",label: "My Team", icon: UserCircle },
  { path: "/Messages",    label: "Messages",icon: MessageSquare },
  { path: "/Sports",      label: "Sports",  icon: Trophy },
  { path: "/Gallery",     label: "Gallery", icon: Image },
];

export default function BottomTabBar({ onOpenSidebar }) {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || "";
  const isStaff = ["admin", "athletic_director", "coach"].includes(role);
  const tabs = isStaff ? staffTabs : parentTabs;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-sidebar border-t border-sidebar-border safe-area-bottom"
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.path && location.pathname === tab.path;

          if (tab.isSidebar) {
            return (
              <button
                key="more"
                onClick={onOpenSidebar}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-muted-foreground active:text-foreground transition-colors"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
              <span className={`text-[10px] font-medium ${isActive ? "text-primary" : ""}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}