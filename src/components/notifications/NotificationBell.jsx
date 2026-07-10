import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Megaphone, Calendar, X, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";

const STORAGE_KEY = "cu_read_notification_ids";

function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch { return new Set(); }
}
function markRead(ids) {
  const existing = getReadIds();
  ids.forEach(id => existing.add(id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing]));
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(parseISO(dateStr.endsWith("Z") ? dateStr : dateStr + "Z"), { addSuffix: true });
  } catch { return ""; }
}

const SOURCE_ICONS = {
  snack_reminder: "🍎",
  game_reminder: "🏆",
  weather_alert: "🌩",
  document_reminder: "📄",
  other: "🔔",
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("system");
  const [activityNotifications, setActivityNotifications] = useState([]);
  const [readIds, setReadIds] = useState(getReadIds());
  const panelRef = useRef();
  const queryClient = useQueryClient();

  // ── System notifications from NotificationQueue ──────────
  const { data: systemNotifications = [] } = useQuery({
    queryKey: ["notif-queue", user?.email],
    queryFn: () => base44.entities.NotificationQueue.filter(
      { user_email: user.email },
      "-created_date",
      25
    ),
    enabled: !!user?.email,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // ── Activity notifications (Announcements + Events) ──────
  useEffect(() => {
    loadActivityNotifications();
  }, [user]);

  useEffect(() => {
    const handler = (e) => {
      if (open && panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const loadActivityNotifications = async () => {
    if (!user) return;
    try {
      const guardians = await base44.entities.PlayerGuardian.filter({ user_email: user.email });
      const playerIds = guardians.map(g => g.player_id).filter(Boolean);
      const allowedTeamIds = new Set();

      if (playerIds.length > 0) {
        const playerFetches = await Promise.all(
          playerIds.map(pid => base44.entities.Player.filter({ id: pid }))
        );
        playerFetches.flat().forEach(p => { if (p.team_id) allowedTeamIds.add(p.team_id); });
      }

      const isStaff = user.role === "admin" || user.role === "coach" || user.role === "athletic_director";

      const [announcements, events] = await Promise.all([
        base44.entities.Announcement.list("-created_date", 30),
        base44.entities.Event.list("-date", 20),
      ]);

      const now = new Date();
      const filteredAnnouncements = isStaff
        ? announcements
        : announcements.filter(a => a.target === "org" || (a.target === "team" && allowedTeamIds.has(a.target_id)));
      const filteredEvents = isStaff
        ? events
        : events.filter(e => !e.team_id || allowedTeamIds.has(e.team_id));

      const items = [
        ...filteredAnnouncements.slice(0, 10).map(a => ({
          id: `ann-${a.id}`,
          type: "announcement",
          title: a.title,
          body: a.content?.slice(0, 80) + (a.content?.length > 80 ? "…" : ""),
          date: a.created_date,
          link: "/Portal",
        })),
        ...filteredEvents.filter(e => new Date(e.date) >= now).slice(0, 5).map(e => ({
          id: `evt-${e.id}`,
          type: "event",
          title: e.title,
          body: `${e.type} · ${e.date}${e.start_time ? " · " + e.start_time : ""}`,
          date: e.created_date || e.date,
          link: "/Schedule",
        })),
      ];
      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      const sliced = items.slice(0, 15);
      setActivityNotifications(sliced);

      // First-time seed: start activity badge at 0
      if (localStorage.getItem(STORAGE_KEY) === null) {
        markRead(sliced.map(n => n.id));
        setReadIds(getReadIds());
      }
    } catch { /* silent */ }
  };

  // ── Unread counts ────────────────────────────────────────
  const systemUnread = systemNotifications.filter(n => !n.read_at).length;
  const activityUnread = activityNotifications.filter(n => !readIds.has(n.id)).length;
  const totalUnread = systemUnread + activityUnread;
  const badgeText = totalUnread > 99 ? "99+" : String(totalUnread);

  // ── Mark-read handlers ───────────────────────────────────
  const markOneRead = async (notif) => {
    // Optimistic update
    const prev = systemNotifications;
    const optimistic = systemNotifications.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n);
    queryClient.setQueryData(["notif-queue", user?.email], optimistic);
    try {
      await base44.entities.NotificationQueue.update(notif.id, { read_at: new Date().toISOString() });
    } catch {
      // Revert on failure
      queryClient.setQueryData(["notif-queue", user?.email], prev);
    }
  };

  const markAllSystemRead = async () => {
    const unread = systemNotifications.filter(n => !n.read_at);
    if (unread.length === 0) return;
    const prev = systemNotifications;
    const nowIso = new Date().toISOString();
    const optimistic = systemNotifications.map(n => !n.read_at ? { ...n, read_at: nowIso } : n);
    queryClient.setQueryData(["notif-queue", user?.email], optimistic);
    try {
      await Promise.all(
        unread.map(n => base44.entities.NotificationQueue.update(n.id, { read_at: nowIso }))
      );
    } catch {
      queryClient.setQueryData(["notif-queue", user?.email], prev);
    }
  };

  const markActivityRead = (ids) => {
    markRead(ids);
    setReadIds(getReadIds());
  };

  const handleOpen = () => {
    setOpen(o => !o);
  };

  const handleActivityClick = (id) => {
    markActivityRead([id]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
      >
        <Bell className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("system")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === "system" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Bell className="w-3.5 h-3.5" /> System
              {systemUnread > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-500 text-white font-bold leading-none flex items-center">{systemUnread > 99 ? "99+" : systemUnread}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === "activity" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Megaphone className="w-3.5 h-3.5" /> Activity
              {activityUnread > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-500 text-white font-bold leading-none flex items-center">{activityUnread > 99 ? "99+" : activityUnread}</span>
              )}
            </button>
          </div>

          {/* Header row */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground">
              {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
            </span>
            <div className="flex items-center gap-1">
              {activeTab === "system" && systemUnread > 0 && (
                <button onClick={markAllSystemRead} className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-surface transition-colors flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              {activeTab === "activity" && activityUnread > 0 && (
                <button onClick={() => markActivityRead(activityNotifications.map(n => n.id))} className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-surface transition-colors flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className="max-h-[400px] overflow-y-auto">
            {activeTab === "system" ? (
              systemNotifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">No system notifications</p>
                </div>
              ) : (
                systemNotifications.map(n => {
                  const isUnread = !n.read_at;
                  const icon = SOURCE_ICONS[n.source] || SOURCE_ICONS.other;
                  return (
                    <div
                      key={n.id}
                      onClick={() => markOneRead(n)}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-surface transition-colors cursor-pointer border-b border-border/50 last:border-0 ${isUnread ? "bg-primary/5 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"}`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-tight line-clamp-1 ${isUnread ? "font-semibold text-foreground" : "text-foreground"}`}>{n.title}</p>
                          <span className="text-xs text-muted-foreground flex-sh-0">{relativeTime(n.created_date)}</span>
                        </div>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              activityNotifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                </div>
              ) : (
                activityNotifications.map(n => {
                  const isUnread = !readIds.has(n.id);
                  return (
                    <Link
                      key={n.id}
                      to={n.link}
                      onClick={() => handleActivityClick(n.id)}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-surface transition-colors border-b border-border/50 last:border-0 ${isUnread ? "bg-primary/5 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${n.type === "announcement" ? "bg-yellow-500/20" : "bg-blue-500/20"}`}>
                        {n.type === "announcement"
                          ? <Megaphone className="w-3.5 h-3.5 text-yellow-400" />
                          : <Calendar className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-!2">
                          <p className={`text-sm leading-tight line-clamp-1 ${isUnread ? "font-semibold text-foreground" : "text-foreground"}`}>{n.title}</p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{relativeTime(n.date)}</span>
                        </div>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      </div>
                      {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />}
                    </Link>
                  );
                })
              )
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-muted/30">
            <Link to="/NotificationSettings" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">
              Notification preferences →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}