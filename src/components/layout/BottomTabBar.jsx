import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Calendar, MessageSquare, UserCircle,
  Trophy, Users, Menu, Image
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

function useUnreadMessageCount(user) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user?.email) return;
    const check = async () => {
      try {
        const isParent = user.role === "parent" || user.role === "user";

        // For parents, compute the set of channel IDs they're allowed to see
        let allowedChannelIds = null;
        if (isParent) {
          allowedChannelIds = new Set();
          // Get teams via guardian links
          const guardians = await base44.entities.PlayerGuardian.filter({ user_email: user.email });
          const playerIds = guardians.map(g => g.player_id).filter(Boolean);
          const myTeamIds = new Set();
          if (playerIds.length > 0) {
            const players = await Promise.all(playerIds.map(pid => base44.entities.Player.filter({ id: pid })));
            players.flat().forEach(p => { if (p.team_id) myTeamIds.add(p.team_id); });
          }
          // Team channels
          myTeamIds.forEach(tid => allowedChannelIds.add(tid));
          // Rooms the parent has access to
          const rooms = await base44.entities.MessageRoom.filter({ is_active: true });
          rooms.forEach(room => {
            if (room.allowed_team_ids) {
              try {
                const tids = JSON.parse(room.allowed_team_ids);
                if (tids.some(tid => myTeamIds.has(tid))) { allowedChannelIds.add(room.id); return; }
              } catch {}
            }
            if (room.allowed_emails) {
              try { if (JSON.parse(room.allowed_emails).includes(user.email)) { allowedChannelIds.add(room.id); return; } } catch {}
            }
          });
        }

        const msgs = await base44.entities.Message.list("-created_date", 100);
        const count = msgs.filter(m => {
          if (m.sender_email === user.email) return false;
          if (allowedChannelIds && !allowedChannelIds.has(m.channel_id)) return false;
          const lastRead = parseInt(localStorage.getItem(`msg_read_${m.channel_id}`) || "0", 10);
          return new Date(m.created_date).getTime() > lastRead;
        }).length;
        setUnread(count);
      } catch {}
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [user?.email, user?.role]);
  return unread;
}

// Tab root paths — used to identify which tab is active
const staffTabs = [
  { root: "/Portal",   label: "Home",     icon: LayoutDashboard },
  { root: "/Schedule", label: "Schedule", icon: Calendar },
  { root: "/Messages", label: "Messages", icon: MessageSquare },
  { root: "/Teams",    label: "Teams",    icon: Users },
  { root: null,        label: "More",     icon: Menu, isSidebar: true },
];

const parentTabs = [
  { root: "/Portal",   label: "Home",     icon: LayoutDashboard },
  { root: "/ParentCalendar", label: "Calendar", icon: Calendar },
  { root: "/Messages", label: "Messages", icon: MessageSquare },
  { root: "/ParentPortal", label: "My Family", icon: UserCircle },
  { root: "/Sports",   label: "Sports",   icon: Trophy },
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
  const unreadMessages = useUnreadMessageCount(user);

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
        transform: "translateZ(0)",
        willChange: "transform",
        backfaceVisibility: "hidden",
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
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-muted-foreground active:bg-white/5 transition-none"
                style={{ minHeight: 56 }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          }

          return (
            <motion.button
              key={tab.root}
              onClick={() => handleTabPress(tab)}
              whileTap={{ scale: 0.88 }}
              transition={{ duration: 0.12 }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 relative ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              style={{ minHeight: 56 }}
            >
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    layoutId="tab-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full"
                    initial={{ opacity: 0, scaleX: 0.5 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    exit={{ opacity: 0, scaleX: 0.5 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>
              <motion.div animate={{ scale: isActive ? 1.1 : 1 }} transition={{ duration: 0.15 }} className="relative">
                <Icon className="w-5 h-5" />
                {tab.root === "/Messages" && unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </motion.div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}