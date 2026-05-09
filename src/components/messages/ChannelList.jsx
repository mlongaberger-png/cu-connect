import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, CheckCircle2, Lock, Globe, Star, Smile } from "lucide-react";

const ICON_OPTIONS = [
  { group: "Sports", icons: ["⚽", "🏀", "🏈", "⚾", "🥎", "🏐", "🏉", "🎾", "🏊", "🏋️", "🤸", "🏇", "⛷️", "🏌️", "🥊", "🏒", "🎿", "🏑", "🥅", "🏟️"] },
  { group: "Volunteer & Events", icons: ["🙋", "🤝", "🎽", "📋", "🧢", "🍕", "🥤", "🍉", "🍪", "🎉", "📣", "🚗", "🏕️", "🎪", "📸", "🎤", "🎯", "🗓️", "📢", "💪"] },
  { group: "General", icons: ["⭐", "🔥", "💬", "📌", "🏆", "🎖️", "👋", "🌟", "💡", "📣", "🔔", "✅", "🎁", "🛡️", "🦁", "🌊", "❤️", "🤩", "👏", "🙌"] },
];

function getLastRead(channelId) {
  try { return parseInt(localStorage.getItem(`msg_read_${channelId}`) || "0", 10); } catch { return 0; }
}

export default function ChannelList({ sports, teams, filterTeamIds, userRole, userEmail, activeChannelId, onSelectChannel }) {
  const [starredChats, setStarredChats] = useState({});
  const [userId, setUserId] = useState(null);
  const [iconPickerFor, setIconPickerFor] = useState(null); // channel id
  const queryClient = useQueryClient();
  const isAdmin = userRole === "admin" || userRole === "athletic_director";

  const updateIconMutation = useMutation({
    mutationFn: ({ type, id, icon }) => {
      if (type === "room") return base44.entities.MessageRoom.update(id, { icon });
      if (type === "sport") return base44.entities.Sport.update(id, { icon });
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["sports"] });
      setIconPickerFor(null);
    },
  });

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u) return;
      setUserId(u.id);
      base44.entities.UserChatPreference.filter({ user_id: u.id, is_starred: true }).then(prefs => {
        const map = {};
        prefs.forEach(p => { map[p.chat_id] = p.id; });
        setStarredChats(map);
      });
    }).catch(() => {});
  }, []);

  const { data: allRooms = [] } = useQuery({
    queryKey: ["message-rooms"],
    queryFn: () => base44.entities.MessageRoom.filter({ is_active: true }),
  });

  // Fetch recent messages for all channels to compute unread counts + last activity
  const { data: recentMessages = [] } = useQuery({
    queryKey: ["messages-recent-all"],
    queryFn: () => base44.entities.Message.list("-created_date", 200),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 25000,
  });

  const visibleTeams = filterTeamIds ? teams.filter(t => filterTeamIds.includes(t.id)) : teams;

  const visibleRooms = allRooms.filter(room => {
    if (!room.is_private) return true;
    if (room.allowed_roles) {
      try { if (JSON.parse(room.allowed_roles).includes(userRole)) return true; } catch { }
    }
    if (room.allowed_emails) {
      try { if (JSON.parse(room.allowed_emails).includes(userEmail)) return true; } catch { }
    }
    return userRole === "admin" || room.created_by === userEmail;
  });

  const allChannels = useMemo(() => {
    const channels = [
      { id: "org", name: "Organization", type: "org", icon: null, canEditIcon: false },
      ...sports.map(s => ({ id: s.id, name: s.name, type: "sport", icon: s.icon, canEditIcon: isAdmin })),
      ...visibleTeams.map(t => ({ id: t.id, name: t.name, type: "team", icon: null, canEditIcon: false })),
      ...visibleRooms.map(r => ({ id: r.id, name: r.name, type: "room", icon: r.icon || null, isPrivate: r.is_private, canEditIcon: isAdmin || r.created_by === userEmail })),
    ];

    // Compute unread count and last message time per channel
    return channels.map(ch => {
      const chMsgs = recentMessages.filter(m => m.channel_id === ch.id || (ch.id === "org" && m.channel === "org"));
      const lastMsgTime = chMsgs.length > 0 ? new Date(chMsgs[0].created_date).getTime() : 0;
      const lastRead = getLastRead(ch.id);
      const unread = chMsgs.filter(m => new Date(m.created_date).getTime() > lastRead && m.sender_email !== userEmail).length;
      return { ...ch, unread, lastMsgTime };
    }).sort((a, b) => {
      // Unread first, then by recency
      if (a.unread > 0 && b.unread === 0) return -1;
      if (b.unread > 0 && a.unread === 0) return 1;
      return b.lastMsgTime - a.lastMsgTime;
    });
  }, [sports, visibleTeams, visibleRooms, recentMessages, userEmail]);

  const starredIds = new Set(Object.keys(starredChats));
  const starredChannels = allChannels.filter(c => starredIds.has(c.id));
  const otherChannels = allChannels.filter(c => !starredIds.has(c.id));

  const renderChannel = (ch) => {
    const isActive = ch.id === activeChannelId;
    const showPicker = iconPickerFor === ch.id;
    return (
      <div key={ch.id} className={`relative border-b border-border/50 last:border-0 ${isActive ? "bg-primary/10" : "hover:bg-surface"} group`}>
        <button
          onClick={() => onSelectChannel(ch.type, ch.id, ch.name)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
        >
          {/* Icon — click opens picker for admins/creators */}
          <div
            onClick={ch.canEditIcon ? (e) => { e.stopPropagation(); setIconPickerFor(showPicker ? null : ch.id); } : undefined}
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${ch.unread > 0 ? "bg-primary/20" : "bg-surface"} ${ch.canEditIcon ? "cursor-pointer hover:bg-primary/30 hover:ring-1 hover:ring-primary/40" : ""}`}
            title={ch.canEditIcon ? "Change icon" : undefined}
          >
            {ch.icon
              ? <span className="text-lg leading-none">{ch.icon}</span>
              : ch.type === "room"
                ? ch.isPrivate ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Globe className="w-4 h-4 text-muted-foreground" />
                : <MessageSquare className={`w-4 h-4 ${ch.unread > 0 ? "text-primary" : "text-muted-foreground"}`} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm truncate ${ch.unread > 0 ? "font-semibold text-foreground" : isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {ch.name}
            </p>
            {ch.lastMsgTime > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRelative(ch.lastMsgTime)}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 flex items-center gap-1.5">
            {starredIds.has(ch.id) && <Star className="w-3 h-3 fill-primary text-primary opacity-60" />}
            {ch.unread > 0 ? (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {ch.unread > 99 ? "99+" : ch.unread}
              </span>
            ) : ch.id === activeChannelId ? (
              <CheckCircle2 className="w-4 h-4 text-green-500/60" />
            ) : null}
          </div>
        </button>

        {/* Inline icon picker */}
        {showPicker && ch.canEditIcon && (
          <div
            className="absolute left-2 right-2 z-50 bg-popover border border-border rounded-xl shadow-xl p-3 space-y-3 max-h-56 overflow-y-auto"
            style={{ top: "calc(100% - 4px)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-foreground">Pick an icon</p>
              <div className="flex items-center gap-2">
                {ch.icon && (
                  <button
                    onClick={() => updateIconMutation.mutate({ type: ch.type, id: ch.id, icon: "" })}
                    className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                )}
                <button onClick={() => setIconPickerFor(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
            </div>
            {ICON_OPTIONS.map(group => (
              <div key={group.group}>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{group.group}</p>
                <div className="flex flex-wrap gap-1">
                  {group.icons.map(icon => (
                    <button
                      key={icon}
                      onClick={() => updateIconMutation.mutate({ type: ch.type, id: ch.id, icon })}
                      disabled={updateIconMutation.isPending}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-primary/20 transition-colors ${ch.icon === icon ? "bg-primary/30 ring-1 ring-primary" : ""}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {starredChannels.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2 flex items-center gap-1.5">
            <Star className="w-3 h-3 fill-primary text-primary" /> Starred
          </p>
          {starredChannels.map(renderChannel)}
        </div>
      )}
      <div>
        {starredChannels.length > 0 && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2">All Channels</p>
        )}
        {otherChannels.map(renderChannel)}
      </div>
      {allChannels.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No channels available</p>
        </div>
      )}
    </div>
  );
}

function formatRelative(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}