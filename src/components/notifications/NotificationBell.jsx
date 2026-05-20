import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Bell, Megaphone, Calendar, X, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { format, isToday, isYesterday, parseISO } from "date-fns";

const STORAGE_KEY = "cu_read_notification_ids";

function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch { return new Set(); }
}
function markRead(ids) {
  const existing = getReadIds();
  ids.forEach(id => existing.add(id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing]));
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMM d");
  } catch { return ""; }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(getReadIds());
  const panelRef = useRef();

  useEffect(() => {
    loadNotifications();
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

  const loadNotifications = async () => {
    if (!user) return;
    try {
      // 1. Determine which teams this user's athletes belong to
      const guardians = await base44.entities.PlayerGuardian.filter({ user_email: user.email });
      const playerIds = guardians.map(g => g.player_id).filter(Boolean);

      let allowedTeamIds = new Set();
      let allowedSportIds = new Set();

      if (playerIds.length > 0) {
        // Fetch all players for this user's guardianships to get team IDs
        const playerFetches = await Promise.all(
          playerIds.map(pid => base44.entities.Player.filter({ id: pid }))
        );
        playerFetches.flat().forEach(p => {
          if (p.team_id) allowedTeamIds.add(p.team_id);
        });
      }

      const isStaff = user.role === "admin" || user.role === "coach" || user.role === "athletic_director";

      const [announcements, events] = await Promise.all([
        base44.entities.Announcement.list("-created_date", 30),
        base44.entities.Event.list("-date", 20),
      ]);

      const now = new Date();

      // Filter announcements: show org-wide ones always, team/sport ones only if relevant
      const filteredAnnouncements = isStaff
        ? announcements
        : announcements.filter(a => {
            if (a.target === "org") return true;
            if (a.target === "team") return allowedTeamIds.has(a.target_id);
            if (a.target === "sport") return allowedSportIds.has(a.target_id);
            return false;
          });

      // Filter events: only show events for allowed teams (or all for staff)
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
          priority: a.priority,
          link: "/Portal",
        })),
        ...filteredEvents
          .filter(e => new Date(e.date) >= now)
          .slice(0, 5)
          .map(e => ({
            id: `evt-${e.id}`,
            type: "event",
            title: e.title,
            body: `${e.type} · ${format(parseISO(e.date), "MMM d")}${e.start_time ? " · " + e.start_time : ""}`,
            date: e.created_date || e.date,
            link: "/Schedule",
          })),
      ];

      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      const sliced = items.slice(0, 15);
      setNotifications(sliced);

      // First-time seed: if the user has never interacted with the bell,
      // mark everything currently visible as read so the badge starts at 0.
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) {
        markRead(sliced.map(n => n.id));
        setReadIds(getReadIds());
      }
    } catch { /* silent */ }
  };

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) {
      // mark all visible as read when opening
      const ids = notifications.map(n => n.id);
      markRead(ids);
      setReadIds(getReadIds());
    }
  };

  const markAllRead = () => {
    markRead(notifications.map(n => n.id));
    setReadIds(getReadIds());
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" /> Notifications
              {unreadCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary/20 text-primary font-medium">{unreadCount} new</span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-surface transition-colors flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5" /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const isUnread = !readIds.has(n.id);
                return (
                  <Link
                    key={n.id}
                    to={n.link}
                    onClick={() => { markRead([n.id]); setReadIds(getReadIds()); setOpen(false); }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-surface transition-colors border-b border-border/50 last:border-0 ${isUnread ? "bg-primary/5" : ""}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${n.type === "announcement" ? "bg-yellow-500/20" : "bg-blue-500/20"}`}>
                      {n.type === "announcement"
                        ? <Megaphone className="w-3.5 h-3.5 text-yellow-400" />
                        : <Calendar className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight line-clamp-1 ${isUnread ? "font-semibold text-foreground" : "text-foreground"}`}>{n.title}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(n.date)}</span>
                      </div>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    </div>
                    {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />}
                  </Link>
                );
              })
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